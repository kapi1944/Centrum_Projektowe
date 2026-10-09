# Centrum Projektowe 2.0 — baseline po Etapie 5

## Punkt odniesienia

Audyt wykonano 2026-10-09 na czystej gałęzi `main`. HEAD wejściowy i audytowany kod: **`c0ce40bca88333bef1ebc87c49ff3c1fca6b64c8` — `refactor: introduce v2 domain boundaries`**. Gałąź miała trzy lokalne commity ponad `origin/main` (`f2b7e98`). Commit tego dokumentu jest następnym commitem dokumentacyjnym; identyfikatorem baseline kodu pozostaje powyższy SHA.

Zachowane są ADR, reorganizacja `28c7569` oraz fundament domeny `c0ce40b`. Etap 5 dodaje wyłącznie cztery dokumenty. Nie wykonuje migracji danych, zmiany UI, AI, integracji ani synchronizacji.

Źródłem opisu jest bieżący kod `apps/*` i `packages/*`, nie wcześniejszy układ `src/`. Kontekst ADR i [WORKSPACE_MIGRATION](WORKSPACE_MIGRATION.md) opisuje wcześniejsze punkty wejścia: wzmianki o braku Hubu lub pustym `packages/domain` nie opisują aktualnego HEAD. [DOMAIN_FOUNDATION](DOMAIN_FOUNDATION.md) opisuje już fundament po tych zmianach.

## Workspaces i uruchamianie

Root `package.json`: `workspaces: ["apps/*", "packages/*"]`, Node `>=24 <25`, jeden `package-lock.json`; lokalnie Node `v24.16.0`, npm `11.13.0`.

| Workspace | Rzeczywisty stan |
| --- | --- |
| `apps/web` / `@centrum-projektowe/web` | React 19, React Router 7, Vite 8; UI, polska domena v1, use cases, IndexedDB i testy lokalne |
| `apps/hub` / `@centrum-projektowe/hub` | Serwer Node/TypeScript: tylko `GET /health`; domyślnie `127.0.0.1:3001`, konfigurowalny `PORT` 1–65535 |
| `packages/domain` | Wyłącznie deklaracje `.d.ts`: UnitOfWork i pierwsze modele v2; bez runtime, Reacta i IndexedDB |
| `packages/contracts` | Deklaracje health oraz struktur integracji; bez walidatorów runtime |
| `packages/integration-sdk` | Deklaracje portu dostawcy i re-eksport kontraktów; bez klienta sieciowego i adapterów |
| `packages/ui` | Manifest i README; brak kodu, eksportów i własnych kontroli |
| `packages/testing` | Manifest i README; brak wspólnych helperów, eksportów i własnych kontroli |

Root `dev` i `preview` delegują do web, `dev:hub` uruchamia osobny Hub. `lint`, `typecheck`, `test`, `build` używają `--workspaces --if-present`: brak skryptu nie jest testem pustego pakietu. Build emituje `apps/web/dist` i `apps/hub/dist`; pakiety deklaracji wykonują tylko typecheck. Web nie łączy się z Hubem. Health zwraca `status`, wersję manifestu i czas ISO; inne metody/ścieżki mają 404. Nie potwierdza gotowości bazy ani synchronizacji.

## Trwałość, magazyny i indeksy

`apps/web/src/infrastructure/repozytoriumIndexedDb.ts` otwiera **`centrum-projektowe`, IndexedDB v5**. Wszystkie magazyny mają `keyPath: id` (unikalny klucz główny). Rejestr wszystkich 11 magazynów, walidatorów i formatu eksportu znajduje się w `apps/web/src/domain/kopieZapasowe.ts`.

| Magazyn | Model utrwalany | Indeksy dodatkowe |
| --- | --- | --- |
| `projekty` | `Projekt` | brak |
| `wpisy` | `Wpis` (Capture) | brak |
| `zdarzenia` | `ZdarzenieAktywnosci` (ActivityEvent) | brak |
| `decyzje` | `Decyzja` | **`czytelneId`, unique**; `projektIds`, multiEntry, nieunikalny |
| `analizyWplywu` | `AnalizaWplywu` | brak |
| `analizyWpisow` | `AnalizaWpisu` | **`wpisId`, unique** |
| `obszary` | `Obszar` | `projektId`, nieunikalny |
| `etapy` | `Etap` | `projektId`, nieunikalny |
| `elementyPracy` | `ElementPracy` | `projektId`; `decyzjaIds`, multiEntry; **`elementZrodlowy`, unique** |
| `pytania` | `OtwartePytanie` | `projektId`; **`elementZrodlowy`, unique** |
| `blokady` | `Blokada` | `projektId`, nieunikalny |

Złożony `elementZrodlowy` ma ścieżki `[pochodzenie.analizaWpisuId, pochodzenie.elementAnalizyId]`. Każdy z dwóch indeksów chroni własny magazyn. Zakaz konwersji tego samego elementu także pomiędzy pracą i pytaniami sprawdzają domena realizacji oraz walidacja kopii; sam indeks nie zapewnia unikalności między magazynami.

Migracje w `onupgradeneeded`:

| Wersja | Zmiana istniejąca w kodzie |
| --- | --- |
| 1 | `projekty`, `wpisy` |
| 2 | Dodanie `zdarzenia`; przy wejściu z v1 przebudowa pól projektów/wpisów z zachowaniem ID, oryginałów, relacji i czasu; obliczenie ostatniej aktywności z wpisów, bez dopisywania fikcyjnej historii |
| 3 | Decyzje, wpływ, unikalne `czytelneId`, relacje wielu projektów |
| 4 | Analizy wpisów, unikalne `wpisId` |
| 5 | Pięć magazynów realizacji i ich indeksy |

Świeża baza otrzymuje cały schemat. Aktualizacja wykonuje odpowiednie kroki według `oldVersion`. Brak IndexedDB i zablokowany upgrade mają jawne błędy. Połączenia zamykają się po operacjach. Sukces zapisu/odczytu jest zwracany po `oncomplete`, błąd transakcji wycofuje zapis.

## Zachowane modele i workflow v1

Wszystkie wykonywalne modele pozostają w `apps/web/src/domain`:

| Plik | Modele i reguły |
| --- | --- |
| `modele.ts`, `operacje.ts` | `Projekt`, `DaneProjektu`, `PunktPowrotu`, `Wpis`, `ZrodloDanych`, `KontekstZapisu`, `ZdarzenieAktywnosci` oraz typy akcji i wyników; oryginał wpisu jest zachowany, archiwizacja/odrzucenie nie usuwa danych |
| `ustalenia.ts` | `Decyzja`, `DaneDecyzji`, `PowiazanyElement`, `AnalizaWplywu`, `PropozycjaWplywu`, `ZrodloWplywu`, stan/operacje/wyniki ustaleń; `DEC-XXXX`, wiele projektów, wersje i zastępowanie |
| `analizaWpisu.ts` | `AnalysisProvider`, wynik i propozycje dostawcy, `AnalizaWpisu`, `ElementAnalizy`, review, operacje i wynik; wynik, korekty i zastosowanie nadal w jednym rekordzie |
| `realizacja.ts` | `Obszar`, `Etap`, `ElementPracy`, `OtwartePytanie`, `Blokada`, ich dane, wersje, umiejscowienie, `PochodzenieAnalizy`, stan/operacje/wyniki |
| `kopieZapasowe.ts` | `DaneKopii`, `KopiaZapasowa`, `TrybImportu`, `KonfliktKopii`, `BladKonfliktow`, walidacja struktury, relacji i unikalności |

Aktualne przypadki użycia obejmują:

- tworzenie, edycję i archiwizację projektu oraz aktualizację ręcznego punktu powrotu;
- zapis wpisu z projektem lub bez niego, przypisanie, utworzenie projektu z wpisu, odłożenie i odrzucenie bez utraty oryginału;
- analizę regułową, rozpoczęcie review, akceptację/edycję/odrzucenie elementów, zakończenie i osobne zastosowanie;
- tworzenie decyzji `PROPOSED`, zmianę statusu, zastąpienie z zachowaniem starej decyzji, analizę relacyjnego wpływu i osobne rozstrzyganie jego propozycji;
- zapis/edycję obszarów, etapów, pracy, pytań i blokad oraz jawną konwersję zatwierdzonych, zachowanych elementów analizy do pracy/pytania;
- odczyt rejestru i historii, eksport, sprawdzenie oraz import kopii.

Dwa wydzielone use cases w `application/przypadkiUzycia.ts` to `utworzWpisUzytkownika` i `aktualizujPunktPowrotu`. `zapiszNowyWpis` jest wspólną ścieżką zapisu dla use case i fasady v1. Pozostałe workflow nadal wywołują fasadę `RepozytoriumProjektowe`; nie są jeszcze wydzielone do warstwy aplikacyjnej.

Sześć portów w `domain/porty.ts`: projekty, wpisy, analizy, decyzje (z wpływem), realizacja i zdarzenia. Fasada komponuje je z backupem i UnitOfWork. Nowy adapter UnitOfWork obsługuje tylko logiczne `projekty`, `wpisy`, `zdarzenia`: wpis bez projektu zapisuje dwa magazyny, wpis z projektem trzy, punkt powrotu dwa. Callbacki koordynacji/odczytu są synchroniczne, Promise i brak zakończenia są odrzucane. Sieć i dostawca analizy działają poza transakcją. Pozostałe zapisy fasady korzystają z istniejącej transakcji wszystkich 11 magazynów.

## Istniejące elementy v2

`packages/domain/src/index.d.ts` deklaruje `JednostkaPracy`, `PochodzenieDanych`, `RekordZrodlowy`, `PrzebiegAnalizy`, `PolecenieZmiany`, `PropozycjaZmiany`, `ZestawZmian`, `KopertaZdarzeniaDomenowego`. Readonly i typy nie zapewniają walidacji runtime ani trwałości.

`infrastructure/zgodnoscV1V2.ts` projektuje wpis, analizę, zdarzenie i całą kopię do widoków v2 **w pamięci**. Zachowuje pełne `zgodnoscV1`, klonuje dane, waliduje v1 i zgodność projekcji przy powrocie. `PrzebiegAnalizy` starego wyniku ma `LEGACY_IMPORTED`, czasy `null`, bez wymyślonego modelu/promptu. Koperta ma `actor: null`. Natywnego v2 ani zmienionego widoku nie można bezstratnie spłaszczyć do v1. Brak nowego magazynu, pipeline i automatycznego wywołania adaptera w UI.

## Backup i restore

Format: `format: centrum-projektowe`, **`schemaVersion: 1`**, `appVersion: 0.0.0` z manifestu web, `exportedAt`, `data` wszystkich 11 magazynów. Wersja backupu jest niezależna od IndexedDB v5 i rewizji rekordów.

Eksport odczytuje spójny obraz w jednej transakcji readonly i waliduje go. Import klonuje argument, sprawdza format, wersję, rekordy, relacje i klucze; zapisuje atomowo. `polacz` pomija identyczne rekordy, dodaje nowe i odrzuca całość przy innym rekordzie tego samego ID lub naruszeniu relacji/unikalności. `zastap` wymaga potwierdzenia, czyści i odtwarza wszystkie magazyny w jednej transakcji, także dla pustej kopii. Nie dodaje zdarzeń rzekomej dawnej pracy.

Ekran `/dane` używa Blob/download, rzeczywistego pliku JSON, osobnego sprawdzenia i podglądu przed importem. Komunikat przygotowania pliku sam nie dowodzi pobrania. Kopie są nieszyfrowane; kod nie definiuje limitu rozmiaru importu. Walidatory rekordów nie odrzucają wszystkich dodatkowych pól i nie są kompletnym runtime kontraktem przyszłego v2.

## Routing i CI

`main.tsx` tworzy jedną fasadę IndexedDB i `BrowserRouter`. Trasy w `app/Aplikacja.tsx`: `/`, `/projekty`, `/projekty/:projektId`, `/projekty/:projektId/ustalenia`, `/inbox` (także parametr `wpis`), `/dane`; `*` pokazuje brak strony. Odczyt rejestru poprzedza render tras. Hosting produkcyjny wymaga fallbacku SPA dla bezpośrednich wejść; nie skonfigurowano deployu.

`.github/workflows/quality.yml`: push/pull_request, Ubuntu, Node 24, `npm ci`, lint, typecheck, test, build. Brak deployu. W tym etapie nie ma dowodu wykonania tego workflow na GitHubie (bez push); lokalne PASS nie oznacza zdalnego CI PASS.

## Security gate bieżącego drzewa

> **OSTRZEŻENIE: repozytorium GitHub jest PUBLIC.** `gh repo view --json visibility,defaultBranchRef` zwróciło `visibility: PUBLIC`, domyślną gałąź `main`. Kod i commitowana dokumentacja są publiczne. Nie dodawać sekretów, prywatnych kopii ani danych użytkownika. Widoczności nie zmieniono.

Sprawdzono workflow, `.gitignore`, manifesty, konfiguracje ESLint/Vite/TypeScript, konfigurację Hubu i bieżące śledzone pliki. Nie analizowano całej historii Git.

- `.gitignore` wyklucza `.env`, `.env.*`, dopuszcza `.env.example`; ignoruje również node_modules, dist, coverage i pliki lokalne. Ignorowanie nie usuwa wcześniej śledzonego sekretu.
- Inwentaryzacja `.env*` poza `.git` i `node_modules`, także plików ignorowanych: brak. `git ls-files` nie wykazał śledzonego pliku env.
- W 98 śledzonych plikach wykonano ograniczony przegląd znanych formatów tokenów GitHub/OpenAI/AWS, kluczy prywatnych i literalnych przypisań klucz/token/hasło: **0 trafień**. To wynik tych wzorców i przeglądu konfiguracji, nie dowód braku każdego możliwego sekretu.
- Jedyną zmienną konfiguracji Hubu jest `PORT`; bind pozostaje lokalny. Web nie ma konfiguracji zdalnych API, tokenów ani sieciowego dostawcy analizy. `REMOTE_LLM`/`LOCAL_LLM` są wartościami modelu.
- CI nie ma deployu ani jawnych sekretów, ale akcje są wskazane tagami `@v4`, nie SHA; brak jawnego `permissions` pozostawia zakres tokenu ustawieniom GitHub. Stan tych ustawień nie został odczytany. Odnotowano do przyszłego utwardzenia, bez zmiany CI.
- `npm ci`: **0 zgłoszonych podatności** w raporcie instalacji. Nie jest to pełny audyt bezpieczeństwa aplikacji ani historii.

## Dowód browser smoke backupu

**PASS, 2026-10-09**, prawdziwa przeglądarka Codex In-app Browser. Web uruchomiono przez `npm run dev -- --host 127.0.0.1 --port 5195 --strictPort`. Osobny origin `http://127.0.0.1:5195` miał początkowo 0 projektów i 0 wpisów; nie użyto danych użytkownika.

1. Przez UI utworzono `ETAP5-SMOKE-2026-10-09` i wpis z nową linią oraz znakami `ąćęłńóśźż`, przypisany do projektu.
2. Faktycznie pobrano `centrum-projektowe-kopia-2026-10-09.json`; plik na dysku sprawdzono: 1 projekt, 1 wpis, 2 zdarzenia, pozostałe 8 magazynów puste, schemat 1.
3. Zmieniono opis projektu i dodano drugi wpis po backupie; UI potwierdził zmianę.
4. Przez file chooser wybrano ten sam pobrany plik, sprawdzono kopię, wybrano zastąpienie i zaznaczono wymagane potwierdzenie. UI potwierdził odtworzenie.
5. Wykonano pełny reload. Zachowany jest pierwotny opis, oryginalny wpis z przypisaniem i dwa dawne zdarzenia; wpis dodany po backupie i zmiana opisu zniknęły.
6. Ponownie faktycznie pobrano kopię po reload. Porównanie `JSON.stringify(przed.data) === JSON.stringify(po.data)` dało `true` dla wszystkich 11 magazynów; metadane czasu eksportu nie były porównywane. SHA-256 porównanego `data`: `36f0aacf6091e50a44537fbf4799c9dde8a94d97b502d0e87122889597fe7688`.

Projekt ID: `9998530a-5674-46a2-99b3-d13c6504d3ff`; wpis ID: `6a1e6850-bc8f-4820-a97f-0060273aec29`. Lokalne dowody poza repo: `backup-przed-restore.json`, `backup-po-restore.json`, `backup-po-restore.jpg` w katalogu artefaktów sesji `C:/Users/Kacper/.codex/visualizations/2026/10/09/01a1219e-359c-7c12-9ccf-61096282f169`. Nie są częścią publicznego commita.

Zakres dowodu: jedna prawdziwa przeglądarka, syntetyczny projekt/wpis/historia, download → import → reload. Nie dowodzi pełnego wypełnienia 11 magazynów w przeglądarce, innych urządzeń, migracji historycznej bazy użytkownika, Hubu ani natywnego v2. Pełniejsze relacje i rollback pokrywają istniejące testy fake-indexeddb.

## Kontrole lokalne Etapu 5

| Kontrola | Wynik |
| --- | --- |
| `npm ci` | PASS |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS: web 109/109, 16 plików; Hub 1/1; razem 110 |
| `npm run build` | PASS: web, Hub i pakiety deklaracji |
| `git diff --check` i `git diff --cached --check` | PASS; staged diff obejmuje wyłącznie cztery dokumenty Etapu 5 |

## Ograniczenia i pozostała migracja

- Aplikacja nadal utrwala modele v1; jedna analiza na wpis pozostaje wymuszona domeną, indeksem i backupem. Nie wdrożono wielu runów, preferencji runu ani osobnego audytu korekt.
- Propozycje/zestawy v2 nie mają walidacji runtime, magazynów, koordynatora apply ani trwałej idempotencji. Stara historia nie jest pełnym event sourcingiem.
- Czyste reguły i sześć portów nadal są w web; dwa workflow korzystają z nowego UnitOfWork, pozostałe z istniejącej fasady. Nie ma alternatywnego adaptera storage.
- `ProjectSnapshot`, `AttentionItem`, Artifacts, Sync, autoryzacja i prywatność per zasób istnieją jako cele ADR, nie działające funkcje. Hub health i typy SDK nie ustanawiają tych możliwości.
- IndexedDB jest zależne od originu przeglądarki. Zmiana protokołu/hosta/portu nie przenosi danych. Usunięcie danych witryny usuwa lokalny stan; zachować backup poza przeglądarką.

Kolejność i bramki przyszłych prac: [MIGRATION_PLAN](MIGRATION_PLAN.md), [ARCHITECTURE_TARGET](ARCHITECTURE_TARGET.md), [COMPATIBILITY](COMPATIBILITY.md). Żadna z tych prac nie została rozpoczęta w Etapie 5.
