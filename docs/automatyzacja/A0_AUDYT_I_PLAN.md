# A0 — audyt i fundament automatyzacji

Data: **2026-11-01, Europe/Warsaw**. Zakres: instrukcje, umiejętności, diagnostyka jakości i projekt dalszych etapów. Plan A1–A9 poniżej jest propozycją techniczną, nie upoważnieniem do wykonania. A0 nie implementuje Automation Orchestratora ani nowej integracji aplikacji.

## 1. Stan wejściowy i dowody

| Element | Stan sprawdzony w A0 |
| --- | --- |
| Repozytorium | `C:\GitHub\Projects\Centrum_Projektowe`, origin `https://github.com/kapi1944/Centrum_Projektowe.git`, publiczne, domyślna gałąź `main` |
| Bieżąca gałąź / HEAD | `codex/ux-rescue-01`, `abdad485049a3591637c01c88999965251721956` |
| Lokalne `main` | `9a9fcbf0027643fc326fabfa767358298d27b869` |
| Różnica gałęzi | `git rev-list --left-right --count main...HEAD`: `0 1`; dodatkowy commit UX Rescue 01 |
| Origin | `git ls-remote --heads origin` potwierdził oba powyższe SHA. Tracking i stan zdalny zgodne w chwili odczytu; nie zakładano, że wcześniejsze lokalne etapy zostały wypchnięte |
| Drzewo wejściowe | `git status --porcelain=v1 --untracked-files=all`: puste; lokalne raporty R0 i ZIP są ignorowane, zachowane |
| Środowisko | Windows / PowerShell, Node `v24.16.0`, npm `11.13.0`, VS Code `1.144.0` |
| Ostatni zaobserwowany CI bazy | [Quality 41314913303](https://github.com/kapi1944/Centrum_Projektowe/actions/runs/41314913303), push, `completed/success`, HEAD `abdad485…`; dotyczy starego workflow, przed A0 |

Polecenia źródłowe: `git status`, `git branch -vv`, `git log`, `git remote -v`, `git ls-remote`, `gh repo view`, `gh run list`. Użyto wyłącznie odczytu GitHub. Nie modyfikowano origin ani ustawień ochrony gałęzi. Nie audytowano ich kompletności; brak lokalnego pliku ochrony nie dowodzi braku ochrony po stronie GitHub.

### Dokumentacja R0–R3 i jej aktualność

- [R0 FINAL + R1](../v2/R0_FINAL_R1.md): zamknięcie audytu zależności, powłoka Glassplate, obowiązkowe komendy, granice odbioru. Obejrzano też lokalne `audyt-R0-2026-11-01_03-01-17/PODSUMOWANIE.txt`, `wyniki.json` i logi audytu SECURITY. Pierwszy R0 miał FAIL audytu npm pomimo pozostałych PASS; nie wolno sprowadzać jego wyniku do „wszystko zielone”.
- [R2](../v2/R2_DASHBOARD.md): rzeczywiste projekcje pulpitu, bez automatycznego procentu ukończenia. Raport rozróżnia pierwszy przebieg z błędami i częściowe ponowienia po poprawkach.
- [R3](../v2/R3_GITHUB_INTELLIGENCE.md): ręczny odczyt commitów, PR i listy Actions, dowody i uzgodnienia. Brak jobów/logów, sterowania Actions, uwierzytelnienia i monitorowania. Nie należy interpretować samego sukcesu workflow jako wdrożenia.
- [UX Rescue 01](../v2/UX_RESCUE_01.md): najnowszy opis interfejsu i historyczna pełna regresja 298 web + 1 Hub. Bazą A0 jest właśnie ten commit, a nie sam R3.
- [README](../../README.md), [zgodność](../v2/COMPATIBILITY.md), [integracja GitHub](../v2/GITHUB_INTEGRATION.md), [korekty](../v2/CORRECTION_PIPELINE.md), [ADR 0007](../adr/0007-ai-review-gate.md): źródła właściwych kontraktów i granic uprawnień.

`BASELINE.md`, `WORKSPACE_MIGRATION.md` i `ROADMAP.md` zawierają wcześniejsze wersje bazy, kopii i zakresu funkcji. Są użyteczne historycznie, ale nie są aktualnym katalogiem możliwości. Kod potwierdza otwarcie IndexedDB v8, eksport backupu v5 i rejestr 19 magazynów w `apps/web/src/domain/kopieZapasowe.ts`. Dokumenty mają różny stan historyczny; A0 nie przepisuje ich zbiorczo.

### Skrypty npm i odpowiedzialność

Manifest główny wymaga Node `>=24 <25`. Root deleguje kontrole do workspaces przez `--workspaces --if-present`.

| Skrypt / workspace | Faktyczna odpowiedzialność |
| --- | --- |
| root `dev`, `dev:hub`, `preview` | Uruchomienie Vite, osobnego Huba i podglądu web; nie są testami ani wdrożeniem |
| root `lint`, `typecheck`, `test`, `build` | Agregacja istniejących skryptów; brak skryptu w pakiecie jest pomijany |
| web `lint` | ESLint z `--max-warnings 0` |
| web `typecheck` | `tsc --noEmit`, także typy testów |
| web `test`, `test:watch` | Vitest jednorazowy / interaktywny; jsdom, Testing Library, fake-indexeddb |
| web `build` | Własny typecheck i produkcyjny Vite build |
| Hub `lint`, `typecheck`, `test`, `build` | ESLint, TypeScript, rzeczywisty test HTTP przez Node test runner, kompilacja serwera |
| Hub `dev`, `start` | Serwer deweloperski / uruchomienie skompilowanego serwera; obecnie tylko health check |
| contracts, domain, integration-sdk | Deklaracje `.d.ts`: lint, typecheck, build delegujący do typecheck; brak testów runtime |
| ui, testing | Zarezerwowane pakiety bez skryptów kontroli; nie implementują wspólnej biblioteki UI ani testów |

Istnieją automatyczne testy domeny, zatwierdzeń, izolacji projektów, migracji, importu starszych kopii, atomowości, rollbacku, idempotencji, UI i adaptera GitHub. Konfiguracja `apps/web/vite.config.ts` uruchamia jsdom i `src/testy.ts`; testy HTTP GitHub korzystają z mocków. Nie ma skonfigurowanego runnera E2E, progu pokrycia, raportera JUnit ani automatycznego odbioru urządzeń. Odbiory przeglądarkowe R1–R3 są osobnymi historycznymi dowodami.

## 2. Braki i powtarzające się instrukcje

| Brak na wejściu | Rozwiązanie / etap |
| --- | --- |
| Brak repozytoryjnego AGENTS.md i umiejętności | A0: jedno AGENTS.md i cztery SKILL.md w `.agents/skills` |
| Powtarzane polecenia jakości, zasady danych i struktury raportów w kolejnych zadaniach | A0: wspólne procedury i odnośniki, bez przepisywania raportów R0–R3 |
| Raporty Markdown i lokalne logi/JSON bez jednego kontraktu | A0: format raportu człowieka i prosty `wyniki.json` CI; A1: wersjonowany kontrakt oraz walidator |
| CI zatrzymuje kolejne kontrole po pierwszym błędzie | A0: niezależne warunki czterech kontroli po poprawnej instalacji |
| Brak ręcznego wyzwolenia, jawnych uprawnień, retencji i artefaktów jakości | A0: lokalna rozbudowa istniejącego workflow |
| Brak reusable workflow i wydzielonego profilu repozytorium | A2 po ustabilizowaniu kontraktu w A1 |
| Lista Actions nie zawiera wyników jobów, poszczególnych prób ani artefaktów | A3: osobny, ograniczony odczyt Actions |
| Brak Stage Gates związanych z planem, rewizją i SHA | A4; istniejące review domenowe pozostaje odrębnym mechanizmem |
| Brak bezpiecznej autoryzacji sterowania GitHub | A5: proces poza przeglądarką i minimalne uprawnienia |
| Brak wykonawcy kolejnych etapów, kolejki i odzyskiwania po awarii | A6; A0 nie dodaje takiego wykonawcy |
| Brak panelu automatyzacji i adaptera Agent Host | A7 i A8; R2/R3 dają elementy prezentacji i pochodzenia, ale nie gotowy orchestrator |
| Brak dowodu przenośności poza Centrum Projektowym | A9: pilotaż drugiego repo, bez globalnej warstwy „na przyszłość” |

Powtarzają się przede wszystkim: zachowanie danych, mały zakres zmiany, czytanie rzeczywistego kodu, cztery kontrole npm, kontrola różnicy Git, rozróżnienie testów lokalnych/CI/urządzenia oraz wykaz plików i ograniczeń. [AGENTS.md](../../AGENTS.md) zawiera zasady; [PROCEDURY.md](PROCEDURY.md) zawiera wykonanie i raportowanie; manifesty pozostają źródłem komend, a dotychczasowe dokumenty właścicielami kontraktów domeny.

## 3. Fundament instrukcji i Agent Skills

Cztery krótkie umiejętności realizują różne zadania: wykonanie zleconego etapu, diagnoza konkretnej awarii, rzeczywista regresja, raportowanie dowodów. Nie zawierają kopii wspólnego szablonu ani pełnej instrukcji danych. Wywołanie, np. `$realizuj-etap`, nie daje nowych uprawnień.

Wybrano **`.agents/skills/<nazwa>/SKILL.md`**: natywną lokalizację repozytoryjną Codexa, obsługiwaną również w VS Code. Wymagany frontmatter to `name` i `description`; instrukcje ładowane są zadaniowo. Nie dodano niepotrzebnych skryptów ani opcjonalnego `agents/openai.yaml`. Nie ma kopii w `.github/skills`, `.codex/skills`, promptach VS Code lub profilu użytkownika. Podstawą są [oficjalne instrukcje OpenAI](https://learn.chatgpt.com/docs/build-skills) i [lokalizacje VS Code](https://code.visualstudio.com/docs/agent-customization/agent-skills).

Repozytoryjny AGENTS.md jest odkrywany według hierarchii katalogów i może być przesłonięty przez bliższe instrukcje lub AGENTS.override.md. Jego obecność nie jest egzekwowalną kontrolą dostępu. CI i uprawnienia wykonawcy muszą niezależnie pilnować ograniczeń. [Zasady odkrywania AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md).

Zgodność VS Code należy odebrać w **konkretnym harnessie**: otworzyć Agent Customizations → Skills, sprawdzić ścieżkę i cztery nazwy, a następnie wywołać umiejętność. Dla Instructions sprawdzić załadowany AGENTS.md. A0 potwierdza wersję edytora i strukturę plików; nie deklaruje przeprowadzenia nowej sesji w każdym harnessie ani dostępu do konta Copilot. Edytor zarządza customizacjami wybranego harnessu, więc sama wersja VS Code nie gwarantuje jednakowej obsługi wszystkich formatów. [Agent Customizations](https://code.visualstudio.com/docs/agent-customization/overview).

## 4. GitHub Actions — zmiana A0 i dalsza propozycja

### Zastany quality.yml

Jeden job `quality`, `ubuntu-latest`, Node 24, `npm ci`, lint, typecheck, testy, build, wyzwalacze push i pull_request. Brak artefaktów, zestawienia, workflow_dispatch, concurrency, jawnych uprawnień i timeoutu. Brak automatycznych zmian kodu, wdrożenia oraz merge — tę granicę zachowano.

### Lokalnie przygotowana rozbudowa

- Zachowano nazwę workflow `Quality`, identyfikator joba `quality`, Node 24 i wszystkie pierwotne komendy. Nie zmieniono testów ani manifestów.
- Dodano `workflow_dispatch`, `contents: read`, timeout 20 minut i concurrency anulujące starszy przebieg tego samego workflow, zdarzenia i gałęzi/PR. Push i PR mają osobne grupy, aby nie anulować sobie wymaganych kontroli; otwarty PR może nadal powodować dwa przebiegi.
- Lint, typy, testy i build wykonują się po udanej instalacji także po błędzie wcześniejszej kontroli. Błąd pozostaje błędem joba: brak `continue-on-error`. Jawne `shell: bash` zapewnia `-e -o pipefail`, więc `tee` nie ukrywa kodu błędu npm. Nieudana instalacja blokuje cztery kontrole; anulowanie nie uruchamia kolejnych.
- Log każdej komendy trafia do katalogu tymczasowego runnera. Końcowe kroki z `always()` próbują zapisać tabelę w Job Summary i artefakt `jakosc-<run_id>-<attempt>` z logami, Markdown i `wyniki.json`, retencja 7 dni. Nagłe przerwanie runnera może uniemożliwić zapis; brak artefaktu nie jest sukcesem.
- JSON wersji 1 zawiera repozytorium, SHA kontroli, SHA źródła PR, run ID, attempt, zdarzenie i `outcome` poszczególnych kroków. Nie jest jeszcze kompletnym kontraktem Stage Gate ani raportem pojedynczych przypadków testowych. Wynik uploadu trzeba odczytać z joba; nie znajduje się w JSON tworzonym przed uploadem.
- Akcje przypięto do pełnych SHA z odczytanych tagów v4; checkout nie zachowuje poświadczeń. Logowane są komendy jakości, bez kopiowania workspace, prywatnych danych ani całego środowiska. Surowe logi nadal wymagają ostrożności, jeżeli przyszły test zacznie wypisywać poufne dane.

Ochrona przed zapętlaniem wynika z braku kroków zapisujących kod, wywołujących dispatch, tworzących PR/komentarze oraz z braku triggerów `workflow_run`/`repository_dispatch`/harmonogramu. Nie zastosowano filtra „pomiń boty”, który mógłby pozostawić niezweryfikowane zmiany. GitHub ogranicza wyzwalanie zdarzeń przez GITHUB_TOKEN, ale dispatch jest wyjątkiem; przyszły sterownik musi mieć własne limity i idempotencję. [Wyzwalanie workflow](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow).

Ręczne uruchomienie będzie dostępne po wprowadzeniu definicji z `workflow_dispatch` do domyślnej gałęzi. A0 pozostawia lokalną propozycję; nie wykonuje push ani merge. Nie uznajemy wcześniejszego zielonego uruchomienia za sprawdzenie nowego YAML. [Wymagania workflow_dispatch](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_dispatch).

### Rozbudowa po A0

A1: trwała walidacja konfiguracji w CI, raport przypadków testowych (np. JUnit) i wersjonowanie wyniku. A2: wydzielenie sprawdzonego joba do workflow z `workflow_call`, cienki lokalny caller i wywołanie z innego repo po niezmiennym SHA. Początkowe wejścia: wersja Node, katalog projektu, profil zatwierdzonych kontroli i retencja; bez arbitralnej komendy pochodzącej ze zdarzenia. Wyjścia: wynik jakości i nazwa artefaktu; porażka nadal musi powodować porażkę wywołującego joba. Bez `secrets: inherit`, jeśli sekrety nie są potrzebne. [Reusable workflows](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows).

Nie dodano teraz drugiego YAML, bo nie ma jeszcze drugiego odbiorcy ani stabilnego kontraktu. Repozytoria o innym runtime wymagają własnego profilu jakości; nie wolno narzucać im Node 24 lub schematu danych Centrum Projektowego. Wspólny rdzeń procedur można później dystrybuować jako wersjonowany pakiet umiejętności/plugin, z profilem repo jako jedynym miejscem lokalnych różnic. Bez ręcznie utrzymywanych duplikatów.

## 5. Dostępność, autoryzacja i koszty

| Mechanizm | Dostępny obecnie | Co wymaga kolejnego wdrożenia / uprawnień / kosztu |
| --- | --- | --- |
| AGENTS.md i Agent Skills | Pliki repozytorium, bez nowej usługi | Załadowanie i użycie w konkretnym kliencie; sam skill nie jest wykonawcą AI |
| Kontrole jakości | Lokalne narzędzia i istniejący CI; rozbudowa A0 lokalnie | Publikacja workflow przez normalne review; limity minut/storage Actions zależne od repo i planu, bez zakładania nieograniczonego bezpłatnego działania |
| R3 Actions | Ręczny anonimowy GET listy uruchomień publicznego repo | Joby, próby i artefakty to nowe zakresy; pobieranie logów/archiwów oraz repo prywatne mogą wymagać autoryzacji |
| Stage Gates | Istnieją domenowe review i kontrola rewizji | Brak bramek automatyzacji; implementacja A4, bez zastępowania nimi istniejących zgód |
| Actions dispatch | GitHub udostępnia API | A5, autoryzacja Actions write i zaufany proces; brak takiego tokenu w aplikacji i A0 |
| Sekwencja etapów | Wykonanie ręczne na podstawie zlecenia | A6: deterministyczny sterownik, kolejka, audyt; do samej decyzji „kolejny dozwolony job” nie potrzeba modelu AI |
| Samodzielna implementacja kodu przez agenta | Bieżący klient ma wykonawcę w tej sesji | Stały worker poza sesją, izolacja i wybrany silnik; model lokalny wymaga zasobów, zdalny API lub Copilot/Codex — odpowiedniego konta, dostępu i ewentualnych opłat. Nie zakładamy, że subskrypcja daje dowolne użycie API |
| AHP | VS Code publikuje Agent Host Protocol v1.0 | A8: adapter klienta/hosta, negocjacja funkcji, autoryzacja i uruchomiony host; protokół nie dostarcza modelu ani polityki zgód |
| Dashboard automatyzacji | R2/R3 pokazują projekty i ręczne obserwacje GitHub | A7: nowe projekcje postępu i dat aktualności; brak bieżącego monitorowania i trwałej kolejki w obecnym web |

Wydanie [VS Code 1.144](https://code.visualstudio.com/updates/v1_144) opisuje AHP v1.0; architektura oddziela host sesji od klienta. Host musi nadal działać, a narzędzia dostarczane przez klienta mogą wymagać jego obecności. Publiczny protokół nie jest dowodem kompatybilności z dowolnym API sesji Codexa. [Architektura Agent Host](https://code.visualstudio.com/docs/agents/concepts/agent-host).

## 6. Kontrakty przyszłej integracji

Poniższe nazwy i struktury są projektem do zatwierdzenia w odpowiednich etapach. Nie dodano modeli, endpointów, magazynów ani zmian backupu.

### Actions API i granica zaufania

Odczyt A3: lista uruchomień po workflow i SHA, szczegóły `GET /repos/{owner}/{repo}/actions/runs/{run_id}`, joby danej próby `GET .../actions/runs/{run_id}/attempts/{attempt_number}/jobs` oraz `GET .../actions/runs/{run_id}/artifacts`. Obsłużyć paginację, 403/404/429, ETag, wygasłe artefakty i odwołany dostęp; nie pobierać automatycznie całych logów. Wybrany log `GET .../actions/jobs/{job_id}/logs` traktować jako niezaufaną treść, z ograniczeniem rozmiaru, czasu i przekierowań do adresów pobrania wydanych przez GitHub. Nie zapisywać podpisanego URL jako trwałego linku. [Joby](https://docs.github.com/en/rest/actions/workflow-jobs), [artefakty](https://docs.github.com/en/rest/actions/artifacts).

Tożsamość obserwacji: stabilne ID repozytorium + workflow ID + run ID + attempt + head SHA + SHA faktycznie testowanego checkoutu + zdarzenie i czas pobrania. Nie scalać dwóch workflow po nazwie. `failure`, `cancelled`, `timed_out`, `skipped`, `neutral`, `action_required`, brak wyniku i nieaktualne dane nie spełniają bramki wymagającej sukcesu. Dla PR zidentyfikować również bazę/merge SHA; sam sukces wcześniejszego head SHA nie zatwierdza nowej kombinacji z bazą.

Zapis A5: `POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches`, wyłącznie dla allowlisty repo/workflow/ref i zatwierdzonych wejść. Aktualna dokumentacja API pokazuje odpowiedź 200 z `workflow_run_id` i URL, wymagane Actions write oraz ref jako gałąź/tag. Przed implementacją adaptera sprawdzić wybraną wersję API i jej kontrakt, zamiast zakładać dawną odpowiedź bez run ID. Ref rozwiązać do SHA, wymusić checkout zatwierdzonego SHA w wykonawcy i ponownie sprawdzić je po dispatch, aby przesunięcie gałęzi nie rozszerzyło zgody. [Dispatch API](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event).

Proces zaufany poza przeglądarką przechowuje poświadczenia; preferowana przyszła GitHub App z ograniczeniem instalacji do wybranych repo. Sam web otrzymuje stan i wynik operacji, nigdy sekret instalacji. Odczyt Actions read, dispatch Actions write; uprawnienia do kodu/PR są osobną decyzją. Przy braku prawa do pobrania logu zachować metadane i link do GitHub, bez obchodzenia dostępu. Nie modyfikować dzisiejszego anonimowego adaptera przez dopisanie tokenu do localStorage/IndexedDB.

### Zatwierdzony plan i Stage Gates

Plan wykonawczy ma zawierać: ID/rewizję, repo ID i bazowy SHA, cel, dozwolone pliki/operacje, etapy i zależności, kryteria odbioru, profil kontroli, limity czasu/prób/kosztu, zakres danych wysyłanych do modelu oraz sposób zatrzymania i odtworzenia. Zatwierdzenie wiązać z kanoniczną treścią i jej skrótem, rewizją, aktorem i czasem. Zmiana treści, zakresu, bazy lub zależności unieważnia zgodę w dotkniętym zakresie; agent nie zatwierdza własnego planu.

Proponowane bramki:

| Bramka | Warunek przejścia |
| --- | --- |
| Zakres | Zlecony etap, aktualna zatwierdzona rewizja planu i zgodny bazowy SHA |
| Wykonanie | Rozliczona próba, zmiany w dozwolonym zakresie i powiązany wynik wykonawcy |
| Jakość | Wszystkie wymagane kontrole zakończone sukcesem dla właściwego SHA/próby; pełny wymagany zestaw dowodów, brak anulowania |
| Odbiór | Kryteria funkcjonalne i wymagany manualny odbiór potwierdzone przez uprawnionego aktora; CI nie zastępuje tej decyzji |
| Kontynuacja | Następny etap należy do zatwierdzonej sekwencji, zależności są nadal aktualne, dostępny limit i brak blokady użytkownika |
| Publikacja | Odrębna zgoda na push/PR/merge/deploy zgodnie z nadanymi uprawnieniami; domyślnie blokada |

To przyszłe bramki wykonawcze, nie automatyczne nadawanie istniejącym zadaniom DONE ani przyjmowanie decyzji domenowych. Dowody i ich pochodzenie powinny wskazywać istniejący Evidence/SourceLink, gdzie pasuje ich znaczenie, bez drugiego konkurencyjnego rejestru decyzji.

### Kolejka i dalsze etapy

Proponowane stany próby: oczekuje na zgodę → gotowa → uruchamiana → wykonywana → weryfikowana → oczekuje na odbiór → zakończona. Dodatkowe zakończenia: błąd, blokada, anulowanie. Brak obserwacji po restarcie oznacza potrzebę uzgodnienia stanu, a nie nowy dispatch.

Klucz idempotencji: repo ID + plan ID/rewizja + etap ID + wejściowy SHA. Próba ma osobny numer. Zaufany sterownik musi trwale zapisać zamiar, posiadać pojedynczą dzierżawę pracy i zapisać run ID. Timeout po wysłaniu żądania wymaga ustalenia, czy run powstał, zanim będzie można powtórzyć. Workflow wykonawczy również odrzuca drugi efekt tego samego klucza. `concurrency` samo nie zapewnia dokładnie jednego wykonania.

Ukończenie jakości wywołuje ocenę bramek, a nie bezpośrednio kolejne AI. Każda kontynuacja ma znany etap nadrzędny, ograniczoną liczbę przejść i zatwierdzonego następcę. Duplikaty webhooków, zła kolejność, nowa rewizja planu, ruch gałęzi i przekroczenie limitu blokują efekt. Ręczne zatrzymanie unieważnia dzierżawę/zgodę na dalsze dispatch; anulowanie zdalnego runu jest oddzielną autoryzowaną czynnością. Logi i prompty nie mogą zmieniać allowlisty ani limitów.

### AHP i dashboard

AHP wdrażać za osobnym adapterem, nie jako drugi system Stage Gates. Centrum Projektowe byłoby klientem sesji hosta; najpierw lokalny eksperyment na syntetycznym repo. Negocjować wersję i capabilities, wiązać sesję z repo/worktree/etapem, obsługiwać utratę połączenia, ponowne dołączenie, potwierdzenia narzędzi i anulowanie. Mapować identyfikatory zdarzeń i kursor, zamiast traktować tekst końcowy modelu jako dowód wykonania. Zdalne połączenie WebSocket wymaga uwierzytelnienia, ochrony transportu i kontroli originu. Nie wystawiać portu hosta publicznie w ramach A0.

Dashboard A7 powinien pokazać plan i rewizję, etap, bramkę oczekującą na działanie, wynik kontroli, run/attempt/SHA, odnośniki do artefaktów oraz datę obserwacji. Rozdzielić „zaobserwowano”, „zatwierdzono”, „opublikowano” i „wdrożono”. Postęp liczyć z jawnie przyjętych kryteriów planu, bez zgadywania z liczby commitów lub tekstu agenta. Offline pokazać ostatni zapisany stan i jego wiek; brak sieci nie może uruchamiać retry zapisu. Polling ograniczyć, wstrzymywać w tle i respektować limity; webhooki przyjmować po stronie zaufanego procesu z kontrolą podpisu i deduplikacją.

## 7. Szczegółowe etapy A1–A9

Każdy etap wymaga osobnego zlecenia. Wspólna baza odbioru: [procedury](PROCEDURY.md). „Odtworzenie” poniżej oznacza wyłączenie nowej funkcji lub dodanie zmiany korygującej; nie usuwanie danych i historii. Gdy etap wymaga trwałego zapisu, najpierw zatwierdzić właściciela danych oraz zgodność schematu i kopii — brak zgody blokuje implementację persistence, nie uzasadnia prowizorycznej bazy.

### A1 — kontrakt jakości i walidacja fundamentu

- **Wejście:** odebrany A0, decyzja o wymaganych kontrolach i repozytoryjnym profilu. Zakres: kontrola AGENTS/Skills/YAML w CI, wersjonowany raport, raport przypadków web i Huba bez utraty istniejących testów.
- **Wynik:** opis JSON Schema raportu, identyfikacja narzędzi/środowiska/SHA/próby, rozróżnienie błędu wykonania od błędu testu i braku dowodu. Kontrola, czy wymagane workspaces rzeczywiście wykonały skrypty.
- **Brama odbioru:** wadliwy YAML/skill, FAIL testu, błąd instalacji i brak raportu blokują jakość; poprawny projekt przechodzi. Raport częściowy nie staje się kompletnym sukcesem.
- **Weryfikacja/odtworzenie:** lokalne fixtures sukcesu i awarii oraz rzeczywisty run po autoryzowanej publikacji. Wyłączenie nowego raportera przy zachowaniu obecnych komend, bez zmiany domeny/deps zbiorczo.

### A2 — reusable workflow i profil repozytorium

- **Zależność:** stabilny kontrakt A1. Wyodrębnić istniejący job do workflow_call w `.github/workflows`, pozostawić cienki caller; zaprojektować wersjonowany profil komend i wymaganych dowodów.
- **Wynik:** jawne typy inputs/outputs, minimalne permissions, przypięte wersje/SHA i zasady aktualizacji. Bez wykonywania arbitralnych wejść jako poleceń shell i bez dziedziczenia sekretów bez potrzeby.
- **Brama odbioru:** caller zachowuje błąd callee, artefakt i pełny zestaw kontroli; brak przypadkowego podwójnego wyzwalania. Działanie na dwóch różnych profilach potwierdzone lokalnie, zdalny drugi odbiorca w A9.
- **Weryfikacja/odtworzenie:** actionlint obu plików i próba dozwolonych/niedozwolonych wejść. Powrót callerem do poprzedniego SHA bez zmiany danych aplikacji.

### A3 — odczyt dowodów Actions

- **Zależność:** A1; A2 przydatny, ale odczyt nie powinien zależeć od jednego dostawcy workflow. Nowy ograniczony zakres adaptera tylko do odczytu publicznego Actions, jobów i metadanych artefaktów.
- **Wynik:** wersjonowane DTO, poprawne run/attempt/SHA, paginacja/oznaczenie niepełności, staleness, limity i kontrolowana obsługa braku dostępu. Logi dopiero na żądanie i z autoryzacją, jeżeli wymaga jej endpoint.
- **Brama odbioru:** brak mieszania workflow po nazwie, sukces starej próby nie zasłania nowej porażki, brak artefaktu/wygasły log pozostaje jawnym brakiem dowodu; odczyt nie zmienia etapu.
- **Weryfikacja/odtworzenie:** mocki statusów, stron, limitów, anulowania, wygasania i konfliktów; pojedynczy odbiór publicznego repo na danych syntetycznych. Wyłączenie zakresu zachowuje wcześniejsze obserwacje R3.

### A4 — zatwierdzony plan i Stage Gates

- **Zależność:** A1 i A3. Najpierw uzgodnić model planu, rewizji, zgody i wymaganych dowodów oraz relację do istniejących decyzji/korekt. Bez automatycznego wykonawcy.
- **Wynik:** walidator planu/DAG zależności i deterministyczna ocena bramek, ślad aktora/czasu/rewizji. Projekt przechowywania wymaga oddzielnego odbioru zgodności; A0 nie przesądza o zmianie IndexedDB/backupu.
- **Brama odbioru:** cykl, brak zależności, zmieniony plan/SHA, cofnięta zgoda, brak kontroli lub nieaktualna próba blokują przejście. Weryfikacja jakości nie nadaje automatycznie statusu domenowego.
- **Weryfikacja/odtworzenie:** testy tabel decyzyjnych, rozbieżnych rewizji i historii; ręczny odbiór przykładowego planu. Wyłączenie bramek wykonawczych pozostawia ręczną pracę i historię zgód.

### A5 — autoryzowany ręczny dispatch

- **Zależność:** A3/A4 oraz zgoda na dostawcę autoryzacji i zaufany proces. Ocenić rozszerzenie Huba, który obecnie ma tylko health check; nie zakładać, że jest już bezpiecznym brokerem.
- **Wynik:** minimalna GitHub App lub zatwierdzona alternatywa, sekrety poza web/repo, allowlista workflow/ref, przypięty wejściowy SHA, log audytu i ręczny dispatch jednego etapu. Kontrola sesji/CORS/CSRF stosownie do wybranego transportu.
- **Brama odbioru:** użytkownik zatwierdza konkretny plan/etap; serwer weryfikuje zgodę ponownie. Brak scope, odwołany token, niezgodny ref i obcy workflow są blokowane. Sukces HTTP oznacza zlecenie runu, nie sukces etapu.
- **Weryfikacja/odtworzenie:** mocki 401/403/404/429, przesunięcia ref i timeoutu po dispatch; jeden autoryzowany run testowego workflow. Wyłączenie dispatch/odwołanie instalacji bez usuwania obserwacji.

### A6 — kontrolowana sekwencja wykonania

- **Zależność:** A4/A5 i zatwierdzony zakres autonomii. Dodać deterministyczną kolejkę, idempotencję, lease, uzgadnianie po restarcie, ograniczone retry/backoff i zatrzymanie. Najpierw zadania jakości, bez samodzielnego kodowania.
- **Wynik:** trwałe zamiary i próby, ocena wszystkich bramek przed każdym następnikiem, limity liczby kroków/czasu/kosztu, historia decyzji sterownika i ręczna pauza.
- **Brama odbioru:** zduplikowane lub spóźnione zdarzenia nie tworzą kolejnego efektu; crash między dispatch a zapisem run ID nie powoduje ślepego retry; unieważnienie planu zatrzymuje sekwencję.
- **Weryfikacja/odtworzenie:** scenariusze restartu, timeoutu, dwóch workerów, zmiany planu i przerwania użytkownika. Globalny przełącznik stopuje nowe zadania; aktywne runy są rozliczane osobno.

### A7 — dashboard automatyzacji

- **Zależność:** A3/A4; sterowanie tylko z autoryzowanym A5/A6. Użyć istniejących komponentów R2/R3 i dodać projekcję postępu, bramek, prób, kontroli i aktualności.
- **Wynik:** lista etapów i wymaganych działań, panel run/job/log/artefakt z kontrolą dostępu, czytelna informacja offline/stale i wyjaśnienie blokady. Zmiany domenowe nadal osobno zatwierdzane.
- **Brama odbioru:** niepełne dane nie pokazują 100%; ponowienie runu i nowa rewizja mają odrębne wyniki. Brak autoryzacji usuwa dostęp do operacji, bez ujawnienia sekretów.
- **Weryfikacja/odtworzenie:** testy projekcji i interakcji, odbiór desktop/mobile/klawiaturą, regresja R1–R3. Wyłączenie panelu zachowuje dotychczasowe trasy i projekty.

### A8 — adapter Agent Host Protocol i wykonawca

- **Zależność:** A4–A6; A7 do obserwacji. Najpierw ograniczony eksperyment lokalny na wersji AHP hosta, później ewentualny worker implementujący zlecony zakres kodu.
- **Wynik:** adapter sesji i zdarzeń, negocjacja capabilities, izolowany worktree, ograniczenie narzędzi/sieci, mapowanie zgód i przerwań. Wybrany silnik AI, hosting, uprawnienia i budżet wymagają osobnej decyzji; protokół nie zapewnia ich automatycznie.
- **Brama odbioru:** brak możliwości ominięcia Stage Gates, edycji poza zakresem i publikacji bez zgody; rozłączenie klienta nie jest ukończeniem zadania. Wynik agenta przechodzi te same kontrole co kod człowieka.
- **Weryfikacja/odtworzenie:** fałszywy host i test kompatybilności z wybraną implementacją, reconnect, anulowanie i złośliwe instrukcje w logach. Odłączenie adaptera przywraca ręczną realizację etapów.

### A9 — pilotaż wielorepozytoryjny i eksploatacja

- **Zależność:** odebrane potrzebne elementy A1–A8 i wskazane drugie repozytorium, bez rozszerzania uprawnień na wszystkie projekty. Przenieść wspólny rdzeń przez wersjonowaną dystrybucję, pozostawić lokalne profile.
- **Wynik:** dwa rzeczywiste repo korzystające z tego samego workflow/umiejętności, udokumentowana aktualizacja i powrót wersji, zasady retencji/eksportu audytu, limity kosztów i instrukcja awaryjna.
- **Brama odbioru:** brak przecieku sekretów i dowodów między repo, brak powielonych dispatch, ręczny stop działa w obu repo, odmienne stacki zachowują własne kontrole. Automatyczny merge nadal poza zakresem, chyba że zostanie osobno zlecony.
- **Weryfikacja/odtworzenie:** scenariusz od zatwierdzenia planu do odbioru etapu, awaria usług i odwołanie dostępu; pomiar czasu, liczby ponowień i użycia zasobów. Wycofanie profilu/wersji osobno dla każdego repo, bez kasowania historii.

## 8. Weryfikacja A0

Wykonano jeden pełny przebieg czterech komend na Windows, Node `v24.16.0`, npm `11.13.0`. Wszystkie zakończyły się kodem 0. Korzystano z istniejącej instalacji; w A0 nie uruchamiano `npm ci`, `npm audit` ani aktualizacji zależności. Dowody lokalne: `C:/Users/Kacper/.codex/artifacts/centrum-a0-2026-11-01/`. Nie są częścią repozytorium i nie zawierają danych przeglądarki.

| Komenda / kontrola | Zakres i wynik | Kod | Dowód w katalogu lokalnym |
| --- | --- | --- | --- |
| `npm.cmd run lint` | PASS, wszystkie workspaces z zadeklarowanym skryptem, 14,99 s | 0 | `lint.log`, `kontrole.json` |
| `npm.cmd run typecheck` | PASS, wszystkie workspaces ze skryptem, 7,73 s | 0 | `typecheck.log`, `kontrole.json` |
| `npm.cmd run test` | PASS, 298/298 web w 28 plikach i 1/1 Hub, 19,49 s | 0 | `test.log`, `kontrole.json` |
| `npm.cmd run build` | PASS, web, Hub i pakiety deklaracji, 11,46 s | 0 | `build.log`, `kontrole.json` |
| `actionlint .github/workflows/quality.yml` | PASS po poprawce opisanej poniżej, actionlint 1.7.12 | 0 | `actionlint.log` (pusty przy sukcesie) |
| `skill-creator/scripts/quick_validate.py` dla czterech katalogów | PASS 4/4, Python 3.14.6 + PyYAML 6.0.3 | 0 każdy | `skills.json` |
| Parser YAML, lokalne odnośniki i kotwice | PASS: workflow oraz 42 lokalne odwołania w 8 plikach Markdown | 0 | `walidacja-konfiguracji.json` |
| Wykonanie kodu raportowania z YAML w Node | PASS: sukces, błąd lint, błąd instalacji, anulowanie i błąd checkout; zachowane stany, SHA źródła/kontroli i numer próby | 0 | `scenariusze/*/centrum-quality/wyniki.json` i podsumowania |
| Potoki komend z YAML przez Bash `-e -o pipefail` | PASS: 5 komend × sukces/błąd = 10 prób; wejściowy kod 23 zachowany mimo `tee`, powstały logi | 0 kontroli walidującej | `potoki/`, `walidacja-konfiguracji.json` |
| `git diff --check`, przegląd diff/status i nowych plików | PASS; zakres dziewięciu plików wskazany poniżej | 0 | końcowy przegląd Git |
| `git diff --exit-code -- apps packages package.json package-lock.json` | PASS, brak zmian kodu aplikacji, testów i zależności | 0 | końcowy przegląd Git |

Pierwsze uruchomienie actionlint wykryło użycie `runner.temp` w `jobs.quality.env`, gdzie walidator nie dopuszcza kontekstu `runner`. Katalog dla komend jest teraz ustawiany przez krok przygotowawczy w `GITHUB_ENV`; raport i upload korzystają niezależnie ze stałego podkatalogu runnera, także przy błędzie checkout. Ponowiona walidacja przeszła. Sprawdzenie środowiska walidatora Skills ujawniło brak modułu YAML w interpreterze; PyYAML doinstalowano wyłącznie do lokalnego katalogu narzędzi poza repozytorium. Nie zmieniono zależności projektu ani globalnej konfiguracji Pythona.

Actionlint pobrano z wydania projektu i sprawdzono SHA256 archiwum względem opublikowanego pliku sum: `6e7241b51e6817ea6a047693d8e6fed13b31819c9a0dd6c5a726e1592d22f6e9`. Testy lokalne wykonały kod raportu i potoki z rzeczywistego YAML; nie symulują całego silnika warunków GitHub ani faktycznego uploadu artefaktów. Ten odbiór pozostaje **NIEWYKONANY** bez publikacji workflow. Odbiór w nowej sesji Agent Customizations również **NIEWYKONANY**; potwierdzono format i obsługiwane lokalizacje.

Build web zakończył się bez ostrzeżenia o chunku większym niż 500 kB znanego z R3 (największy obecny plik JS około 380 kB). Vitest wypisał poradę optymalizacji tworzenia środowisk jsdom; nie zmieniano izolacji testów. Git informuje o przyszłej konwersji LF→CRLF zgodnie z ustawieniami lokalnymi; nie zmieniano polityki końców linii.

Kryteria A0 dotyczące lokalnego audytu, instrukcji, czterech umiejętności, propozycji/konfiguracji jakości, planu A1–A9 i wykonania kontroli są spełnione. Brak zdalnego odbioru nowego workflow oraz ręcznego odbioru odkrywania Skills pozostaje jawną granicą dowodu, a nie deklarowanym sukcesem.

## 9. Wykaz plików i ograniczenia

| Plik | Powód zmiany |
| --- | --- |
| `AGENTS.md` | Repozytoryjne zasady, routing do istniejących kontraktów i procedur |
| `.agents/skills/realizuj-etap/SKILL.md` | Procedura wykonania zleconego etapu |
| `.agents/skills/diagnostyka-bledow/SKILL.md` | Procedura diagnozy i ograniczonej naprawy |
| `.agents/skills/testy-regresyjne/SKILL.md` | Dobór i rzetelny odbiór regresji |
| `.agents/skills/raport-etapu/SKILL.md` | Raport na podstawie wspólnego formatu i dowodów |
| `.github/workflows/quality.yml` | Diagnostyka, wyniki, artefakty i zabezpieczenia istniejącego CI |
| `docs/automatyzacja/PROCEDURY.md` | Jedno źródło procedur i standardu raportowania |
| `docs/automatyzacja/A0_AUDYT_I_PLAN.md` | Audyt, braki, propozycja integracji, plan A1–A9 i odbiór A0 |
| `README.md` | Odnośniki do fundamentu automatyzacji |

Ograniczenia i ryzyka:

- Zmiany A0 pozostają lokalne, bez commita, push, PR i merge. Nowy workflow wymaga rzeczywistego odbioru na GitHubie po autoryzowanej publikacji; walidacja lokalna go nie zastępuje.
- Skills/AGENTS są instrukcjami dla modelu, nie granicą uprawnień. Nie potwierdzono ich wywołania w nowej sesji każdego klienta. Działanie zależy od harnessu, konta i ustawień organizacji.
- Historyczny R0/R1 raportował 12 Moderate w narzędziach deweloperskich i 0 produkcyjnych; to wcześniejsza obserwacja. A0 nie wykonuje napraw zależności ani nie traktuje starego audytu jako aktualnego skanu bezpieczeństwa.
- Publiczny CI i jego logi/artefakty nie mogą zawierać prywatnych danych ani sekretów. Retencja 7 dni ogranicza dostępność dowodów; wymagany dłuższy audyt potrzebuje osobnej polityki archiwizacji.
- Testy lokalne nie potwierdzają działania na telefonie, prywatnych danych ani zewnętrznego wykonawcy AI. Zmiana A0 nie dotyczy UI/domeny i nie wymaga zapisu danych w przeglądarce.
- Paginacja, limity i autoryzacja API ograniczą przyszły dashboard; brak danych nie może oznaczać sukcesu. Ceny i uprawnienia planów usług trzeba sprawdzić przy wyborze dostawcy, bez dodawania usług płatnych w A0.
- Zachowano IndexedDB v8, backup v5, starsze czytniki, domenę, zależności i lokalne archiwa R0. Nie wdrożono harmonogramu, webhooka, nowego endpointu ani automatycznej zmiany kodu.
