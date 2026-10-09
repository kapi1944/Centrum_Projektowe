# Migracja struktury do npm workspaces

## Punkt wejścia i wynik przed migracją

Data: 2026-10-09. Punkt wejścia: `261fea2` — zatwierdzone ADR, czyste drzewo robocze. Środowisko lokalne: Windows, Node `v24.16.0`, npm `11.13.0`.

Przed pierwszym przeniesieniem plików uruchomiono dwa pełne przebiegi `npm test`. Oba zakończyły się błędem tego samego testu: `Review CaptureAnalysis w Inbox > błąd apply pozostawia UI i bazę w REVIEWED, pozwalając ponowić zapis`. Drugi przebieg zapisano przez reporter JSON: **97 testów, 96 PASS, 1 FAIL, 0 pominiętych**. Zachowane jest 14 plików testowych. To błąd obecny przed reorganizacją, nie regresja wynikająca z workspaces.

Test używał synchronicznego `getByRole` do znalezienia przycisku „Zastosuj zatwierdzone” zaraz po asynchronicznym zakończeniu review; UI pozostawał jeszcze w trakcie zapisu. Lokalna poprawka zmienia wyłącznie to jedno oczekiwanie na `findByRole`. Pozostawia asercje błędu, rollbacku bazy i udanego ponowienia. Nie usuwa testu ani nie zmienia kodu użytkowego.

## Układ i granice migracji

```text
apps/web                 dotychczasowa aplikacja, konfiguracja Vite, domena i testy
apps/hub                 Node/TypeScript, wyłącznie GET /health
packages/contracts       typy health check i danych integracji
packages/domain          miejsce przyszłej migracji czystej domeny, bez kodu
packages/ui              miejsce przyszłego Design Systemu, bez kodu
packages/integration-sdk porty providerów z ADR 0006, bez implementacji
packages/testing         miejsce helperów współdzielonych, bez kodu
docs/adr                 istniejące decyzje architektoniczne
docs/v2                  dokumentacja tej reorganizacji
docs/ui                  miejsce dokumentacji UI
```

Pliki aplikacji i jej konfiguracje przeniesiono przez `git mv`. Domena, routing, komponenty, style, adapter IndexedDB i format backupu pozostają takie same. Import `../../package.json` w adapterze teraz odczytuje manifest web; zachowuje `version: 0.0.0` w eksporcie. Nazwa bazy `centrum-projektowe`, wersja IndexedDB 5 i schemat kopii 1 nie zmieniają się.

Jeden root lockfile obsługuje siedem workspaces. Istniejące wersje zależności web pozostają zachowane; dodano typy Node dla Hubu. Root `dev` i `preview` delegują do web; `dev:hub` uruchamia Hub osobno. `build`, `test`, `lint`, `typecheck` delegują przez `--workspaces --if-present`. Trzy pakiety bez kodu nie deklarują pozornych kontroli. Pakiety typów sprawdzają deklaracje bez emitowania runtime.

Hub domyślnie nasłuchuje na `127.0.0.1:3001`; `PORT` pozwala wybrać inny port. `/health` zwraca `{ status: "ok", version, timestamp }`, wersję z manifestu Hubu i bieżący czas ISO UTC. Nieznane ścieżki i inne metody zwracają 404. Hub nie jest połączony z web. Nie dodano bazy, sync, obsługi plików, autoryzacji ani adapterów API.

Typy `SourceLink`, `IntegrationEnvelope`, `IntegrationProvider`, `IntegrationOutboxEntry` z ADR mają polskie nazwy eksportów: `PolaczenieZrodla`, `KopertaIntegracji`, `DostawcaIntegracji`, `WpisKolejkiIntegracji`. Nazwy pól wire-contract zachowują zapis ADR, wersję 1 i klucze idempotencji. `unknown` w payload wymaga przyszłego walidatora konkretnego adaptera; same typy nie dowodzą walidacji runtime, idempotencji ani działania integracji.

Workflow `.github/workflows/quality.yml` utworzono, ponieważ nie istniał w punkcie wejścia. Uruchamia root `npm ci`, lint, typecheck, testy i build na Node 24. Brak deployu.

## Weryfikacja po migracji

| Kontrola lokalna | Wynik |
| --- | --- |
| `npm ci` z katalogu głównego | PASS; instalacja siedmiu workspaces z jednego lockfile |
| `npm run lint` | PASS: Hub, web, contracts, integration-sdk |
| `npm run typecheck` | PASS: Hub (w tym jego test), web, contracts, integration-sdk |
| `npm test` | PASS: istniejące 97/97 testów web, 14/14 plików; dodatkowo 1/1 test HTTP Hubu, łącznie 98 testów |
| `npm run build` | PASS: kompilacja Hubu, produkcyjny build web, sprawdzenie obu pakietów deklaracji |
| Porównanie źródeł z `261fea2` | PASS: 45 przeniesionych plików, jedyna zmiana treści to wskazane oczekiwanie w teście; żaden test nie usunięty |
| Smoke root `npm run dev` | PASS HTTP: `/inbox` i moduł `/src/main.tsx` na `127.0.0.1:5173`; bez zmiany domyślnego portu Vite |
| Smoke skompilowanego Hubu przez `npm start --workspace=@centrum-projektowe/hub` | PASS HTTP: `/health`, wersja manifestu `0.0.0`, prawidłowy czas; test użył tymczasowego portu przez `PORT` |

Test HTTP Hubu sprawdza dodatkowo Content-Type, komplet pól, aktualność czasu i 404 dla nieznanej ścieżki oraz POST. Procesy smoke zatrzymano po sprawdzeniu. To kontrole HTTP i automatyczne testy UI w jsdom, bez wizualnego odbioru w prawdziwej przeglądarce.

## Granice dowodu

Testy web nadal używają jsdom i fake-indexeddb. Reorganizacja i testy nie dowodzą trwałości na urządzeniu użytkownika ani odtworzenia realnie pobranego pliku backupu. Nie ma dowodu CI na GitHubie przed push. Zachowanie danych przeglądarki wymaga dotychczasowego protokołu, hosta i portu web; Hub działa na osobnym originie i nie przejmuje IndexedDB.
