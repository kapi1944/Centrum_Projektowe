# Architektura MVP

## Przepływ docelowy

Surowy wpis → zachowanie oryginału → przypisanie do projektu lub utworzenie projektu → analiza → propozycje zmian → zatwierdzenie przez użytkownika → aktualizacja modelu projektu → historia.

Etap 0 realizuje zapis oryginału i opcjonalne przypisanie do istniejącego projektu. Projekt można utworzyć na stronie Projekty. Dalsze kroki są zaplanowane, a zapis wpisu nie jest zatwierdzeniem zmian modelu.

## Podział odpowiedzialności

```text
src/
  app/             shell, routing i połączenie UI z przypadkami użycia
  domain/          modele, czyste operacje i kontrakt repozytorium
  features/        obsługa rejestru: odczyt i koordynacja zapisu
  infrastructure/ adapter IndexedDB
  pages/           Start, Projekty, Inbox
  shared/          style i formatowanie dat
```

Domena nie importuje Reacta, IndexedDB ani API przeglądarki. Operacje domenowe otrzymują identyfikator i czas jako argumenty. `useRejestrProjektowy` dostaje repozytorium przez parametr, tworzy identyfikatory/czas i aktualizuje projekcję UI dopiero po potwierdzeniu zapisu. `main.tsx` wybiera adapter IndexedDB i przekazuje go aplikacji. Nie ma globalnego frameworka repozytoriów ani kontenera zależności.

Formularze przechowują tylko stan edycji, postęp i komunikaty. Nie zawierają reguł tworzenia modeli ani bezpośrednich operacji storage. Trwałym źródłem danych jest repozytorium; tablice w React to projekcja bieżącej karty.

## Persistence

Baza `centrum-projektowe`, wersja 1. Magazyny `projekty` i `wpisy` używają klucza `id`. Adapter korzysta z natywnego IndexedDB bez dodatkowego frameworka. Zapis przez `add` odrzuca duplikat identyfikatora zamiast nadpisywać istniejący rekord. Wpis z przypisaniem wymaga istniejącego projektu; kontrola i zapis działają w jednej transakcji. Sukces jest zwracany dopiero po zakończeniu transakcji. Połączenie zamyka się po operacji.

Oryginał wpisu nie jest normalizowany. Białe znaki służą jedynie do sprawdzenia, czy wpis jest pusty. Nie udostępniamy operacji edycji ani usuwania oryginału. Nie jest to zabezpieczenie przed ręczną modyfikacją bazy w narzędziach przeglądarki.

Zmiany schematu będą wymagały kolejnych wersji i migracji w `onupgradeneeded`; nie wolno czyścić bazy, aby ominąć migrację. Etap 1 obejmuje migracje, wersjonowanie modeli i eksport/import danych. Dopiero późniejsze potrzeby uzasadnią indeksy lub dodatkowe repozytoria.

## Bezpieczny kierunek rozwoju

Analiza ma tworzyć osobne propozycje, zachowując powiązanie ze źródłowym wpisem. Dopiero jawne zatwierdzenie może zmienić model projektu. Zapis zmian modelu i zdarzeń historii powinien być atomowy oraz odporny na ponowne zatwierdzenie. Historia nie zastępuje oryginału wpisu. Mechanizm analizy zostanie określony w etapie 3; ten fundament nie dodaje AI ani połączeń sieciowych.

Nie ma uwierzytelnienia, synchronizacji, konfliktów między urządzeniami, eksportu ani service workera. Dane są lokalne, ale nie szyfrowane. Aktualizacja stanu między kartami wymaga odświeżenia. Testy persistence korzystają z fake-indexeddb, więc nie stanowią dowodu trwałości w konkretnej przeglądarce lub po restarcie urządzenia.
