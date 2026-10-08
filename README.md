# Centrum Projektowe

Prywatna aplikacja webowa: pamięć projektowa, rejestr ustaleń i miejsce do przechwytywania pomysłów. Nie jest publicznym portfolio; tę rolę pełni „Po Kapiemu”.

## Uruchomienie

Wymagany Node.js 24 LTS i npm. Na Windows można używać `npm.cmd` zamiast `npm`.

```sh
npm ci
npm run dev
```

## Kontrole

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run preview
```

React + TypeScript + Vite + React Router. Vitest, Testing Library i fake-indexeddb sprawdzają domenę, persistence oraz podstawowy przepływ UI. `build` tworzy katalog `dist`. Hosting statyczny musi przekierowywać ścieżki aplikacji (np. `/inbox`) do `index.html`.

## Zakres etapu 0

- Shell: Start, Projekty, Inbox oraz obsługa nieznanej trasy.
- Tworzenie projektów i zapis surowych wpisów, opcjonalnie przypisanych do istniejącego projektu.
- Oryginał wpisu zachowany bez przycinania białych znaków i bez nadpisywania.
- IndexedDB, wersja schematu 1; stan ładowania i błędy odczytu/zapisu.
- Start pokazuje liczby faktycznych rekordów i ostatnio zapisany wpis.

Analiza, propozycje zmian, zatwierdzanie, historia zmian modelu oraz pełne „Gdzie skończyłem?” nie są jeszcze zaimplementowane. Nie ma AI, integracji, backendu, kont ani danych demonstracyjnych.

## Dane lokalne i granice prywatności

Dane są przypisane do przeglądarki, profilu i originu (protokół, host, port). Nie są wysyłane do serwera. Usunięcie danych witryny, utrata profilu albo tryb prywatny mogą spowodować utratę zapisów. Ta wersja nie zapewnia eksportu, kopii zapasowych, szyfrowania ani uwierzytelnienia. „Prywatna” oznacza przeznaczenie aplikacji, a nie kontrolę dostępu na współdzielonym urządzeniu.

Zmiany z innej otwartej karty będą widoczne po odświeżeniu; synchronizacja kart nie jest częścią etapu 0. Dane pozostają dostępne po ponownym uruchomieniu aplikacji na tym samym originie. Nie ma jeszcze service workera ani obsługi uruchamiania aplikacji offline.

## Dokumentacja

- [Architektura](docs/ARCHITECTURE.md)
- [Model domenowy](docs/DOMAIN_MODEL.md)
- [Roadmapa](docs/ROADMAP.md)

Fundament dodano do istniejącego repozytorium, którego bazą był commit `a2a5bc1c1cd88a86e2e878c8f0d19e234fe108c2`.
