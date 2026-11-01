# Glassplate Solid — Premium Developer Workspace

Stan R1, 2026-11-01. System lokalny w `apps/web`; bez zewnętrznej biblioteki UI, webfontów i zmian domeny.

## Tokeny i zachowanie

| Rola | Wartość |
| --- | --- |
| Tło | `#141820` |
| Panel | `#1D232D` |
| Powierzchnia podwyższona | `#252D39` |
| Obramowanie | `#34404F` |
| Tekst | `#E6EDF6` |
| Tekst drugorzędny | `#A9B6C8` |
| Akcent / fokus | `#91BCFF` / `#A5CBFF` |
| Sukces | tekst `#A9D9C3`, tło `#20332E` |
| Ostrzeżenie | tekst `#EDC780`, tło `#392F20` |
| Błąd | tekst `#FFBDC3`, tło `#39252C` |

Powierzchnie mają pełne krycie, bez rozmycia szkła. Głębię wyznaczają obramowania i subtelny cień. Typografia systemowa Segoe UI Variable / Segoe UI / system-ui. Odstępy opierają się na 4 px, zwykle 8/12/16/20/24/48 px. Promień powierzchni 12 px, kontrolek 7 px. Kontrolki mają co najmniej 44 px wysokości; checkbox/radio zachowują natywny rozmiar wewnątrz etykiet.

Desktop: sidebar 248 px (216 px na mniejszym ekranie), po zwinięciu 80 px; aktywna trasa ma kolor, obramowanie i boczny znacznik. Do 760 px menu jest rozwijane nad treścią, bez nakładki i blokowania przewijania. Escape zamyka menu i oddaje fokus przyciskowi; wybór trasy zamyka menu i przenosi fokus do treści. Stan zwinięcia jest sesyjny i nie zapisuje się w bazie ani kopii.

Mikrointerakcje dotyczą tylko kolorów i obramowań (140 ms). `prefers-reduced-motion` wyłącza przejścia i animacje. Dostępne są widoczny fokus, link pomijający nawigację, etykiety kontrolek, `aria-current`, `aria-controls` i `aria-expanded`. Statusy zawsze mają tekst, nie tylko kolor. Komunikaty operacji zachowują dotychczasowe role `alert` i `status`.

## Komponenty

Nazwy polskie zgodne z zasadami repozytorium. Wszystkie komponenty są używane przez aktualne ekrany, bez dodatkowego pakietu i abstrakcji domenowych.

| Wymagany komponent | Implementacja | Zastosowanie |
| --- | --- | --- |
| AppShell | `PowlokaAplikacji` | Wszystkie trasy, loading i błąd odczytu |
| Sidebar | `PasekBoczny` | Główna nawigacja oraz moduły otwartego projektu |
| Topbar | `GornyPasek` | Nazwa obszaru, lokalny charakter danych, menu mobilne |
| Panel | `Panel` | Semantyczna sekcja, przekazywane atrybuty HTML/ARIA |
| Card | `Karta` | Semantyczny article, m.in. metryki |
| StatusBadge | `EtykietaStatusu` | Projekty, wpisy, waga uwagi; pięć tonów |
| MetricTile | `KafelekMetryki` | Liczby rzeczywistych projektów i wpisów |
| EmptyState | `PustyStan` | Puste listy i wyniki filtrów |
| SectionHeader | `NaglowekSekcji` | h1/h2, opis, opcjonalne akcje |
| ActionButton | `PrzyciskAkcji` | Native button, typy HTML, ref, wariant główny/drugorzędny/niebezpieczny |

Źródła: `src/app/PowlokaAplikacji.tsx`, `src/shared/Komponenty.tsx`, `src/shared/style.css` (w `apps/web`). Przycisk ma domyślnie `type="button"`; w formularzu zapisu należy podać `type="submit"`. Sekcja z `aria-labelledby` wymaga odpowiadającego ID nagłówka. Etykieta statusu jest statyczną informacją, nie regionem live.

Istniejące ekrany używają wspólnych reguł formularzy, paneli, kart, komunikatów i odnośników. Zakładki modułów projektu są linkami nawigacyjnymi, bez pozornej semantyki ARIA tabs. Poprzednia dokumentacja UI była miejscem zarezerwowanym podczas migracji workspace; historyczny zakres opisuje archiwalne README.
