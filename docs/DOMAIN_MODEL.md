# Model domenowy

Nazwy w kodzie są polskie. Angielskie nazwy w tabeli odpowiadają pojęciom z założeń projektu. Tylko Projekt i Wpis są obecnie typami wykonywalnymi; pozostałe encje opisują kierunek bez pustych implementacji.

| Pojęcie | Nazwa polska | Odpowiedzialność i relacje | Stan |
| --- | --- | --- | --- |
| Project | Projekt | Agreguje kontekst pracy; obecnie `id`, `nazwa`, `utworzono` | Minimalny model |
| Capture | Wpis | Niezmienny `trescOryginalna`, `id`, `utworzono`, opcjonalne `projektId`, `stan: nowy` | Minimalny model |
| Decision | Decyzja | Ustalenie, uzasadnienie, źródłowe wpisy, status przyjęcia i osobny status wdrożenia | Plan |
| Area | Obszar | Część projektu porządkująca decyzje i pracę | Plan |
| Stage | Etap | Wyodrębniony zakres z kryteriami zakończenia w projekcie | Plan |
| Task | Zadanie | Konkretna czynność wykonawcza w projekcie, opcjonalnie etapie i obszarze | Plan |
| WorkItem | ElementPracy | Większy zakres wykonania łączący zadania, źródła i ustalenia | Plan |
| OpenQuestion | OtwartePytanie | Nierozstrzygnięta kwestia wraz z kontekstem projektu | Plan |
| Blocker | Blokada | Przeszkoda powiązana z projektem lub elementem wykonania | Plan |
| Document | Dokument | Treść lub odnośnik i powiązania ze źródłami projektu | Plan |
| Repository | RepozytoriumKodu | Metadane repozytorium kodu przypisanego do projektu; odrębne od kontraktu persistence | Plan |
| Resource | Zasob | Materiał lub odnośnik wspierający pracę nad projektem | Plan |
| ProjectHealth | ZdrowieProjektu | Ocena wyprowadzona z jawnych przesłanek i ich aktualności | Plan |
| ActivityEvent | ZdarzenieAktywnosci | Historia zatwierdzonych zmian: czas, źródło, zakres i wynik | Plan |

## Reguły obecnej wersji

- Projekt wymaga niepustej nazwy, przycinanej na brzegach. Nazwy nie są unikalne; tożsamością jest `id`.
- Wpis wymaga treści zawierającej coś poza białymi znakami. Oryginał nie jest przycinany.
- Wpis może trafić do Inbox bez projektu. Przypisanie podczas zapisu wymaga istniejącego projektu.
- Identyfikatory tworzy warstwa przypadków użycia jako UUID, a czas zapisuje jako ISO 8601.
- Zapis nowego wpisu nie modyfikuje projektu poza dodaniem powiązanego źródła.
- Repozytorium nie udostępnia nadpisywania oryginału. Powtórne `id` powoduje błąd transakcji.

## Docelowe propozycje zmian

Analiza źródłowego wpisu będzie tworzyć osobny model propozycji z powiązaniem do wpisu i projektu. Propozycja musi pokazywać różnicę, uzasadnienie i wpływ. Jej stan (oczekująca, zatwierdzona, odrzucona) jest odrębny od stanu źródła i statusu wykonania.

Zatwierdzenie aktualizuje bieżący model i dopisuje zdarzenie aktywności w jednej transakcji. Odrzucenie pozostawia model bez zmian. Późniejsza zmiana decyzji musi zachować wcześniejsze ustalenie oraz jego źródło w historii. Dokładny schemat propozycji i wersji agregatów należy ustalić przed implementacją etapu 3.
