---
name: diagnostyka-bledow
description: Diagnozuj odtwarzalny błąd aplikacji, testów, instalacji lub CI w Centrum Projektowym i naprawiaj go w zleconym zakresie. Stosuj do konkretnej awarii, nie do ogólnego audytu bezpieczeństwa.
---

# Diagnostyka błędów

Stosuj [AGENTS.md](../../../AGENTS.md) oraz [procedury kontroli](../../../docs/automatyzacja/PROCEDURY.md).

Zapisz komendę lub kroki odtworzenia, środowisko, SHA, kod zakończenia i istotny komunikat bez sekretów. Dla CI rozróżnij instalację, wykonanie kontroli, brak raportu oraz anulowanie; log z innego SHA lub próby nie potwierdza aktualnego błędu.

Odtwórz problem najmniejszą istniejącą kontrolą. Oddziel błąd produktu od niepoprawnego fixture, niedeterministycznego testu i awarii środowiska. Hipotezę potwierdź kodem lub eksperymentem. Nie zmieniaj produkcyjnych danych, nie obniżaj asercji i nie stosuj kolejnych retry bez nowego dowodu.

Napraw przyczynę lokalnie. Test odtwarzający dodaj, jeżeli chroni istotne zachowanie; wykorzystaj istniejący, gdy już ujawnia problem. Po naprawie wykonaj kontrolę odtwarzającą i powiązaną regresję. Gdy przyczyna pozostaje zewnętrzna lub zakres nie obejmuje naprawy, zakończ z rozpoznaniem, dowodem i jawnym ograniczeniem, bez deklarowania PASS.
