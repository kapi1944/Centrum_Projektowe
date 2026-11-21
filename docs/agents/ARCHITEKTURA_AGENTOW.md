# Architektura agentów i umiejętności Claude Code

Stan: 2026-11-21, SHA bazowy `b9e4e24` (origin/main). Właściciel: Centrum Projektowe. Zasady wspólne: [AGENTS.md](../../AGENTS.md); procedury kontroli i format raportu: [PROCEDURY](../automatyzacja/PROCEDURY.md).

## Trzy warstwy (nie mylić)

| Warstwa | Gdzie | Status |
| --- | --- | --- |
| 1. Subagenci Claude Code | `.claude/agents/*.md` | ✅ pliki wdrożone (5) i sprawdzone statycznie; 🟠 ładowanie w żywej sesji jeszcze niewykonane — patrz [EWALUACJE](EWALUACJE.md) |
| 2. Umiejętności (skills) | `.claude/skills/*/SKILL.md` | ✅ wdrożone (6) |
| 3. Wykonawca agentowy w aplikacji Centrum | przyszły Orchestrator / Agent Host (A8) | ⚪ tylko plan; **nic z warstw 1–2 nie oznacza, że aplikacja sama uruchamia agentów** |

```mermaid
flowchart LR
    U[Użytkownik] -->|/audyt-repo| A[repo-auditor<br/>odczyt]
    A --> P[/plan-etapu/<br/>implementation-planner<br/>odczyt]
    P -->|ZGODA na plan + SHA| I[/realizuj-etap/<br/>focused-implementer<br/>zapis w zakresie]
    I --> Q[/odbior-jakosci/<br/>qa-regression<br/>niezależnie]
    I --> S[security-privacy-reviewer<br/>gdy dane / CI / uprawnienia]
    Q -->|FAIL| D[/diagnostyka-bledow/ → STOP + propozycja]
    Q -->|PASS| C[/pakiet-kontekstu/<br/>punkt wznowienia]
    S --> C
    D -->|zgoda na korektę| I
```

Główny agent (sesja) orkiestruje; subagenci nie wołają siebie nawzajem. Jeden audyt na etap, jedno zadanie implementacyjne naraz, kontrola zawsze w osobnym kontekście niż implementacja.

## Agenci

| Agent | Odpowiedzialność | Narzędzia | Strażnik Bash | Zatrzymuje się, gdy | Kryterium skuteczności |
| --- | --- | --- | --- | --- | --- |
| `repo-auditor` | stan repo, różnice z origin, ryzyka | Read, Glob, Grep, Bash | `odczyt` (lista dozwolonych poleceń) | brak celu/SHA, zablokowane polecenie, >30 kroków | każdy fakt ze źródłem; zero zmian w repo |
| `implementation-planner` | najmniejszy etap: zakres, DAG, kryteria, rollback | Read, Glob, Grep, Bash | `odczyt` | brak SHA/celu, konflikt z AGENTS.md | plan mieści się w jednym odbieralnym etapie; każde kryterium ma test |
| `focused-implementer` | JEDNO zatwierdzone zadanie w wyznaczonych plikach | + Edit, Write | `ogolny` (zakazy + pytanie o zgodę) | brak planu/listy plików, 2× ta sama awaria, plik spoza zakresu | zmiany tylko w zakresie; brak PASS bez uruchomienia |
| `qa-regression` | niezależne kontrole i werdykt PASS/FAIL/BLOCKED | Read, Glob, Grep, Bash (bez Edit/Write) | `ogolny` | środowisko blokuje, 2× ta sama porażka bez zmian | werdykt wiązany z SHA; brak „skipped = passed” |
| `security-privacy-reviewer` | sekrety, publiczne repo, dane, CI, uprawnienia agentów, prompt injection | Read, Glob, Grep, Bash | `odczyt` | zakres niejasny | ustalenia ze ścieżką:linia; jawne „NIE SPRAWDZONO” |

Wybór modelu nie jest zakodowany (`model` pominięty → domyślny dobór Claude Code). Gdy pomiar kosztu pokaże potrzebę, dopisz `model` agentom odczytu osobnym, uzasadnionym commitem.

### Świadomie odroczeni agenci

- `context-curator` — rolę pełni skill `/pakiet-kontekstu` (zapis jednego pliku, bez osobnego kontekstu). Agent ma sens dopiero, gdy punkt wznowienia zacznie wymagać czytania dużych źródeł.
- `market-researcher`, `creative-director`, `partner-outreach` — dopiero po działającym MVP Copilota (patrz [ROADMAPA](ROADMAPA_EKOSYSTEMU.md)).

## Model uprawnień — co jest egzekwowane, a co nie

| Warstwa | Mechanizm | Co daje | Ograniczenie |
| --- | --- | --- | --- |
| Narzędzia agenta | `tools:` (lista dozwolonych) | agenci odczytu nie mają Edit/Write/PowerShell | `Bash` sam w sobie potrafi zapisywać |
| Strażnik poleceń | `.claude/hooks/straznik-polecen.mjs`, tryb `odczyt` (allowlista) i `ogolny` (zakazy + pytanie) | blokuje m.in. `push --force`, `reset --hard`, `clean`, `branch -D`, `npm audit fix`, `rm -rf`, odczyt `.env`; wymusza zgodę na `push/merge/commit/rebase`, `npm install`, `npx`, `gh` z zapisem; testowany `node --test` | to regex, nie piaskownica — nie zastępuje przeglądu; frontmatter-hooki projektu działają dopiero po zaufaniu folderowi (nie w `-p`) |
| Projekt | `.claude/settings.json` → `permissions.deny` + ten sam hook (`ogolny`) | zakazy działają też w głównej sesji | j.w. |
| Proces | AGENTS.md, plan z SHA, zgoda użytkownika | bramki SCOPE/REVIEW | zależy od dyscypliny; nie jest techniczną izolacją |

Czego **nie** twierdzimy: brak izolacji systemu plików ani sieci; agent z `Bash` w trybie `ogolny` może teoretycznie zapisać plik przekierowaniem. Dlatego `qa-regression` ma pomijać zapisy w instrukcji, a diff z `git status` po jego pracy jest częścią odbioru.

## Skille i jedno źródło prawdy z Codexem

| Skill Claude (`.claude/skills`) | Źródło procedury | Co dodaje wersja Claude |
| --- | --- | --- |
| `audyt-repo` | tylko tu (brak odpowiednika Codex) | trasowanie do `repo-auditor` |
| `plan-etapu` | tylko tu | trasowanie do planisty + bramka zgody |
| `realizuj-etap` | `.agents/skills/realizuj-etap` | bramka zakresu, implementer → QA → STOP przy FAIL; `disable-model-invocation` |
| `diagnostyka-bledow` | `.agents/skills/diagnostyka-bledow` | odtworzenie przez `qa-regression` |
| `odbior-jakosci` | `.agents/skills/testy-regresyjne` + `raport-etapu` | QA + opcjonalnie security, reguły werdyktu |
| `pakiet-kontekstu` | tylko tu | zapis [PUNKT_WZNOWIENIA](PUNKT_WZNOWIENIA.md) |

Wersje Claude odsyłają do plików Codexa zamiast je kopiować; zmiana procedury odbywa się w `.agents/skills/` lub PROCEDURY.md.

## Integracja z aplikacją Centrum (od ręcznej do automatycznej)

| Etap | Co użytkownik dostaje | Efekty uboczne | Zależność |
| --- | --- | --- | --- |
| **Teraz (Claude Code)** | `/audyt-repo` → `/plan-etapu` → zgoda → `/realizuj-etap` → `/odbior-jakosci` | tylko zatwierdzone | ✅ wdrożone w tym etapie |
| **I1** „Sprawdź stan projektu” w UI | przycisk składa ContextPack + dane R3 w raport i **kopiuje gotowe polecenie** dla Claude Code | brak (odczyt) | istniejące R2/R3, ContextPack |
| **I2** Plan jako dane | zatwierdzany plan z SHA, statusy bramek PASS/FAIL/BLOCKED wprowadzane z dowodów | zapis tylko domeny Centrum | A1, A4 (kontrakty, Stage Gates) |
| **I3** Odczyt przebiegów CI | dowody SHA/attempt dla bramek | brak (read-only GitHub) | A3 |
| **I4** Wykonawca | pojedynczy etap uruchamiany z UI przez zaufany host (Agent SDK/MCP po porównaniu) | worktree, gałąź | A5–A6, A8 + bramki |

Nie omijamy A4–A6, jeśli aplikacja ma wykonywać operacje z efektem ubocznym.
