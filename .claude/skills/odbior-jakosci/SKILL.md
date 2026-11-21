---
name: odbior-jakosci
description: Niezależny odbiór jakości zmiany — rzeczywiście uruchomione kontrole (lint, typecheck, testy, build, regresja wg zakresu) i raport PASS/FAIL/BLOCKED z dowodami oraz stanem Git. Adapter Claude Code do procedur z .agents/skills/testy-regresyjne i raport-etapu. Użyj po implementacji lub przed oddaniem.
when_to_use: Przykłady — "odbierz zmianę", "sprawdź czy nic nie zepsuliśmy", "raport z etapu", "czy to jest gotowe".
argument-hint: "[zakres: SHA, zakres commitów lub ścieżki]"
---

# Odbiór jakości (Claude Code)

Źródła procedur (jedyne): [testy-regresyjne](../../../.agents/skills/testy-regresyjne/SKILL.md), [raport-etapu](../../../.agents/skills/raport-etapu/SKILL.md), [PROCEDURY.md](../../../docs/automatyzacja/PROCEDURY.md). Nie twórz własnego szablonu raportu.

Zakres: $ARGUMENTS (brak → bieżąca różnica robocza względem `origin/main`).

1. Deleguj kontrole do `qa-regression` (osobny kontekst, tylko wyniki wracają). Jeśli zmiana dotyka danych, CI, uprawnień agentów lub integracji — równolegle `security-privacy-reviewer`.
2. Zweryfikuj w raporcie: PASS dotyczy **dokładnie tego SHA/stanu**, anulowanie i pominięcie nie są PASS, wynik historyczny nie jest bieżącym, a CI lokalne ≠ CI zdalne ≠ wdrożenie.
3. Wynik w formacie z PROCEDURY.md (tabela kontroli, pliki, ryzyka, stan Git). Odbiór UI/storage w prawdziwej przeglądarce i na syntetycznych danych to osobny dowód — jeśli go nie było, wpisz ograniczenie.
4. Kolejny krok to propozycja. Nie wykonuj `commit`/`push`/`merge` bez wyraźnego polecenia.
