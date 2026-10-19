# Etap 9 — repozytoria i pakiety kontekstu

Warstwa lokalnych metadanych jest dostępna z projektu przez „Repozytoria i generator kontekstu” (`/projekty/:projektId/repozytoria`). Nie odczytuje plików pod podaną ścieżką, nie łączy się z siecią i nie wykonuje zmian kodu ani projektu.

## Aktualizacja — Etap 10.1

[Adapter i synchronizacja GitHub](GITHUB_INTEGRATION.md) rozszerzają opisany poniżej historyczny Etap 9: publiczny odczyt REST na żądanie użytkownika, stabilne ID repozytorium, znormalizowana historia commitów i gałęzi, Evidence/SourceLink, statusy i daty próby/obserwacji. Dodano źródło i weryfikację `GITHUB_API`. IndexedDB nadal v8; backup v5 importuje v1–v4. Ręczne formularze nie nadają weryfikacji API. Poniższy opis braku sieci i granicy Etapu 10 dotyczy punktu odniesienia Etapu 9.

## Modele i tożsamość

`PolaczenieRepozytorium` odpowiada RepoConnection. Ma trwałe `id`, wiele `projektIds`, nazwę, rodzaj, dostawcę, opcjonalny URL HTTP(S), ścieżkę i domyślną gałąź, stan weryfikacji metadanych, czasy, notatkę i wersję. Jeden projekt może mieć wiele repozytoriów. Wspólny rekord edytuje się przez wybór projektów lub „Powiąż istniejące repozytorium”. Powtórzenie identycznego zapisu jest idempotentne. Ta sama znormalizowana ścieżka lub URL nie może utworzyć drugiej tożsamości. Zmiana metadanych sprawdza oczekiwaną wersję; nie ma rozstrzygania konfliktu zegarem.

`MigawkaRepozytorium` odpowiada RepositorySnapshot: `id`, `repoConnectionId`, gałąź, opcjonalny SHA, czas obserwacji, rodzaj i opis źródła, opis stanu, ostrzeżenia, ID dowodów i weryfikacja. Każda obserwacja jest nowym rekordem. Retry tego samego ID i treści jest bezskutkowy; zmiana treści istniejącej obserwacji jest odrzucana. Aktualna obserwacja to największy czas obserwacji, z deterministycznym rozstrzygnięciem remisu przez ID. Późniejszy import starszego raportu nie zastępuje nowszej obserwacji. Historia pozostaje czytelna osobno.

Obecne źródła to wpis ręczny i import raportu. Ręczny commit zawsze pozostaje niezweryfikowany. Raport również domyślnie jest niezweryfikowany. Potwierdzenie lokalne wymaga wskazania dowodu odczytu repozytorium lub wyniku testu, z opisem sprawdzenia i tą samą rewizją SHA. Jest to jawny zapis użytkownika o lokalnym sprawdzeniu, a nie automatyczna kontrola GitHub. Model nie przyjmuje dziś stanu „zweryfikowane przez integrację”. Przyszły adapter wymaga rozszerzenia walidacji i udokumentowania rzeczywistego pochodzenia w Etapie 10.

Minimalny raport JSON importowany w UI:

```json
{
  "galaz": "main",
  "commitSha": "abcdef1234567",
  "zaobserwowano": "2026-10-14T10:00:00.000Z",
  "opis": "Stan opisany w raporcie użytkownika",
  "ostrzezenia": ["Wynik wymaga sprawdzenia"]
}
```

`Dowod` odpowiada Evidence. To odniesienie, nie kopia źródła: ID, projekty, typ i ID źródła, pochodzenie, opis, stan weryfikacji, opcjonalna rewizja, czas obserwacji i opcjonalne powiązanie zewnętrzne. Obsługuje istniejący SourceRecord poprzez kanoniczny `Wpis`, AnalysisRun, Correction, ChangeSet, DomainEvent, decyzję, pracę, pytanie, bloker, repozytorium i obserwację. Nie ma kanonicznego modelu dokumentu: nie tworzymy jego pozornego odpowiednika.

Powiązanie zewnętrzne ma dokładnie istniejący typ `PolaczenieZrodla` z integration-sdk/contracts (SourceLink z ADR 0006). Zachowuje wersję 1, klucz idempotencji, dostawcę, połączenie, rodzaj zasobu, zewnętrzne ID oraz opcjonalne URL, rewizję i sourceId. Nie powstaje drugi SourceLink ani adapter sieciowy. Referencje, zakres projektów i połączenie są walidowane. Sam SourceLink nie uprawnia do wysyłki lub weryfikacji informacji. Deklaracja Codexa/narzędzia nie może otrzymać statusu potwierdzonego dowodu; wynik testu lub odczyt wymagają osobnej deklaracji użytkownika, opisu i rewizji.

## ContextPack i wybór zakresu

`PakietKontekstu` (`ContextPack`) jest nietrwałym rezultatem czystej funkcji `generujPakietKontekstu(dane, wybor, wygenerowano)`. Projekt i aktualny stan pochodzą z istniejącej projekcji `wyliczStanProjektu`. Funkcja nie używa zegara, losowania, LLM ani repozytorium zapisującego dane. Te same dane, wybór i czas dają tę samą zawartość, także po przestawieniu tablic danych i ID wyboru.

| Kontrakt zadania | Pole wykonywalne |
| --- | --- |
| project / currentSnapshot | projekt / aktualnaMigawka |
| selectedDecisions / selectedWorkItems | wybraneDecyzje / wybranePrace |
| selectedQuestions / selectedBlockers | wybranePytania / wybraneBlokery |
| repositorySnapshot | migawkaRepozytorium oraz metadane repozytorium |
| selectedDocuments | wybraneDokumenty, zawsze puste do powstania modelu dokumentów |
| recentCorrections / evidence | ostatnieKorekty / dowody oraz zrodla |
| goal / constraints / generatedAt | cel / ograniczenia / wygenerowano |

UI domyślnie zaznacza aktualny stan, obowiązujące decyzje i aktualne ograniczenia. Pozostałe rekordy wymagają zaznaczenia. Można wykluczyć każdy rekord i cały aktualny opis. Nie można wybrać odrzuconej/zastąpionej/proponowanej decyzji, zakończonej pracy, rozstrzygniętego pytania, nieaktywnego blokera ani niezastosowanej korekty. ID spoza zakresu kończy generowanie błędem.

Korekty pochodzą wyłącznie z zastosowanych ChangeSet i zdarzeń obejmujących projekt, również dla wspólnej decyzji. Eksportowane są tylko faktycznie przyjęte/edytowane operacje. Sekcja korekt jest historią zastosowań; nie przedstawia dawnych wartości jako obecnych ustaleń. Ograniczenia nadal odpowiadają bieżącym wartościom, według reguł Etapu 8.

Eksport zawiera tylko ostatnią obserwację wybranego repozytorium, bez jego historii. Wybranie dowodu dodaje opis i identyfikatory odniesienia, bez automatycznego dołączania treści źródła. Źródła wybranych decyzji i prac zachowują ID i lokalne adresy ekranów. Dowód dla nieaktualnej rewizji jest oznaczany jako niezweryfikowany. Wykluczenie dowodu potwierdzającego commit obniża weryfikację obserwacji w pakiecie. Lokalna decyzja zatwierdzona przez użytkownika nadal nie jest dowodem wyniku testu kodu.

Pełny klucz `MigawkaProjektu.rewizja` zawiera treść całej projekcji, więc nie jest eksportowany. `aktualnaMigawka` zachowuje projekt, czas danych oraz wybrane podsumowanie i cele; wybrane decyzje/prace/ograniczenia występują osobno. Zapobiega to przeciekowi wykluczonych rekordów przez rewizję. Pakiet jest klonem: edycja rezultatu nie zmienia danych wejściowych.

## Markdown, JSON i prywatność

Markdown ma 11 sekcji: cel, projekt, aktualny stan, ustalenia, ograniczenia, repozytorium i commit, problemy, prace, korekty, dowody i źródła, niepewność. Wszystkie dane użytkownika i źródeł są cytatami; znaki HTML i delimiterów kodu są escapowane. Instrukcje zawarte w danych pozostają danymi. Pakiet nie jest zgodą na wykonanie zmian. JSON ma wersję 1 i walidator runtime sprawdzający strukturę, aktualne statusy, źródła, weryfikację i relacje zawarte w pakiecie. Nie jest formatem importu zmian projektu.

Podgląd Markdown i pełny JSON pokazują dokładny zakres przed kopiowaniem lub zapisem pliku. Zmiana wyboru usuwa podgląd. Zmiana danych blokuje eksport starego podglądu. Schowek wymaga świadomego kliknięcia; jego niedostępność pozostawia możliwość zaznaczenia podglądu lub zapisu pliku. Pliki powstają lokalnie przez Blob. Nie ma wysyłki do GitHub, AI, Huba ani innych usług.

Modele nie mają pól tokenów i danych uwierzytelniających. Nieobsługiwane pola nowych encji są odrzucane. Rozpoznane wzorce sekretów (m.in. tokeny dostawców, przypisania haseł/kluczy, Bearer, klucz prywatny, URL z poświadczeniami) blokują zapis nowych metadanych oraz pakiet i backup. Kontrola backupu obejmuje także tekst starszych rekordów; wykrycie sekretu zatrzymuje eksport/import bez zmiany oryginałów i bez częściowego zapisu. Nie jest to uniwersalne rozpoznawanie dowolnych sekretów w swobodnej treści. Dokładny podgląd i świadomy wybór zakresu pozostają wymagane.

## Persistence i zgodność

IndexedDB v7 → v8 dodaje trzy puste magazyny w tej samej bazie: `polaczeniaRepozytoriow`, `migawkiRepozytoriow`, `dowody`. Nie przepisuje wcześniejszych danych. Port `RepozytoriumKontekstu` rozszerza istniejącą fasadę. Zapis używa istniejącego UnitOfWork z portem rewizji: walidacja przed zapisem, wynik dopiero po zakończeniu transakcji, rollback po błędzie. Nie zapisuje projektu, decyzji ani jego punktu powrotu.

Backup v4 obejmuje 19 magazynów. Wspólny rejestr schematu steruje odczytem, walidacją i importem. Czytniki v1/v2/v3 pozostają: nowe magazyny są puste w dawnych formatach. Scalanie starej kopii zachowuje lokalne nowe encje; świadome zastąpienie nadal oznacza cały stan kopii. Import waliduje źródła, projekty, tożsamości, dowody SHA i SourceLink oraz pozostaje jedną transakcją, także po clear. Konflikt nie oznacza nadpisania. Downgrade do aplikacji używającej starszej bazy nie jest zapewniony.

## Granica Etapu 10 i dowody odbioru

Etap 9 daje lokalne modele, historię i pakiet z jawnym pochodzeniem. Brak GitHub API, pobierania commitów/PR, monitorowania, indeksowania kodu, LLM, wysyłki pakietu, synchronizacji Raspberry Pi oraz integracji innych aplikacji. Etap 10 wymaga osobnego zlecenia i kontraktu adaptera z autoryzacją, walidacją, deduplikacją oraz rzeczywistym potwierdzeniem pochodzenia. Nie został rozpoczęty.

Testy ukierunkowane: `infrastructure/kontekstRepozytorium.test.ts` i `pages/RepozytoriaKontekst.test.tsx`. Pokrywają 18 wymaganych przypadków, wielorepozytoryjność, współdzielenie tożsamości, historię i retry, zatwierdzone ustalenia/korekty, zakres, deterministyczność, JSON, sekrety, brak sieci/zapisu domeny, stare backupy, upgrade v7, restore v4 i późny rollback. Fake-indexeddb/jsdom nie są dowodem migracji prywatnych danych użytkownika ani odbioru na fizycznym telefonie.

Przykład wygenerowany przez kod z danych syntetycznych: [Markdown](CONTEXT_PACK_EXAMPLE.md), [JSON](CONTEXT_PACK_EXAMPLE.json).

Odbiór dodatkowy w Edge/Chromium headless na izolowanych danych syntetycznych: utworzenie repozytorium i obserwacji przez UI, odczyt po reload, generowanie offline, rzeczywiste pobranie Markdown/JSON identycznych z podglądem, widok 1280×900 i 390×844 bez poziomego przepełnienia, brak błędów strony. Kopiowanie zweryfikowano w teście UI ze schowkiem testowym. Nie jest to odbiór na fizycznym telefonie ani migracja prywatnych danych użytkownika.

## Pliki zmienione w Etapie 9

- Modele i generator: `apps/web/src/domain/kontekstRepozytorium.ts`, `apps/web/src/domain/pakietKontekstu.ts`.
- Istniejące porty/storage/backup: `apps/web/src/domain/porty.ts`, `apps/web/src/domain/repozytorium.ts`, `apps/web/src/domain/kopieZapasowe.ts`, `apps/web/src/infrastructure/repozytoriumIndexedDb.ts`.
- UI i rejestr: `apps/web/src/pages/RepozytoriaKontekst.tsx`, `apps/web/src/pages/Projekt.tsx`, `apps/web/src/app/Aplikacja.tsx`, `apps/web/src/features/rejestr/useRejestrProjektowy.ts`, `apps/web/src/shared/style.css`.
- Nowe testy: `apps/web/src/infrastructure/kontekstRepozytorium.test.ts`, `apps/web/src/pages/RepozytoriaKontekst.test.tsx`.
- Dostosowane kontrakty fixture/oczekiwania schematu w istniejących testach: `apps/web/src/app/Aplikacja.test.tsx`, `apps/web/src/domain/stanProjektu.test.ts`, `apps/web/src/infrastructure/kopieZapasowe.test.ts`, `apps/web/src/infrastructure/korekty.test.ts`, `apps/web/src/infrastructure/przebiegiAnaliz.test.ts`.
- Bezpośrednia zależność typów SDK: `apps/web/package.json`, `package-lock.json` (bez zmiany wersji zewnętrznych bibliotek).
- Dokumentacja: `docs/v2/REPOSITORY_CONTEXT.md`, `docs/v2/ARCHITECTURE_TARGET.md`, `docs/v2/MIGRATION_PLAN.md`, `docs/v2/COMPATIBILITY.md`, `docs/v2/CONTEXT_PACK_EXAMPLE.md`, `docs/v2/CONTEXT_PACK_EXAMPLE.json`.
