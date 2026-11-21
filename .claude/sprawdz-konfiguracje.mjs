#!/usr/bin/env node
// Statyczna kontrola konfiguracji Claude Code: agenci, skille, settings.json, odnośniki.
// Uruchom z katalogu głównego: node .claude/sprawdz-konfiguracje.mjs
// Kod wyjścia 1 przy jakimkolwiek błędzie. Nie zastępuje próby w żywej sesji.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'

const korzen = resolve(import.meta.dirname, '..')
const bledy = []
const blad = (plik, tekst) => bledy.push(`${plik}: ${tekst}`)

function frontmatter(sciezka) {
  const tekst = readFileSync(sciezka, 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n')
  const m = tekst.match(/^---\n([\s\S]*?)\n---\n/)
  if (!m) return { tekst, pola: null }
  const pola = {}
  let klucz = null
  for (const linia of m[1].split('\n')) {
    const k = linia.match(/^([A-Za-z_-]+):\s*(.*)$/)
    if (k) { klucz = k[1]; pola[klucz] = k[2].trim() }
  }
  return { tekst, pola, surowy: m[1] }
}

const NAZWA = /^[a-z0-9]+(-[a-z0-9]+)*$/
const ZNANE_NARZEDZIA = new Set(['Read', 'Glob', 'Grep', 'Bash', 'Edit', 'Write', 'PowerShell', 'WebFetch', 'WebSearch', 'NotebookEdit'])
const ZAPISUJACE = new Set(['Edit', 'Write', 'NotebookEdit', 'PowerShell'])

function sprawdzOdnosniki(plik, tekst) {
  for (const m of tekst.matchAll(/\]\(((?!https?:|#|mailto:)[^)\s]+)\)/g)) {
    const cel = m[1].split('#')[0]
    if (cel && !existsSync(resolve(dirname(plik), cel))) blad(plik, `martwy odnośnik: ${m[1]}`)
  }
}

// Agenci
const katAgentow = join(korzen, '.claude/agents')
for (const plik of existsSync(katAgentow) ? readdirSync(katAgentow).filter((n) => n.endsWith('.md')) : []) {
  const sciezka = join(katAgentow, plik)
  const { tekst, pola, surowy } = frontmatter(sciezka)
  if (!pola) { blad(plik, 'brak frontmatter'); continue }
  const nazwa = plik.replace(/\.md$/, '')
  if (pola.name !== nazwa) blad(plik, `name "${pola.name}" ≠ nazwa pliku "${nazwa}"`)
  if (!NAZWA.test(pola.name ?? '')) blad(plik, 'niepoprawny format name')
  if (!pola.description || pola.description.length < 40) blad(plik, 'description puste lub zbyt krótkie')
  const narzedzia = (pola.tools ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  if (!narzedzia.length) blad(plik, 'brak jawnej listy tools (agent odziedziczyłby wszystkie narzędzia)')
  for (const n of narzedzia) if (!ZNANE_NARZEDZIA.has(n)) blad(plik, `nieznane narzędzie: ${n}`)
  if (!pola.maxTurns) blad(plik, 'brak maxTurns (warunek zatrzymania)')
  const zapisujacy = narzedzia.some((n) => ZAPISUJACE.has(n))
  if (/Zatrzymaj się/.test(tekst) === false) blad(plik, 'brak sekcji „Zatrzymaj się” (warunki stopu)')
  if (narzedzia.includes('Bash') && !/straznik-polecen\.mjs/.test(surowy)) blad(plik, 'Bash bez hooka strażnika')
  if (!zapisujacy && /tylko odczyt|tylko do odczytu/i.test(pola.description) && !/straznik-polecen\.mjs\\?"? odczyt/.test(surowy)) blad(plik, 'agent „tylko odczyt” bez trybu `odczyt` strażnika')
  sprawdzOdnosniki(sciezka, tekst)
}

// Skille
const katSkilli = join(korzen, '.claude/skills')
for (const nazwa of existsSync(katSkilli) ? readdirSync(katSkilli) : []) {
  const sciezka = join(katSkilli, nazwa, 'SKILL.md')
  if (!existsSync(sciezka)) { blad(nazwa, 'brak SKILL.md'); continue }
  const { tekst, pola } = frontmatter(sciezka)
  if (!pola) { blad(nazwa, 'brak frontmatter'); continue }
  if (pola.name !== nazwa) blad(nazwa, `name "${pola.name}" ≠ katalog`)
  if (!NAZWA.test(nazwa) || nazwa.length > 64) blad(nazwa, 'niepoprawna nazwa katalogu')
  if (!pola.description) blad(nazwa, 'brak description')
  if ((pola.description + (pola.when_to_use ?? '')).length > 1536) blad(nazwa, 'description + when_to_use > 1536 znaków')
  if (/TODO|FIXME|\.\.\.$/m.test(tekst)) blad(nazwa, 'niedokończona treść')
  sprawdzOdnosniki(sciezka, tekst)
}

// settings.json i hooki
const ustawienia = join(korzen, '.claude/settings.json')
try {
  const dane = JSON.parse(readFileSync(ustawienia, 'utf8'))
  for (const grupa of dane.hooks?.PreToolUse ?? []) for (const h of grupa.hooks ?? []) {
    const m = String(h.command).match(/\.claude\/hooks\/([\w.-]+\.mjs)/)
    if (!m || !existsSync(join(korzen, '.claude/hooks', m[1]))) blad('settings.json', `hook wskazuje brakujący plik: ${h.command}`)
  }
} catch (e) { blad('settings.json', `niepoprawny JSON: ${e.message}`) }

for (const plik of ['CLAUDE.md', 'AGENTS.md']) if (!existsSync(join(korzen, plik)) || !statSync(join(korzen, plik)).size) blad(plik, 'brak lub pusty')
if (existsSync(join(korzen, 'CLAUDE.md'))) sprawdzOdnosniki(join(korzen, 'CLAUDE.md'), readFileSync(join(korzen, 'CLAUDE.md'), 'utf8'))

if (bledy.length) { console.error(`BŁĘDY (${bledy.length}):\n- ${bledy.join('\n- ')}`); process.exit(1) }
console.log('OK: agenci, skille, settings.json i odnośniki spójne.')
