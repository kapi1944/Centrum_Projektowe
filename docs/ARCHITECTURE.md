# Architektura MVP

## Przepływ Etapów 0–4 z integracją 3R

**Capture → CaptureAnalysis → Review → Apply → Decision / Impact.**

**ORYGINAŁ ≠ ANALIZA ≠ DECYZJA.** Surowy wpis jest źródłem, analiza zbiorem propozycji systemu, a zatwierdzenie elementu osobnym działaniem użytkownika. Samo generowanie i review nie zmieniają Project ani Decision. Oryginał `Wpis.trescOryginalna` pozostaje niezmienny.

`POSSIBLE_DECISION` po apply tworzy istniejącą `Decyzja` jako `PROPOSED`. `IMPACT_CANDIDATE` inicjuje istniejącą `AnalizaWplywu` ze źródłem Capture oraz pochodzeniem zatwierdzonego elementu. Faktyczny wpływ na projekt wymaga osobnego rozstrzygnięcia propozycji Etapu 4. Pozostałe typy są zachowywane w analizie; nie tworzą konkurencyjnego modelu wiedzy ani wykonania.

## Podział odpowiedzialności

```text
src/
  app/             shell, routing, połączenie UI z rejestrem
  domain/          modele, czyste operacje, AnalysisProvider, kontrakt repozytorium
  features/        formularze, review, ustalenia, koordynacja zapisu
  infrastructure/ adapter IndexedDB, RuleBasedAnalysisProvider
  pages/           Start, Projekty, Projekt, Inbox, Ustalenia
  shared/          style i formatowanie dat
```

Domena nie importuje Reacta, IndexedDB ani API przeglądarki. Otrzymuje identyfikatory, czas i kontekst zapisu przez argumenty. `analizaWpisu.ts` przechowuje model analizy oraz reguły jej cyklu życia i zastosowania. Przy tworzeniu decyzji i wpływu wywołuje istniejącą `wykonajOperacjeUstalen`; kolejne decyzje w jednym apply widzą już wcześniejsze numery `DEC-XXXX`. Nie ma drugiego silnika Decision ani Impact.

`AnalysisProvider.analizuj` przyjmuje tekst i zwraca wynik z pochodzeniem, wersją i propozycjami. Jest asynchroniczny, ale jedyna implementacja działa lokalnie według jawnych reguł. Uruchomienie dostawcy odbywa się przed transakcją. Kontrakt dopuszcza oznaczenia `RULE_BASED`, `REMOTE_LLM`, `LOCAL_LLM`; nie implementujemy LLM, sieci ani konfiguracji API. Reguły nie przypisują prawdziwości ani pewności i nie tworzą FACT na podstawie domysłu.

`useRejestrProjektowy` dostaje repozytorium i opcjonalnie dostawcę. Po wygenerowaniu wyniku przekazuje operację do repozytorium, a projekcję React aktualizuje dopiero po zatwierdzeniu transakcji. Formularze przechowują lokalną edycję, blokadę ponownego kliknięcia i błędy. Review pokazuje trwały oryginał, elementy w siedmiu sekcjach, historię ocen i efekt apply. Inbox zachowuje także dotychczasowy ręczny dostęp do analizy wpływu Etapu 4.

## Persistence i migracje

Baza `centrum-projektowe` ma **wersję 4**. Magazyny z kluczem `id`: `projekty`, `wpisy`, `zdarzenia`, `decyzje`, `analizyWplywu`, `analizyWpisow`.

| Migracja | Zmiana |
| --- | --- |
| Nowa baza | Utworzenie wszystkich magazynów |
| v1 → v2 | Rozwinięcie modeli Projekt/Wpis, zachowanie oryginałów i przypisań, magazyn historii |
| v2 → v3 | Decision i ImpactAnalysis; unikalny indeks `czytelneId` i indeks `projektIds` decyzji |
| v3 → v4 | Wyłącznie nowy magazyn `analizyWpisow` z unikalnym indeksem `wpisId`; istniejące dane pozostają bez zmian |

Aktualizacja z v1 lub v2 przechodzi również późniejsze kroki. Migracja nie usuwa magazynów, nie resetuje danych ani historii i nie uzupełnia fikcyjnej historii wcześniejszych etapów. Jedna analiza na wpis zapobiega przypadkowemu nadpisaniu wyników i review.

Operacje analizy odczytują najnowszy stan wewnątrz jednej transakcji `readwrite` obejmującej wszystkie sześć magazynów. W tej samej transakcji zapisują analizę, status Capture, utworzone decyzje, analizę wpływu, ewentualną aktywność projektu i zdarzenia. Błąd któregokolwiek zapisu wycofuje całość. Repozytorium zwraca sukces dopiero w `oncomplete`, po czym zamyka połączenie. Nie ma asynchronicznych wywołań dostawcy wewnątrz transakcji.

Review i apply wymagają aktualnej `wersja` analizy. Równoczesne operacje z innej karty nie mogą nadpisać nowszego review; powtórny apply jest odrzucany. Edycje i odrzucenia trafiają do `historiaReview`, bez ActivityEvent na każde kliknięcie. Zdarzenia graniczne to `CAPTURE_ANALYZED`, `CAPTURE_REVIEWED`, `CAPTURE_ANALYSIS_APPLIED`; operacje ustaleń zachowują swoje zdarzenia.

Ochrona nieaktualnego wpływu pozostaje w istniejącym mechanizmie: wersja decyzji oraz porównanie punktu powrotu z jego snapshotem. Przyjęcie kandydata analizy nie omija tych kontroli. `APPLIED` Capture oznacza zakończony zapis apply, nie zgodę na wszystkie późniejsze propozycje wpływu.

## Granice

Brak operacji edycji lub usuwania oryginału. Nie chroni to przed ręczną zmianą IndexedDB w narzędziach przeglądarki. Brak synchronizacji kart, backendu, kont, eksportu, kopii zapasowych i service workera. Inna karta wymaga odświeżenia po konflikcie. Nie implementujemy Task, WorkItem, OpenQuestion, Blocker, Document ani Project Health.

Testy Vitest i Testing Library sprawdzają domenę i interakcje UI w jsdom, a fake-indexeddb migracje, odtwarzanie stanu, rollback i współbieżność. Nie są dowodem trwałości w konkretnej przeglądarce ani po restarcie urządzenia.
