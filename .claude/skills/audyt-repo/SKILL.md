---
name: audyt-repo
description: Audyt repozytorium tylko do odczytu przed planowaniem — rzeczywisty stan gałęzi/HEAD względem origin, struktura, testy/CI, ryzyka danych, krótki raport faktów. Użyj na początku etapu lub sesji, gdy trzeba ustalić „co naprawdę jest”. Nie zmienia plików i nie uruchamia testów.
when_to_use: Przykłady — "sprawdź stan projektu", "zrób audyt repo", "co jest na main a co na gałęzi", "zanim zaczniemy, ustal stan".
argument-hint: "[cel audytu lub zakres]"
---

# Audyt repo

Cel audytu: $ARGUMENTS (brak → ogólny stan repo i gotowość do kolejnego etapu).

1. Deleguj do subagenta `repo-auditor` (jeden audyt na etap; nie czytaj repo samodzielnie, żeby nie dublować kontekstu). Przekaż: cel, zakres, aktywne repo.
2. Odbierz raport (`STAN / FAKTY / NIEWERYFIKOWANE / RYZYKA / PROPOZYCJE`). Sprawdź wyrywkowo 1–2 kluczowe fakty (np. HEAD vs origin/main) zanim je powtórzysz użytkownikowi.
3. Przedstaw wynik skrótowo: statusy ✅ sprawdzone · 🔵 w toku · 🟠 wymaga decyzji · 🔴 blokada · ⚪ niezweryfikowane. Propozycje to propozycje, nie zlecenia.

Granice: bez zapisów w repo, bez testów (to `/odbior-jakosci`), bez planowania (to `/plan-etapu`). Wynik historyczny z dokumentów oznaczaj datą i źródłem.
