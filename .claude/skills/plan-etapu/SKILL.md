---
name: plan-etapu
description: Tworzy plan najmniejszego użytecznego etapu — zakres i dozwolone pliki, zależności, kryteria odbioru, testy, rollback, decyzje człowieka. Użyj po audycie i przed implementacją; nie pisze kodu i nie jest zgodą na wykonanie.
when_to_use: Przykłady — "zaplanuj etap", "rozpisz kolejny krok", "co zrobić najpierw, żeby było użyteczne".
argument-hint: "[cel etapu]"
---

# Plan etapu

Cel: $ARGUMENTS

1. Potrzebujesz świeżego wyniku audytu (SHA, stan). Jeśli go nie ma lub dotyczy innego SHA → najpierw `/audyt-repo`.
2. Deleguj do `implementation-planner` z celem, wynikiem audytu i ograniczeniami z AGENTS.md.
3. Zwróć użytkownikowi plan w stałym formacie (CEL, ZAKRES, KROKI, KRYTERIA ODBIORU, TESTY, ROLLBACK, DECYZJE, NIEWIADOME) w formie krótkiej tabeli plus listy decyzji.
4. **Zatrzymaj się i poproś o zatwierdzenie.** Zatwierdzenie dotyczy tego planu i tego SHA; zmiana planu lub nowego commitu bazowego unieważnia zgodę. Nie przechodź do realizacji sam.

Granice: bez edycji plików, bez zmian danych; nowe zależności, API, AI, płatne usługi i zmiany persistence — wyłącznie jako jawna decyzja człowieka.
