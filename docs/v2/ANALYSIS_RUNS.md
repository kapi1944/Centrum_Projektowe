# Wersjonowane analizy — Etap 6

Stan wejściowy: `fc47c26` (`docs: complete Centrum Projektowe 2.0 baseline`), czyste `main`. Dokumenty baseline opisują historyczny stan Etapu 5. Poniższy dokument opisuje zmianę do IndexedDB v6 i backupu v2.

## Źródło, wynik i review

`RekordZrodlowy` / SourceRecord nadal jest widokiem istniejącego `Wpis` z adaptera zgodności. `sourceId` wskazuje `Wpis.id`, a `sourceType` ma wartość `CAPTURE`. Nie powstaje drugi magazyn oryginałów.

Rozszerzony istniejący `PrzebiegAnalizy` / AnalysisRun zawiera `id`, `sourceId`, `sourceType`, `provider`, opcjonalne `model` i `promptVersion`, `schemaVersion`, `status`, `startedAt`, `finishedAt`, opcjonalne `supersedesAnalysisRunId`, `preferred`, `output`, `reviewStatus` i `createdAt`. Wynik ma schemat `capture-analysis-v1`.

Status wykonania (`RUNNING`, `SUCCEEDED`, `FAILED`, `CANCELLED`, `LEGACY_IMPORTED`) jest osobny od review (`NOT_STARTED`, `GENERATED`, `IN_REVIEW`, `REVIEWED`, `APPLIED`). Niezakończony lub nieudany run nie ma wyniku ani review. Istniejące `AnalizaWpisu` przechowuje korekty, rozstrzygnięcia i historię review; jego ID odpowiada ID zakończonego runu. `output` zachowuje propozycje dostawcy, a nie późniejszą korektę użytkownika.

Use case `uruchomAnalizeWpisu` zapisuje `RUNNING` przed wywołaniem istniejącego lokalnego dostawcy. Wywołanie dostawcy odbywa się poza transakcją IndexedDB. Zapis wyniku, review i zdarzeń jest atomowy; błąd pozostawia wcześniejsze dane i zapisuje `FAILED`, jeśli run nadal istnieje. Wynik oczekujący podczas restore nie zostanie dopisany, jeśli restore usunął run lub zmienił treść źródła.

Bezpośrednia operacja zgodności `generuj`, przyjmująca już gotowy wynik, nadal działa: rejestruje jego zapis z czasem operacji jako początkiem i końcem. Te czasy nie mierzą pracy dostawcy. Interfejs używa use case z osobnym, trwałym rozpoczęciem.

## Migracja IndexedDB v5 → v6

Migracja wykonuje się w jednej transakcji upgrade:

1. Zastępuje unikalny indeks `analizyWpisow.wpisId` nieunikalnym indeksem o tej samej nazwie.
2. Dodaje magazyn `przebiegiAnaliz` z kluczem `id` i nieunikalnym indeksem `sourceId`.
3. Dla każdego dawnego review tworzy run z tym samym ID i źródłem, zachowanym dostawcą, wynikiem oraz `reviewStatus`.
4. Oznacza go jako `LEGACY_IMPORTED`, `preferred: true` i zapisuje `migrationSource: { kind: 'INDEXEDDB_V5', legacyAnalysisId }`. Bezpośrednia migracja z v4 używa `INDEXEDDB_V4`.

Nieznane historyczne czasy wykonania pozostają `null`; model, prompt i poprzednik pozostają nieokreślone. `createdAt` pochodzi z dawnego `utworzono`. Stare rekordy, korekty, statusy, zdarzenia i identyfikatory elementów pozostają bez zmian. Provenance decyzji, analiz wpływu, prac i pytań nadal wskazuje tę samą analizę i element. Nie powstają wymyślone historyczne ChangeProposal ani zdarzenia uruchomienia.

Błąd walidacji lub zapisu wycofuje dane, nowy magazyn, zmianę indeksu i wersję bazy. Można ponowić upgrade. Wcześniejsze ścieżki migracji v1–v4 są zachowane.

## Wiele runów i aktualna analiza

Pierwszy run z wynikiem zostaje preferowany. Następne nie zastępują go automatycznie. Źródło posiadające wyniki ma dokładnie jeden `preferred`; źródło z samymi nieudanymi lub trwającymi runami nie ma preferowanego wyniku.

Jawny wybór „Ustaw jako aktualną” zmienia oba markery w jednej transakcji i zapisuje `ANALYSIS_PREFERRED_CHANGED` z ID runu oraz poprzedniego wyboru. Sprawdzany jest oczekiwany poprzedni wybór, więc nieaktualna karta nie nadpisuje nowszej preferencji. Operacja nie zmienia źródła, review, decyzji ani realizacji. Rozpoczęcie i błąd runu mają własne ActivityEvent. Zakończenie zachowuje dotychczasowe `CAPTURE_ANALYZED`.

Historia pokazuje wszystkie runy i pozwala otworzyć ich review. Ponowienie działa także po zastosowaniu wcześniejszej analizy. Zastosowanie pozostaje osobną, jawną operacją review. Operacje historycznej, niepreferowanej analizy nie zmieniają transportowego statusu `Wpis`; status konkretnego review należy odczytać z runu i `AnalizaWpisu`. Sam wybór preferencji nie przelicza starego statusu wpisu.

## Backup i zgodność

Eksport zapisuje `schemaVersion: 2` i wszystkie 12 magazynów, w tym runy. Import rozpoznaje format 1 i 2. Odczyt pliku zachowuje jego wersję; migracja v1 odbywa się przy imporcie i dodaje `LEGACY_IMPORTED` z markerem `BACKUP_V1`. Wszystkie dane v1 pozostają odtwarzalne, również review i provenance.

Połączenie v1 z już zmigrowaną bazą zachowuje istniejący odpowiadający run, marker migracji i późniejszą preferencję. Różnice w dawnych rekordach review nadal stanowią konflikt i zatrzymują cały import. Restore i merge obejmują wszystkie magazyny atomowo. Walidacja v2 sprawdza relacje źródła, zgodność wyniku i review, dostawcę, preferencję, czasy oraz brak cykli poprzedników.

Adapter kopii v1 ↔ widok v2 nadal odtwarza pełny snapshot v1. Natywnego backupu v2 nie spłaszcza do v1, ponieważ zgubiłby wiele runów. Starsza aplikacja nie odczyta bazy v6 ani backupu v2; nie ma automatycznego downgrade.

## Weryfikacja i ograniczenia

Testy obejmują wiele runów i równoczesne zapisy, pojedynczą preferencję, konkurencyjny wybór, zachowanie review i provenance, migrację v5 → v6, rollback upgrade i zapisu zdarzeń, odrzucanie uszkodzonych relacji oraz round-trip v1 → import/migracja → eksport v2 → ponowny import.

Kontrole końcowe: `npm run lint`, `npm run typecheck`, `npm test` (121 testów web i 1 hub), `npm run build` oraz `git diff --check` — PASS.

Smoke w prawdziwej przeglądarce na osobnym lokalnym originie `127.0.0.1:5196` i danych syntetycznych: rzeczywisty import pliku v1 z częściowym review i korektą, ponowienie analizy, jawny wybór drugiej jako aktualnej, reload, rzeczywiste pobranie backupu v2, ponowne połączenie starego pliku bez utraty preferencji, restore pobranego pliku v2 i kolejny reload. Dwie analizy, stara korekta oraz nowy wybór zostały zachowane.

Nie ma odzyskiwania przerwanego procesu: zamknięcie aplikacji podczas pracy może pozostawić `RUNNING`; użytkownik może uruchomić nowy run. Typ `CANCELLED` pozostaje rozpoznawalny w formacie, ale nie dodano obsługi anulowania w UI. Dostawca nadal jest lokalny i regułowy. Analiza, korekta użytkownika i decyzja pozostają osobnymi pojęciami.
