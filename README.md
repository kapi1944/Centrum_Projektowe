# Centrum Projektowe 2.0

Prywatna pamięć projektowa: projekty, oryginalne wpisy, ustalenia i realizacja. **Premium Dark Glassplate 2.0** to pełne, ciemne powierzchnie, czytelna typografia, interaktywne kafelki i responsywna nawigacja. Stan na 2026-11-01: UX Rescue 01 — projekty na pierwszym planie, wyszukiwanie, aktualny etap, następny krok i bezpośredni dostęp do GitHub. Zachowano funkcje R2/R3.

## Uruchomienie

Wymagany Node.js 24 LTS i npm. Komendy wykonuj z katalogu głównego; na Windows można używać `npm.cmd`.

```sh
npm ci
npm run dev
```

Zachowaj dotychczasowy protokół, host i port aplikacji. Inny origin oznacza osobną bazę przeglądarki. Hosting statyczny musi przekierowywać trasy, np. `/inbox`, do `index.html`.

## Bieżący zakres

- Start z przeglądem wszystkich projektów od pierwszego otwarcia, wyszukiwaniem, filtrami, aktualnym etapem, następnym krokiem, blokadami i skrótem GitHub na kafelku. Zachowano metryki, kontynuację pracy, uwagi, oś czasu i szybkie działania.
- Projekty: tworzenie, edycja, archiwizacja, historia, obszary, etapy, elementy pracy, pytania i blokady.
- Skrzynka: zachowany oryginał, analizy regułowe, weryfikacja, przebiegi i osobno zatwierdzane zastosowanie. Analiza nie jest decyzją ani obiektywną prawdą.
- Ustalenia i analiza wpływu; korekty, propozycje zmian i rewizje planu wymagające zatwierdzenia.
- „Wymaga uwagi”: projekcja rzeczywistych danych, filtry projektu, typu i wagi, odnośniki do źródeł.
- Repozytoria projektu, dowody, migawki, generator kontekstu oraz istniejący ręcznie uruchamiany odczyt publicznego GitHub. R1 nie dodaje integracji ani automatyzacji.
- Ręczny eksport, sprawdzenie, scalanie i atomowe zastąpienie kopii zapasowej.
- Zwijany sidebar, kontekstowe moduły projektu, górny pasek i menu mobilne. Wszystkie wcześniejsze trasy zachowane.

## Dane i prywatność

IndexedDB **v8**, **19 magazynów**, backup **v5** z obsługą importu v1–v4. R1 nie zmienia schematu, formatu kopii ani reguł domenowych. Dane są przypisane do przeglądarki, profilu i originu. Usunięcie danych witryny usuwa także projekty i historię. Wykonuj ręczne kopie na ekranie „Dane i kopie zapasowe” (`/dane`); pliki zawierają jawne prywatne treści.

Brak kont, szyfrowania, automatycznej synchronizacji między kartami i service workera. Dane projektowe są lokalne; istniejący odczyt publicznego GitHub wykonuje zapytania sieciowe na żądanie. Hub pozostaje niezależnym szkieletem health check, bez połączenia z web.

## Workspaces i weryfikacja

`apps/web`: React, TypeScript, Vite, React Router, domena i IndexedDB. `apps/hub`: `GET /health` z `status`, `version`, `timestamp` (domyślnie `http://127.0.0.1:3001/health`, opcjonalny `PORT`). `packages/contracts`, `packages/integration-sdk` i `packages/domain` zawierają istniejące kontrakty i typy. Komponenty wizualne pozostają lokalnie w web; `packages/ui` i `packages/testing` są zarezerwowane.

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run preview
```

Build web zawiera również kontrolę TypeScript. `npm run dev:hub` uruchamia Hub; po buildzie użyj `npm start --workspace=@centrum-projektowe/hub`. Testy jsdom/fake-indexeddb nie zastępują walidacji na urządzeniu fizycznym.

## Dokumentacja

- [Instrukcje agentów](AGENTS.md), [wspólne procedury rozwoju](docs/automatyzacja/PROCEDURY.md) i [audyt A0 oraz plan A1–A9](docs/automatyzacja/A0_AUDYT_I_PLAN.md)
- [UX Rescue 01: interfejs, naprawy i pełny odbiór](docs/v2/UX_RESCUE_01.md)
- [R2: pulpit, zakres metryk i weryfikacja](docs/v2/R2_DASHBOARD.md)
- [R3: GitHub Intelligence, kontrakty, API i weryfikacja](docs/v2/R3_GITHUB_INTELLIGENCE.md)
- [R0 FINAL + R1: zakres, zależności i weryfikacja](docs/v2/R0_FINAL_R1.md)
- [Glassplate Solid: tokeny i komponenty](docs/ui/README.md)
- [Zgodność danych i historia migracji](docs/v2/COMPATIBILITY.md)
- [Odczyt GitHub](docs/v2/GITHUB_INTEGRATION.md)
- [Archiwalne README etapów 0–6](docs/archive/README_PRZED_R1.md)
- [Architektura i wcześniejsze decyzje](docs/ARCHITECTURE.md), [model](docs/DOMAIN_MODEL.md), [roadmapa](docs/ROADMAP.md)

Starsze dokumenty pozostają archiwum decyzji i kolejnych etapów. Przy rozbieżności opis bieżącego stanu znajduje się tutaj i w dokumentacji R0/R1 oraz zgodności.
