# ADR 0001 — Local-first i Hub

## Kontekst

Stan odczytany 2026-10-09: `f2b7e98`, po `5c6acd8` (backup i restore). W historii nie ma commita baseline 2.0. Te ADR-y dokumentują docelowe kontrakty; nie potwierdzają ich implementacji.

Obecnie aplikacja działa lokalnie, przez `RepozytoriumProjektowe` i adapter IndexedDB. Baza v5 zawiera 11 magazynów. Historia i skutki operacji są zapisywane transakcyjnie; eksport oraz import działają bez sieci. Nie ma Hubu, kont ani synchronizacji.

## Decyzja

Local-first pozostaje. Odczyt, zapis, review, realizacja i backup lokalnego projektu nie wymagają dostępności Hubu ani logowania. Hub będzie opcjonalnym rozszerzeniem dla synchronizacji i współdzielenia jawnie wybranych zasobów, przez adapter opisany w [ADR 0004](0004-sync-authority.md).

Nowe zasoby mają domyślną widoczność `PRIVATE`. Brak metadanych prywatności podczas przyszłej migracji również oznacza `PRIVATE`. Połączenie Hubu nie publikuje istniejących danych. Wysłanie danych do Hubu, integracji lub zdalnego dostawcy analizy wymaga jawnie określonego zakresu i zgody użytkownika; zgoda na jedno nie oznacza zgody na pozostałe.

Źródło ≠ analiza ≠ propozycja ≠ decyzja. Hub nie przejmuje review i nie może sam przyjmować decyzji. Zmiany zachowują historię, identyfikatory oraz pochodzenie. Lokalny backup pozostaje dostępny także bez Hubu.

## Konsekwencje

- UI w przyszłości odróżnia zapis lokalny, oczekiwanie na synchronizację, potwierdzenie Hubu i konflikt. Lokalny sukces nie jest potwierdzeniem synchronizacji.
- Brak sieci ani błąd autoryzacji nie unieważnia lokalnego zapisu. Błędy synchronizacji pozostają widoczne i możliwe do ponowienia.
- `PRIVATE` jest polityką dostępu, nie obietnicą szyfrowania IndexedDB czy eksportowanego pliku. Backup nadal może zawierać prywatne dane.
- W tym etapie nie dodajemy Hubu, Raspberry Pi, AI, kont, transportów ani zmian UX.

Przyszła bramka kontraktu: działanie offline, brak automatycznej publikacji po połączeniu, zachowanie lokalnych zmian po odrzuceniu synchronizacji i dostępny eksport przy awarii Hubu.

## Alternatywy odrzucone

- Hub wymagany do zapisu: blokowałby pracę offline.
- Automatyczna publikacja po podłączeniu konta: narusza domyślną prywatność.
- Dwie niezależne domeny lokalna i serwerowa: prowadzą do rozbieżnych reguł.

## Status

Przyjęta decyzja projektowa 2.0; rozszerzenia niewdrożone. Zmiana zasad wymaga kolejnego ADR.
