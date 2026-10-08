# Plan rozwoju

Etap 3 pierwotnie pominięto. Etap **3R** dołącza `CaptureAnalysis` do już istniejących decyzji i wpływu Etapu 4. Kolejne etapy wymagają osobnego zadania.

| Etap | Zakres | Stan |
| --- | --- | --- |
| 0. Fundament | React/TS/Vite, obsługa tras, kontrakt repozytorium, zapis projektów i oryginałów | Zaimplementowany |
| 1. Pamięć projektu | Rozwinięty `Project`, statusy, archiwizacja, `ActivityEvent`, atomowy trwały zapis i migracje | Zaimplementowany; eksport/import i kopie zapasowe pozostają poza zakresem |
| 2. Skrzynka + „Gdzie skończyłem?” | Zapis i przypisywanie `Capture`, projekt z wpisu, ręczny punkt powrotu | Zaimplementowany |
| 3R. Analiza wpisów | Osobna analiza, AnalysisProvider, reguły lokalne, weryfikacja i zastosowanie do istniejących `Decision` / `ImpactAnalysis` | Zaimplementowany; oryginał niezmienny, zatwierdzanie jawne, audyt i wycofanie transakcji |
| 4. Decyzje, zastępowanie i analiza wpływu | Decyzje, źródła, wersje, zastępowanie, relacyjny wpływ i osobne zatwierdzanie propozycji | Istniejąca implementacja zachowana i połączona z 3R |
| 4.5. Spójność interfejsu | Polskie etykiety, weryfikacja tekstów, szczegóły techniczne i rozdzielenie statusów od filtrów | Zaimplementowany; bez zmiany schematu i tras |
| 5. Wykonanie | Obszary, etapy, siedem typów pracy, pytania i blokady | Zaimplementowany; relacje z decyzjami, jawna konwersja starszych analiz, migracja v5 i historia |
| 6. Dokumentacja / repozytoria / zasoby | Dokumenty, ręczne powiązania z repozytoriami, katalog zasobów | Plan |
| 7. Zdrowie / ekran Start | Ocena zdrowia z dowodów, aktualność kontekstu, blokady, następne kroki | Plan |
| 8+. Integracje | Opcjonalne źródła zewnętrzne i dostawcy modeli językowych | Wymagają osobnego polecenia; brak API i integracji w 3R |

## Obecny przepływ

**Wpis → Analiza wpisu → Weryfikacja → Zastosowanie → Decyzja / Analiza wpływu.**

**ORYGINAŁ ≠ ANALIZA ≠ DECYZJA.** Sam wynik dostawcy nie zmienia modelu projektu. Akceptacja założenia zachowuje jego typ. Potencjalna decyzja staje się propozycją w istniejącym rejestrze; kandydat wpływu trafia do istniejącego mechanizmu, którego propozycje wymagają osobnej zgody użytkownika. Dostawca regułowy nie ustala prawdziwości faktów ani semantyki tekstu.

## Granice 3R

- IndexedDB v4 dodaje wyłącznie magazyn analiz; dane i historia Etapów 0–4 pozostają zachowane.
- Jedna analiza na `Capture`, trwała częściowa weryfikacja i audyt edycji/odrzuceń; brak regeneracji i otwierania zakończonej weryfikacji.
- Brak zewnętrznego API sztucznej inteligencji, lokalnego modelu językowego, `Document`, GitHub API i `ProjectHealth`. Etap 5 dodaje osobny, potwierdzany przepływ tworzenia pracy i pytań z zachowanych elementów analizy.
- `APPLIED` oznacza udany zapis efektów analizy, a nie wdrożenie decyzji ani zatwierdzenie wszystkich propozycji wpływu.
- Testy automatyczne obejmują regresję istniejących przypadków, analizę, weryfikację, zastosowanie, informacje o pochodzeniu, migracje, współbieżność, wycofanie transakcji i ochronę nieaktualnego wpływu. Środowisko jsdom/fake-indexeddb nie zastępuje próby trwałości w rzeczywistej przeglądarce.
