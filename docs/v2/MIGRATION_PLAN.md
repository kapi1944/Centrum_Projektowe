# Plan dalszej migracji Centrum Projektowego 2.0

## Stan już osiągnięty

Punktem wyjścia jest kod `c0ce40b`, opisany w [BASELINE](BASELINE.md). ADR 0001–0007, siedem workspaces, CI, Hub health, deklaracje v2, sześć portów v1, dwa use cases, częściowy UnitOfWork i adapter widoków v1 ↔ v2 już istnieją. Nie cofamy ich ani nie wykonujemy ponownie reorganizacji. IndexedDB pozostaje v5, format kopii pozostaje 1.

Etap 5 kończy dokumentację i lokalne bramki. Poniższe kroki są **planem wymagającym osobnego zlecenia**, bez terminów kalendarzowych i bez deklaracji, że zostały wykonane.

## Kolejność i warunki rozpoczęcia

| Krok | Zakres przyszłego wdrożenia | Warunek wejścia i wyjścia |
| --- | --- | --- |
| 1. Reguły i przypadki użycia | Przenosić małe, używane fragmenty czystej domeny do `packages/domain`; kolejne workflow wydzielać do application i właściwych portów | Wejście: ustalony konkretny workflow. Wyjście: brak importów UI/storage w domenie, jeden silnik reguł, te same ID/statusy i wynik po commit transakcji; rollback historii |
| 2. Kontrakt danych i kopii v2 | Walidatory runtime i wersjonowany czytnik formatu v1; mapowanie wszystkich 11 magazynów, relacji i ograniczeń | Wejście: konkretne encje i docelowy format zatwierdzone. Wyjście: eksport/import pełnego syntetycznego stanu, jawny błąd nieznanej wersji i konfliktu, bez częściowego zapisu |
| 3. Źródła, runy i audyt review | Osobny etap według ADR 0003; rozdzielenie starej analizy bez nadpisania źródła, wyniku i korekt | Wejście: sprawdzona kopia przed migracją, przygotowany czytnik i strategia awarii. Wyjście: wiele runów bez utraty ID, pochodzenia i dawnych skutków; zachowane review i ochrona konwersji |
| 4. Propozycje i zastosowanie | Skończony katalog poleceń, osobny review, `ZestawZmian`, rewizje i trwała idempotencja | Wejście: dane/audyt z kroku 3 i jawne granice transakcji. Wyjście: tylko ACCEPTED/EDITED, stale revision blokuje zapis, identyczny retry nie powiela skutków, błąd historii wycofuje całość |
| 5. Zdarzenia i projekcje | Koperty trwałych zdarzeń, odtwarzalne snapshoty/sygnały uwagi, kursor i deduplikacja wpływu | Wejście: utrwalony apply. Wyjście: replay/ponowienie bez duplikatów, brak automatycznej zmiany decyzji i ręcznego punktu powrotu; bez wymyślonej dawnej historii |
| 6. Adaptery opcjonalne | Oddzielne zlecenia dla alternatywnego storage, Artifacts, Hub/Sync, integracji, AI lub wspólnego UI | Wejście: własny projekt kontraktu/uprawnień oraz stabilne bramki wcześniejszych kroków. Wyjście: dowód konkretnego adaptera i pracy offline; lokalny sukces odróżniony od potwierdzenia usługi |

Pakiety `ui` i `testing` otrzymują kod dopiero, gdy istnieje rzeczywisty współdzielony odbiorca. Nie tworzymy drugich modeli projektu/decyzji, globalnego frameworka persistence ani równoległego silnika analizy wpływu.

## Protokół przyszłej migracji danych

1. Sprawdzić wersję bazy, format wejściowej kopii, liczbę rekordów, unikalność i relacje. Wykonać spójny eksport v1 oraz odtworzyć go w odizolowanej bazie/przeglądarce. Zachować oryginalny plik poza repo i przeglądarką.
2. Przygotować deterministyczne mapowanie ID: wpis → źródło; analiza → historyczny run; element/review/zastosowanie → audyt i pochodzenie. Zachować decyzje, wpływ, realizację i historię wszystkich 11 magazynów. Bez rekonstrukcji brakujących zdarzeń jako nowych faktów.
3. Zachować `trescOryginalna`, tekst dostawcy, `trescEdytowana`, historię rozstrzygnięć, odrzucenia i rzeczywiste zastosowania. Historyczne runy: `LEGACY_IMPORTED`, czasy nieznane `null`, bez zgadywania modelu lub promptu. Dawny status APPLIED nie staje się nowym poleceniem wykonania.
4. Dopiero po przygotowaniu całego nowego kontraktu zmienić ograniczenie jednej analizy w domenie, fizyczny indeks `wpisId`, walidację kopii i odbiorców UI. Zapewnić równoważną ochronę unikalnego pochodzenia konwersji oraz idempotencji. Ten dokument nie ustala numeru nowej bazy.
5. Migrację i jej marker zakończenia zapisać atomowo w granicach przyjętego adaptera. Awaria pozostawia stary poprawny stan lub w pełni zatwierdzony nowy stan; nie czyści danych. Nie utrzymywać dwóch niezależnych źródeł prawdy przez dual-write.
6. Zweryfikować odczyt po ponownym otwarciu, eksport nowej kopii, import v1, konflikty, awarię późnego zapisu i restart. Sprawdzić realny plik w prawdziwej przeglądarce; fake-indexeddb nie zastępuje tego dowodu.

## Wycofanie i zgodność

Obecny adapter widoków nie migruje bazy i nie gwarantuje downgrade natywnego v2. Powrót do starej aplikacji po przyszłym podniesieniu wersji IndexedDB nie jest zapewniony. Przed migracją trzeba określić odtworzenie zachowanej kopii v1 w zgodnym środowisku/originie; późniejsze nowe dane v2 mogą nie mieć odpowiednika v1 i nie mogą być po cichu tracone.

Czytnik kopii v1 ma osobny cykl życia od adaptera widoków. Usunięcie `zgodnoscV1` lub fasady wymaga spełnienia warunków [COMPATIBILITY](COMPATIBILITY.md), pełnych testów konsumentów i odtworzenia danych. Sam upływ czasu lub obecność nowego typu nie wystarcza.

## Bramki dla każdego kroku

Wykonać lokalnie `npm ci`, lint, typecheck, test, build i `git diff --check`, a dodatkowe testy dobrać do faktycznego kontraktu. Weryfikacja danych obejmuje rollback encji/historii, aktualne rewizje, unikalność, niezmienny oryginał i bezstratny backup. Po osobnym upoważnieniu do publikacji ocenić zdalne CI; w Etapie 5 nie wykonano push.

Przed przyszłym udostępnieniem Hubu wymagane są osobne decyzje o autoryzacji i zakresie danych. Przed integracją lub AI wymagane są walidacja, zgoda na konkretną wysyłkę i sekrety poza payloadem/historią/backupem. To warunki wejścia przyszłych prac z ADR, nie implementacja w tym etapie.
