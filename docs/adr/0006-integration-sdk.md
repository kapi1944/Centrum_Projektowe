# ADR 0006 — Wspólny kontrakt integracji

## Kontekst

System nie ma dziś adapterów GitHub, Ogarniacza ani Po Kapiemu. Przyszłe usługi mają różne tożsamości, modele i możliwości ponawiania. Ich dane nie mogą omijać review lub wymuszać zależności domeny od konkretnego API.

## Decyzja

Ustalamy kontrakt SDK w wersji 1, bez implementacji klienta, sieci ani integracji. SDK jest zestawem portów i struktur, nie nowym globalnym repozytorium. Każda struktura ma `contractVersion: 1` i `idempotencyKey`; klucze odnoszą się do opisanych poniżej zakresów. Nieznana wersja kończy się jawnym odrzuceniem bez zapisu.

| Struktura | Pola i semantyka |
| --- | --- |
| SourceLink | `providerId`, `connectionId`, `resourceType`, `externalId`, opcjonalne `url`, `externalRevision`, `sourceId`; `idempotencyKey` to stabilny klucz powiązania w obrębie połączenia, nie klucz każdej aktualizacji |
| IntegrationEnvelope | `envelopeId`, `providerId`, `connectionId`, `direction` (`INBOUND` / `OUTBOUND`), `sourceLink`, `occurredAt`, `payloadSchemaVersion`, `payload`, `correlationId?`, `causationId?`; `idempotencyKey` identyfikuje konkretną wiadomość/rewizję, stałą przy retry |
| IntegrationProvider | `providerId`, wspierane wersje, deklarowane możliwości odbioru/wysyłki i kontrakty polskich metod: `odbierz` (koperty + kursor), `wyslij` (koperta → rezultat), `sprawdzPolaczenie`; wywołanie ma wersję i klucz operacji |
| IntegrationOutboxEntry | `id`, `envelope`, `changeSetId?`, `status`, `attempts`, `createdAt`, `nextAttemptAt?`, `lastError?`, `receipt?`; wersja i klucz zgodne z kopertą, treść niezmienna podczas retry |

Tożsamość zewnętrznego zasobu to `(providerId, connectionId, resourceType, externalId)`, a nie samo URL. `SourceLink` jest odniesieniem i pochodzeniem, nie przyznaje uprawnień. Połączenie oznacza konto/instancję z jawnym zakresem dostępu; nie zawiera tokenu.

Odbiór waliduje kopertę i payload według jawnego schematu adaptera, deduplikuje wiadomość oraz atomowo zapisuje źródło i marker odbioru. Nowa rewizja zewnętrznej treści tworzy nowy `SourceRecord` z powiązaniem do poprzedniego; nie nadpisuje oryginału. Dane trafiają do Knowledge, potem do pipeline propozycji. Odbiór nie tworzy automatycznie przyjętej decyzji ani pracy.

Outbox zawiera tylko jawnie zatwierdzoną wysyłkę. Jeśli wynika z lokalnego `ChangeSet`, jego wpis i lokalne skutki powstają atomowo. Stan: `PENDING` → `IN_FLIGHT` → `DELIVERED`, z `RETRY_WAIT`, `REJECTED` albo `UNKNOWN` przy braku pewnego rezultatu. Worker używa czasowego przejęcia wpisu, aby restart nie zostawił wiecznego `IN_FLIGHT`; przejęcie jest atomowe. Lokalna transakcja nie obejmuje sieci.

`wyslij` zwraca potwierdzenie z zewnętrznym ID/rewizją, błąd możliwy do ponowienia, trwałe odrzucenie lub wynik nieznany. Jeżeli zewnętrzne API wspiera idempotencję, adapter przekazuje stabilny klucz. Jeżeli nie wspiera, adapter musi uzgodnić wynik przez stabilne odniesienie; po timeout nie powtarza ślepo operacji tworzącej rekord. Pozostawia `UNKNOWN` do sprawdzenia lub decyzji użytkownika. Nie obiecujemy exactly-once w obcym API.

GitHub, Ogarniacz, Po Kapiemu i inne API implementują te same porty przez własne adaptery. Format ich payloadów, endpointy, autoryzacja i zakresy zgód wymagają osobnego projektu przed implementacją. Sekrety należą do konfiguracji adaptera poza encjami, logami, kopertami i backupem. `PRIVATE` nie zezwala na eksport do integracji bez jawnej zgody.

## Konsekwencje

- Wspólne są wersjonowanie, pochodzenie, deduplikacja i stany dostarczenia; nie narzucamy wszystkim usługom jednego modelu treści.
- Integracje i Sync mają oddzielne potwierdzenia. Wysłanie do GitHub nie jest synchronizacją projektu z Hubem.
- `correlationId` / `causationId` pozwalają blokować pętle zwrotne; odbity własny eksport nie jest nowym poleceniem domenowym.

Przyszłe testy: duplikat odbioru, nowa rewizja źródła, nieznany schemat, brak sekretów w eksporcie, restart outboxu, timeout bez zewnętrznej idempotencji i blokada pętli.

## Alternatywy odrzucone

- Bezpośredni zapis adaptera do projektów: omija domenę i review.
- Osobny pipeline dla każdego API: powiela reguły i rozbieżne stany.
- Uniwersalny payload bez walidacji: nie daje stabilnego kontraktu.

## Status

Przyjęta decyzja projektowa 2.0; SDK i adaptery niewdrożone.
