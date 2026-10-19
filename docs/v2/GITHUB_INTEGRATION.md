# Etap 10.1 — odczyt i synchronizacja publicznych repozytoriów GitHub

## Zakres i punkt wejścia

Rozszerzenie istniejącego Etapu 9. Pierwotny preflight: `main`, `d7e330ef3a95ed65bec8693c0348be19dd9a1abf`, czyste drzewo, kompletne RepoConnection / RepositorySnapshot / Evidence / ContextPack, IndexedDB v8, backup v4. Początkowe testy repozytoriów, UI i backupu: 42/42. Po wznowieniu zapisany częściowy kod był już w lokalnym `25e38c8`; dalsza praca zachowuje ten commit i historię.

W widoku repozytoriów projektu „Sprawdź połączenie” oraz „Synchronizuj” uruchamiają ten sam pełny, ograniczony odczyt. Nie ma automatycznej synchronizacji przy wejściu, monitorowania ani interwałów. Integracja odczytuje wyłącznie publiczne repozytoria. Nie zmienia kodu, projektów, decyzji ani repozytoriów na GitHub.

## Architektura

`RepozytoriaKontekst` → `utworzSynchronizacjeRepozytorium` → port `CzytnikRepozytorium` → adapter `utworzCzytnikGitHub` → walidacja DTO → normalizacja → istniejąca operacja `synchronizuj` → UnitOfWork / IndexedDB → odświeżenie rejestru i UI.

Port i znormalizowane struktury są w `domain/synchronizacjaGitHub.ts`. Adapter jest w `infrastructure/githubApi.ts`; przyjmuje podmienialny klient HTTP, limit czasu i zegar. Warstwa aplikacyjna jest w `application/synchronizujRepozytorium.ts`. React nie wykonuje bezpośrednich zapytań REST. Nie dodano zależności ani frameworka.

Istniejący SDK dostarcza `PolaczenieZrodla` (SourceLink). Jego ogólny port `DostawcaIntegracji` obejmuje także wysyłkę i koperty; dla tego odczytu stosowany jest węższy port repozytorium, bez pozornej implementacji wysyłki, outboxu lub pipeline decyzji. Nie powstaje równoległy model repozytorium, snapshotu ani dowodu. ProjectSnapshot i Attention Engine zachowują wcześniejsze reguły; odczyt GitHub nie tworzy automatycznych ustaleń ani pracy.

## API i ograniczenia pobierania

Nagłówek `X-GitHub-Api-Version: 2026-03-10`, zgodnie z [aktualną dokumentacją wersjonowania](https://docs.github.com/en/rest/about-the-rest-api/api-versions). Normalne odpowiedzi używają `application/vnd.github+json`.

| Endpoint GET | Cel |
| --- | --- |
| `/repos/{owner}/{repo}` | Pierwsze rozpoznanie publicznego repozytorium i trwałego ID |
| `/repositories/{id}` | Kolejne odczyty metadanych po trwałym ID, także po zmianie nazwy/właściciela |
| `/repos/{owner}/{repo}/commits/{ref}` | HEAD domyślnej gałęzi; `Accept: application/vnd.github.sha` zwraca wyłącznie SHA, bez plików i diffów |
| `/repos/{owner}/{repo}/commits?sha={HEAD}&per_page=20&page=1` | Do 20 commitów historii przypiętej do odczytanego HEAD |
| `/repos/{owner}/{repo}/branches?per_page=100&page=1` | Do 100 gałęzi; informacja o obcięciu pochodzi z `Link: rel="next"` |

Jedna próba wykonuje maksymalnie cztery zapytania, sekwencyjnie. Każdy endpoint listy pobiera tylko pierwszą stronę. Nie podąża za URL z nagłówka Link. Nie pobiera kodu, Issues, Pull Requestów ani pełnych diffów. Historia commitów jest celowo ograniczona, a lista gałęzi może być niepełna. Spójność HEAD, pierwszego commita historii i domyślnej gałęzi jest walidowana. Rozbieżność w trakcie odczytu kończy próbę bez zapisu częściowej obserwacji; ponowienie wymaga kliknięcia użytkownika. GitHub nie zapewnia atomowego odczytu wszystkich endpointów.

## Tożsamość i model

`PolaczenieRepozytorium.github` zawiera opcjonalną tożsamość: numeryczne ID GitHub, właściciela, nazwę, kanoniczny URL, domyślną gałąź, publiczną widoczność i flagę archiwum. Oddzielnie przechowuje stan ostatniej próby, jej czas, czas ostatniej poprawnej obserwacji, kontrolowany komunikat i ewentualny termin ponowienia.

Pierwszy odczyt korzysta z owner/repo podanego w obsługiwanym URL. Po związaniu z ID kolejne odczyty używają ID; zmiana nazwy lub właściciela aktualizuje metadane i URL, zachowując lokalne ID i `projektIds`. Odpowiedź z innym stabilnym ID jest odrzucana. Ochrona unikalności sprawdza ID GitHub, URL i lokalną ścieżkę. Istniejące wspólne repozytorium należy powiązać z kolejnym projektem. Odkrycie duplikatu nie scala rekordów ani nie usuwa powiązań; zgłasza kontrolowany błąd.

`MigawkaRepozytorium.github` jest znormalizowaną obserwacją: tożsamość, maksymalnie 20 commitów (SHA, opis do 2000 znaków, czas committera), maksymalnie 100 gałęzi (nazwa, SHA) i znacznik ograniczenia. Data commita nie zastępuje czasu obserwacji. Całe odpowiedzi API, autorzy, e-maile, pliki ani diffy nie trafiają do bazy.

`GITHUB_API` jest osobnym źródłem obserwacji, pochodzeniem dowodu i stanem weryfikacji. Nie oznacza wyniku testów, review, poprawności kodu ani decyzji użytkownika. Formularze ręczne nie oferują nadawania tego stanu. Po potwierdzeniu tożsamości pola pochodzące z GitHub są tylko do odczytu; nadal można edytować lokalną nazwę, notatkę, rodzaj i powiązania z projektami.

## Atomowość, historia i Evidence

Sieć działa poza transakcją. Dopiero pełny poprawny wynik tworzy jedną operację `synchronizuj`, obejmującą połączenie, nowy snapshot i niezmienny Dowod. Istniejący UnitOfWork waliduje stan i zapisuje go w jednej transakcji. Wynik publikuje się po `oncomplete`. Konflikt wersji lub awaria późnego zapisu wycofują całość. Użytkownik otrzymuje błąd zapisu; synchronizacja nie nadpisuje równoległej edycji.

Dowód wskazuje konkretny snapshot, SHA, czas obserwacji i zakres projektów. SourceLink zachowuje `contractVersion: 1`, `providerId: GITHUB`, lokalne `connectionId`, stabilne zewnętrzne ID GitHub, rewizję i URL commita. Klucz idempotencji SourceLink jest stały dla powiązania z repozytorium; kolejny snapshot nie zmienia klucza powiązania. Walidowane są zgodność SHA, ID repozytorium, połączenia i źródła oraz relacje projektów.

Każda zmiana znormalizowanego stanu daje nowy niezmienny snapshot i dowód. Identyczny kolejny odczyt aktualizuje wyłącznie daty i status połączenia. Historia pozostaje bez zmian, również po błędzie API. ContextPack korzysta z tego samego źródła; wykluczenie wymaganego dowodu obniża weryfikację snapshotu w pakiecie. Zapisany backup jest deklaracją historycznego pochodzenia, a nie kryptograficznym potwierdzeniem ponownego odczytu GitHub.

## Cache, limity i anulowanie

Cache ETag zawiera wyłącznie znormalizowane odpowiedzi i istnieje w pamięci konkretnej instancji adaptera (maksymalnie 100 pozycji). Klucz zawiera zakres `public:anonymous`, wersję API i całą ścieżkę z parametrami. `If-None-Match` pozwala wykorzystać 304; 304 bez cache jest błędem. Restart usuwa cache HTTP, ale zachowuje snapshoty w IndexedDB. Nie ma cache odpowiedzi prywatnych ani przełączania autoryzacji. Przyszły uwierzytelniony adapter musi oddzielać cache według zakresu i tożsamości sesji oraz czyścić go przy zmianie dostępu.

Usługa współdzieli trwającą synchronizację tego samego lokalnego repozytorium. UI blokuje ponowne kliknięcie. Zapis jest dodatkowo chroniony oczekiwaną wersją. Limit czasu wynosi 15 sekund na zapytanie; AbortController obsługuje timeout, przycisk anulowania i opuszczenie widoku.

Adapter respektuje `Retry-After`, `X-RateLimit-Remaining` i `X-RateLimit-Reset`, blokując następne odczyty do wyznaczonego czasu. Przy odpowiedzi limitu bez użytecznego czasu stosuje co najmniej minutową przerwę. Nie ma automatycznych retry. Termin otrzymanego błędu limitu jest także zapisany w połączeniu, więc jego blokada przetrwa odświeżenie strony. Inne karty przeglądarki mają osobny cache i nie dzielą blokady w pamięci; wspólny limit serwera nadal obowiązuje.

Anonimowe zapytania podlegają limitom GitHub związanym z adresem IP (obecnie 60 zapytań na godzinę). Szczegóły: [limity REST API](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api), [zalecenia integracyjne](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api).

## Statusy i błędy

| Stan | Znaczenie |
| --- | --- |
| Niepołączone | Brak adresu zdalnego lub inny dostawca |
| Gotowe do sprawdzenia | Istnieje konfiguracja GitHub, brak próby |
| Sprawdzanie | Bieżąca operacja w UI; nie jest utrwalanym statusem |
| Połączone | Pełny poprawny odczyt |
| Dane nieaktualne | Ostatni poprawny odczyt starszy niż 24 godziny; wyliczane przy otwarciu/odświeżeniu widoku, bez interwału |
| Offline | Błąd transportu, bez założenia usunięcia repozytorium |
| Brak dostępu | 401/403 lub odpowiedź wskazująca repozytorium prywatne |
| Nie znaleziono | 404; repozytorium lub zasób może też być prywatny albo niedostępny |
| Limit API | 429 albo odpowiedź limitu 403; użytkownik widzi termin ponowienia |
| Błąd synchronizacji | 409/puste repozytorium, 5xx, timeout, anulowanie, nieobsługiwany HTTP, błędna odpowiedź lub niespójna tożsamość |

200 wymaga walidacji DTO i relacji. 304 korzysta z własnego cache. Błędy sieci, walidacji i HTTP aktualizują ostatnią próbę, zachowując wcześniejszą poprawną obserwację i jej czas. Surowa treść błędu HTTP ani wyjątku klienta nie jest zapisywana. Błąd storage jest zgłaszany użytkownikowi, ponieważ nie można wiarygodnie zapisać statusu po nieudanej transakcji.

## Offline i interfejs

Ostatnia obserwacja, historia, gałęzie, commity, dowody i generator kontekstu działają z lokalnych danych. Brak sieci nie usuwa danych. UI pokazuje status, osobne daty próby i poprawnej obserwacji, domyślną gałąź, skrócone SHA, pełną wartość w rozwijanym szczególe oraz odnośniki do commitów. Zachowano dotychczasowy routing i style, w tym zawijanie treści i przycisków.

## Bezpieczeństwo i ograniczenia

Obsługiwany adres to `https://github.com/{owner}/{repo}` bez portu, poświadczeń, query i fragmentu; `.git` jest normalizowane. Wszystkie żądania mają stały host `https://api.github.com`, kodowane segmenty, `GET`, `credentials: omit`, `referrerPolicy: no-referrer` i blokadę przekierowań. Nie jest używany dowolny URL z odpowiedzi. Kolejne metadane pobiera się po zweryfikowanym numerycznym ID. Pierwsze połączenie przez dawny URL wymagający przekierowania należy poprawić na aktualny URL.

Brak tokenów, pól tokenu, OAuth, GitHub App, proxy, sekretów w storage, backupie i logach. Istniejąca kontrola rozpoznanych sekretów obejmuje również pobrane opisy commitów; wykrycie blokuje obserwację bez zapisania treści sekretu. Nie jest to uniwersalny detektor dowolnej poufnej treści. Adapter odrzuca prywatną odpowiedź przed umieszczeniem jej w cache. Etap 10.2 nie został rozpoczęty.

## Weryfikacja i pliki

Testy jednostkowe używają wyłącznie kontrolowanych odpowiedzi HTTP. Pokrywają poprawny odczyt, 401/403/404/409/429/5xx, repozytorium prywatne, timeout, anulowanie, offline, walidację DTO/URL, ETag/304, izolację cache, limity, zmianę nazwy/właściciela/gałęzi, współdzielenie i deduplikację, historię, Evidence, sekrety, konkurencję, rollback, backup v5 i ContextPack. Test UI sprawdza świadome uruchomienie, prezentację SHA/linku, edycję lokalnej notatki i zachowanie danych offline po ponownym otwarciu. Starsze testy nadal sprawdzają import v1–v4 i migrację v7→v8.

Dodatkowy rzeczywisty odczyt adapterem w Node: publiczne `octocat/Hello-World`, stabilne ID `1296269`, gałąź `master`, trzy commity i trzy gałęzie; ponowny odczyt po ID zakończył się poprawnie. Ten odczyt nie należy do testów jednostkowych i nie zapisuje danych użytkownika. Dodatkowo w przeglądarce Chromium/IAB, na izolowanym originie `http://127.0.0.1:4179`, utworzono przez UI syntetyczny projekt i powiązanie z tym repozytorium. Pełny odczyt pokazał „Połączone”, gałąź, SHA i dowód; ponowna synchronizacja zachowała jedną obserwację, a reload odtworzył zapisane dane. Potwierdzono tym samym rzeczywisty odczyt z przeglądarki, w tym CORS. Nie wykonano odbioru na fizycznym telefonie.

Kod Etapu 10.1 obejmuje:

- `apps/web/src/domain/synchronizacjaGitHub.ts`, `kontekstRepozytorium.ts`, `kopieZapasowe.ts`, `pakietKontekstu.ts`.
- `apps/web/src/application/synchronizujRepozytorium.ts`.
- `apps/web/src/infrastructure/githubApi.ts`, `repozytoriumIndexedDb.ts`.
- `apps/web/src/pages/RepozytoriaKontekst.tsx`, `apps/web/src/app/Aplikacja.tsx`.
- Testy `githubApi.test.ts`, `kontekstRepozytorium.test.ts`, `kopieZapasowe.test.ts`, `korekty.test.ts`, `przebiegiAnaliz.test.ts`, `RepozytoriaKontekst.test.tsx`.
- Niniejsza dokumentacja oraz krótkie aktualizacje dokumentów architektury, migracji, zgodności, kontekstu i ADR 0006.

IndexedDB pozostaje v8 i 19 magazynów. Dodano wyłącznie opcjonalne pola istniejących rekordów, bez zmiany struktury magazynów i bez migracji ich zawartości. Backup v5 obejmuje te pola i walidację; nadal importuje v1–v4. Downgrade do dawnej aplikacji nie jest zapewniony. ETag/cache HTTP nie jest częścią backupu.

## Wynik kontroli końcowych

- `npm ci`: PASS, lockfile bez zmiany, zgłoszone 0 podatności zależności.
- `npm run lint`: PASS dla workspaces.
- `npm run typecheck`: PASS dla workspaces.
- `npm test`: PASS — 248 testów web w 24 plikach oraz 1 test Huba; testy jednostkowe nie wykonują rzeczywistych zapytań GitHub.
- `npm run build`: PASS dla workspaces.
- `git diff --check`: PASS.
- Rzeczywisty odczyt publiczny: PASS w Node oraz w przeglądarce Chromium/IAB, na danych syntetycznych; ponowna synchronizacja bez duplikatu i trwałość po reload.
- Brak odbioru na fizycznym telefonie. Offline, migracje i rollback są pokryte testami automatycznymi; nie deklarujemy migracji prywatnych danych użytkownika.

Fundament jest gotowy do osobno zleconego Etapu 10.2. Nie wdrożono Issues, PR, diffów, uwierzytelnienia ani monitorowania.
