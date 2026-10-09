# ADR 0002 — Logiczne granice domeny

## Kontekst

`src/domain` zawiera polskie modele i czyste operacje. `RepozytoriumProjektowe` łączy dziś projekty, wpisy, analizy, ustalenia, realizację i backup. `analizaWpisu.ts` wywołuje istniejące operacje ustaleń; realizacja odczytuje pochodzenie zatwierdzonych elementów. Rozdzielenie katalogów bez określenia własności danych grozi duplikacją domeny i utratą atomowości.

## Decyzja

Bounded contexts są logicznymi granicami jednego systemu, bez mikroserwisów. Nazwy angielskie poniżej są nazwami architektury; przyszłe funkcje, zmienne, komponenty i komentarze pozostają polskie. Własność obejmuje reguły zapisu, a nie osobną fizyczną bazę.

| Kontekst | Własność i odpowiedzialność | Relacja z obecnym modelem |
| --- | --- | --- |
| Projects | Tożsamość projektu, cykl życia, prywatność, ręczny punkt powrotu | `Projekt`; przyszły `ProjectSnapshot` jest projekcją |
| Knowledge | Niezmienne źródła, ich pochodzenie i jawnie zatwierdzona wiedza | `Wpis` → `SourceRecord`; twierdzenie z analizy nie staje się faktem |
| Decisions | Propozycje decyzji, przyjęcie, zastępowanie, wersje, review wpływu | `Decyzja`, `AnalizaWplywu`; zachowanie `DEC-XXXX` i relacji wielu projektów |
| Execution | Obszary, etapy, praca, pytania, blokady i ich reguły | `Obszar`, `Etap`, `ElementPracy`, `OtwartePytanie`, `Blokada` |
| Artifacts | Metadane dokumentów, plików i zasobów oraz odniesienia do ich treści | Brak dedykowanej encji dziś; backup jest formatem wymiany całego systemu, nie encją tego kontekstu |
| Intelligence | Dostawcy analiz, przebiegi, interpretacja wyników w propozycje | `AnalysisProvider`, docelowe `AnalysisRun`; bez prawa zapisu projektu |
| Integrations | Adaptery zewnętrznych usług, mapowanie, koperty, outbox | Brak implementacji; [ADR 0006](0006-integration-sdk.md) |
| Sync | Operacje, rewizje, deduplikacja, potwierdzenia i konflikty | Brak implementacji; [ADR 0004](0004-sync-authority.md) |

Kontekst zmienia własne encje przez jawne polecenia. Inne konteksty odwołują się przez identyfikatory i kontrakty, bez edycji cudzych rekordów. Koordynator zastosowania `ChangeSet` wywołuje reguły właścicieli i zachowuje jedną lokalną transakcję dla skutków wymagających atomowości. Podział logiczny nie wymusza osobnych magazynów ani repozytoriów.

`DomainEvents` opisują zatwierdzone zmiany. Impact Engine jest funkcją domenową analizy relacji, koordynowaną między kontekstami: tworzy propozycje wpływu dla Decisions oraz odtwarzalne projekcje `ProjectSnapshot` / `AttentionItem`. Nie jest drugim właścicielem projektu. Praca może wynikać z decyzji, ale aktualizacja pracy nie zmienia automatycznie decyzji.

## Konsekwencje

- Najpierw stabilizujemy kontrakty, później przenosimy małe fragmenty. W tym etapie nie zmieniamy katalogów i importów aplikacji.
- Nie tworzymy równoległych modeli `Projekt`, `Decyzja` ani drugiego silnika wpływu. Obecne ręczne powiązania i relacje realizacji zachowują swoje znaczenie.
- Historia jest wspólnym trwałym kontraktem audytu; jej szczegóły określa [ADR 0003](0003-change-proposal-pipeline.md). Nie wprowadzamy event sourcingu jako nowego źródła prawdy.

Przyszła bramka kontraktu: zakaz importów infrastruktury w domenie, brak zapisu cudzej encji poza koordynatorem i rollback całego zastosowania przy błędzie historii.

## Alternatywy odrzucone

- Mikroserwis na kontekst: zbędny koszt sieci i transakcji rozproszonych.
- Globalny model obejmujący wszystko: utrwala obecne sprzężenie.
- Osobne bazy wymuszone granicą kontekstu: utrudniają atomowe zastosowanie.

## Status

Przyjęta decyzja projektowa 2.0; podział logiczny, bez reorganizacji aplikacji.
