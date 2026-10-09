# ADR 0005 — Storage provider-neutral

## Kontekst

`RepozytoriumProjektowe` już oddziela domenę od IndexedDB. Adapter realizuje migracje v1–v5, zapis historii i operacji atomowych. `kopieZapasowe.ts` definiuje rejestr 11 magazynów i format JSON `schemaVersion: 1`. Format backupu i wersja bazy to różne kontrakty. Nazwy magazynów są dziś częścią formatu wymiany.

## Decyzja

Domena i przyszłe kontrakty kontekstów pozostają niezależne od dostawcy storage. IndexedDB jest aktualnym adapterem, bez zmiany w tym etapie. Nie wybieramy teraz kolejnej bazy ani nie budujemy globalnego frameworka persistence.

Porty wyrażają odczyty i polecenia domenowe, kontrolę rewizji oraz wymagane granice atomowości. Nie ujawniają `IDBTransaction`, nazw fizycznych tabel, SQL ani sterowników. Koordynator ma otrzymać możliwość atomowego zastosowania konkretnego zestawu zmian; adapter bez takiej gwarancji nie może udawać zgodności.

Wspólne wymagania dla przyszłego adaptera:

- sukces po trwałym zatwierdzeniu transakcji; błąd historii wycofuje encje i marker zastosowania;
- kontrola aktualnych rewizji i relacji wewnątrz zapisu, nie tylko na wcześniejszym podglądzie;
- niezmienne źródła, trwałe ID, oryginalne pochodzenie i brak wymyślonej historii;
- równoważne ograniczenia unikalności: `czytelneId`, pochodzenie konwersji i idempotencja zastosowania; odejście od unikalnego `wpisId` wyłącznie z migracją [ADR 0003](0003-change-proposal-pipeline.md);
- spójny eksport całego stanu i atomowy import; kolizje i niepoprawne relacje blokują całość;
- jawna obsługa braku przestrzeni, niedostępności storage i konfliktów; brak automatycznego czyszczenia danych.

Eksport ma być logicznym, wersjonowanym formatem niezależnym od układu fizycznego. Przyszły format 2.0 wymaga jawnego czytnika kopii v1 i migracji z walidacją. Kopie v1 nadal muszą być obsługiwane zgodnie z istniejącą semantyką: merge konfliktuje przy różnych rekordach tego samego ID, replace wymaga potwierdzenia i nie dopisuje fikcyjnych zdarzeń. Downgrade do starej aplikacji po migracji nie jest gwarantowany; przed migracją wymagany jest sprawdzony eksport v1.

## Konsekwencje

Najpierw powstanie zestaw wspólnych testów zachowania adaptera: atomowość, konkurencyjna rewizja, unikalność, komplet danych backupu, restore i ponowne otwarcie. Testy fake-indexeddb są lokalnym dowodem implementacji, nie dowodem przeglądarki, innej bazy ani Hubu. Nowy adapter wymaga tych samych testów i osobnej weryfikacji jego trwałości.

Obecnego repozytorium nie dzielimy mechanicznie według kontekstów. Jego rozmiar jest miejscem przyszłej konsolidacji, ale zachowanie jednej transakcji ma pierwszeństwo przed układem katalogów.

## Alternatywy odrzucone

- Wymiana IndexedDB przy samym podziale katalogów: łączy dwa niezależne ryzyka.
- Uniwersalny CRUD: usuwa jawne reguły domeny i granice transakcji.
- Backup jako kopia fizycznych plików dostawcy: wiąże format z konkretną bazą.

## Status

Przyjęta decyzja projektowa 2.0. Bez zmian IndexedDB, portów i formatu kopii w tym etapie.
