#!/usr/bin/env node
// Strażnik poleceń Bash dla Claude Code (hook PreToolUse).
// Czyta JSON ze stdin (tool_input.command) i zwraca decyzję:
//   exit 0, brak wyjścia   -> brak sprzeciwu, działa zwykły system uprawnień
//   exit 0 + JSON "ask"    -> wymaga jawnej zgody użytkownika
//   exit 2 + stderr        -> twarda blokada
// Tryby (argument): "ogolny" (domyślny, zakazy projektu) oraz "odczyt"
// (lista dozwolonych poleceń dla agentów tylko do odczytu).
// To dodatkowa warstwa, nie jedyne zabezpieczenie: dopełnia `tools` agentów
// i `permissions` w settings.json. Bez zależności, wyłącznie Node.

import { fileURLToPath } from 'node:url'

const TWARDE_ZAKAZY = [
  [/\bgit\b.*\bpush\b.*(--force|--force-with-lease|\s-f\b|\s\+\S)/, 'push z wymuszeniem'],
  [/\bgit\b.*\breset\b.*--hard/, 'git reset --hard'],
  [/\bgit\b.*\bclean\b/, 'git clean'],
  [/\bgit\b.*\bbranch\b.*(\s-D\b|--delete\s+--force|\s-d\b|--delete)/, 'usuwanie gałęzi'],
  [/\bgit\b.*\bcheckout\b.*(\s-f\b|--force|\s--\s|\s\.(\s|$))/, 'git checkout nadpisujący pliki'],
  [/\bgit\b.*\bswitch\b.*(\s-f\b|--force|--discard-changes)/, 'git switch nadpisujący zmiany'],
  [/\bgit\b.*\breset\b.*--(merge|keep)\b/, 'git reset --merge/--keep'],
  [/\bgit\b.*\bpush\b.*(--delete|\s:\S)/, 'usuwanie zdalnej gałęzi'],
  [/\bgit\b.*\bstash\b.*\b(drop|clear)\b/, 'git stash drop/clear'],
  [/\bnpm(\.cmd)?\b.*\baudit\b.*\bfix\b/, 'npm audit fix'],
  [/\brm\b.*(\s-\w*[rf]\w*\b|--recursive|--force)/, 'rm -r/-f'],
  [/\bremove-item\b.*-recurse/i, 'Remove-Item -Recurse'],
  // Dowolne polecenie wskazujące plik .env (z wyjątkiem .env.example), także git show HEAD:.env, grep, rg.
  [/(^|[\s/:='"])\.env(?!\.example\b)(\.[\w.-]+)?(?=$|[\s'"|;&)])/i, 'dostęp do pliku .env'],
  [/\b(curl|wget|iwr|invoke-webrequest)\b.*\|\s*(sh|bash|iex|node|python)/i, 'pobranie i wykonanie kodu'],
]

const WYMAGAJA_ZGODY = [
  [/\bgit\b.*\bpush\b/, 'git push'],
  [/\bgit\b.*\bmerge\b/, 'git merge'],
  [/\bgit\b.*\brebase\b/, 'git rebase'],
  [/\bgit\b.*\bcommit\b/, 'git commit'],
  [/\bgit\b.*\brestore\b(?!.*--staged)/, 'git restore (nadpisuje pliki)'],
  [/\bnpm(\.cmd)?\s+(install|i|add|update|up|uninstall|remove|rm)\b/, 'zmiana zależności npm'],
  [/\bnpx(\.cmd)?\b/, 'npx (pobiera i uruchamia kod)'],
  [/\bgh\s+pr\s+(merge|create|close|edit|comment)\b/, 'gh pr (zapis)'],
  [/\bgh\s+(workflow\s+run|release\s+create|issue\s+(create|close|edit|comment))\b/, 'gh (zapis)'],
  [/\bgh\s+api\b.*(-X|--method)\s*(POST|PUT|PATCH|DELETE)\b/i, 'gh api (zapis)'],
  [/\bgh\s+api\b.*(\s-f\b|\s-F\b|--field|--raw-field|--input)/, 'gh api z danymi (zapis)'],
]

// Dozwolone segmenty poleceń w trybie "odczyt" (każdy segment osobno).
const DOZWOLONE_ODCZYT = [
  /^git (-C \S+ )?(status|log|diff|show|rev-parse|rev-list|ls-files|ls-tree|merge-base|blame|shortlog|describe|cat-file|diff-tree|for-each-ref)\b/,
  /^git (-C \S+ )?fetch( origin)?$/,
  /^git (-C \S+ )?branch( (-a|-r|-v|-vv|--list|--show-current|--all|--remotes|--verbose))*$/,
  /^git (-C \S+ )?(remote( -v)?|tag( -l| --list)?|stash list|worktree list|config --get \S+)$/,
  /^(ls|dir|pwd|head|tail|wc|grep|rg|sort|uniq|cat|file|stat|du|which|where)\b/,
  /^find\b(?!.*(-delete|-exec|-execdir|-fprint|-fls|-ok))/,
  /^(node|npm|npm\.cmd|git|gh) (-v|--version)$/,
  /^npm(\.cmd)? (ls|list)\b/,
  /^gh (pr|issue|run|repo|release|workflow) (view|list|diff|checks|status)\b/,
  /^gh api\b(?!.*(-X|--method|\s-f\b|\s-F\b|--field|--raw-field|--input))/,
]

function normalizuj(polecenie) {
  return polecenie
    .replace(/2>&1/g, ' ')
    .replace(/&>\s*\/dev\/null/g, ' ')
    .replace(/\d?>\s*\/dev\/null/g, ' ')
    .replace(/2>\s*\$null/gi, ' ')
}

export function ocenPolecenie(polecenie, tryb = 'ogolny') {
  const tekst = String(polecenie ?? '')
  for (const [wzor, nazwa] of TWARDE_ZAKAZY) {
    if (wzor.test(tekst)) return { decyzja: 'blokada', powod: `Zablokowano: ${nazwa} (zakaz projektu, AGENTS.md).` }
  }
  if (tryb === 'odczyt') {
    const oczyszczone = normalizuj(tekst)
    if (/\$|`|<\(|>|\r|--output\b|--pre\b|--compress-program|--no-index|--ext-diff|--textconv|--upload-pack|--exec\b|\bsort\b.*\s-\w*o\b/.test(oczyszczone)) {
      return { decyzja: 'blokada', powod: 'Agent tylko do odczytu: przekierowania, zmienne, podstawienia poleceń oraz opcje zapisu/wykonania (--output, --pre, sort -o itp.) są zabronione.' }
    }
    const segmenty = oczyszczone.split(/&&|\|\||;|\||\n/).map((s) => s.trim()).filter(Boolean)
    for (const segment of segmenty) {
      if (/&/.test(segment)) {
        return { decyzja: 'blokada', powod: 'Agent tylko do odczytu: pojedynczy & (praca w tle) jest zabroniony.' }
      }
      if (!DOZWOLONE_ODCZYT.some((wzor) => wzor.test(segment))) {
        return { decyzja: 'blokada', powod: `Agent tylko do odczytu: polecenie spoza listy dozwolonych: "${segment.slice(0, 80)}". Zwróć BLOCKED i opisz, czego brakuje.` }
      }
    }
    return { decyzja: 'brak' }
  }
  for (const [wzor, nazwa] of WYMAGAJA_ZGODY) {
    if (wzor.test(tekst)) return { decyzja: 'zgoda', powod: `Wymaga jawnej zgody użytkownika: ${nazwa}.` }
  }
  return { decyzja: 'brak' }
}

async function czytajStdin() {
  const kawalki = []
  for await (const kawalek of process.stdin) kawalki.push(kawalek)
  return Buffer.concat(kawalki).toString('utf8')
}

async function main() {
  const tryb = process.argv[2] === 'odczyt' ? 'odczyt' : 'ogolny'
  let wejscie
  try {
    wejscie = JSON.parse(await czytajStdin())
  } catch {
    // Brak poprawnego wejścia: tryb odczytu zawodzi bezpiecznie, ogólny nie przeszkadza.
    if (tryb === 'odczyt') { console.error('Strażnik: nieczytelne wejście hooka.'); process.exit(2) }
    process.exit(0)
  }
  let wynik
  try {
    wynik = ocenPolecenie(wejscie?.tool_input?.command, tryb)
  } catch (blad) {
    // Awaria oceny: tryb odczytu zawodzi bezpiecznie (kod 2), ogólny nie przeszkadza.
    if (tryb === 'odczyt') { console.error(`Strażnik: błąd oceny polecenia (${blad?.message ?? blad}).`); process.exit(2) }
    process.exit(0)
  }
  if (wynik.decyzja === 'blokada') { console.error(wynik.powod); process.exit(2) }
  if (wynik.decyzja === 'zgoda') {
    console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: wynik.powod } }))
  }
  process.exit(0)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main()
