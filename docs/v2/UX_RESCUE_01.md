# UX Rescue 01 — Product First

Stan: 2026-11-01. Gałąź `codex/ux-rescue-01`, utworzona z czystego, zweryfikowanego `9a9fcbf0027643fc326fabfa767358298d27b869`. Nie rozpoczęto R4 ani nowych odczytów GitHub API. Zmiany są lokalne; bez push i merge do main.

## Odbiór R3 i problemy produktu

Raport R3 zestawiono z modelem, adapterem, istniejącym zapisem obserwacji i rzeczywistym interfejsem. Początkowa pełna regresja: **294/294 web i 1/1 Hub PASS**. Fundament pozostaje: RepositorySnapshot / Evidence / SourceLink / ContextPack, IndexedDB v8, 19 magazynów, backup v5.

W aktualnej przeglądarce na dotychczasowym originie testowym `http://127.0.0.1:4183` potwierdzono problem pierwszego ekranu: nowy projekt w statusie Pomysł był ukryty przez domyślny filtr Aktywny, a lista projektów znajdowała się poniżej dużych paneli. Nie było wyszukiwania, etapu w kafelku ani bezpośredniego wejścia do repozytorium konkretnego projektu. Wskazówki do dalszej pracy były rozproszone.

![Start przed zmianą](/C:/Users/Kacper/.codex/artifacts/centrum-ux-rescue-01/01-start-przed.jpg)

## Zmienione zachowanie

- Projekty są główną częścią Start. Domyślny widok obejmuje wszystkie statusy i jawnie oznaczone archiwum. Nowy pomysł jest widoczny od razu. Wyszukiwanie obejmuje nazwę, opis i następny krok, ignorując wielkość liter. Pusty wynik ma akcję wyczyszczenia filtrów.
- Kafelek pokazuje zapisany status, czas aktywności, rzeczywisty etap IN_PROGRESS, następny krok, liczbę otwartych zadań i aktywnych blokad. Przy wielu etapach w toku wyświetlany jest pierwszy według kolejności oraz liczba pozostałych. Brak etapu nie jest zastępowany domysłem. Stan i ostatnia praca pozostają dostępne w szczegółach.
- Osobne, dostępne klawiaturą akcje otwierają projekt i jego GitHub/repozytoria. Kafelek nie jest zagnieżdżonym przyciskiem z innymi przyciskami. Przycisk Nowy projekt jest widoczny w nagłówku, z przejściem i fokusem do istniejącego formularza.
- Panel uwag korzysta z dotychczasowej projekcji i pokazuje cztery najważniejsze sprawy, rzeczywiste powody i odnośniki do źródeł. Pełna lista jest dostępna osobno. Nie zmieniono reguł rozstrzygania uwag.
- Pozostawiono metryki, punkt powrotu, zadania, pytania i blokady ostatniego projektu, szybkie działania, wybór repozytorium, historię i oryginalny wpis.
- Premium Dark Glassplate 2.0: nieprzezroczyste grafitowe powierzchnie, mięta dla głównej akcji, niebieskie akcenty nawigacji, kolor statusu na kafelku, lokalna typografia systemowa, subtelne wejście i hover. `prefers-reduced-motion` wyłącza ruch. Ikony pochodzą z `lucide-react` i są ukryte przed czytnikiem, gdy towarzyszy im etykieta.
- Nawigacja zachowuje wszystkie trasy, zwijany sidebar i moduły otwartego projektu. Górny pasek pozostaje widoczny podczas przewijania. Mobilne menu obsługuje Escape i oddaje fokus przyciskowi. Odsunięcie celu przewijania zapobiega chowaniu go pod paskiem.

Nie powstały dodatkowe magazyny ani alternatywne modele. Start otrzymuje etapy i połączenia repozytoriów z istniejącego rejestru.

## Naprawione błędy i wydajność

1. Nowe projekty ukryte przez domyślny filtr — domyślnie wszystkie projekty i możliwość zawężenia listy.
2. Długi dostęp do projektów i repozytoriów — projekty przed panelami pobocznymi, wyszukiwanie i odnośniki GitHub w kafelkach.
3. Brak etapu na pulpicie — odczyt istniejących etapów IN_PROGRESS, z prawdziwym odnośnikiem do sekcji.
4. Ostrzeżenie Vite o rozmiarze JS — widoki inne niż Start są ładowane przez `React.lazy` i `Suspense` po wejściu na trasę. Główny plik spadł z około **505,6 kB / 149,4 kB gzip** do **379,7 kB / 118,9 kB gzip**, około 25% mniej przed kompresją. Największy osobny widok GitHub ma około 60,1 kB. Nie podniesiono progu ostrzeżeń; ostrzeżenie zniknęło.
5. Zimny start przy zmienionej kolejności importów — uruchomienie w rzeczywistej przeglądarce ujawniło przedwczesny odczyt `typyCelow` w cyklu korekty/kopie. Dwa walidatory pobierają te mapy dopiero podczas walidacji. Zestaw pól i format danych pozostały identyczne. Dodano test inicjalizacji rejestru bez wcześniejszego ładowania stron.
6. Fokus celu przy leniwym ładowaniu trasy — przenoszony dopiero po gotowości widoku, wewnątrz granicy Suspense. Zweryfikowano wejścia do formularzy i konkretnego zadania z fragmentem URL.
7. Dowód R3 dla dołączonego projektu — niezmieniona historia nie blokuje już nowej obserwacji, gdy wcześniejszy dowód nie obejmuje wszystkich aktualnie powiązanych projektów. Powstaje nowy dowód i snapshot, bez modyfikowania poprzednich. Nowy test obejmuje ten przypadek.

Instalacja ikon w działającym serwerze deweloperskim wywołała przejściowy błąd cache React. Po ponownej optymalizacji zależności oraz w zimnym uruchomieniu produkcyjnym problem nie występuje. Nie dodano drugiej kopii React.

## Rzeczywisty scenariusz

Użyto wyłącznie danych testowych w IAB na originie odbiorowym R3. Dotychczasowy syntetyczny projekt R3 zachowano. Nie korzystano z prywatnego profilu przeglądarki użytkownika ani nie resetowano danych. Serwer dev zastąpiono podglądem produkcyjnym pod **tym samym adresem i portem**, przed ponownym otwarciem aplikacji.

| Krok | Przebieg i wynik |
| --- | --- |
| 1 — projekt | PASS: Nowy projekt → formularz z fokusem → „Pracownia — UX Rescue”, status Aktywny, opis i następny krok zapisane. |
| 2 — zadanie i etap | PASS: zapisano zadanie w toku, priorytet Wysoki i etap „Odbiór produktu” w toku. |
| 3 — decyzja | PASS: zapisano propozycję „Zachowujemy lokalny zapis projektu” i ręcznie zaakceptowano ją. |
| 4 — repozytorium | PASS: powiązano istniejącą tożsamość `octocat/Hello-World` z drugim projektem, bez duplikatu repozytorium. |
| 5 — GitHub | PASS: wykonano rzeczywisty anonimowy odczyt; status Połączone, gałąź master, historia i dowód dla nowego projektu. Bez zapisu na GitHub. |
| 6 — postęp | PASS: zapisano punkt powrotu, stan, ostatnią pracę i następny krok; dodano testową blokadę fizycznego odbioru telefonu. |
| 7 — kopia | PASS: eksport v5, sprawdzenie pliku i import w trybie scalenia; istniejące rekordy zachowane, bez resetu bazy. |
| 8 — zamknięcie | PASS: zamknięto kartę, uruchomiono produkcyjny build i otworzono nową kartę na tym samym originie. Dane i skrót GitHub zachowane. Nie jest to restart procesu przeglądarki ani systemu. |
| 9 — kontynuacja | PASS: z panelu powrotu otwarto konkretne zadanie, potwierdzono fokus na jego identyfikatorze, ukończono zadanie i dodano kolejne zablokowane zadanie. |
| 10 — odświeżenie | PASS: zapisano kolejny punkt powrotu i odświeżono Start. Stan kontynuacji, etap, zadanie, blokada, decyzja i repozytorium pozostały dostępne. |

Eksport w kroku 7 zawierał 2 projekty, 1 zadanie, 1 decyzję, 1 etap, 1 repozytorium, 6 obserwacji i 6 dowodów. Kontynuacja po tym eksporcie dodała drugie zadanie i nowy zapis postępu. Liczby nie są danymi demonstracyjnymi w kodzie aplikacji.

![Zaakceptowana decyzja](/C:/Users/Kacper/.codex/artifacts/centrum-ux-rescue-01/05-decyzja.jpg)

![Odtworzenie kopii](/C:/Users/Kacper/.codex/artifacts/centrum-ux-rescue-01/08-kopia-odtworzona.jpg)

![Start po ponownym otwarciu i kontynuacji](/C:/Users/Kacper/.codex/artifacts/centrum-ux-rescue-01/09-start-desktop.jpg)

![Start mobilny](/C:/Users/Kacper/.codex/artifacts/centrum-ux-rescue-01/10-start-mobile.jpg)

## Regresja i dostępność

- Przed zmianami: pełne **294 web + 1 Hub PASS**.
- Końcowa pełna regresja: **298/298 web w 28 plikach + 1/1 Hub PASS**. Obejmuje IndexedDB, migracje, zgodność kopii, rollback, R2, R3, ContextPack, routing, formularze i historię.
- Dodano cztery testy: widoczność pomysłu/wyszukiwanie/czyszczenie filtrów, rzeczywisty etap i link GitHub, zimna inicjalizacja rejestru, dowód repozytorium dla nowego projektu. Starsze scenariusze nawigacji czekają na docelowy widok ładowany asynchronicznie. Poprawiono też niejednoznaczne wskazanie liczby blokerów po pokazaniu wszystkich projektów.
- Powtórzenie zestawu ujawniło niedeterministyczne założenie nowego testu o kolejności losowych ID dowodów w IndexedDB. Test identyfikuje teraz nowy dowód po jego ID, zamiast pozycji w tablicy.
- `npm run lint`, `npm run typecheck`, `npm run build`: PASS dla wszystkich workspaces. Po poprawkach ponowiono kontrolę zmienionych testów i końcowy build web. Pełne testy mają końcowy wynik zielony, nie wyłącznie zbiór wyników częściowych.
- Podgląd produkcyjny: brak błędów i ostrzeżeń konsoli po zimnym otwarciu i po nawigacji mobilnej. Wcześniejsze błędy deweloperskie zostały zdiagnozowane, a nie pominięte w ocenie.
- Desktop: `scrollWidth = clientWidth = 1581 px`. Wąski układ mobilny: `381 px`, wysokość 975 px, bez poziomego przewijania. IAB skaluje żądany viewport; raport podaje rzeczywiste wymiary dokumentu, nie deklaruje odbioru przy 320 px.
- Mobilnie sprawdzono otwieranie/zamykanie menu, Escape i zwrot fokusu, wyszukiwanie, kafelki, bezpośrednią trasę GitHub oraz powrót przeglądarką.
- Nawigacja, akcje i pola mają nazwy dostępne dla technologii asystujących; fokus pozostaje widoczny. Nie deklarujemy pełnego audytu WCAG ani testu czytnikiem ekranu.
- `npm audit --omit=dev`: 0 podatności zależności produkcyjnych. Instalacja zgłosiła 12 umiarkowanych podatności w całym drzewie z narzędziami deweloperskimi; nie wykonywano wymuszonych aktualizacji poza zakresem zadania.

Log pełnej regresji i pomiary przeglądarki: `C:/Users/Kacper/.codex/artifacts/centrum-ux-rescue-01/testy-pelna-regresja.log`, `weryfikacja-przegladarki.json`. Zrzuty pozostają w tym samym katalogu. Nie dodano danych testowych do repozytorium ani do startowego stanu aplikacji.

## Ograniczenia i uruchomienie

Odbiór mobilny wykonano w przeglądarce, bez telefonu fizycznego. Zamknięcie karty i nowe otwarcie sprawdzają trwały zapis originu; nie symulują wyczyszczenia danych, reinstalacji ani restartu systemu. Cache odczytów GitHub jest nadal sesyjny; zachowane obserwacje i daty są lokalne. Integracja pozostaje publiczna i read-only z limitami R3. Brak gwarancji działania wszystkich tras po utracie sieci przed pierwszym pobraniem ich pliku JS — nie dodano service workera ani nowego trybu offline.

Przegląd wszystkich projektów może obejmować archiwum; etykieta filtra i statusy pokazują ten zakres. Kafelki nie określają automatycznie procentu ukończenia ani aktualnego etapu na podstawie commitów. Sortowanie i filtry są sesyjne. Pozostałe ekrany zachowują dotychczasową strukturę funkcjonalną; zakres redesignu obejmuje Start i nawigację.

Standardowe uruchomienie: `npm ci`, następnie `npm run dev` z katalogu repozytorium. Dla istniejących danych zachowaj dotychczasowy protokół, host, port i profil przeglądarki. Podgląd odbiorowy działa osobno na `http://127.0.0.1:4183` i zawiera tylko dane testowe.

Zmieniono Start, powłokę, ładowanie tras, lokalne style, dwa miejsca napraw danych/integracji, testy, zależność ikon i dokumentację. IndexedDB, backup i kontrakty API nie zmieniają wersji. Nie dodano Electrona, płatnych API, publikacji ani automatyzacji.
