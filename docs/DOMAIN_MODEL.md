# Model domenowy

Nazwy domenowe w kodzie są polskie. `AnalysisProvider` i `RuleBasedAnalysisProvider` zachowują nazwy kontraktu Etapu 3R.

| Pojęcie | Nazwa w kodzie | Stan i odpowiedzialność |
| --- | --- | --- |
| `Project` | Projekt | Istniejący model: nazwa, opis, status, punkt powrotu, daty, archiwizacja, źródło |
| `Capture` | Wpis | Niezmienny oryginał `trescOryginalna` (`rawText`), identyfikator, data, opcjonalny projekt, źródło i status |
| `CaptureAnalysis` | AnalizaWpisu | Oddzielny wynik dostawcy, powiązanie do wpisu, wersje, weryfikacja i audyt zastosowania |
| `AnalysisItem` | ElementAnalizy | Typ i treść propozycji, oryginał systemu, edycja użytkownika, oceny i wynik zastosowania |
| `Decision` | Decyzja | Istniejące ustalenia, `DEC-XXXX`, status, wersja, projekty, źródło i zastępowanie |
| `ImpactAnalysis` | AnalizaWplywu | Istniejące propozycje wpływu oparte na relacjach, z osobnym rozstrzyganiem |
| `ActivityEvent` | ZdarzenieAktywnosci | Trwała historia operacji, kontekst źródła i metadane |
| `Area` | Obszar | Projekt, nazwa, opis, status i daty |
| `Stage` | Etap | Projekt, opcjonalny obszar, nazwa, opis, status i kolejność |
| `WorkItem` | ElementPracy | Siedem typów pracy, status, priorytet, opcjonalny obszar i etap, decyzje, daty i pochodzenie |
| `OpenQuestion` | OtwartePytanie | Osobna encja z kontekstem, odpowiedzią i stanem rozstrzygnięcia |
| `Blocker` | Blokada | Osobna encja z wagą, stanem i datą rozwiązania |
| `Document` / `Repository` / `Resource` / `ProjectHealth` | — | Poza obecnym zakresem |

## Oryginał i analiza

**ORYGINAŁ ≠ ANALIZA ≠ DECYZJA. Analiza nie jest prawdą.** Oryginał pochodzi od użytkownika, a system nie może nadpisywać go analizą, podsumowaniem ani edycją elementu. Zapis zachowuje białe znaki. Wpis może nie mieć projektu.

`AnalizaWpisu` przechowuje:

- `id`, `wpisId` (`captureId`), `utworzono` (`createdAt`);
- `typDostawcy` (`RULE_BASED` / `REMOTE_LLM` / `LOCAL_LLM`), opcjonalnie `nazwaDostawcy`, `wersjaDostawcy`;
- `wersjaAnalizy` (wersja formatu/reguł), opcjonalnie `klasyfikacja`, `podsumowanie`;
- `status`: `GENERATED` → `IN_REVIEW` → `REVIEWED` → `APPLIED`;
- `wersja`: rosnący licznik do kontroli konkurencyjnego zapisu;
- `elementy`, opcjonalne daty `sprawdzono` i `zastosowano`.

Jedna analiza przypada na `Capture`. Wynik wygenerowania jest utrwalany nawet bez weryfikacji lub zastosowania. Nie ma regeneracji ani nadpisywania poprzedniej analizy.

## Elementy i weryfikacja

Każdy `ElementAnalizy` ma `id`, `typ`, `tresc`, opcjonalną `pewnosc` (0–1), `zrodlo` `SYSTEM` / `AI`, `trescOryginalna` (`originalText`), opcjonalną `trescEdytowana` (`editedText`) i `statusReview`: `PENDING` / `ACCEPTED` / `EDITED` / `REJECTED`. Obecny dostawca zawsze zwraca `SYSTEM` i pomija pewność. `tresc` i `trescOryginalna` zachowują propozycję dostawcy; edycje nigdy ich nie nadpisują.

`historiaReview` dopisuje każde zapisane rozstrzygnięcie: status, treść edycji, czas i źródło działania użytkownika. Odrzucone elementy pozostają w analizie. Po zastosowaniu `zastosowanie` wskazuje datę, rodzaj efektu (`DECISION` / `IMPACT` / `RETAINED`) oraz, gdy dotyczy, encję i projekt docelowy. W ten sposób można odtworzyć propozycję, korekty, akceptację, odrzucenie i faktyczny efekt.

| Typ | Znaczenie | Efekt zastosowania dla `ACCEPTED` / `EDITED` |
| --- | --- | --- |
| `FACT` | Wyekstrahowane twierdzenie wymagające weryfikacji; nie automatyczna prawda | Zachowany element analizy; nie `Decision` |
| `ASSUMPTION` | Założenie / interpretacja | Zachowane jako założenie, nigdy automatycznie zamienione na fakt |
| `SUGGESTION` | Sugestia | Zachowany element analizy |
| `POSSIBLE_DECISION` | Potencjalna decyzja | Istniejąca Decyzja, status `PROPOSED` |
| `OPEN_QUESTION` | Otwarte pytanie | Zachowany element; osobna potwierdzona konwersja do `OtwartePytanie` |
| `RECOMMENDED_ACTION` | Rekomendowane działanie | Zachowany element; osobna potwierdzona konwersja do `ElementPracy` |
| `IMPACT_CANDIDATE` | Kandydat możliwego wpływu | Istniejąca AnalizaWplywu z propozycjami wymagającymi osobnego zatwierdzenia |

`ACCEPTED` używa `trescOryginalna`, `EDITED` używa `trescEdytowana`. `PENDING` i `REJECTED` nie mają efektów. Zakończenie weryfikacji wymaga rozstrzygnięcia wszystkich elementów; zastosowanie wymaga `REVIEWED` i co najmniej jednego zatwierdzonego elementu. Analiza bez rozpoznanych elementów może zostać zweryfikowana, ale pozostaje bez zastosowania. Zakończona weryfikacja jest zamknięta na edycję; częściową weryfikację można kontynuować.

## Integracja z istniejącymi `Decision` i `Impact`

`Decyzja.wpisZrodlowyId` jest istniejącym odpowiednikiem `Decision.originCaptureId`. Decyzje utworzone z analizy dodatkowo przechowują `analizaWpisuId` i `elementAnalizyId`. Zachowują dostawcę jako źródło `SYSTEM` / `AI`, a korektę i zgodę użytkownika w historii weryfikacji. `DEC-XXXX`, wersjonowanie, przyjmowanie, zmiany statusów oraz zastępowanie pozostają w mechanizmie Etapu 4.

`AnalizaWplywu.zrodlo` pozostaje `CAPTURE` / `DECISION`. Przy inicjowaniu z zatwierdzonego kandydata dodaje `zrodloAnalizyWpisu`: identyfikatory analizy i elementu oraz zatwierdzoną treść. Wpływ nadal wynika ze wspólnych projektów i jawnych relacji, nie z interpretacji tekstu kandydata. Każda propozycja ma własny stan `PENDING` / `APPROVED` / `REJECTED`. Kontrola wersji decyzji i zapisanego stanu punktu powrotu chroni przed nieaktualną propozycją.

Decyzja i wpływ wymagają aktywnego projektu. Dla luźnego wpisu użytkownik wskazuje cel przy zastosowaniu; zostaje on zapisany w encji wynikowej i audycie zastosowania, bez przepisywania `Wpis.projektId`. Pozostałe typy można zachować bez projektu. Zastosowanie nie kopiuje twierdzeń, założeń ani podsumowania do pól `Project`. Zmiana punktu powrotu jest dostępna przez osobno zatwierdzony wpływ.

## Statusy `Capture` i atomowość

| Działanie | Status `Capture` |
| --- | --- |
| Zapis oryginału | `UNPROCESSED` |
| Zapis wygenerowanej analizy | `ANALYZED` |
| Rozpoczęcie / częściowa weryfikacja | `ANALYZED` |
| Zakończenie weryfikacji | `REVIEWED` |
| Udane zastosowanie | `APPLIED` |
| Dotychczasowe odrzucenie nieprzetworzonego wpisu | `DISMISSED` |

`Capture`, analiza, efekty i historia są zapisywane w jednej transakcji IndexedDB. Nieudane zastosowanie nie może pozostawić częściowej decyzji, wpływu ani statusu `APPLIED`. Powtórne zastosowanie jest blokowane. Zdarzenia `CAPTURE_ANALYZED`, `CAPTURE_REVIEWED`, `CAPTURE_ANALYSIS_APPLIED` opisują granice przepływu; szczegóły kliknięć pozostają w audycie elementu bez osobnego zdarzenia `ActivityEvent` na każde kliknięcie.

## Model realizacji

Każda encja realizacji ma `id`, `projektId`, daty utworzenia i aktualizacji oraz rosnącą `wersja`. Obszar i etap są opcjonalne dla pracy; etap przypisany do obszaru wymaga zgodnego obszaru pracy. Nie można przenieść etapu, jeżeli naruszyłoby to relacje jego elementów. Archiwalny projekt nie przyjmuje zmian realizacji.

`ElementPracy.typ` to `TASK`, `RESEARCH`, `EXPERIMENT`, `CONTACT`, `PURCHASE`, `FOLLOW_UP` lub `WAITING`. `decyzjaIds` przechowuje rzeczywistą relację wiele-do-wielu bez duplikatów; decyzje muszą obejmować projekt pracy. Dotychczasowe ręczne `PowiazanyElement` pozostają odrębne i nie są przepisywane.

Pytanie ma stan `OPEN`, `ANSWERED` lub `DISMISSED`; odpowiedź jest wymagana przy `ANSWERED`. Blokada ma stan `ACTIVE`, `RESOLVED` lub `DISMISSED` i wagę `LOW`, `MEDIUM`, `HIGH` lub `CRITICAL`. Etykiety interfejsu są polskie.

Praca i pytanie utworzone z analizy zachowują `pochodzenie`: `analizaWpisuId`, `elementAnalizyId`, `wpisId`. Konwersja obejmuje tylko zaakceptowane lub edytowane działania i pytania w zastosowanej analizie z efektem `RETAINED`. Nie wymaga ponownej analizy starszych wpisów i nie zmienia źródła.

## Format kopii zapasowej (Etap 6)

Kopia nie jest nową encją persistent. Jest zewnętrznym dokumentem JSON: `format: "centrum-projektowe"`, `schemaVersion: 1`, tekstowe `appVersion`, `exportedAt` oraz `data`. Data eksportu jest datą ISO. `data` zawiera tablice `projekty`, `wpisy`, `zdarzenia`, `decyzje`, `analizyWplywu`, `analizyWpisow`, `obszary`, `etapy`, `elementyPracy`, `pytania`, `blokady`; puste magazyny nadal występują jako puste tablice. Oryginały, statusy, źródła, wersje i historia są przenoszone bez przeliczania i renumerowania. Wersja kopii 1 nie oznacza wersji IndexedDB 1 (baza nadal v5).

Walidacja sprawdza główny format, wersję, metadane, komplet magazynów, pola wymagane i opcjonalne, typy zagnieżdżone, statusy oraz ID. Odrzuca powtórzone ID, numery decyzji, wiele analiz jednego wpisu oraz powtórzone pochodzenie konwersji. Kontrola relacji obejmuje projekty, źródłowe wpisy, zastępowanie decyzji, pochodzenie analiz i konwersji, cele zastosowania, propozycje wpływu, encje historii oraz zgodność projektu/obszaru/etapu i decyzji pracy. Historyczne wersje propozycji wpływu mogą być starsze niż obecny rekord — jest to prawidłowy zapis historii. Ręczne `PowiazanyElement` i propozycje `REVIEW` mogą wskazywać obiekty zewnętrzne, więc nie wymagają rekordu lokalnego.

Przy łączeniu tożsamość to magazyn + ID. Równa zawartość oznacza pominięcie; odmienne pola to konflikt blokujący cały import. Nie zmieniamy dat, statusów ani wersji w celu rozstrzygnięcia. Wynik połączenia musi spełniać te same ograniczenia relacji i unikalności co kopia. Jawne zastąpienie odtwarza dokładny stan kopii i usuwa pozostałe rekordy w tej samej transakcji. Import nie tworzy dodatkowych zdarzeń historii ani automatycznie nie przyjmuje decyzji. Nie ma częściowego odtwarzania ani automatycznej migracji formatu kopii.
