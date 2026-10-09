# ADR 0003 — Pipeline propozycji zmian i przebiegi analiz

## Kontekst

Dziś `Wpis` ma maksymalnie jedną `AnalizaWpisu`: wymusza to domena, unikalny indeks `analizyWpisow.wpisId` i walidacja kopii. Analiza przechowuje wynik dostawcy, review oraz zastosowanie w jednym rekordzie. `APPLIED` zamyka analizę i wpis. Zatwierdzony `POSSIBLE_DECISION` tworzy decyzję `PROPOSED`, a wpływ wymaga osobnego review. Nowe przebiegi nie mogą nadpisać tej historii ani ponownie zastosować dawnych skutków.

## Decyzja

Docelowy przepływ:

```text
SourceRecord → AnalysisRun → ChangeProposal → User Review
             → ChangeSet → DomainEvents → Impact Engine
             → ProjectSnapshot / AttentionItem
```

| Element | Kontrakt |
| --- | --- |
| SourceRecord | Niezmienny oryginał, `id`, pochodzenie, czas, opcjonalne przypisanie projektu; edycja źródła tworzy nowy rekord z jawnym powiązaniem |
| AnalysisRun | Jeden przebieg dostawcy dla konkretnego źródła; wynik nie jest stanem projektu |
| ChangeProposal | `id`, `sourceId`, `analysisRunId`, identyfikatory elementów wyniku, wersja schematu, proponowane operacje, cele i oczekiwane rewizje; zachowany oryginalny wynik |
| User Review | Osobny audyt propozycji: rewizja, rozstrzygnięcia `PENDING` / `ACCEPTED` / `EDITED` / `REJECTED`, treść korekty, osoba lub lokalny użytkownik i czas |
| ChangeSet | Niezmienny zestaw jawnie zatwierdzonych operacji, identyfikator review i jego rewizja, oczekiwane rewizje encji i klucz idempotencji |
| DomainEvents | Trwałe skutki zastosowania: `eventId`, wersja schematu, `changeSetId`, typ i ID encji, rewizja, czas, pochodzenie oraz dane zdarzenia |
| ProjectSnapshot / AttentionItem | Odtwarzalne projekcje stanu i sygnałów uwagi z kursorem przetworzonych zdarzeń; nie zastępują encji ani decyzji |

`ChangeProposal` zawiera polecenia ze skończonego katalogu domenowego, nie dowolny patch rekordów. Żaden `AnalysisProvider` nie dostaje repozytorium, uprawnień zapisu ani callbacku modyfikującego projekt. Przyjmuje źródło i parametry analizy; zwraca wynik walidowany przez aplikację. Generowanie odbywa się poza transakcją.

Review rozstrzyga wszystkie elementy przed zamknięciem. `PENDING` i `REJECTED` nie mają skutków; `EDITED` zachowuje wynik pierwotny i korektę. Zmiana zatwierdzonej propozycji wymaga nowej rewizji i ponownego review. Zakończenie review bez zaakceptowanych operacji nie tworzy `ChangeSet`.

Koordynator przed zastosowaniem ponownie sprawdza review, rewizje, relacje i reguły domeny. Encje, audyt zastosowania, marker idempotencji i zdarzenia zapisuje atomowo. Błąd wycofuje wszystko. Powtórzenie identycznego `ChangeSet` zwraca zapisany rezultat; ten sam klucz z inną treścią jest odrzucany. Sukces jest widoczny dopiero po zakończeniu transakcji.

Impact Engine przetwarza tylko utrwalone zdarzenia i deduplikuje je po `eventId`. Może odtworzyć projekcje i wygenerować nową propozycję wpływu, lecz zmiana domeny wymaga kolejnego review. Aktualizacja projekcji nie zmienia ręcznego punktu powrotu. Awaria projekcji pozostawia kursor do ponowienia i nie cofa zatwierdzonej domeny. Zdarzenia i aktualny stan współistnieją; nie zakładamy odtworzenia całej starej domeny z niepełnej historii MVP.

### AnalysisRun

`SourceRecord` ma wiele `AnalysisRun`. Docelowy kontrakt danych:

| Pole | Znaczenie i ograniczenie |
| --- | --- |
| `id` | Trwały, niepusty identyfikator przebiegu |
| `sourceId` | Istniejący niezmienny `SourceRecord` |
| `provider` | Identyfikator, rodzaj i znana wersja dostawcy; nie sekret |
| `model?` | Faktycznie użyty model, gdy dotyczy |
| `promptVersion?` | Znana wersja instrukcji, gdy dotyczy |
| `schemaVersion` | Wersja kontraktu wyniku, niezależna od wersji bazy i rewizji rekordu |
| `startedAt` | Czas ISO UTC; dla importu historycznego może być `null`, jeśli nieznany |
| `finishedAt` | Czas ISO UTC zakończenia lub `null` przed zakończeniem; w migracji także `null`, gdy nieznany |
| `status` | `RUNNING`, `SUCCEEDED`, `FAILED`, `CANCELLED` lub `LEGACY_IMPORTED` |
| `supersedesAnalysisRunId?` | Istniejący wcześniejszy run tego samego źródła; bez cykli, nie oznacza usunięcia |
| `output` | Wersjonowany, walidowany wynik; `null` przed sukcesem lub przy błędzie; import historyczny zachowuje dawny wynik |

Nowy `RUNNING` wymaga `startedAt`; terminalny nowy run wymaga `finishedAt` nie wcześniejszego niż start. `SUCCEEDED` wymaga poprawnego `output`; błąd ma osobną bezpieczną diagnostykę bez sekretów. Po zakończeniu wynik jest niezmienny. Stan review nie jest statusem runu.

Źródło może mieć opcjonalny `preferredAnalysisRunId`, wskazujący jeden pomyślny lub poprawnie importowany przebieg tego źródła. Użytkownik zmienia go jawnie, z kontrolą rewizji i audytem. Nowy run i `supersedesAnalysisRunId` nie zmieniają go automatycznie. Preferencja nie zatwierdza propozycji, nie usuwa starszych wyników i nie odwraca ich zastosowania.

### Plan migracji, bez wykonania

1. Zachować `Wpis.id`, dokładny oryginał, przypisania i historię jako `SourceRecord`. Status przetworzenia MVP zachować jako metadane historyczne; nie używać go jako globalnej blokady nowych runów.
2. Każdą `AnalizaWpisu` przenieść do jednego runu z dotychczasowym ID i `sourceId = wpisId`. Zachować dostawcę, jego wersję i `wersjaAnalizy` w metadanych historycznych; nie utożsamiać jej bez walidacji z nowym `schemaVersion`.
3. Stare `utworzono` oznacza zapis wygenerowanego wyniku, nie zmierzony start/koniec dostawcy. Zachować je osobno; run oznaczyć `LEGACY_IMPORTED`, nie wymyślać czasów, modelu ani wersji promptu.
4. Przenieść elementy, review i zastosowanie do jawnych propozycji i audytu z zachowaniem ID. Dawne efekty oznaczyć jako już zastosowane. Nie odtwarzać brakujących historycznych `ChangeSet` ani `DomainEvents` jako rzekomych nowych operacji.
5. Zachować odwołania decyzji, wpływu i konwersji do dawnego ID analizy/elementu, przez jawne mapowanie do runu/propozycji. Jedno źródło z jednym poprawnym starym runem może otrzymać go jako preferowany, z oznaczeniem pochodzenia migracyjnego.
6. Dopiero w osobnym etapie usunąć ograniczenie jednej analizy w domenie, zastąpić unikalny indeks źródła indeksem nieunikalnym i zmienić backup oraz UI. Obecne unikalne pochodzenie konwersji i ochrona przed podwójnym zastosowaniem wymagają równoważnych reguł dla propozycji, nie prostego usunięcia indeksów.

## Konsekwencje

Przyszłe testy kontraktu muszą obejmować dwa runy jednego źródła bez utraty review, brak zapisu domeny przez dostawcę, brak automatycznej akceptacji przy zmianie preferencji, nieaktualne rewizje, idempotentne zastosowanie, rollback historii i ponowienie projekcji bez powielania wpływu. Migracja musi zachować backup, stare ID, `PROPOSED` decyzji, osobne review wpływu i ręczny punkt powrotu.

W tym etapie zapisujemy kontrakt w dokumentacji. Nie dodajemy nieużywanych typów runtime ani testów sprawdzających wyłącznie własne deklaracje. Wymienione scenariusze są bramkami przyszłej implementacji, nie wykonanymi testami 2.0.

## Alternatywy odrzucone

- Nadpisywanie ostatniej analizy: utrata pochodzenia i review.
- Wspólne statusy runu i review: pomylenie sukcesu dostawcy ze zgodą użytkownika.
- Automatyczne stosowanie najnowszego wyniku: omija review.
- Dowolne patche projektu generowane przez dostawcę: omijają reguły domeny.

## Status

Przyjęta decyzja projektowa 2.0; pipeline i migracja niewdrożone. IndexedDB pozostaje v5.
