# R3 — GitHub Intelligence 2.0

Stan na 2026-11-01. Implementacja na lokalnym `main` po R2, baza `79b4cff`. Zachowano adapter GitHub z Etapu 10.1, RepositorySnapshot, Evidence, SourceLink, ContextPack oraz istniejące transakcje UnitOfWork. Nie dodano zależności, magazynów ani endpointów Huba.

## Funkcjonalności

- Panel statusu istniejącego połączenia i historia do 20 ostatnich commitów domyślnej gałęzi: SHA, opis, data, link GitHub, informacja o obserwacji API i ręcznie przypisanych dowodach.
- Szczegóły wybranego commita na żądanie: statystyki całego commita, nazwy i statusy plików, poprzednie nazwy przy zmianie nazwy, dodane/usunięte linie. Bez pobierania patchy i zawartości plików.
- Porównanie dwóch różnych commitów z pobranego okna historii: kierunek, relacja gałęzi, liczba commitów oraz statystyki pobranych plików. GitHub porównuje zmiany od wspólnego przodka; nie jest to dowolny lokalny diff dwóch drzew.
- Lista PR wszystkich stanów, od ostatnio aktualizowanych, i ręczne powiązania PR z elementem pracy.
- Actions: najnowszy zaobserwowany status, nazwa workflow, powiązany SHA, daty, odnośnik uruchomienia i przybliżony czas do ostatniej aktualizacji. Statusy: sukces, błąd, w toku, nieznany. Anulowane/pominięte uruchomienie nie staje się sukcesem. Sukces workflow nie jest gwarancją poprawności aplikacji ani dowodem wdrożenia.
- Ręczne powiązanie commita z elementem pracy, etapem lub decyzją. Oddzielne znaczenie dowodu: zmiana w kodzie albo zadeklarowane przez użytkownika wdrożenie z wymaganym opisem źródła potwierdzenia. Powiązania są deklaracjami użytkownika (`NIEZWERYFIKOWANE`), a obserwacja API potwierdza wyłącznie odczyt zasobu.
- Project Reconciliation: ukończone zadanie bez dowodu wdrożenia bieżącej wersji, powiązany commit poza pobranym oknem, nieudany workflow powiązanego commita oraz zmiany wymagające przeglądu. Wyniki są propozycjami. Nie zmieniają pracy, etapów, decyzji ani obserwacji. Brak dowodu nie oznacza niewykonania zadania. Użytkownik może otworzyć formularz uzupełnienia dowodu lub jawnie potwierdzić wykonany przegląd repozytorium.
- Oddzielna obsługa kolejnych uruchomień każdego workflow według stabilnego ID: sukces innego workflow o tej samej nazwie nie ukrywa błędu.
- Glassplate Solid: istniejące tokeny i komponenty powierzchni, lokalny układ paneli desktop/mobile, zawijanie SHA, nazw, opisów i przycisków.

## Modele i zapis

`OdczytGitHub` ma opcjonalne `historiaPobrana` oraz `inteligencja`: maksymalnie 20 zestawów szczegółów commitów, ostatnie porównanie, ostatnia lista PR i ostatnia lista workflow. Każdy rozszerzony zakres ma osobne `pobrano`; odświeżenie wybranego zakresu nie udaje ponownego odczytu historii. Pełna synchronizacja zachowuje wcześniej pobrane zakresy z ich własnymi datami.

Port `CzytnikRepozytorium` zachowuje `odczytaj`; dodano opcjonalne `rozszerz` z jawnym `ZakresGitHub`. Adaptery/mocki implementujące tylko dawny odczyt nadal działają. Wybór ostatniego odczytu API jest wspólny dla UI i synchronizacji i pomija ręczne obserwacje bez usuwania ich historii.

Rozszerzenie tworzy nowy niezmienny RepositorySnapshot i Evidence przez istniejącą atomową operację `synchronizuj`. Dotychczasowe obserwacje nie są modyfikowane. Błąd odczytu aktualizuje wyłącznie stan próby, zachowując poprzednie dane. Błąd zapisu dowodu wycofuje całą transakcję. Pełny odczyt o niezmienionej treści zachowuje wcześniejszą deduplikację.

Evidence otrzymuje opcjonalną `rola`: `ZMIANA`, `WDROZENIE`, `PRZEGLAD`. Mapa źródeł otrzymuje `STAGE`, wskazujący istniejący magazyn etapów. SourceLink bez zmiany kontraktu przechowuje `resourceType=commit|pull_request`, identyfikator zasobu, SHA w `externalRevision`, kanoniczny URL i klucz idempotencji. `Evidence.rewizja` wskazuje wersję lokalnego celu; dla przeglądu repozytorium wskazuje SHA. Ponowne potwierdzenie identycznego powiązania nie tworzy duplikatu. Dowód starszej wersji celu pozostaje w historii i nie potwierdza nowej wersji.

Zapis/import sprawdza istnienie celu, wspólny projekt repozytorium i celu oraz zgodny zasób w zachowanej obserwacji API, w tym URL i SHA PR. PR można wiązać tylko z elementem pracy jako zmianę. Te relacje nie podnoszą automatycznie statusów decyzji ani pracy.

IndexedDB pozostaje v8, backup v5. Starsze rekordy bez opcjonalnych pól pozostają poprawne. ContextPack nadal wybiera istniejące dowody i ostatnią obserwację; obsługuje źródło etapu z odnośnikiem do rzeczywistej sekcji projektu. Import do starszej wersji aplikacji nie jest zapewniony.

## Odczyty REST API

Wszystkie zapytania są anonimowe, tylko `GET`, host `https://api.github.com`, API `2026-03-10`. Pełna synchronizacja zachowuje dotychczasowe cztery odczyty. Nowa akcja wykonuje najwyżej dwa: potwierdzenie metadanych przez stabilny `/repositories/{id}` i jeden wybrany endpoint. Nie pobiera kolejnych stron ani historii w tle.

| Nowy zakres | Endpoint względem `/repos/{owner}/{repo}` | Limit |
| --- | --- | --- |
| Szczegóły commita | `/commits/{sha}?per_page=100&page=1` | 100 plików |
| Porównanie | `/compare/{base}...{head}?per_page=1&page=1` | do 300 plików pierwszej strony; bez przechodzenia listy commitów |
| PR | `/pulls?state=all&sort=updated&direction=desc&per_page=20&page=1` | 20 PR |
| Actions | `/actions/runs?per_page=20&page=1` | 20 uruchomień |

Dokumentacja kontraktów: [commity i porównania](https://docs.github.com/en/rest/commits/commits), [Pull Requests](https://docs.github.com/en/rest/pulls/pulls), [workflow runs](https://docs.github.com/en/rest/actions/workflow-runs).

Zachowano wspólne ETag/304, ograniczony cache w pamięci, obsługę 403/429, Retry-After, resetu limitu, timeoutu, anulowania i błędów sieci. Blokada limitu dotyczy wszystkich zakresów adaptera; termin ponowienia jest też zapisywany w stanie połączenia. Obce adresy, niepobrane SHA, nieprawidłowe liczniki/statusy/daty, duplikaty i nadmiarowe pola zapisanych modeli są odrzucane. Rozpoznane sekrety są blokowane przed zapisaniem odpowiedzi w cache i storage; detektor nie rozpoznaje każdej możliwej poufnej treści. Adapter nie przyjmuje PAT, nie wysyła cookies i nie wykonuje operacji zapisu GitHub ani git push.

## Kontrole jakości

Wykonano jeden pełny przebieg standardowych kontroli wszystkich workspaces:

- `npm run lint`: PASS.
- `npm run typecheck`: PASS.
- `npm test`: Hub 1 PASS; web 277 PASS / 14 FAIL z 291. Wykryto brak wymaganego opisu w nowym scenariuszu testowym (13 przypadków) i zmianę równości odczytu cache po dodaniu znacznika czasu (1 przypadek). Poprawiono fixture; datowanie obserwacji przeniesiono do warstwy aplikacyjnej, zachowując dotychczasowy wynik adaptera przy 304.
- `npm run build`: PASS dla wszystkich workspaces.

Po poprawkach ponowiono wyłącznie dotknięte obszary:

- Pierwsze ponowienie adaptera i nowych testów: 66/66 PASS.
- Po uzupełnieniu o test sekretu przed cache, rollbacku R3 i dowodu starszej wersji zadania: końcowe 103/103 PASS w czterech plikach (GitHub, R3, repozytoria/ContextPack, UI repozytoriów).
- Końcowy zakres to 294 testy web, w tym 35 nowych R3, i 1 test Huba; przypadki mają wyniki PASS z pełnego przebiegu albo ponowienia dotkniętych plików. Nie wykonywano drugiego pełnego przebiegu.
- ESLint plików zmienionych po pełnym przebiegu: PASS. Build web wraz z typecheck: PASS.
- Vite zgłasza ostrzeżenie o chunku JS około 506 kB; nie blokuje ono builda. Dzielenie bundla pozostawiono poza zakresem R3.

Nowe testy obejmują szczegóły commitów, porównania, ograniczenia stron, odrębne PR/Actions, klasyfikację CI, ETag, limity, błędne zakresy i DTO, błędy sieci, zachowanie historii, sekrety, rollback, trwałość powiązań, idempotencję, import/eksport v5, ContextPack, izolację projektów i świadome potwierdzenia UI.

## Odbiór przeglądarkowy i ograniczenia

W IAB, na osobnym originie `http://127.0.0.1:4183`, utworzono syntetyczny projekt odbiorowy. Rzeczywisty anonimowy odczyt `octocat/Hello-World` potwierdził historię (3 commity), szczegóły README (+1/−1), porównanie dwóch commitów (2 commity w zakresie), 20 PR z komunikatem ograniczenia oraz 7 uruchomień Actions, w tym sukcesy i błędy. Każda akcja utworzyła kolejną obserwację. Nie modyfikowano repozytorium GitHub.

Układ desktop i mobile sprawdzono wizualnie oraz przez `scrollWidth === clientWidth`: desktop 1581 px treści, mobile 381 px treści (okno około 400 px). Narzędzie IAB ograniczyło żądany viewport 320 px do większej szerokości; nie deklarujemy rzeczywistego odbioru przy 320 px ani na fizycznym telefonie. Zrzuty w `C:/Users/Kacper/.codex/artifacts/centrum-r3-2026-11-01/` (`github-desktop.jpg`, `github-mobile.jpg`). Przywrócono rozmiar okna po odbiorze.

Dane mają zakresy i daty odczytu, nie są monitoringiem bieżącego stanu. Rozbieżności są heurystycznymi propozycjami; ukończone zadanie może nie wymagać wdrożenia. Potwierdzenie przeglądu lub wdrożenia jest deklaracją użytkownika. R3 nie analizuje logów/jobów Actions, statusów z zewnętrznego CI, deploymentów, treści diffów ani całej historii; nie obsługuje repozytoriów prywatnych i uwierzytelnienia. Czas wykonania Actions jest przybliżeniem, bez pobierania jobów. Lista PR odróżnia stan otwarty/zamknięty, nie rozstrzyga zamknięcia przez merge. Porównywarka obsługuje commity z ostatnio pobranego okna.

## Pliki implementacji

- `apps/web/src/domain/synchronizacjaGitHub.ts` — rozszerzone modele i walidacja.
- `apps/web/src/domain/inteligencjaGitHub.ts` — wybór obserwacji API, tworzenie powiązań i uzgodnienia.
- `apps/web/src/domain/kontekstRepozytorium.ts` — rola Evidence, źródło etapu i walidacja relacji.
- `apps/web/src/domain/pakietKontekstu.ts` — odnośniki źródła STAGE.
- `apps/web/src/application/synchronizujRepozytorium.ts` — wybrany zakres przez istniejący zapis obserwacji.
- `apps/web/src/infrastructure/githubApi.ts` — nowe odczyty, wspólny cache/limity i blokada sekretów przed cache.
- `apps/web/src/infrastructure/inteligencjaGitHub.test.tsx` — 35 testów R3.
- `apps/web/src/pages/PanelInteligencjiGitHub.tsx` — historia, porównanie, PR, Actions, powiązania i propozycje.
- `apps/web/src/pages/RepozytoriaKontekst.tsx` — podłączenie panelu do dotychczasowej synchronizacji.
- `apps/web/src/features/realizacja/PanelRealizacji.tsx` — cel odnośnika etapu.
- `apps/web/src/shared/style.css` — lokalny responsywny układ paneli.
- `README.md`, `docs/v2/GITHUB_INTEGRATION.md`, ten raport — aktualizacja dokumentacji R3.
