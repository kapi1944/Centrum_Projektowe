# R2 — Interactive Command Dashboard

Stan na 2026-11-01. Kontynuacja R1 na lokalnym `main` (baza `286f4c0`). Bez zmian domeny, IndexedDB, backupu, zależności i operacji biznesowych.

## Dashboard

- Cztery rzeczywiste metryki: projekty ACTIVE, niezakończone zadania TASK, aktywne blokady i nierozwiązane uwagi z istniejących projekcji `ObrazProjektu`.
- Metryki operacyjne obejmują projekty bez archiwum i bez statusów COMPLETED/ABANDONED. Zadania pochodzą z `aktualnaPraca` istniejącego selektora (bez DONE/ABANDONED). Badania, kontakty i inne typy pracy nie zawyżają liczby zadań.
- Kafelki z nazwą, statusem, aktywnością, zapisanym stanem, ostatnią pracą, następnym krokiem, liczbą aktywnych blokad i przejściem do projektu. Domyślnie ACTIVE; filtr udostępnia wszystkie statusy oraz archiwum. Sortowanie według aktywności lub polskiej nazwy statusu A–Z (remisy: aktywność, ID).
- Kontynuuj pracę: ostatnio aktywny bieżący projekt, pełny zapisany punkt powrotu, niezakończone zadania, otwarte pytania i blokady z bezpośrednimi odnośnikami. Nie dopisuje sugestii do punktu powrotu ani nie zmienia projektu.
- Wymaga uwagi: bez ponownego wyliczania klasyfikacji; prezentacja istniejących wag CRITICAL/HIGH/MEDIUM/LOW, następnie czasu i ID. Tytuł, powód, projekt i źródłowe odnośniki pochodzą z Attention Engine.
- Oś czasu: wyłącznie `ZdarzenieAktywnosci` odczytane z rejestru. Zapisana nazwa, opis, czas i autor; obsługa zdarzeń projektów i statusów, decyzji, korekt, zakończonej pracy oraz pozostałych istniejących aktywności. Korekta odrzucona nie jest opisywana jako zastosowana. Bieżący status DONE nie tworzy fikcyjnego zdarzenia ukończenia. Odrębne koperty korekt nie są dodawane ponownie, bo istniejący zapis operacji zawiera już aktywność CORRECTION_*.
- Szybkie działania: istniejące trasy formularzy projektu i wpisu, Skrzynka, Wymaga uwagi oraz repozytoria wybranego bieżącego projektu. Brak projektu oznacza jawny stan pusty zamiast niepoprawnego odnośnika.
- Zachowano ostatni wpis i jego oryginalną treść.

## UX i zakres techniczny

Istniejące komponenty Glassplate Solid, tokeny, kolory i mikrointerakcje pozostają jedynym systemem wizualnym. Dodano lokalne reguły układu `.pulpit`: cztery/dwa/jeden kafelek metryk, dwie/jedna kolumna paneli i mobilne filtry. Usunięto minimalną szerokość body z R1, która wraz z pionowym paskiem przewijania powodowała poziome przewijanie przy 320 px.

Aplikacja zachowuje loading/error istniejącego rejestru. Odnośniki z fragmentem po załadowaniu danych przewijają do celu i przenoszą fokus, również przy wejściu bezpośrednim. Wadliwy fragment URL jest ignorowany. Nie dodano animacji ani punktacji zdrowia/procentów postępu.

## Testy i kontrole

Wykonano jeden pełny przebieg wymaganych komend:

- lint: PASS we wszystkich workspaces;
- typecheck: wykrył niedozwoloną opcję `exact` w nowym teście Testing Library; poprawiono;
- testy: Hub 1 PASS, web 257 PASS / 1 FAIL; starszy test wymagał wskazania panelu, bo punkt powrotu jest teraz widoczny także na kafelku;
- build: Hub i pakiety PASS; web zatrzymany przez powyższy błąd typu w teście.

Po poprawkach wykonano tylko kontrole dotknięte zmianą, bez kolejnego pełnego przebiegu:

- 9 testów dashboardu/punktu powrotu: PASS;
- po dodaniu integracyjnego testu fokusu: 17 testów w 3 plikach (dashboard, punkt powrotu, aplikacja): PASS;
- build web wraz z typecheck: PASS;
- ESLint zmienionych po pierwszym przebiegu plików TS/TSX: PASS.

Łączny końcowy zakres to 259 testów web (251 z R1 + 7 nowych dashboardu + 1 integracyjny fokusu) i 1 Hub. Wszystkie przypadki mają wynik PASS z pełnego przebiegu lub ponowienia zmienionego pliku. Nie deklarujemy drugiego pełnego przebiegu.

Przeglądarka: potwierdzono układ desktop/mobile, filtr wszystkich projektów oraz działanie Nowego wpisu (fokus `tresc-wpisu`). Przy viewport 320 px po poprawce `scrollWidth = clientWidth = 301 px` (pozostałe 19 px zajmuje pionowy scrollbar), bez poziomego przewijania. Oglądano wyłącznie istniejące dane, bez dopisywania demonstracji. Zrzuty: `C:/Users/Kacper/.codex/artifacts/centrum-r2-2026-11-01/dashboard-desktop.jpg` i `dashboard-mobile.jpg`.

## Ograniczenia

Panel uwag pokazuje 5 najważniejszych spraw, z przejściem do całej listy. Kontynuacja pokazuje do 5 pozycji każdej kategorii oraz odnośnik do pełnej realizacji. Oś czasu pokazuje do 12 najnowszych zdarzeń wybranego rodzaju, również z archiwum. To podgląd zapisanej historii, bez odtwarzania brakujących wydarzeń. Sortowanie i filtry są sesyjne. Walidacja mobilna wykonana w przeglądarce, bez fizycznego telefonu.

## Pliki

`apps/web/src/pages/Start.tsx`, `Start.test.tsx`, `apps/web/src/app/Aplikacja.tsx`, `Aplikacja.test.tsx`, `apps/web/src/features/projekty/punktPowrotu.test.tsx`, `apps/web/src/shared/style.css`, `README.md`, ten raport. Starsza dokumentacja R0/R1 pozostaje zachowana.
