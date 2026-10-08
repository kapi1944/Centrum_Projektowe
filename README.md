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

## Aktualny zakres (Etapy 0–4, w tym 3R)

- Shell: Start, Projekty, Inbox oraz obsługa nieznanej trasy.
- Tworzenie, edycja i archiwizacja projektów, dashboard oraz ręczny punkt powrotu „Gdzie skończyłem?”.
- Szybki zapis surowych wpisów, przypisywanie do projektu i tworzenie projektu z wpisu.
- Oryginał wpisu zachowany bez przycinania białych znaków i bez nadpisywania.
- IndexedDB, wersja schematu 4; migracje zachowują dane wersji 1–3, w tym decyzje i analizę wpływu Etapu 4.
- CaptureAnalysis (`AnalizaWpisu`): osobna analiza, siedem typów elementów, review z edycją i historią oraz atomowe zastosowanie zatwierdzonych elementów.
- Projekt → Ustalenia: decyzje z wieloma projektami, źródłami, statusami i historią zastępowania. Numery `DEC-XXXX` są nadawane w transakcji, a poprzednia decyzja pozostaje w rejestrze.
- Analiza wpływu ze źródłem Capture lub Decision: kandydaci wynikają ze wspólnych projektów i jawnych odnośników. Każda propozycja jest zatwierdzana lub odrzucana osobno. Status decyzji i punkt powrotu mogą zmienić się dopiero po zatwierdzeniu; nieaktualne propozycje są blokowane.
- Zmiany modelu i zdarzenia historii zapisują się atomowo. Oryginały Capture pozostają niezmienione.

Analiza wpływu nie interpretuje semantycznie tekstu. Powiązania z zadaniami, elementami pracy, blokerami i dokumentacją to ręczne odnośniki; zatwierdzenie wpływu na odnośnik zapisuje potrzebę przeglądu i nie modyfikuje zewnętrznego obiektu. Nie ma AI, integracji, backendu, kont ani danych demonstracyjnych.

## Capture → CaptureAnalysis → Review → Apply → Decision / Impact

**ORYGINAŁ ≠ ANALIZA ≠ DECYZJA. Analiza nie jest prawdą.** `Capture.rawText` odpowiada w kodzie `Wpis.trescOryginalna` i nigdy nie zmienia się podczas analizy, review ani apply.

1. W Inbox wybierz **Analizuj**. Zapis powstaje niezależnie od projektu i decyzji; Capture otrzymuje `ANALYZED`.
2. Oryginał pozostaje widoczny. **Rozpocznij review**, następnie zaakceptuj, edytuj albo odrzuć każdy element. Odrzucone propozycje i kolejne edycje pozostają w historii.
3. **Zakończ review** ustawia `REVIEWED`. Nie zmienia projektu ani decyzji. Analiza może pozostać w tym stanie bez zastosowania.
4. **Zastosuj zatwierdzone** obejmuje wyłącznie `ACCEPTED` / `EDITED`; przy edycji używa zatwierdzonej treści użytkownika. Wszystkie elementy muszą być wcześniej rozstrzygnięte. Brak zatwierdzonych elementów pozostawia analizę w `REVIEWED`.
5. Potencjalna decyzja tworzy istniejącą `Decyzja` w statusie `PROPOSED`, z powiązaniem do wpisu, analizy i elementu. Przyjęcie decyzji nadal odbywa się w Ustaleniach.
6. Kandydat wpływu inicjuje istniejącą `AnalizaWplywu`; zachowuje zatwierdzoną treść i provenance. Propozycje wpływu wymagają **osobnego zatwierdzenia**, a nieaktualne są blokowane jak w Etapie 4. Dopiero tam może zmienić się punkt powrotu lub status istniejącej decyzji.

Fakty, założenia i sugestie są zachowywane jako elementy analizy ze swoim typem. Akceptacja założenia oznacza chęć jego zachowania, nie obiektywną prawdziwość. Działania i pytania pozostają elementami oczekującymi na Etap 5; nie powstają encje Task ani OpenQuestion. Wpis bez projektu wymaga wskazania aktywnego projektu przy apply decyzji lub wpływu; cel zostaje zapisany w provenance bez zmiany oryginału i przypisania Capture.

`AnalysisProvider` oddziela kontrakt od implementacji. Jedyny dostawca, `RuleBasedAnalysisProvider`, rozpoznaje pytania zakończone `?` oraz jawne początki zdań, np. „Decyduję”, „Trzeba”, „Zakładam”, „Proponuję”, „Wpływ:”. Podsumowanie jest oznaczonym skrótem oryginału do 180 znaków. Reguły nie weryfikują faktów, nie rozumieją kontekstu ani zależności i mogą pomijać lub błędnie klasyfikować zdania. Nie generują faktów ani pozornej oceny pewności. `REMOTE_LLM` i `LOCAL_LLM` są tylko dozwolonymi oznaczeniami kontraktu, bez implementacji i połączeń sieciowych.

W tej wersji jest jedna trwała analiza na Capture. Ponowne generowanie i ponowne otwieranie zakończonego review nie są dostępne; można wrócić do częściowego review. `APPLIED` oznacza zapis efektów zatwierdzonych elementów, a nie przyjęcie decyzji ani zatwierdzenie wpływu. Stan UI zmienia się dopiero po zakończeniu transakcji.

## Dane lokalne i granice prywatności

Dane są przypisane do przeglądarki, profilu i originu (protokół, host, port). Nie są wysyłane do serwera. Usunięcie danych witryny, utrata profilu albo tryb prywatny mogą spowodować utratę zapisów. Ta wersja nie zapewnia eksportu, kopii zapasowych, szyfrowania ani uwierzytelnienia. „Prywatna” oznacza przeznaczenie aplikacji, a nie kontrolę dostępu na współdzielonym urządzeniu.

Zmiany z innej otwartej karty będą widoczne po odświeżeniu; synchronizacja kart nie jest zaimplementowana. Dane pozostają dostępne po ponownym uruchomieniu aplikacji na tym samym originie. Nie ma jeszcze service workera ani obsługi uruchamiania aplikacji offline.

## Dokumentacja

- [Architektura](docs/ARCHITECTURE.md)
- [Model domenowy](docs/DOMAIN_MODEL.md)
- [Roadmapa](docs/ROADMAP.md)

Fundament dodano do istniejącego repozytorium, którego bazą był commit `a2a5bc1c1cd88a86e2e878c8f0d19e234fe108c2`.
