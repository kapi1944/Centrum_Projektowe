# ADR 0004 — Autorytet i kontrakt synchronizacji

## Kontekst

Obecny system nie ma synchronizacji. Niektóre encje mają `wersja`, a ochrona wpływu porównuje także stan punktu powrotu; nie jest to jednolity protokół rewizji wszystkich encji. Synchronizacja nie może utożsamiać lokalnego sukcesu z przyjęciem zmiany przez Hub.

## Decyzja

Lokalne repozytorium jest autorytetem dla zatwierdzonej pracy na urządzeniu. Dla jawnie synchronizowanego zasobu Hub jest autorytetem wspólnej zaakceptowanej rewizji i kontroli dostępu. Nie jest autorytetem prawdziwości analiz ani zgody użytkownika. Przy rozbieżności zachowujemy lokalny stan i jawny konflikt; nie wybieramy zwycięzcy według czasu urządzenia. Dla zasobu wyłącznie lokalnego Hub nie uczestniczy w zapisie.

`SyncOperation` w wersji kontraktu 1:

| Pole | Kontrakt |
| --- | --- |
| `contractVersion` | `1`; nieobsługiwana wersja jest odrzucana |
| `operationId` | Globalnie unikalne ID logicznej operacji; stałe przy retry |
| `deviceId` | Stabilna tożsamość urządzenia; nie dowód uprawnień |
| `entityType`, `entityId` | Typ z jawnego katalogu i ID zasobu |
| `baseRevision` | Nieprzezroczysta rewizja ostatnio potwierdzona przez Hub; `null` tylko dla utworzenia |
| `createdAt` | ISO UTC urządzenia, do audytu, nie do rozstrzygania konfliktów |
| `payload` | Wersjonowane polecenie domenowe z pochodzeniem i odwołaniem do review, jeżeli wymagane; nie dowolny zapis bazy |
| `idempotencyKey` | Stały klucz deduplikacji w obrębie przestrzeni synchronizacji |

Kontekst uwierzytelnionej przestrzeni jest ustalany przez adapter i weryfikowany przez Hub, nigdy wyłącznie z `payload`. `operationId`, klucz i treść pozostają niezmienne przy ponowieniu. Zapis lokalny i oczekująca operacja są atomowe. Zmiany wielu encji wymagające wspólnej atomowości są jednym pakietem `ChangeSet` z oczekiwanymi rewizjami wszystkich celów; lista niezależnych operacji nie gwarantuje atomowości pakietu.

`SyncResult` jest sumą rozłączną z `contractVersion`, `operationId` i statusem:

| Status | Wymagane dane i znaczenie |
| --- | --- |
| `APPLIED` | Potwierdzona rewizja, czas przyjęcia, identyfikatory skutków/zdarzeń; identyczne ponowienie zwraca ten sam rezultat bez nowego zapisu |
| `CONFLICT` | Oczekiwana i bieżąca rewizja oraz bezpieczny opis różnicy lub odniesienie do bieżącego stanu; brak zapisu domeny |
| `REJECTED` | Kod i opis powodu, np. brak uprawnień, nieznany kontrakt, błędne relacje lub klucz z inną treścią; brak zapisu domeny |

Po uwierzytelnieniu odbiorca najpierw sprawdza zapisany rezultat deduplikacji, a dopiero dla nowej operacji rewizje. Przyjęcie zmiany, nowa rewizja, zdarzenia i rezultat deduplikacji są atomowe. Timeout lub brak odpowiedzi to nie `REJECTED`: operacja pozostaje niepotwierdzona, retry używa tego samego klucza. Nowa treść, rozstrzygnięcie konfliktu lub ponowna próba po zmianie uprawnień tworzą nową operację z nowym kluczem i aktualną bazą.

Konflikt rozstrzyga użytkownik na podstawie obu stanów. Rozstrzygnięcie przechodzi reguły domeny i review, gdy zmienia zatwierdzony zakres. Nie projektujemy CRDT, last-write-wins ani automatycznego scalania decyzji. Odbiór potwierdzonego zdarzenia odtwarza już zatwierdzoną zmianę, nie uruchamia ponownie dostawcy AI.

## Konsekwencje

- Rewizja Hubu jest odrębna od lokalnej `wersja`; synchronizacja potrzebuje mapowania i trwałych potwierdzeń.
- Operacje zależne od niepotwierdzonego utworzenia czekają na jego wynik. Nie wolno wysłać edycji z fikcyjną rewizją.
- Deduplikacja musi przetrwać restart i być zachowana co najmniej tak długo, jak możliwe ponowienia; jej retencja wymaga ustalenia przed wdrożeniem.
- Zakres synchronizacji, uwierzytelnianie i transport zostaną ustalone przy implementacji adaptera. Ten ADR nie ustanawia endpointów ani infrastruktury.

Przyszłe testy: retry po utraconej odpowiedzi, konflikt dwóch urządzeń, podmieniony payload pod tym samym kluczem, nieuprawniony zapis, rollback pakietu i praca offline.

## Alternatywy odrzucone

- Ostatni timestamp wygrywa: zegary urządzeń nie ustalają intencji.
- CRDT: poza zakresem i niewystarczające dla review decyzji.
- Bezwarunkowy autorytet Hubu nad lokalnymi danymi: ryzyko utraty pracy offline.

## Status

Przyjęta decyzja projektowa 2.0; kontrakt bez implementacji Sync i Hubu.
