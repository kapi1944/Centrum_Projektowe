# Model domenowy

Nazwy domenowe w kodzie są polskie. `AnalysisProvider` i `RuleBasedAnalysisProvider` zachowują nazwy kontraktu Etapu 3R.

| Pojęcie | Nazwa w kodzie | Stan i odpowiedzialność |
| --- | --- | --- |
| Project | Projekt | Istniejący model: nazwa, opis, status, punkt powrotu, daty, archiwizacja, źródło |
| Capture | Wpis | Niezmienny oryginał `trescOryginalna` (rawText), identyfikator, data, opcjonalny projekt, źródło i status |
| CaptureAnalysis | AnalizaWpisu | Oddzielny wynik dostawcy, powiązanie do wpisu, wersje, review i audyt zastosowania |
| AnalysisItem | ElementAnalizy | Typ i treść propozycji, oryginał systemu, edycja użytkownika, oceny i wynik zastosowania |
| Decision | Decyzja | Istniejące ustalenia, `DEC-XXXX`, status, wersja, projekty, źródło i supersession |
| ImpactAnalysis | AnalizaWplywu | Istniejące propozycje wpływu oparte na relacjach, z osobnym rozstrzyganiem |
| ActivityEvent | ZdarzenieAktywnosci | Trwała historia operacji, kontekst źródła i metadane |
| Task / WorkItem / OpenQuestion / Blocker / Document | — | Brak pełnych encji; ręczne odnośniki ustaleń nie są encjami wykonania |
| Area / Stage / Repository / Resource / ProjectHealth | — | Poza obecnym zakresem |

## Oryginał i analiza

**ORYGINAŁ ≠ ANALIZA ≠ DECYZJA. Analiza nie jest prawdą.** Oryginał pochodzi od użytkownika, a system nie może nadpisywać go analizą, summary ani edycją elementu. Zapis zachowuje białe znaki. Wpis może nie mieć projektu.

`AnalizaWpisu` przechowuje:

- `id`, `wpisId` (captureId), `utworzono` (createdAt);
- `typDostawcy` (RULE_BASED / REMOTE_LLM / LOCAL_LLM), opcjonalnie `nazwaDostawcy`, `wersjaDostawcy`;
- `wersjaAnalizy` (wersja formatu/reguł), opcjonalnie `klasyfikacja`, `podsumowanie`;
- `status`: GENERATED → IN_REVIEW → REVIEWED → APPLIED;
- `wersja`: rosnący licznik do kontroli konkurencyjnego zapisu;
- `elementy`, opcjonalne daty `sprawdzono` i `zastosowano`.

Jedna analiza przypada na Capture. Wynik wygenerowania jest utrwalany nawet bez review lub apply. Nie ma regeneracji ani nadpisywania poprzedniej analizy.

## Elementy i review

Każdy `ElementAnalizy` ma `id`, `typ`, `tresc`, opcjonalną `pewnosc` (0–1), `zrodlo` SYSTEM / AI, `trescOryginalna` (originalText), opcjonalną `trescEdytowana` (editedText) i `statusReview`: PENDING / ACCEPTED / EDITED / REJECTED. Obecny provider zawsze zwraca SYSTEM i pomija pewność. `tresc` i `trescOryginalna` zachowują propozycję dostawcy; edycje nigdy ich nie nadpisują.

`historiaReview` dopisuje każde zapisane rozstrzygnięcie: status, treść edycji, czas i źródło działania użytkownika. Odrzucone elementy pozostają w analizie. Po zastosowaniu `zastosowanie` wskazuje datę, rodzaj efektu (DECISION / IMPACT / RETAINED) oraz, gdy dotyczy, encję i projekt docelowy. W ten sposób można odtworzyć propozycję, korekty, akceptację, odrzucenie i faktyczny efekt.

| Typ | Znaczenie | Efekt apply dla ACCEPTED / EDITED |
| --- | --- | --- |
| FACT | Wyekstrahowane twierdzenie wymagające review; nie automatyczna prawda | Zachowany element analizy; nie Decision |
| ASSUMPTION | Założenie / interpretacja | Zachowane jako założenie, nigdy automatycznie zamienione na fakt |
| SUGGESTION | Sugestia | Zachowany element analizy |
| POSSIBLE_DECISION | Potencjalna decyzja | Istniejąca Decyzja, status PROPOSED |
| OPEN_QUESTION | Otwarte pytanie | Zachowany element, bez pełnej encji OpenQuestion |
| RECOMMENDED_ACTION | Rekomendowane działanie | Zachowany element oczekujący na Etap 5, bez Task |
| IMPACT_CANDIDATE | Kandydat możliwego wpływu | Istniejąca AnalizaWplywu z propozycjami wymagającymi osobnego zatwierdzenia |

ACCEPTED używa `trescOryginalna`, EDITED używa `trescEdytowana`. PENDING i REJECTED nie mają efektów. Zakończenie review wymaga rozstrzygnięcia wszystkich elementów; apply wymaga REVIEWED i co najmniej jednego zatwierdzonego elementu. Analiza bez rozpoznanych elementów może zostać sprawdzona, ale pozostaje bez apply. Zakończone review jest zamknięte na edycję; częściowe review można kontynuować.

## Integracja z istniejącymi Decision i Impact

`Decyzja.wpisZrodlowyId` jest istniejącym odpowiednikiem `Decision.originCaptureId`. Decyzje utworzone z analizy dodatkowo przechowują `analizaWpisuId` i `elementAnalizyId`. Zachowują dostawcę jako źródło SYSTEM / AI, a korektę i zgodę użytkownika w historii review. `DEC-XXXX`, wersjonowanie, przyjmowanie, zmiany statusów oraz supersession pozostają w mechanizmie Etapu 4.

`AnalizaWplywu.zrodlo` pozostaje CAPTURE / DECISION. Przy inicjowaniu z zatwierdzonego kandydata dodaje `zrodloAnalizyWpisu`: identyfikatory analizy i elementu oraz zatwierdzoną treść. Wpływ nadal wynika ze wspólnych projektów i jawnych relacji, nie z interpretacji tekstu kandydata. Każda propozycja ma własny stan PENDING / APPROVED / REJECTED. Kontrola wersji decyzji i snapshotu punktu powrotu chroni przed stale proposal.

Decyzja i wpływ wymagają aktywnego projektu. Dla luźnego wpisu użytkownik wskazuje cel przy apply; zostaje on zapisany w encji wynikowej i audycie zastosowania, bez przepisywania `Wpis.projektId`. Pozostałe typy można zachować bez projektu. Apply nie kopiuje faktów, założeń ani summary do pól Project. Zmiana punktu powrotu jest dostępna przez osobno zatwierdzony wpływ.

## Statusy Capture i atomowość

| Działanie | Status Capture |
| --- | --- |
| Zapis oryginału | UNPROCESSED |
| Zapis wygenerowanej analizy | ANALYZED |
| Rozpoczęcie / częściowe review | ANALYZED |
| Zakończenie review | REVIEWED |
| Udany apply | APPLIED |
| Dotychczasowe odrzucenie nieprzetworzonego wpisu | DISMISSED |

Capture, analiza, efekty i historia są zapisywane w jednej transakcji IndexedDB. Nieudany apply nie może pozostawić częściowej decyzji, wpływu ani statusu APPLIED. Powtórny apply jest blokowany. Zdarzenia `CAPTURE_ANALYZED`, `CAPTURE_REVIEWED`, `CAPTURE_ANALYSIS_APPLIED` opisują granice przepływu; szczegóły kliknięć pozostają w audycie elementu zamiast spamować ActivityEvent.
