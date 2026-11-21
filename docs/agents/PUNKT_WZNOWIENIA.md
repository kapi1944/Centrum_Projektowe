# Punkt wznowienia

Jedna aktualna wersja; nadpisuje ją skill `/pakiet-kontekstu`. Historię ma Git.

## Data i SHA
2026-11-21, gałąź `claude/agenci-i-skille-01` od `origin/main` `b9e4e24`. Commit `3ddf067` lokalny, niewypchnięty (gałąź 1 przed `origin/main`).

## Gdzie jesteśmy
Wdrożono pierwszy etap systemu agentów: `CLAUDE.md`, `.claude/settings.json`, strażnik poleceń, 5 subagentów, 6 skilli, dokumenty w `docs/agents/`.

## Zweryfikowane (z dowodem)
- Kontrole jakości Centrum na drzewie równym `main`: lint, typecheck, test (web 298), build — exit 0.
- Strażnik poleceń: `node --test .claude/hooks/straznik-polecen.test.mjs` — wynik w [EWALUACJE](EWALUACJE.md).
- UX/A0 jest już na `main` (PR #1).

## Niezweryfikowane
Zachowanie agentów w sesjach interaktywnych poza próbami w [EWALUACJE](EWALUACJE.md); działanie hooków frontmatter po zaufaniu folderowi w UI; Windows poza tym komputerem; Claude Code Cloud.

## Decyzje użytkownika
Brak zgody na `commit`, `push`, `merge` — nie udzielono.

## Otwarte pytania
Patrz „Lista decyzji dla człowieka” w [ROADMAPA](ROADMAPA_EKOSYSTEMU.md).

## Następny krok (propozycja)
Przegląd i zatwierdzenie commita; potem P3/I1 („Sprawdź stan projektu”, tylko odczyt) lub C0 dla Copilota.
