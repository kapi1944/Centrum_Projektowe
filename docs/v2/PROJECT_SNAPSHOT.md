# Etap 8 — aktualny stan i uwaga

`MigawkaProjektu` (`ProjectSnapshot`) i `ElementUwagi` (`AttentionItem`) są projekcjami istniejących danych, nie dodatkowymi encjami projektu. Polskie pola odpowiadają wymaganym polom kontraktu: `projektId`, `rewizja`, `wygenerowano`, `podsumowanie`, `aktualneCele`, `aktywneOgraniczenia`, `aktywneDecyzje`, `otwartePytania`, `blokery`, `aktualnaPraca`, `sugerowaneDzialania`, `nieaktualneElementy`; uwaga zawiera też typ, wagę, tytuł, opis, powód, odnośniki źródeł, czas utworzenia i opcjonalny czas rozwiązania.

Po zakończeniu istniejącej transakcji ChangeSet rejestr odczytuje zatwierdzone dane i DomainEvents. Lokalny projektor aktualizuje obraz zmienionych projektów. Klucz cache uwzględnia jawny zakres projektów decyzji i zdarzeń domenowych. Niezmienione projekty zachowują ten sam obiekt. Niepowodzenie zapisu nie publikuje nowego stanu. Import lub ponowne otwarcie odtwarza projekcję ze źródeł; format kopii i wersja IndexedDB pozostają bez zmian.

Projektor nie ma osobnego trwałego kursora z ADR 0003: za każdym razem wylicza wynik z kanonicznego stanu, a cache służy tylko unikaniu powtórnego obliczenia. Nie stosuje skutków zdarzeń przyrostowo, więc ponowny odczyt tego samego eventId nie powiela skutków ani uwagi. Unikalność zdarzeń i idempotencję ChangeSet zapewnia istniejąca transakcja. Po błędzie projekcji ponowny odczyt odtwarza całość bez zgubienia zdarzeń; zatwierdzona domena pozostaje zapisana. Są to równoważne gwarancje odtwarzania dla tej projekcji, bez kursora przetwarzania przyrostowego Impact Engine.

Korekta wspólnej decyzji jest widoczna we wszystkich projektach z jej jawnego zakresu. Ograniczenia, uwaga i ostatnie zmiany prowadzą do projektu, w którym zapisano źródłową korektę. Widok uwagi udostępnia filtry projektu, typu i wagi; filtrowanie nie zapisuje zmian domeny.

Rewizja jest deterministycznym, pełnym kluczem treści projekcji; nie jest licznikiem operacji. Czas wygenerowania oznacza najnowszy czas danych domenowych uwzględnionych w stanie, nie zegar odczytu. Odrzucona korekta nie zmienia migawki; jej rozstrzygnięcie może usunąć uwagę o oczekującej weryfikacji. Kolejność źródłowych tablic nie wpływa na wynik.

Cel pochodzi z aktualnego opisu projektu. Podsumowanie jest dosłownym zapisem punktu powrotu użytkownika. Nie interpretujemy automatycznie tekstu ani podsumowań dostawcy analizy. Ograniczenia pochodzą z zastosowanych korekt typu zmiana ograniczenia / ograniczenie techniczne, których wartość nadal odpowiada bieżącemu celowi korekty. Decyzje proponowane, zastąpione i odrzucone nie obowiązują. Praca zakończona lub porzucona, pytania rozstrzygnięte i nieaktywne blokery nie trafiają do aktualnego stanu.

Następny krok pochodzi z punktu powrotu; przy jego braku sugestią jest pierwsza praca do zrobienia lub w toku, według priorytetu i identyfikatora. Jest to propozycja bez zapisu i bez automatycznej zmiany planu. Brak obu źródeł tworzy uwagę. Sugestia nie gwarantuje, że aktywny bloker pozwala ją wykonać.

Reguły uwagi: aktywny bloker, proponowana decyzja, aktywna praca powiązana z zastąpioną/odrzuconą decyzją, nieprzetworzony przypisany wpis, nierozstrzygnięta korekta, oczekująca propozycja wpływu, niezastosowana preferowana analiza i brak następnego kroku. Każda zawiera „Dlaczego to widzę?” oraz odnośniki do ekranu źródłowego. Rozwiązanie przyczyny usuwa element z projekcji; historia pozostaje w istniejących źródłach. Projekty archiwalne, zakończone i porzucone nie generują uwagi.

Typy konfliktu, nieaktualnego dokumentu i błędu integracji są częścią modelu, lecz nie generują fikcyjnych zgłoszeń: obecny system nie ma kanonicznych rekordów dokumentów ani wykonanych integracji. Nie dodano integracji ani AI.

Widoki: `/uwaga` — „Wymaga uwagi”; sekcja „Stan teraz” na projekcie, oddzielona od historii i formularza punktu powrotu. Ostatnie zaakceptowane zmiany wynikają z ostatnich DomainEvents i prowadzą do korekt.
