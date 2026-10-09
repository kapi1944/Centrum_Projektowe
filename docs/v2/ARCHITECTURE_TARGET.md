# Architektura docelowa Centrum Projektowego 2.0

## Cel i rzeczywisty punkt wyjścia

Kontynuujemy jedno local-first Centrum Projektowe. [BASELINE](BASELINE.md) opisuje działający kod `c0ce40b`; ten dokument zestawia go z przyjętymi ADR 0001–0007. Cel nie oznacza wdrożenia. Dotychczasowe polskie modele, indeksy, backup, routing i UI są zachowane.

Docelowa zależność: UI web → przypadki użycia → reguły domeny/porty → adaptery. UI odzwierciedla wynik po trwałym zakończeniu zapisu. Dostawca analizy działa poza transakcją i nie otrzymuje prawa zapisu domeny. Hub jest opcjonalny; lokalny zapis i backup nie wymagają konta ani sieci.

## Runtime po Etapie 7

Etap 6 (`0299fd3`) wprowadził wiele AnalysisRun na źródło, jedno preferred, IndexedDB v6 i backup v2. Etap 7 dodaje [pipeline korekt](CORRECTION_PIPELINE.md): Correction → istniejący ChangeProposal → istniejąca AnalizaWplywu → review → ChangeSet → trwałe DomainEventEnvelope i ActivityEvent → bieżąca projekcja. Wykonywalna domena pozostaje lokalna w web; wspólne kontrakty są rozszerzone bez drugich modeli projektu/decyzji.

UnitOfWork otrzymuje port rewizji dla atomowego odczytu, sprawdzenia i zapisu skutków korekty. Correction/ChangeProposal/ChangeSet/DomainEvents mają trwałe magazyny w IndexedDB v7, a backup v3 zachowuje czytniki v1/v2. Historyczne źródła, wyniki, review i provenance pozostają dostępne. Nowy run po zaakceptowanej korekcie jest jawny i nadal wymaga review wyniku. Brak LLM, ProjectSnapshot, Attention Engine, dodatkowych integracji i alternatywnego storage.

Poniższa macierz opisuje historyczny baseline `c0ce40b`; stan runów i korekt został rozszerzony w Etapach 6–7 zgodnie z powyższym opisem.

## Własność kontekstów (baseline)

| Kontekst według ADR 0002 | Własność docelowa | Stan w audytowanym HEAD |
| --- | --- | --- |
| Projects | Tożsamość, cykl życia, prywatność, ręczny punkt powrotu | Wykonywalny `Projekt` w web; wydzielony use case punktu powrotu; prywatność per zasób niewdrożona |
| Knowledge | Niezmienne źródła i pochodzenie, jawnie zatwierdzona wiedza | Wykonywalny `Wpis`; deklaracja `RekordZrodlowy` i bezstratny widok; brak nowego storage źródeł/faktów |
| Decisions | Propozycje decyzji, przyjęcie, zastępowanie i review wpływu | Istniejące `Decyzja`/`AnalizaWplywu`, wiele projektów, wersje i osobne zgody |
| Execution | Obszary, etapy, praca, pytania i blokady | Pięć modeli i magazynów v1; jawna konwersja elementów analizy |
| Artifacts | Metadane plików i odniesienia do treści | Brak encji/portu. Backup jest formatem wymiany, nie artefaktem domenowym |
| Intelligence | Dostawcy, runy i propozycje, bez prawa zapisu projektu | Regułowy provider i review v1; deklaracje runu/propozycji/zestawu, bez pipeline runtime |
| Integrations | Mapowanie usług, koperty, deduplikacja i outbox | Deklaracje contracts/SDK, bez adaptera i kolejki trwałej |
| Sync | Rewizje wspólne, operacje, potwierdzenia, konflikty | Tylko ADR 0004; Hub `/health` nie implementuje Sync |

Konteksty nie są mikroserwisami ani nakazem osobnych baz. Polecenie wywołuje reguły właściciela danych. Koordynator zachowuje wspólną lokalną transakcję dla skutków wymagających atomowości. Historia współistnieje z aktualnymi encjami; nie zakładamy pełnego event sourcingu starej aplikacji.

## Pipeline według ADR 0003 i 0007

```text
Źródło → Przebieg analizy → Propozycja → Review użytkownika
       → Zatwierdzony zestaw zmian → Trwałe zdarzenia
       → Analiza wpływu / odtwarzalne projekcje stanu i uwagi
```

Źródło ≠ analiza ≠ propozycja ≠ decyzja. Nowy run zachowuje wcześniejsze wyniki i nie zatwierdza ich. Preferencja runu nie stosuje zmian. `PENDING`/`REJECTED` nie mają skutków, `EDITED` zachowuje oryginał i korektę. Apply ponownie sprawdza review, oczekiwane rewizje i relacje; encje, historia oraz marker idempotencji zatwierdzają się atomowo. Identyczny retry zwraca poprzedni rezultat, inna treść pod tym samym kluczem jest błędem.

Utworzona propozycja decyzji pozostaje `PROPOSED`, a wpływ wymaga kolejnego review. Projekcje `ProjectSnapshot`/`AttentionItem` mają być odtwarzalne, z kursorem i deduplikacją; nie zmieniają ręcznego punktu powrotu. W HEAD nie istnieją ich modele wykonywalne ani magazyny. Deklaracja `KopertaZdarzeniaDomenowego` jest pierwszym kontraktem; nie zawiera jeszcze wszystkich docelowych danych powiązania apply/revizji opisanych w ADR.

## Odpowiedzialność workspaces

- `apps/web`: kompozycja adapterów i UI, lokalne use cases. Reguły nadal mieszczą się w lokalnym `domain`; przyszłe przenoszenie odbywa się po jednym używanym workflow.
- `packages/domain`: czyste reguły i porty po migracji; dziś tylko typy v2 i `JednostkaPracy`. Nie powstaje drugi model projektu/decyzji.
- `packages/contracts`: wersjonowane kontrakty wymiany; dziś health i integracje. Runtime wymaga odrębnej walidacji przed zapisem.
- `packages/integration-sdk`: porty wspólne adapterów; dziś tylko deklaracje. Payload `unknown` nie jest automatycznie zaufany.
- `apps/hub`: opcjonalny gospodarz przyszłych możliwości wspólnych, z osobną granicą autoryzacji. Dziś tylko lokalny health i test HTTP.
- `packages/ui`, `packages/testing`: kod współdzielony dopiero przy rzeczywistym użyciu; dzisiejsze style, komponenty, fixture i konfiguracja web pozostają lokalne.

## Storage, Hub i integracje

[ADR 0005](../adr/0005-storage-provider.md): porty opisują zachowanie i atomowość, adapter zapewnia trwałość. Obecny UnitOfWork nie ujawnia `IDBTransaction`, ale obsługuje tylko trzy logiczne porty i synchroniczne callbacki. Pozostała fasada nadal używa szerokich transakcji IndexedDB. Alternatywny storage musi dowieść tych samych rewizji, unikalności, rollbacku, eksportu/importu i odczytu po restarcie; nie jest już wdrożony przez samo istnienie portu.

[ADR 0001](../adr/0001-local-first-and-hub.md) i [ADR 0004](../adr/0004-sync-authority.md): lokalny stan jest autorytetem pracy urządzenia; Hub byłby autorytetem wspólnej przyjętej rewizji jawnie synchronizowanego zasobu. Konflikt zachowuje oba konteksty, nie rozstrzyga się zegarem. Przyszłe zasoby domyślnie `PRIVATE`; podłączenie Hubu nie publikuje danych. W kodzie v1 brak tej polityki per zasób, kont i protokołu Sync.

[ADR 0006](../adr/0006-integration-sdk.md): integracja odbiera wersjonowane dane do źródeł i pipeline review; wysyła tylko zatwierdzony zakres. Trwały outbox ma odróżniać dostarczenie, retry, odrzucenie i nieznany wynik. Nie ma obecnie klienta GitHub API ani integracji Ogarniacza/Po Kapiemu. Sekrety nie należą do rekordów, logów, kopert ani backupu.

[ADR 0007](../adr/0007-ai-review-gate.md): AI tylko proponuje, wysyłka konkretnego źródła wymaga zgody; błąd dostawcy zachowuje źródło i review. Dzisiejszy `RuleBasedAnalysisProvider` nie jest zdalną AI.

## Bramka realizacji celu

Architektura docelowa jest osiągana przez mierzalne migracje z [MIGRATION_PLAN](MIGRATION_PLAN.md) i warunki [COMPATIBILITY](COMPATIBILITY.md), bez globalnej przebudowy. Obecne testy i browser smoke potwierdzają baseline v1 z fundamentem v2; nie potwierdzają natywnego pipeline, nowego storage, synchronizacji, AI ani wdrożenia produkcyjnego.
