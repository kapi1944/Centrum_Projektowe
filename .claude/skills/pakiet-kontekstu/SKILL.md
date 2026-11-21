---
name: pakiet-kontekstu
description: Tworzy zwięzły pakiet kontekstowy lub aktualizuje punkt wznowienia (docs/agents/PUNKT_WZNOWIENIA.md) dla kolejnej sesji — stan, SHA, decyzje, otwarte pytania, następny krok, niewiadome, z źródłami i datą. Użyj na koniec etapu lub przed przerwaniem pracy.
when_to_use: Przykłady — "zapisz punkt wznowienia", "przygotuj kontekst na następną sesję", "podsumuj gdzie jesteśmy".
argument-hint: "[odbiorca i maks. rozmiar, np. 'następna sesja, 40 linii']"
---

# Pakiet kontekstu

Odbiorca/budżet: $ARGUMENTS (domyślnie: następna sesja, maks. ~40 linii).

1. Zbierz **tylko** fakty z bieżącej sesji i repo: `git status --short --branch`, `git rev-parse HEAD`, ostatnie wyniki kontroli (z komendą i SHA), decyzje użytkownika (cytuj zgodę dosłownie), otwarte pytania.
2. Zapisz do [docs/agents/PUNKT_WZNOWIENIA.md](../../../docs/agents/PUNKT_WZNOWIENIA.md) w stałych sekcjach: `Data i SHA`, `Gdzie jesteśmy`, `Zweryfikowane (z dowodem)`, `Niezweryfikowane`, `Decyzje użytkownika`, `Otwarte pytania`, `Następny krok (propozycja)`. Nadpisuj poprzedni punkt — to jedna aktualna wersja, nie dziennik (historię ma Git).
3. Rozróżniaj: fakt sprawdzony · deklaracja z dokumentu · przypuszczenie. Nie zapisuj sekretów, danych prywatnych ani surowych logów — repo jest publiczne.
4. Nie wykonuj `commit` automatycznie; wskaż zmieniony plik użytkownikowi.
