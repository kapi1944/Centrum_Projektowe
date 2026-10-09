# Fundament domeny i warstwy aplikacyjnej

## Zakres

Punkt wejścia: `28c7569`, czyste repozytorium. Wydzielono kontrakty, warstwę przypadków użycia i dwa workflow. Nie zmieniono ekranów, tekstów UI, nazw/statusów rekordów, wersji IndexedDB 5, indeksów, migracji ani kopii `schemaVersion: 1`.

| Pojęcie | Kontrakt w kodzie |
| --- | --- |
| ProjectRepository | `RepozytoriumProjektow` |
| CaptureRepository | `RepozytoriumWpisow` |
| AnalysisRepository | `RepozytoriumAnaliz` |
| DecisionRepository | `RepozytoriumDecyzji` (także istniejący wpływ) |
| ExecutionRepository | `RepozytoriumRealizacji` |
| EventRepository | `RepozytoriumZdarzen` |

Porty znajdują się w `apps/web/src/domain/porty.ts`, ponieważ korzystają z istniejących polskich modeli v1. `RepozytoriumProjektowe` komponuje je i zachowuje dotychczasowe metody oraz operacje backupu; dodaje dostęp do `jednostkaPracy`. Nie dodano portów artefaktów ani integracji. To pierwszy podział odpowiedzialności, nie pełne rozdzielenie adaptera. Analizy, ustalenia i realizacja nadal mają dotychczasowe operacje atomowe.

## Przypadki użycia i UnitOfWork

W `apps/web/src/application/przypadkiUzycia.ts` działają `utworzWpisUzytkownika` (CreateCapture) oraz `aktualizujPunktPowrotu` (UpdateResumePoint). `zapiszNowyWpis` jest wspólną ścieżką zapisu dla pierwszego use case i starej metody `dodajWpis`, nie drugim silnikiem domenowym. Nadal wykorzystujemy reguły `utworzWpis`, `zmienProjekt` i `zdarzenieUtworzenia`.

Hook UI wywołuje przypadek użycia i aktualizuje stan dopiero po jego sukcesie. Nie składa transakcji ani kilku repozytoriów ręcznie. Stare wywołania fasady również korzystają z tych samych dwóch ścieżek. Pozostałe przykłady use cases z zadania nie otrzymują nieużywanych wrapperów: ich migracja będzie osobnym etapem.

| Workflow | Zakres zapisu |
| --- | --- |
| Utworzenie wpisu bez projektu | `wpisy`, `zdarzenia` |
| Utworzenie wpisu z projektem | `projekty`, `wpisy`, `zdarzenia` |
| Punkt powrotu | `projekty`, `zdarzenia` |

`JednostkaPracy<Porty>` w `packages/domain` nie zależy od API IndexedDB. Use case wskazuje logiczne magazyny i otrzymuje jedynie ich porty. Adapter `jednostkaPracyIndexedDb.ts` mapuje je na magazyny v1 i otwiera jedną transakcję. Port wpisów dopuszcza tylko dodanie oryginału; port zdarzeń tylko dopisanie. Porty spoza zakresu nie istnieją ani w typie, ani w obiekcie runtime.

Callback koordynacji i callback odczytu muszą być synchroniczne: kolejkują żądania, stosują reguły domeny i wskazują wynik przez `zakoncz`. Nie wolno robić `await`, wywołań dostawcy analizy, sieci, odczytu pliku ani czekać na UI w transakcji. To ograniczenie tego adaptera IndexedDB; port nie udaje obsługi asynchronicznej pracy wewnątrz transakcji. Adapter odrzuca callback zwracający Promise i brak zakończenia po ostatnim odczycie, wycofując zapis. Wynik use case rozwiązuje się dopiero w `oncomplete`; błąd żądania lub domeny wycofuje encję, aktywność i historię. Połączenie jest zamykane także po błędzie.

## Modele v2 i kompatybilność

Deklaracje w `packages/domain/src/index.d.ts`:

- SourceRecord → `RekordZrodlowy`: oryginał, identyfikator, pochodzenie i opcjonalne wskazanie preferowanego runu.
- AnalysisRun → `PrzebiegAnalizy`: provider, model/prompt gdy znane, odrębny schemat, czas i status przebiegu, wynik, opcjonalne zastępowanie.
- ChangeProposal → `PropozycjaZmiany`: źródło, run i elementy, jawne operacje oraz oczekiwane rewizje.
- ChangeSet → `ZestawZmian`: odwołanie do konkretnego review i jego rewizji, zatwierdzone operacje, rewizje i idempotencyKey.
- DomainEventEnvelope → `KopertaZdarzeniaDomenowego`: wszystkie pola z zadania, w tym rozdzielone actor/source i payload.

Nazwy typów i funkcji są polskie; angielskie pola kontraktów odpowiadają ADR i event envelope z zadania. Katalog deklarowanych zmian obejmuje propozycję decyzji, kandydata wpływu i zachowanie elementu, bez dowolnego patcha projektu. Nie implementowano jeszcze zapisu propozycji/zestawów, ich walidacji runtime, idempotentnego stosowania ani nowego Impact Engine. Readonly w typach nie jest ochroną runtime.

Adapter `apps/web/src/infrastructure/zgodnoscV1V2.ts` tworzy **widoki w pamięci**, nie migrację bazy:

1. Wpis zachowuje ID, dokładny tekst, projekt, czas i pochodzenie. Stan przetworzenia i odłożenie pozostają w pełnym `zgodnoscV1`.
2. Analiza zachowuje ID oraz `wpisId` jako `sourceId`. Wynik providerowy jest oddzielony od review, a pełny rekord v1 zachowuje elementy, oryginały, edycje, oceny, historię i faktyczne skutki. Stare runy mają `LEGACY_IMPORTED`, `startedAt` i `finishedAt` równe `null`; data zapisu nie staje się wymyślonym czasem pracy dostawcy. Nie dopisujemy modelu ani promptVersion. `schemaVersion: capture-analysis-v1` identyfikuje format wyniku adaptera; `wersjaAnalizy` i wersja dostawcy zachowują własne znaczenie.
3. ActivityEvent pozostaje w bazie. Koperta zachowuje ID, typ, encję, czas, projekty, tytuł, opis, metadane i źródło. `actor: null` oznacza brak osobnej wiarygodnej tożsamości aktora w starym kontrakcie; nie przypisujemy działania AI użytkownikowi. Pełny stary rekord zachowuje także różnicę między `projektId` i `projektIds`.
4. Konwersja całej kopii waliduje v1 i zachowuje wszystkie 11 magazynów wraz z relacjami decyzji, wpływu i konwersji realizacji. Nie dorabia historycznych ChangeSet, propozycji ani zdarzeń do dawnych operacji.

Konwersja wstecz obsługuje bezstratne widoki pochodzące z v1, także po serializacji JSON. Kopiuje dane, nie współdzieli referencji z oryginałem. Sprawdza zgodność projekcji z zachowanym rekordem: zmiana treści, pochodzenia, preferencji, schematu lub brak części widoku powoduje jawny błąd. Natywny rekord v2 bez odpowiednika v1 nie jest automatycznie spłaszczany do starego modelu. Obsługa wielu runów w starej kopii pozostaje niedozwolona; indeks i walidacja jednej analizy na wpis pozostają aktywne. Adapter jest bramką zgodności, nie uniwersalnym downgraderem nowych danych.

## Dowody

Nowe testy obejmują dokładne zakresy magazynów, ponowne otwarcie, kolizję ID wpisu, rollback po błędzie historii, odczyt bieżącego projektu, archiwum i ochronę nowszej aktywności. Sprawdzają również brak portu poza zakresem, rollback przy niezakończonym/asynchronicznym callbacku i bezstratne przeniesienie pochodzenia, edycji, odrzuceń oraz efektów analiz. Test pełnej kopii przechodzi przez widok v2, ponowną walidację v1, import i eksport wszystkich magazynów.

Kontrole lokalne: **PASS** `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. Web: **109/109 testów, 16 plików**, w tym wszystkie dotychczasowe 97 testów i 12 nowych. Hub: **1/1**, łącznie 110 testów. Test UnitOfWork sprawdza także, że Promise use case rozwiązuje się dopiero po zdarzeniu `complete` każdej transakcji.

W pierwszym pełnym przebiegu równoległym z lint/typecheck/build istniejący test UI zastępowania decyzji przekroczył limit 5000 ms (108 PASS, 1 timeout). Samodzielny pełny przebieg i końcowy pełny przebieg po instalacji `npm ci` przeszły bez zmiany tego testu i bez zwiększania timeoutów. Nie ustalono osobnej przyczyny timeoutu.

Testy używają jsdom/fake-indexeddb; nie zastępują dowodu urządzenia ani rzeczywistego pobrania pliku backupu. Native v2 oraz nowy pipeline nadal wymagają osobnego wdrożenia i testów; test zgodności nie jest dowodem ich persistence.
