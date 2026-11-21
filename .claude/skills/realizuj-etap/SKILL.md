---
name: realizuj-etap
description: Kontrolowana realizacja JEDNEGO zatwierdzonego etapu Centrum Projektowego (adapter Claude Code do procedury z .agents/skills/realizuj-etap). Użyj dopiero po zatwierdzeniu planu; implementacja przez subagenta, potem niezależna kontrola.
when_to_use: Przykłady — "realizuj etap X", "wykonaj zatwierdzony plan". Nie dla samego planowania.
argument-hint: "[identyfikator etapu lub plan]"
disable-model-invocation: true
---

# Realizacja etapu (Claude Code)

Procedura merytoryczna ma **jedno źródło**: [.agents/skills/realizuj-etap/SKILL.md](../../../.agents/skills/realizuj-etap/SKILL.md) oraz [PROCEDURY.md](../../../docs/automatyzacja/PROCEDURY.md). Przeczytaj je i stosuj; poniżej tylko trasowanie specyficzne dla Claude Code.

Etap: $ARGUMENTS

1. **Bramka zakresu:** upewnij się, że istnieje zatwierdzony plan z SHA bazowym i listą dozwolonych plików. Brak zatwierdzenia → zatrzymaj się i wróć do `/plan-etapu`. Opis A1–A9 ani dostępność skilla nie uruchamiają kolejnego etapu.
2. Sprawdź `git status --short --branch`; pracuj na gałęzi roboczej, nie na `main`. Cudzych zmian nie ruszaj.
3. Deleguj implementację do `focused-implementer` (zakres + lista plików + kryteria). Jedno zadanie naraz.
4. Po implementacji deleguj do `qa-regression` (niezależnie od wykonawcy). Dla zmian dotykających danych, CI, uprawnień lub integracji dodaj `security-privacy-reviewer`.
5. **FAIL/BLOCKED → STOP:** nie kontynuuj do następnego etapu; zastosuj `/diagnostyka-bledow` i przedstaw diagnozę oraz propozycję. Kolejna próba tylko za zgodą.
6. Zamknij raportem wg [formatu z PROCEDURY.md](../../../docs/automatyzacja/PROCEDURY.md#format-raportu-etapu) i zaktualizuj punkt wznowienia (`/pakiet-kontekstu`). `commit`/`push`/`merge` wyłącznie na wyraźne polecenie użytkownika.
