# Zgodność v1 ↔ 2.0

Stan kodu: `c0ce40b`, 2026-10-09. „2.0” oznacza istniejący fundament i przyjęty cel, nie ukończoną migrację. Wszystkie momenty poniżej są **warunkami przyszłych etapów**, nie terminami i nie zgodą na ich rozpoczęcie.

## Aktualizacja zgodności — Etapy 6–7

[Przebiegi analiz](ANALYSIS_RUNS.md) zachowują stare ID, wyniki, review i provenance, obsługując wiele runów i jedno preferred. [Korekty](CORRECTION_PIPELINE.md) rozszerzają istniejące PropozycjaZmiany/ZestawZmian i AnalizaWplywu; ich nowe rekordy nie mają bezstratnego odpowiednika w backupie v1. Adapter widoków v1 ↔ v2 pozostaje bez zmian i odmawia spłaszczenia nowych danych.

| Element | Aktualna zgodność |
| --- | --- |
| IndexedDB | v7; upgrade v6 dodaje korekty, propozycjeZmian, zestawyZmian i zdarzeniaDomenowe bez zmiany starych rekordów |
| Backup v3 | 16 magazynów, spójny odczyt i atomowy import z walidacją relacji oraz audytu korekty |
| Backup v2 / v1 | Nadal importowane; nowe magazyny puste, runy v2 zachowane, analizy v1 migrowane do LEGACY_IMPORTED |
| Review | Stare review analiz pozostaje; propozycje korekt mają osobną historię PENDING/ACCEPTED/EDITED/REJECTED i reviewRevision |
| ImpactAnalysis | Ten sam relacyjny mechanizm; nowe źródło CORRECTION, kandydaci dla istniejących encji; wpływ korekty stosowany wyłącznie przez jej ChangeSet |
| UnitOfWork / zdarzenia | Port rewizji atomowo zapisuje skutki, ChangeSet, DomainEventEnvelope i ActivityEvent; stara historia nie staje się fikcyjnym ChangeSet |
| UI / routing | Dotychczasowe adresy pozostają; `/projekty/:projektId/korekty` udostępnia Delta, review i jawny nowy run |

Testy starego formatu zachowują sprawdzenia danych i relacji; zmienione oczekiwania wersji/nowych pustych magazynów odzwierciedlają rozszerzenie schematu. Restore v3 zachowuje Correction, ChangeSet i zdarzenia. Nie ma automatycznego downgrade do starej aplikacji, dowodu produkcyjnej migracji ani semantycznej pamięci odrzuceń.

Poniższa macierz dokumentuje historyczny baseline `c0ce40b`, sprzed Etapów 6–7; bieżący zakres migracji jest opisany powyżej.

## Macierz zgodności (baseline)

| ELEMENT V1 | STAN 2.0 | STRATEGIA ZGODNOŚCI | MOMENT MIGRACJI | WARUNEK USUNIĘCIA ADAPTERA |
| --- | --- | --- | --- | --- |
| `Projekt`, punkt powrotu i archiwum | Nadal model v1 w web; port projektów i use case punktu powrotu | Jeden model/reguły, te same ID i ręczne pola; `ProjectSnapshot` pozostaje przyszłą projekcją | Osobna migracja Projects i jego konsumentów | Brak odbiorców fasady v1, zachowane archiwum/ID/historia i testy transakcji; dziś brak osobnego mappera projektu do usunięcia |
| `Wpis` / Capture | Deklaracja `RekordZrodlowy`; widok `wpisDoZrodla` | Dokładny `rawText`, ID, czas i pochodzenie; status/odłożenie zachowane w pełnym `zgodnoscV1`; powrót `zrodloDoWpisu` | Po walidatorach i trwałym kontrakcie źródła | Przeniesione wszystkie pola i konsumenty, dowód bezstratnego odtworzenia; v1 import nadal ma jawny czytnik |
| `AnalizaWpisu` i wynik dostawcy | Deklaracja `PrzebiegAnalizy`; `analizaDoPrzebiegu` w pamięci | `LEGACY_IMPORTED`, czasy `null`, ID/run/sourceId zachowane; metadane i pełny wynik/review v1 bez zgadywania modelu/promptu | Osobny etap runów według ADR 0003 | Trwały wynik i audyt przeniesione, brak zależności od `zgodnoscV1`, stare zastosowania rozpoznane bez ponownego apply |
| `ElementAnalizy`, korekty i historia review | Nadal część v1; brak osobnej encji audytu v2 | Oryginał, korekta, rozstrzygnięcia, czasy i skutki pozostają w pełnym starym rekordzie | Razem z jawnie zaprojektowanym audytem run/proposal/review | Każda korekta i odrzucenie ma zachowane pochodzenie i odczyt; żadnych rekonstruowanych zgód; dziś brak samodzielnego adaptera review |
| Jedna analiza na wpis, `analizyWpisow.wpisId` unique | Ograniczenie nadal aktywne, także w kopii | Adapter nie zapisuje wielu runów do v1, nie spłaszcza natywnego v2 | Dopiero razem: domena, indeks, walidacja backupu i UI | Migracja wielu runów zakończona; równoważna ochrona konwersji/apply, test dwóch runów i historycznych danych |
| `Decyzja`, `DEC-XXXX`, `projektIds`, zastępowanie | Istniejąca domena Decisions v1 | Zachować statusy, unikalny numer, relacje wielu projektów, wersje i `SUPERSEDED`; analiza tworzy tylko `PROPOSED` | Migracja właściciela Decisions/use cases | Cała historia i provenance zachowane, wszystkie wywołania przeniesione; nie istnieje jeszcze osobny mapper decyzji |
| `AnalizaWplywu`, `PropozycjaWplywu` | Istniejący relacyjny workflow i osobna zgoda | Zachować PENDING/APPROVED/REJECTED, ochronę nieaktualnego stanu i ręczne odniesienia | Po gotowym apply/zdarzeniach, jeśli zlecono Impact Engine | Ten sam zakres zgody i ochrony rewizji, brak dwóch silników wpływu i powielania skutków |
| `Obszar`, `Etap`, `ElementPracy`, `OtwartePytanie`, `Blokada` | Działające modele i pięć magazynów v1 | Zachować wersje, umiejscowienie, relacje decyzji oraz pochodzenie konwersji; zakończenie pracy nie przyjmuje decyzji | Migracja Execution i odniesień do run/proposal | Dowód zachowania relacji/statusów i zakazu podwójnej konwersji także między pracą/pytaniami; dziś brak odrębnego mappera Execution |
| `ZdarzenieAktywnosci` / ActivityEvent | Deklaracja koperty i `zdarzenieDoKoperty` | Zachować ID, czas, encję, projekty, metadane, źródło; `actor: null`; pełny stary rekord odtwarza różnicę `projektId`/`projektIds` | Wraz z trwałym formatem zdarzeń i audytem apply | Pełna historia czytelna, bez wymyślania aktora/revizji/ChangeSet; pozostaje czytnik starych zdarzeń |
| `RepozytoriumProjektowe` | Fasada komponuje sześć portów, backup i UnitOfWork | Stare metody pozostają; zapis wpisu/punktu powrotu współdzieli nowe use cases | Po jednym rzeczywistym workflow | Brak konsumentów dawnych metod; równoważna atomowość i obsługa błędów wszystkich workflow, bez dual-write |
| Transakcje IndexedDB | Nowy UnitOfWork dla projektów/wpisów/zdarzeń; inne zapisy starej fasady | Wynik po `oncomplete`, synchroniczne callbacki, rollback historii i encji | Osobne rozszerzenie portów/adaptera dla następnego workflow | Wszystkie wymagane operacje obsługiwane, odczyt bieżących rewizji i rollback potwierdzone; alternatywny storage wymaga własnego dowodu |
| Backup `schemaVersion: 1`, 11 magazynów | Format bez zmian; `kopiaDoWidokuV2` / `widokDoKopiiV1` | Zachować pełną kopię v1, walidację i relacje; powrót tylko dla niezmienionego bezstratnego widoku | Wersjonowany format v2 z czytnikiem v1 przed migracją persistence | Mapper widoków znika po migracji odbiorców; czytnik kopii v1 pozostaje do osobnej decyzji o końcu wsparcia i dowodu odtworzenia |
| Routing, hook rejestru i lokalny UI | Przeniesione do web, zachowane interakcje | Aktualne adresy i odczyt modeli v1; dwa use cases w hooku, reszta przez fasadę | Dopiero wraz z konkretnym workflow | Brak zależności UI od migrowanych metod/pól, zachowane deep linki i smoke; Etap 5 nie zmienia ekranów |

## Granica obecnego adaptera

`apps/web/src/infrastructure/zgodnoscV1V2.ts` jest adapterem widoków, nie mechanizmem dual-write ani migracją IndexedDB. Konwersja tworzy klony i przechowuje pełny oryginał `zgodnoscV1`. Powrót porównuje cały widok z ponownie wyprowadzoną projekcją; zmieniony tekst, źródło, schemat, preferencja, brak pełnego rekordu lub natywne v2 powodują jawny błąd. Serializacja JSON bez zmiany semantyki jest obsługiwana. Nie gwarantuje downgrade nowych danych v2.

`PropozycjaZmiany` i `ZestawZmian` są deklaracjami, bez mapowania dawnych działań na fikcyjnie istniejące zestawy. Adapter całej kopii zachowuje decyzje, wpływ i realizację w `zgodnoscV1`; nie tworzy ich natywnych projekcji v2.

## Weryfikacja i pozostające granice

Obecne testy pokrywają bezstratne mapowanie, izolację referencji, review/korekty/odrzucenia, brak zgadywania runów/aktorów i odrzucenie niedozwolonego downgrade. Test pełnej kopii przechodzi przez widok v2, walidację, import i eksport wszystkich 11 magazynów w fake-indexeddb.

Browser smoke z [BASELINE](BASELINE.md) potwierdza realny plik kopii v1, odtworzenie syntetycznych danych i identyczne `data` po reload. Nie jest dowodem natywnego v2 ani produkcyjnej migracji użytkownika. Usunięcie adaptera wymaga spełnienia właściwego wiersza macierzy, a nie samego PASS dotychczasowych testów.

Hub, Artifacts, Sync, AI i SDK integracji nie mają odpowiedników runtime v1 wymagających usunięcia adaptera. Pozostają osobnymi przyszłymi wdrożeniami według [ARCHITECTURE_TARGET](ARCHITECTURE_TARGET.md) i [MIGRATION_PLAN](MIGRATION_PLAN.md).
