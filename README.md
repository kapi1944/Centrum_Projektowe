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

## Aktualny zakres (Etapy 0–2 i 4)

- Shell: Start, Projekty, Inbox oraz obsługa nieznanej trasy.
- Tworzenie, edycja i archiwizacja projektów, dashboard oraz ręczny punkt powrotu „Gdzie skończyłem?”.
- Szybki zapis surowych wpisów, przypisywanie do projektu i tworzenie projektu z wpisu.
- Oryginał wpisu zachowany bez przycinania białych znaków i bez nadpisywania.
- IndexedDB, wersja schematu 3; migracje zachowują dane wersji 1 i 2.
- Projekt → Ustalenia: decyzje z wieloma projektami, źródłami, statusami i historią zastępowania. Numery `DEC-XXXX` są nadawane w transakcji, a poprzednia decyzja pozostaje w rejestrze.
- Analiza wpływu ze źródłem Capture lub Decision: kandydaci wynikają ze wspólnych projektów i jawnych odnośników. Każda propozycja jest zatwierdzana lub odrzucana osobno. Status decyzji i punkt powrotu mogą zmienić się dopiero po zatwierdzeniu; nieaktualne propozycje są blokowane.
- Zmiany modelu i zdarzenia historii zapisują się atomowo. Oryginały Capture pozostają niezmienione.

Etap 3 i CaptureAnalysis nie są zaimplementowane w tym repozytorium. Analiza wpływu nie interpretuje semantycznie tekstu. Powiązania z zadaniami, elementami pracy, blokerami i dokumentacją to ręczne odnośniki; zatwierdzenie wpływu na odnośnik zapisuje potrzebę przeglądu i nie modyfikuje zewnętrznego obiektu. Nie ma AI, integracji, backendu, kont ani danych demonstracyjnych.

## Dane lokalne i granice prywatności

Dane są przypisane do przeglądarki, profilu i originu (protokół, host, port). Nie są wysyłane do serwera. Usunięcie danych witryny, utrata profilu albo tryb prywatny mogą spowodować utratę zapisów. Ta wersja nie zapewnia eksportu, kopii zapasowych, szyfrowania ani uwierzytelnienia. „Prywatna” oznacza przeznaczenie aplikacji, a nie kontrolę dostępu na współdzielonym urządzeniu.

Zmiany z innej otwartej karty będą widoczne po odświeżeniu; synchronizacja kart nie jest zaimplementowana. Dane pozostają dostępne po ponownym uruchomieniu aplikacji na tym samym originie. Nie ma jeszcze service workera ani obsługi uruchamiania aplikacji offline.

## Dokumentacja

- [Architektura](docs/ARCHITECTURE.md)
- [Model domenowy](docs/DOMAIN_MODEL.md)
- [Roadmapa](docs/ROADMAP.md)

Fundament dodano do istniejącego repozytorium, którego bazą był commit `a2a5bc1c1cd88a86e2e878c8f0d19e234fe108c2`.
