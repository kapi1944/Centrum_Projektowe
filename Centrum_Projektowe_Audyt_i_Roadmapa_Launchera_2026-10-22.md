# Centrum Projektowe 2.0 — audyt repozytorium i plan Windows Launchera z AutoUpdate

**Data:** 2026-10-22  
**Repozytorium:** `kapi1944/Centrum_Projektowe`  
**Zweryfikowany zdalny punkt odniesienia:** `main` → `18ce4ee907e905a5ce76fda47a91752467000fa8` (Etap 10.1).  
**Charakter audytu:** szeroki audyt statyczny publicznego HEAD GitHub (drzewo, podstawowe pliki wykonywalne, domena, trwałość, build, CI, dokumentacja) i porównanie rzeczywistych wzorców aktualizacji Ogarniacza i Ultimate Pomagiera. **Nie** jest to audyt lokalnego `C:\GitHub\Projects\Centrum_Projektowe` ani ponowne wykonanie testów lokalnych, testów Windows lub testów na prywatnych danych. Nie przeanalizowano zawartości wszystkich 128 plików linia po linii. Wszystkie luki w dowodach są oznaczone.

## 1. Stan zweryfikowany w GitHub

- Repozytorium publiczne, gałąź główna `main`; aktualny zdalny SHA: `18ce4ee907e905a5ce76fda47a91752467000fa8`.
- Drzewo: **160 wpisów**, z czego **128 plików** i **32 katalogi**, odpowiedź API bez truncation.
- Workspaces: `apps/web`, `apps/hub`, `packages/contracts`, `packages/domain`, `packages/integration-sdk`, `packages/testing`, `packages/ui`.
- Stack web: React 19, TypeScript 6, Vite 8, React Router 7, Vitest/jsdom/fake-indexeddb; wymagany Node.js `>=24 <25`.
- Hub: `GET /health` na `127.0.0.1:3001`, bez połączenia z front-endem, autoryzacji, kont ani synchronizacji.
- Trwałość: lokalne IndexedDB **v8, 19 magazynów**; kopie zapasowe JSON **schemaVersion 5**, import wersji 1–4, atomowe operacje oraz walidacja.
- Funkcje Etapów 7–9: korekty i ChangeSet, projekcja ProjectSnapshot i Attention Engine, RepoConnection/RepositorySnapshot/Evidence, selektywny eksport ContextPack Markdown/JSON.
- Etap 10.1: GitHub REST API dla **publicznych** repozytoriów; świadomy ręczny odczyt metadanych, HEAD, 20 commitów, 100 gałęzi, dowód pochodzenia, cache ETag w pamięci, ograniczenia API, offline/awarie. **Etapy 10.2 i 10.3 nie są obecne w zweryfikowanym HEAD**.
- Zdalna kontrola GitHub Actions `Quality` na SHA `18ce4ee` zakończyła się **success** 2026-10-20. Workflow wykonuje `npm ci`, lint, typecheck, testy i build. W dokumentacji Etapu 10.1 opisano 248 testów web + 1 test Hub; **nie uruchamiano ich ponownie podczas tego audytu**. Przejściowy commit `25e38c8` miał CI failure, commit końcowy jest zielony.
- Brak skonfigurowanego Windows launchera, skryptów AutoUpdate, produkcyjnego kanału wydań GitHub Releases, manifestu PWA i service workera w zweryfikowanym drzewie Centrum. GitHub Releases: lista pusta.

## 2. Macierz audytowa

| Obszar | Ocena | Dowód / komentarz | Priorytet |
|---|---|---|---|
| Modele i operacje domenowe | Dobrze rozwinięte | Oddzielone źródła, analizy, review, korekty, projekcje; świadome zatwierdzenia | Zachować |
| Persistence / migracje | Solidne testowane podstawy | IndexedDB v8; backup v5; 19 stores; atomowość | P0: zabezpieczyć dane przed zmianą runtime/originu |
| Github REST read-only | Działa w zadeklarowanym zakresie | Adapter portowy, lokalna historia, ETag, ograniczenia | P2: 10.2/10.3 pozostają planem |
| UI nawigacja | Funkcjonalny, prosty | Ekrany projektów, uwagi, skrzynki, rejestru; bez powłoki desktopowej | P2 |
| Ekran Start | Podstawowy | Liczby projektów/wpisów, lista, ostatni wpis | P3 |
| Hub i synchronizacja | Tylko szkielet | `/health`, brak aktywnego Sync | P3: nie podłączać launchera do Huba |
| CI | Zielone kontrole kodu | `Quality` na Node 24; brak odrębnych testów Windows launchera | P1: rozbudować przed aktualizacjami |
| Dokumentacja | Częściowo niespójna chronologicznie | README opisuje v5/backup v1 i Etapy 0–6; `docs/ROADMAP.md` nie uwzględnia faktycznych Etapów 7–10.1; pliki `docs/v2` poprawiają nowszy stan | P1 |
| Numer wersji aplikacji | Brak semantyki wydania | root/web/hub `version: 0.0.0` | P1: potrzebny kontrakt wersji do wydań |
| Launcher Windows | Brak | Nie ma `launcher/`, `.cmd` uruchamiania, zarządzania serwerem | P1 |
| Aktualizator | Brak | Nie ma staged update / LKG / rollback / manifestu wydania | P1 |
| Offline | Dane lokalne tak, aplikacja nie w pełni | IndexedDB lokalne, brak PWA SW i gotowego lokalnego runtime | P1 |
| Bezpieczeństwo/prywatność | Kontrakt local-first, brak kontroli dostępu | Kod publiczny, zapis IndexedDB i jawny eksport JSON; lokalne dane nie trafiają domyślnie do API | P1: ograniczenia urządzenia współdzielonego |
| Działanie na prawdziwym Windows | Niezweryfikowane tutaj | Brak testów launchera i procesu aktualizacji; green CI Linux nie wystarcza | P0 bramka odbioru |

## 3. Wnioski techniczne i ryzyka

### R-01 [KRYTYCZNE] — origin IndexedDB

`apps/web/src/main.tsx` otwiera `utworzRepozytoriumIndexedDb()`; dane są związane z **originem (protokół + host + port) i profilem przeglądarki**. `vite.config.ts` zawiera plugin React i konfigurację testów, lecz **nie ustala** serwera, hosta ani `strictPort`. Domyślny Vite może przejść na inny port, jeżeli poprzedni jest zajęty. `http://localhost:5173`, `http://127.0.0.1:5173`, `http://localhost:4173`, HTTPS i WebView2 są oddzielnymi magazynami. To zagrożenie dla widoczności danych, nawet jeśli dane nie zostały fizycznie skasowane.

**Wymóg:** launcher musi poznać i utrwalić używany origin przed pierwszym wdrożeniem. Zajęty port powoduje bezpieczne zatrzymanie/identyfikację *własnego* serwera, nie automatyczną zmianę portu. Jeśli dotąd pracowano na innym originie, migracja **przez istniejący eksport/import** z próbą restore.

### R-02 [WYSOKIE] — brak bieżącej polityki wydań

`package.json` ma wersję `0.0.0`. CI zatwierdza kod, lecz nie publikuje stabilnego, identyfikowalnego wydania. Aktualizowanie wprost każdego nowego HEAD main jest ryzykowne dla narzędzia przechowującego prywatną historię projektów.

**Wymóg:** rozdzielić `HEAD`, wynik CI, numer release i wersję schematu danych. Dla automatycznych aktualizacji wskazana polityka stable/approved, a nie „cokolwiek pojawiło się na main”.

### R-03 [WYSOKIE] — build i aktualizacja źródeł bez LKG

Aktualizator oparty na bezpośrednim `git pull` w katalogu deweloperskim może zmieniać aktywnie modyfikowany projekt lub pozostawić niedziałającą wersję po nieudanym buildzie. **Rekomendacja:** oddzielić codzienne używanie aplikacji od repozytorium deweloperskiego; budować wersję kandydującą w oddzielnym katalogu, uruchamiać po bramkach, przełączać dopiero po sukcesie, zachować *last known good* (LKG). Nie resetować ani stashować zmian użytkownika.

### R-04 [WYSOKIE] — launcher nie widzi prywatnych danych przeglądarki

Node i PowerShell nie odczytują bezpiecznie danych z IndexedDB w otwartym profilu Edge/Chrome. Launcher **nie może deklarować** wykonania backupu ani sprawdzenia wszystkich rekordów, tylko dlatego że wykonano `git fetch` lub `npm run build`.

**Wymóg:** wyraźne osobne potwierdzenie „kopii danych w aplikacji”, test przywrócenia, oznaczanie aktualizacji z migracją danych oraz manualny bezpieczny etap przejściowy.

### R-05 [ŚREDNIE] — długie moduły, ryzyko koncentracji odpowiedzialności

`repozytoriumIndexedDb.ts` ~455 linii, `kopieZapasowe.ts` ~407 linii, `RepozytoriaKontekst.tsx` ~245 linii/26 KB. Widać dużą koncentrację walidacji/persistence i rozbudowany ekran z kilkoma rolami. To **sygnał utrzymaniowy**, nie wykryty błąd. Unikać szerokiej refaktoryzacji przy wdrażaniu launchera; ewentualne małe ekstrakcje tylko po testach.

### R-06 [ŚREDNIE] — dokumentacja nie jest jednolitą prawdą

README i `docs/ROADMAP.md` zachowały historyczne opisy. `docs/v2/GITHUB_INTEGRATION.md`, `ARCHITECTURE_TARGET.md`, `MIGRATION_PLAN.md`, `COMPATIBILITY.md` zawierają nowsze sekcje Etapu 10.1, ale także oznaczone stare baseline'y. Dla Codexa potrzebny **jeden indeks stanu obecnego** z linkami do historycznych decyzji, nie usuwanie historii.

### R-07 [ŚREDNIE] — testy niezależne od platformy, bez Windows E2E

`quality.yml` uruchamia testy na Ubuntu. Brak smoke testu Windows, uruchomienia drugiej instancji launchera, zajętego portu, offline startu i awarii podczas zamiany buildów. Najpierw testy reprodukowalne na tymczasowych repozytoriach, później test rzeczywisty Windows.

### R-08 [ŚREDNIE] — publiczne repo ≠ publiczne dane

Repozytorium na GitHub jest publiczne; dane aplikacji są lokalne. **Nie zmieniać** widoczności danych ani nie wysyłać backupów/ContextPack do GitHub w mechanizmie launchera. Loopback HTTP ma służyć tylko do podawania statycznego buildu; bez nasłuchiwania na sieci LAN, z kontrolą dostępu do plików i bez endpointów wykonujących dowolne polecenia.

### R-09 [NIEZWERYFIKOWANE] — rzeczywiste lokalne zmiany

Nie ma zdalnej wiedzy o `git status`, niezacommitowanych plikach i ewentualnych commitach obecnych wyłącznie w `C:\GitHub\Projects\Centrum_Projektowe`. Etapy 10.2/10.3 mogły zostać wykonane lokalnie po aktualnie opublikowanym SHA. Zanim Codex cokolwiek zmieni, musi porównać lokalny stan z `origin/main` i wykryć takie przypadki. Niczego nie resetować.

## 4. Porównanie gotowych wzorców

### Ogarniacz

- `URUCHOM-OGARNIACZA.cmd`: sprawdza Git i Node/npm, `git fetch`, aktualizuje czysty `main` po fast-forward, `npm ci` przy zmianie lockfile i startuje Vite.
- `docs/WINDOWS_PWA.md`: odrębny **produkcyjny PWA w Edge**, zachowujący stały HTTPS/origin, SW i ręczny komunikat aktualizacji. To *nie jest* pakiet EXE ani to samo co CMD.
- Wnioski do przeniesienia: prosta obsługa, kontrola rozbieżności Git, aktualizacja bez nadpisania lokalnych zmian, utrzymanie originu. Nie kopiować Android APK, Raspberry i Tailscale.

### Ultimate Pomagier

- `launcher/launch.ps1` + `Uruchom Ultimate Pomagier.cmd`: mutex, wykrywanie istniejącego *własnego* serwera, strictPort, kontrola originu, `npm ci` według SHA lockfile, bezpieczne `git fetch`, świadome fast-forward, build-preflight, działanie offline, logi, odrzucenie zmian lokalnych, bez samoczynnego resetu.
- `docs/desktop-windows.md`: osobny **Tauri 2/NSIS/WebView2** z odrębnym profilem danych, signed updater dla kontrolowanych stabilnych wydań, wymaga publikacji artefaktów i `.sig`, kontrolowanego importu z przeglądarki. Nie korzysta z „git pull u użytkownika końcowego”.
- Wnioski do przeniesienia: PowerShell z testami, szczegółowe kontrole bezpieczeństwa, mutex/identity, rozdział trybu developerskiego od natywnej dystrybucji. Nie kopiować ścieżek, nazw, stałych profilu i kontraktów danych Pomagiera.

## 5. Rekomendowana architektura docelowa (dwa niezależne tryby)

```text
               REPO DEWELOPERSKIE
 C:\GitHub\Projects\Centrum_Projektowe
        | (bez automatycznych zmian)
        +-- npm run dev / test / build (praca programistyczna)

        INSTALACJA DO CODZIENNEGO UŻYTKU
 [Uruchom Centrum Projektowe.cmd]
       -> [launcher/launch.ps1]
       -> sprawdź blokadę + runtime + origin
       -> sprawdź kanał aktualizacji (offline -> LKG)
       -> pobierz kandydacki kod/wydanie
       -> wykonaj preflight w odizolowanym katalogu
       -> atomowo przełącz pliki statyczne na zweryfikowany build
       -> [lokalny serwer statyczny TYLKO localhost:STAŁY_PORT]
       -> [Edge/Chrome, STAŁY PROFIL + STAŁY ORIGIN]
       -> IndexedDB centrum-projektowe (nie jest katalogiem launchera)
```

**Preferencja na teraz:** Windows `.cmd` + PowerShell + Node 24 + istniejący frontend, minimalny serwer statyczny dla *produkcyjnego* buildu. Instalator Tauri/EXE dopiero w osobnym etapie. Wersja 1 powinna wymagać Node/Git na własnym komputerze (jak launcher developerski Pomagiera). Jeśli celem stanie się dystrybucja na komputerach bez Node/Git — oddzielnie zbudować Tauri z podpisanym updaterem.

**Punkt do ustalenia na podstawie istniejącego profilu:** stały origin; nie deklarować arbitralnie, że `localhost:5173` jest bezpieczny dla wszystkich dotychczasowych danych. Użytkownik może mieć bazę pod `127.0.0.1:5195` lub innym adresem. Migrować tylko po weryfikacji.

## 6. Roadmapa realizacji

| Etap | Zakres | Główna bramka PASS | Priorytet |
|---|---|---|---|
| **L0 — Lokalny preflight i kopia danych** | Aktualny HEAD/working tree; testy npm; rzeczywisty origin; eksport i test restore na kopii; decyzja dev vs runtime | Reprodukowany baseline i plan migracji danych | P0 |
| **L1 — Tożsamość aplikacji i dystrybucji** | `appVersion`, `buildSha`, kanał aktualizacji, release manifest, dokumentacja obecnego stanu, README | Zgodność źródła, buildu i manifestu | P1 |
| **L2 — Launcher Windows** | `.cmd`, PowerShell, mutex, single-instance, strictPort, identyfikacja własnego serwera, logi, offline, ikona/skróty opcjonalnie | Ponowny start bez zmiany originu i bez ingerencji w dane | P1 |
| **L3 — AutoUpdate fail-safe** | GitHub/release check, clean/FF, staging, LKG, kontrola CI/wersji, timeout, ograniczone retry, atomowy switch, rollback kodu | Awaria nie uszkadza aktualnej instalacji | P0 |
| **L4 — Kontrola kopii i kompatybilności** | Ekran wersji i aktualizacji, ostrzeżenia przed migracją schematu, test eksport/import; launcher nie czyta IndexedDB bez upoważnienia | Dane przetrwały migrację na rzeczywistym originie | P0 |
| **L5 — Testy Windows i dokumentacja** | Testy PowerShell/Node, CI Windows, scenariusze offline/port/kill/lockfile/restart/rollback, instrukcja instalacji | PASS Windows + CI + raport bez fikcyjnych testów | P1 |
| **10.2 (osobno)** | Commity/PR/CI, wykrywanie rozbieżności z ProjectSnapshot | Attention Engine nie myli deklaracji z dowodem | P2 |
| **10.3 (osobno)** | ContextPack GitHub, opcjonalny autoryzowany dostęp do prywatnych repozytoriów, odbiór | Ochrona sekretów i pełna kontrola eksportu | P2 |
| **D1 (opcjonalnie)** | Tauri 2, Windows NSIS, podpisane stabilne wydania, updater, dedykowany profil WebView2 | Test realnego podpisanego update i migracji danych | P3 |

**Zależności:** L0 → L1 → L2 → L3 → L4 → L5. Etapy 10.2/10.3 **nie są warunkiem** podstawowego launchera i mogą nastąpić po L5. D1 jest odrębną decyzją; nie wdrażać na siłę.

## 7. Szczegółowe wymagania launchera

1. Nigdy nie wykonuje `reset --hard`, `clean`, rebase, stash ani nie usuwa danych lokalnych.
2. Nie aktualizuje repozytorium roboczego, jeśli występują niezatwierdzone zmiany, własne commity, inna gałąź lub rozbieżna historia. Zalecana osobna instalacja runtime, aby w ogóle nie modyfikować deweloperskiego checkoutu.
3. Weryfikuje właściwy `origin`, branżę/kanał i zaufane SHA/ref; nie ufa obcemu manifestowi i nie akceptuje dowolnych hostów.
4. W codziennym trybie nie uruchamia aplikacji z nieprzetestowanych źródeł: kandydacki build przechodzi `npm ci`, testy celowane lub minimalny smoke + build, a kanał stable powinien wskazywać zatwierdzony commit/release (CI green jest potrzebne, ale samo może być niewystarczające).
5. Nigdy nie przełącza plików aktywnego builda przed pozytywnym wynikiem. Zachowuje co najmniej jedną ostatnią dobrą wersję. Rollback zmienia kod/bundle, nie pliki profilu przeglądarki ani IndexedDB. **Rollback kodu po migracji danych** może wymagać osobnej wersji zgodności i nie jest automatycznie bezpieczny.
6. Po błędzie sieci uruchamia ostatnią działającą wersję. Brak zależności/offline podczas pierwszego uruchomienia oznacza czytelny błąd, nie pozorny sukces.
7. Serwer lokalny nasłuchuje na loopback; strictPort; stały host, port i protokół. SPA fallback; identyfikacja własnego serwera przez bezpieczny mechanizm, bez akceptacji dowolnej aplikacji zajmującej port. Nie otwiera portu na LAN.
8. Jeden działający serwer na instalację; mutex. Drugi launcher otwiera istniejące okno albo informuje o aktualizacji w toku. Nie zabija dowolnych procesów Node; zamyka tylko własny proces.
9. Skrót pulpitu ma prowadzić do *launchera*, a nie bezpośrednio do `npm run dev` czy niezmiennego pliku HTML.
10. Logi i `.launcher/` nie zawierają tokenów, kopii prywatnej bazy ani ContextPack. Katalog ignorowany przez Git; reset środowiska launchera nigdy nie usuwa danych profilu.
11. `package-lock.json` kontrolowany hashem; `npm ci` tylko gdy zależności brakują lub lockfile się zmienił. Nie tworzyć zmian w tracked `package-lock` w czasie normalnego startu.
12. Wyświetla „wersja lokalna / dostępna / commit / ostatnia udana aktualizacja / tryb offline / błąd” i proste akcje: Sprawdź, Aktualizuj, Później, Uruchom ostatnią dobrą.
13. Nie dodaje GitHub PAT ani zależności od Hubu. Nie interpretuje odczytu GitHub o projektach użytkownika jako synchronizacji aplikacji, a GitHub API Etapu 10.1 nie jest aktualizatorem kodu.
14. Nie uruchamia wersji Vite dev jako niejawnego produkcyjnego runtime. Zachowuje niezależną komendę dev dla programisty.

## 8. Plan testów regresji i odbioru

**Automatyczne:** clean main + nowy commit, brak zmian, dirty tree, lokalny commit, divergent HEAD, obcy origin, GitHub timeout, brak sieci, 429/rate limit, uszkodzony candidate, `npm ci` failure, build failure, brak Node/Git, lockfile unchanged/changed, dwa launchery, obcy proces na porcie, zmieniony port, zmiana branch, błędny manifest, rollback bundle, migracja wersji + kompatybilność, SPA deep link, niedozwolona ścieżka static server, hash assets, brak sekretów w logach.

**Ręczne Windows:** pierwszy start, kolejny start, Edge/Chrome na docelowym profilu, brak zmiany originu, dane po F5, zamknięcie i ponowne uruchomienie, offline, restart Windows, awaria update i powrót do LKG, duża baza testowa, odtworzenie eksportu w izolowanej przeglądarce, brak UAC, poprawny skrót na pulpicie, 360/390/desktop, test zachowania danych po planowanej migracji. CI Linux PASS **nie** zastępuje Windows PASS.

## 9. Kryteria statusu

- **AUDYT STATYCZNY HEAD — WYKONANO**: drzewo, kluczowy kod, konfiguracje, historia, CI i porównanie referencji.
- **AUDYT LOCAL WORKTREE — NIE WYKONANO**: brak dostępu do `C:\GitHub\Projects\Centrum_Projektowe`; szczególnie nieznany lokalny HEAD i zmiany nieopublikowane.
- **AUDYT DYNAMICZNY WINDOWS — NIE WYKONANO**: nie uruchamiano aplikacji/launchera na docelowym komputerze.
- **GOTOWOŚĆ DO IMPLEMENTACJI LAUNCHERA — WARUNKOWA**: wyłącznie po L0, identyfikacji originu i udanej próbie bezpiecznego odtworzenia danych.

## 10. Pliki referencyjne i dowody

Centrum:
- `https://github.com/kapi1944/Centrum_Projektowe/tree/main`
- `.github/workflows/quality.yml`
- `apps/web/package.json`, `apps/web/vite.config.ts`, `apps/web/src/main.tsx`
- `apps/web/src/infrastructure/repozytoriumIndexedDb.ts`
- `apps/web/src/domain/kopieZapasowe.ts`
- `apps/web/src/domain/stanProjektu.ts`, `apps/web/src/domain/pakietKontekstu.ts`
- `docs/v2/GITHUB_INTEGRATION.md`, `ARCHITECTURE_TARGET.md`, `COMPATIBILITY.md`, `MIGRATION_PLAN.md`
- GitHub CI Quality run #10, commit `18ce4ee`, conclusion `success`, 2026-10-20.

Referencje:
- `https://github.com/kapi1944/Ogarniacz/blob/main/URUCHOM-OGARNIACZA.cmd`
- `https://github.com/kapi1944/Ogarniacz/blob/main/docs/WINDOWS_PWA.md`
- `https://github.com/kapi1944/Ultimate_Pomagier_3_5/blob/main/launcher/launch.ps1`
- `https://github.com/kapi1944/Ultimate_Pomagier_3_5/blob/main/launcher/README.md`
- `https://github.com/kapi1944/Ultimate_Pomagier_3_5/blob/main/docs/desktop-windows.md`

---

### Przykładowy pierwszy prompt do Codexa — audyt lokalny i bramka L0

```text
CENTRUM PROJEKTOWE 2.0 — L0: AUDYT LOKALNEGO REPO + BEZPIECZEŃSTWO DANYCH PRZED LAUNCHEREM

Pracuj wyłącznie w istniejącym C:\GitHub\Projects\Centrum_Projektowe.
Nie twórz nowego projektu. Nie resetuj, nie rebasuj, nie wykonuj restore, clean,
pull ani push. Najpierw odczyt Git status, HEAD, origin, ahead/behind i stan
Etapów 9, 10.1, 10.2, 10.3. Nie zakładaj HEAD 18ce4ee: to był stan remote 2026-10-22.

Przeprowadź pełny audyt lokalnego drzewa: domena, storage, IndexedDB, migracje,
backup, ProjectSnapshot, Attention Engine, RepoConnection, ContextPack, GitHub
adapter, Hub, testy, build, routing, bezpieczeństwo, UX, CI, dokumentacja.
Porównaj README/ROADMAP z kodem i wskaż drift.

Szczególnie zbadaj dotychczasowy ORIGIN aplikacji: protokół, host, port,
profil przeglądarki, strictPort, możliwość utraty widoczności IndexedDB po
zmianie originu. Nie próbuj czytać prywatnej bazy użytkownika z PowerShell/Node.
Zaproponuj bezpieczny eksperyment backup/restore na danych syntetycznych w
odizolowanej bazie i procedurę świadomego eksportu istniejących danych.

Uruchom npm ci, lint, typecheck, testy, build zgodnie ze stanem repo,
rozlicz PASS/FAIL i faktyczne liczby, sprawdź brak przypadkowego wpływu.
Nie naprawiaj jeszcze błędów, nie pisz launchera, nie zmieniaj wersji bazy,
nie wykonuj aktualizacji. Utwórz docs/v2/LAUNCHER_PREFLIGHT.md z dowodami,
ryzykami P0–P3, architekturą host/port/profile i gotowością L1.

Raport: HEAD, status Git, różnice względem remote, wersje i testy,
rzeczywisty origin, dowody backupu, ograniczenia i L0 PASS/WYMAGA NAPRAWY.
Bez commita (audyt może tworzyć plik dokumentacyjny), bez push.
```

### Przykładowy drugi prompt do Codexa — plan implementacyjny L1–L3

```text
CENTRUM PROJEKTOWE — WINDOWS LAUNCHER + FAIL-SAFE AUTOUPDATE (L1–L3)

Kontynuuj istniejące repo po L0 PASS. Przeczytaj docs/v2/LAUNCHER_PREFLIGHT.md.
Nie twórz alternatywnej aplikacji ani Tauri/EXE w tym zadaniu. Nie zmieniaj
IndexedDB, backupu, Huba, domeny, ContextPack, loginów ani wersji schematu.

Wzoruj się na gotowych wdrożeniach Ogarniacza i Pomagiera, ale kopiuj tylko
przydatne mechanizmy: Windows .cmd + PowerShell, mutex, strictPort, identyfikacja
własnego serwera, lockfile hash, npm ci, offline fallback, fetch/fast-forward,
czasowe ograniczenia, staging build, LKG, testy PowerShell, logi.

W pierwszej kolejności wdróż osobny runtime do codziennego użytkowania tak,
aby aktualizator nie dotykał lokalnego developerskiego working tree. Stały
origin musi wynikać z preflightu i nie może samoczynnie się zmienić. Za
pierwszym uruchomieniem nie zakładaj, że dane istnieją w docelowym originie.

Zakres L1: schemat wydania, wersja, SHA, dokumentacja, polityka bezpiecznej
promocji aktualizacji; bez sztucznych release. L2: launcher CMD/PowerShell,
serwer statyczny production builda loopback only, SPA fallback, health owner,
blokada dwóch instancji i bezpieczna obsługa portu. L3: zdalny check, czysty
fast-forward albo zatwierdzony release, budowa kandydata poza aktywnym runtime,
kontrole, atomowa aktywacja i ostatnia dobra wersja. Błąd uruchamia LKG;
nie wykonuj reset/restore/clean/rebase/stash i nie nadpisuj danych profilu.

W przypadku potrzeby migracji originu lub danych: STOP, najpierw osobny plan
eksportu/importu i akceptacja; nie pozoruj przeniesienia IndexedDB.

Testy celowane, testy skryptów PowerShell i Node, npm lint/typecheck/test/build,
smoke w przeglądarce oraz Windows jeśli środowisko dostępne. Skonfiguruj CI
Windows dla launchera. Nie deklaruj testu fizycznego Windows, którego nie wykonano.

Po PASS lokalny commit; bez push, release, deploy i aktualizacji Huba.
Raport: przed/po, wdrożone mechanizmy, logi bez sekretów, scenariusze awaryjne,
plików, testy, commit, ograniczenia i status L1–L3.
```
