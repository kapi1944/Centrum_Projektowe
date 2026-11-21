---
name: testy-regresyjne
description: Wykonuj i oceniaj regresję Centrum Projektowego po zmianach, w tym zgodność danych, UI i odczyt GitHub. Stosuj do rzeczywistej weryfikacji, nie do samego opisu przyszłych testów.
---

# Testy regresyjne

Przeczytaj [AGENTS.md](../../../AGENTS.md) i dobierz przypadki z [macierzy regresji](../../../docs/automatyzacja/PROCEDURY.md#regresja-według-zakresu). Skrypty i wersję Node sprawdź w bieżącym `package.json`; przykład z dokumentacji nie zastępuje manifestu.

Uruchom wymagane kontrole z procedury. Zachowaj liczniki testów, kody wyjścia i rozróżnienie pełnego przebiegu od testów wybranych plików. Rzeczywisty odczyt sieci oraz próba w przeglądarce są odrębnymi dowodami od mocków i jsdom.

Nie dopisuj danych do prywatnego originu. Jeżeli zadanie obejmuje UI, storage lub odtworzenie kopii, wykonaj odpowiedni odbiór na syntetycznych danych w odrębnym środowisku albo jawnie zapisz brak tego odbioru. Anulowanie, pominięcie i brak artefaktu pozostają osobnymi wynikami. Raportuj zgodnie ze wspólnym formatem, bez nadawania etapowi statusu ukończenia wyłącznie na podstawie CI.
