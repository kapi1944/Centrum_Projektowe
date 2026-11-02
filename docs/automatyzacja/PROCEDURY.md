# Wspólne procedury rozwoju

Zasady modyfikacji i uprawnień: [AGENTS.md](../../AGENTS.md). Uruchomienie, aktualna platforma i komendy: [README](../../README.md). Ten dokument jest jednym źródłem procedur dla czterech umiejętności; raport A0 opisuje ich uzasadnienie i przyszły rozwój.

## Kontrole obowiązkowe

Komendy wykonuj z katalogu głównego repozytorium na wersji Node wskazanej w `package.json`. Na Windows dopuszczalne jest `npm.cmd`. Instaluj przez `npm ci`, gdy brakuje poprawnej instalacji lub zmienił się lockfile; nie aktualizuj zależności przy okazji.

Przed oddaniem zmiany wykonaj wszystkie cztery kontrole z sekcji „Workspaces i weryfikacja” README: lint, typecheck, testy i build. Zapisz komendę, kod zakończenia, zakres i wynik. Build web wykonuje dodatkowy typecheck; nie zastępuje to pełnego typecheck workspaces. Root używa `--if-present`: brak skryptu w workspace nie jest jego zaliczonym testem.

Sprawdź też `git diff --check`, `git diff --stat`, rzeczywistą różnicę oraz `git status --short --branch`. Nowe nieśledzone pliki przeglądaj osobno: zwykły `git diff` ich nie obejmuje. Nie dodawaj plików do indeksu tylko w celu raportowania.

Nowe konfiguracje sprawdzaj narzędziem właściwym dla formatu:

- GitHub Actions: `actionlint .github/workflows/quality.yml`, a dla zmienionych akcji również poprawność `uses`/SHA i zadeklarowanych wejść. Parser YAML sam nie waliduje wyrażeń GitHub.
- Agent Skills: frontmatter YAML z niepustymi `name` i `description`, nazwa zgodna z katalogiem (małe litery ASCII, cyfry, pojedyncze łączniki, do 64 znaków), brak niedokończonych instrukcji i działające lokalne odnośniki. Jeżeli dostępny jest systemowy `skill-creator`, uruchom jego `scripts/quick_validate.py` dla zmienionych umiejętności. Jest to narzędzie środowiska, nie zależność repozytorium; brak narzędzia jawnie raportuj i wykonaj równoważną kontrolę struktury.
- Dokumentacja: sprawdź lokalne odnośniki i zgodność komend z manifestami. Nie deklaruj obsługi narzędzia tylko dlatego, że plik ma poprawną składnię.

Narzędzia walidujące można uruchamiać z lokalnego katalogu narzędzi poza repozytorium, bez zmieniania lockfile i globalnych ustawień. W raporcie zapisz wersję i sposób walidacji.

Po błędzie zachowaj pierwszy wynik, ustal przyczynę i popraw ją w zakresie zlecenia. Ponawiaj kontrole dotknięte naprawą; kolejny pełny przebieg jest potrzebny, jeżeli zmieniły się wspólne zależności, konfiguracja wykonania albo pozostała niepewność co do zakresu. Nie przedstawiaj sumy częściowych ponowień jako jednego pełnego przebiegu.

## Regresja według zakresu

Poniższe pliki są punktami wejścia do istniejących testów w `apps/web/src`, nie nową kopią scenariuszy.

| Zmieniony obszar | Istotne istniejące kontrole |
| --- | --- |
| Zapis i zgodność danych | `infrastructure/repozytoriumIndexedDb.test.ts`, `zgodnoscV1V2.test.ts`, `kopieZapasowe.test.ts`: migracje, import starszych kopii, relacje, konflikty i rollback |
| Analizy, decyzje i korekty | `infrastructure/przebiegiAnaliz.test.ts`, `korekty.test.ts`, `ustalenia.test.ts`, `workflowWpisow.test.ts`: osobne zatwierdzenia, historia, nieaktualne rewizje i idempotencja |
| R1 i nawigacja | `app/PowlokaAplikacji.test.tsx`, `app/Aplikacja.test.tsx`: trasy, loading/error, menu, fokus |
| R2 i UX Rescue | `pages/Start.test.tsx`, `pages/WymagaUwagi.test.tsx`, `features/projekty/punktPowrotu.test.tsx`: rzeczywiste projekcje, filtry, kontynuacja pracy |
| R3 i repozytoria | `infrastructure/githubApi.test.ts`, `inteligencjaGitHub.test.tsx`, `kontekstRepozytorium.test.ts`, `pages/RepozytoriaKontekst.test.tsx`: zakresy API, limity, ETag, dowody, izolacja projektów i brak zapisu domeny przez sam odczyt |
| Hub i kontrakty | `apps/hub/src/serwer.test.ts` oraz typecheck pakietów; pakiety deklaracji nie mają własnych testów runtime |
| Wyłącznie instrukcje/CI | Pełne dotychczasowe kontrole oraz walidacja konfiguracji; testy aplikacji nie dowodzą działania nowego workflow na GitHubie |

Przykład wybranego zestawu: `npm test --workspace=@centrum-projektowe/web -- src/pages/Start.test.tsx`. Nie zastępuje obowiązkowego pełnego przebiegu przed oddaniem zmiany.

jsdom i fake-indexeddb nie dowodzą odbioru fizycznego urządzenia ani migracji prywatnych danych. Dla zmian UI sprawdź stosowne szerokości i interakcje w prawdziwej przeglądarce. Dla zmian storage lub kopii sprawdź zapis/reload oraz eksport/import syntetycznych danych. Zapisz faktyczny origin, rozmiar dokumentu i zakres odbioru; brak wykonania oznacza ograniczenie.

## Format raportu etapu

Raport utrwalaj w dokumencie etapu; nie przepisuj starych raportów. Krótkie zamknięcie w czacie ma wskazywać pełny raport.

1. **Identyfikacja:** etap, data i strefa czasu, zakres zlecenia i kryteria odbioru.
2. **Stan wejściowy:** gałąź, HEAD, lokalne zmiany, porównanie ze zweryfikowanym origin i źródła audytu. Oddziel stan historyczny od obecnego.
3. **Wynik:** konkretne zachowanie po zmianie, ważne decyzje, elementy poza zakresem i niespełnione kryteria.
4. **Kontrole:** tabela `komenda | środowisko/zakres | kod zakończenia | wynik | dowód`. Wynik: PASS, FAIL, POMINIĘTE, ANULOWANE lub NIEWYKONANE. Podaj liczby testów, ostrzeżenia, pierwszy błąd i ponowienia. Dla CI dodaj SHA kontroli, SHA źródła PR, run ID, attempt, job i URL; PR może testować syntetyczny merge commit.
5. **Pliki:** pełny wykaz zmienionych i nowych plików z powodem, bez katalogów wygenerowanych i zależności.
6. **Zgodność i ryzyka:** dane, kontrakty, regresje, bezpieczeństwo, nieprzeprowadzone odbiory i ograniczenia dowodów.
7. **Git i przekazanie:** lokalne zmiany/commit, faktyczny push/PR/merge albo ich brak. Kolejny etap jest propozycją, dopóki nie został zlecony.

Logi przechowuj poza repozytorium lub w świadomie wykluczonym katalogu. Nie kopiuj sekretów, prywatnych backupów ani pełnego środowiska. W CI artefakt jakości zawiera tylko jawnie wskazane logi kontroli i zestawienie wyników; dostęp do artefaktów i ich retencja podlegają ustawieniom GitHub. Historyczny plik raportu nie jest aktualną bramką wykonania.
