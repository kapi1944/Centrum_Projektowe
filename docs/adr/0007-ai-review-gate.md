# ADR 0007 — Bramka weryfikacji AI

## Kontekst

Obecny `AnalysisProvider` przyjmuje tekst i zwraca propozycje. Dostawca regułowy działa lokalnie; wartości `REMOTE_LLM` i `LOCAL_LLM` w modelu nie oznaczają implementacji AI. Dziś review i zastosowanie są oddzielne od wygenerowania wyniku, a potencjalna decyzja pozostaje `PROPOSED` aż do osobnego przyjęcia.

## Decyzja

AI wyłącznie proponuje. Ten sam pipeline z [ADR 0003](0003-change-proposal-pipeline.md) obowiązuje dostawcę regułowego, lokalny model i zdalny model. Dostawca nie otrzymuje możliwości zapisu domeny, synchronizacji ani wysyłki integracji. Wygenerowany tekst jest niezaufanymi danymi; instrukcje zawarte w źródle lub wyniku nie stanowią zgody użytkownika.

Wynik przechodzi walidację wersji schematu, typów i odniesień. Niepoprawny wynik oznacza błąd runu, bez częściowego zastosowania. Wynik poprawny nadal nie oznacza prawdy. Pewność modelu nie zastępuje review ani nie podnosi założenia do faktu.

Review pokazuje oryginalne źródło, dostawcę/model i znane wersje, propozycję, korektę użytkownika oraz przewidywany zakres skutków. Każdy element ma jawne rozstrzygnięcie. Odrzucenie nie usuwa źródła ani analizy. Akceptacja dotyczy konkretnej rewizji propozycji i konkretnych celów. Zmiana wyniku, celów lub treści po akceptacji wymaga ponownego review; zmiana stanu domeny wymaga ponownej walidacji rewizji przed zastosowaniem.

Zastosowanie zatwierdzonego `ChangeSet` nie jest automatycznym przyjęciem utworzonej decyzji `PROPOSED` ani zgodą na późniejszy wpływ. Osobne bramki Decisions i Execution pozostają. Nowy run, preferowany run, synchronizacja lub adapter integracji nie mogą ominąć żadnej z nich. Dostawca nie uruchamia narzędzi wykonawczych na podstawie wyniku.

Zdalna analiza wymaga jawnej zgody na wysłanie określonego źródła do określonego dostawcy. Zgoda na analizę nie oznacza zgody na zmianę projektu ani publikację. Domyślnie `PRIVATE`; wrażliwe dane są ograniczane do niezbędnego zakresu. Tokeny i sekrety nie należą do promptu, wyniku, koperty ani historii. Niedostępność AI zachowuje źródło i dotychczasowe review oraz pozwala kontynuować pracę lokalnie.

## Konsekwencje

Historia musi pozwolić wskazać: źródło → run → element propozycji → korektę i zgodę → zastosowany zestaw → encję/zdarzenie. Nie wolno przedstawiać wyniku jako zatwierdzonego lub zapisanego przed odpowiednią bramką i zakończeniem transakcji.

Przyszłe testy: wynik z instrukcją zmiany projektu nie wywołuje zapisu, brak zgody blokuje wysłanie źródła, niepoprawny schemat nie tworzy propozycji, `PENDING` i `REJECTED` nie mają skutków, nowa rewizja unieważnia zgodę, awaria dostawcy zachowuje źródło, a decyzja i wpływ nadal wymagają osobnego przyjęcia.

Ten etap nie dodaje AI, integracji, promptów produkcyjnych, konfiguracji kluczy ani nowych ekranów.

## Alternatywy odrzucone

- Automatyczne zastosowanie po przekroczeniu progu pewności: brak zgody użytkownika.
- Jedna zgoda na wszystkie przyszłe wyniki: nie wiąże zgody z konkretną zmianą.
- AI jako właściciel faktów i decyzji: zaciera rozdzielenie źródła, interpretacji i decyzji.

## Status

Przyjęta decyzja projektowa 2.0; AI niewdrożone, obecny review pozostaje bez zmian.
