import { render, screen, within } from '@testing-library/react';
import uzytkownik from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { pusteDaneKopii } from '../domain/kopieZapasowe';
import { utworzProjekt } from '../domain/operacje';
import { wyliczStanProjektu } from '../domain/stanProjektu';
import type { ZdarzenieAktywnosci } from '../domain/modele';
import { Start } from './Start';

function przygotujDane() {
  const dane = pusteDaneKopii();
  const czas = '2026-11-01T10:00:00.000Z';
  dane.projekty = [
    { ...utworzProjekt('Alfa', 'a', czas), status: 'ACTIVE' as const, nastepnyKrok: 'Test interfejsu', ostatnioPracowanoNad: 'Formularz', podsumowanieAktualnegoStanu: 'Gotowy formularz' },
    { ...utworzProjekt('Beta', 'b', czas), status: 'PAUSED' as const, nastepnyKrok: 'Wyjaśnić dostęp', ostatniaAktywnosc: '2026-11-01T12:00:00.000Z' },
    { ...utworzProjekt('Gamma', 'c', czas), nastepnyKrok: 'Rozpisać pomysł', ostatniaAktywnosc: '2026-11-01T11:00:00.000Z' },
    { ...utworzProjekt('Archiwum', 'd', czas), status: 'ACTIVE' as const, zarchiwizowano: czas, ostatniaAktywnosc: '2026-11-01T14:00:00.000Z' },
    { ...utworzProjekt('Koniec', 'e', czas), status: 'COMPLETED' as const, ostatniaAktywnosc: '2026-11-01T15:00:00.000Z' },
  ];
  dane.elementyPracy = [
    { id: 'z1', projektId: 'b', typ: 'TASK', tytul: 'Sprawdzić dostęp', opis: '', status: 'BLOCKED', decyzjaIds: [], utworzono: czas, zaktualizowano: czas, wersja: 1 },
    { id: 'z2', projektId: 'a', typ: 'TASK', tytul: 'Gotowe zadanie', opis: '', status: 'DONE', decyzjaIds: [], utworzono: czas, zaktualizowano: czas, wersja: 1 },
    { id: 'z3', projektId: 'b', typ: 'RESEARCH', tytul: 'Badanie', opis: '', status: 'TODO', decyzjaIds: [], utworzono: czas, zaktualizowano: czas, wersja: 1 },
    { id: 'z4', projektId: 'd', typ: 'TASK', tytul: 'Archiwalne zadanie', opis: '', status: 'TODO', decyzjaIds: [], utworzono: czas, zaktualizowano: czas, wersja: 1 },
    { id: 'z5', projektId: 'a', typ: 'TASK', tytul: 'Porzucone zadanie', opis: '', status: 'ABANDONED', decyzjaIds: [], utworzono: czas, zaktualizowano: czas, wersja: 1 },
  ];
  dane.blokady = [
    { id: 'b1', projektId: 'b', tytul: 'Brak uprawnień', opis: '', status: 'ACTIVE', waga: 'CRITICAL', utworzono: czas, zaktualizowano: czas, wersja: 1 },
    { id: 'b2', projektId: 'a', tytul: 'Czekam na opis', opis: '', status: 'ACTIVE', waga: 'LOW', utworzono: czas, zaktualizowano: czas, wersja: 1 },
    { id: 'b3', projektId: 'a', tytul: 'Rozwiązana', opis: '', status: 'RESOLVED', waga: 'HIGH', utworzono: czas, zaktualizowano: czas, wersja: 1 },
  ];
  dane.pytania = [{ id: 'p1', projektId: 'b', pytanie: 'Kto nada dostęp?', kontekst: '', status: 'OPEN', utworzono: czas, zaktualizowano: czas, wersja: 1 }];
  return dane;
}

function pokaz(dane = przygotujDane(), zdarzenia: ZdarzenieAktywnosci[] = []) {
  return render(<MemoryRouter><Start projekty={dane.projekty} wpisy={dane.wpisy} obrazyProjektow={dane.projekty.map((projekt) => wyliczStanProjektu(dane, projekt))} zdarzenia={zdarzenia} /></MemoryRouter>);
}

describe('Pulpit zarządzania projektami', () => {
  it('liczy rzeczywiste metryki z projekcji, bez archiwum, zakończonych zadań i innych rodzajów pracy', () => {
    const dane = przygotujDane();
    const przed = structuredClone(dane);
    pokaz(dane);
    const metryki = screen.getByLabelText('Stan bieżących projektów');
    for (const [etykieta, wartosc] of [['Aktywne projekty', '1'], ['Otwarte zadania', '1'], ['Aktywne blokady', '2'], ['Wymaga uwagi', '2']]) {
      const kafelek = within(metryki).getByText(etykieta).closest('article')!;
      expect(within(kafelek).getByText(wartosc, { exact: true })).toBeInTheDocument();
    }
    expect(dane).toEqual(przed);
  });

  it('filtruje i sortuje kafelki według aktywności oraz polskich nazw statusów', async () => {
    pokaz();
    const osoba = uzytkownik.setup();
    const panel = screen.getByRole('region', { name: 'Twoje projekty' });
    expect(within(panel).getAllByRole('heading', { level: 3 }).map((naglowek) => naglowek.textContent)).toEqual(['Alfa']);
    expect(within(panel).getByText('Formularz')).toBeInTheDocument();
    expect(within(panel).getByText('Test interfejsu')).toBeInTheDocument();
    expect(within(panel).getByText('Aktywne blokady: 1')).toBeInTheDocument();
    await osoba.selectOptions(screen.getByLabelText('Filtr projektów'), 'wszystkie');
    expect(within(panel).getAllByRole('heading', { level: 3 }).map((naglowek) => naglowek.textContent)).toEqual(['Koniec', 'Archiwum', 'Beta', 'Gamma', 'Alfa']);
    await osoba.selectOptions(screen.getByLabelText('Sortuj projekty'), 'status');
    expect(within(panel).getAllByRole('heading', { level: 3 }).map((naglowek) => naglowek.textContent)).toEqual(['Archiwum', 'Alfa', 'Gamma', 'Beta', 'Koniec']);
  });

  it('wybiera ostatni bieżący projekt i prowadzi do punktu powrotu, zadania, pytania i blokady', () => {
    pokaz();
    const panel = screen.getByRole('region', { name: 'Kontynuuj pracę' });
    expect(within(panel).getByRole('heading', { name: 'Beta' })).toBeInTheDocument();
    for (const [nazwa, adres] of [['Otwórz punkt powrotu', '/projekty/b#pamiec-projektu'], ['Sprawdzić dostęp', '/projekty/b#praca-z1'], ['Kto nada dostęp?', '/projekty/b#pytanie-p1'], ['Brak uprawnień', '/projekty/b#blokada-b1']]) {
      expect(within(panel).getByRole('link', { name: nazwa })).toHaveAttribute('href', adres);
    }
    expect(within(panel).queryByText('Gotowe zadanie')).not.toBeInTheDocument();
    expect(within(panel).queryByText('Badanie')).not.toBeInTheDocument();
  });

  it('pokazuje uwagi silnika według jego wag wraz z powodem i odnośnikiem źródłowym', () => {
    pokaz();
    const panel = screen.getByRole('region', { name: 'Wymaga uwagi' });
    expect(within(panel).getAllByRole('heading', { level: 3 }).map((naglowek) => naglowek.textContent)).toEqual(['Brak uprawnień', 'Czekam na opis']);
    expect(within(panel).getByText('Priorytet: Krytyczna')).toBeInTheDocument();
    expect(within(panel).getAllByText('Bloker ma status „Aktywna”.')).toHaveLength(2);
    expect(within(panel).getByRole('link', { name: 'Beta' })).toHaveAttribute('href', '/projekty/b');
    expect(within(panel).getAllByRole('link', { name: 'Otwórz bloker' })[0]).toHaveAttribute('href', '/projekty/b#blokada-b1');
    expect(within(panel).queryByText('Rozwiązana')).not.toBeInTheDocument();
  });

  it('używa istniejących tras szybkich działań i zmienia projekt repozytorium', async () => {
    pokaz();
    const panel = screen.getByRole('region', { name: 'Szybkie działania' });
    for (const [nazwa, adres] of [['Nowy projekt', '/projekty#nazwa-projektu'], ['Nowy wpis', '/inbox#tresc-wpisu'], ['Otwórz Skrzynkę', '/inbox'], ['Wymaga uwagi', '/uwaga']]) {
      expect(within(panel).getByRole('link', { name: nazwa })).toHaveAttribute('href', adres);
    }
    expect(within(panel).getByRole('link', { name: 'Repozytoria' })).toHaveAttribute('href', '/projekty/b/repozytoria');
    await uzytkownik.setup().selectOptions(screen.getByLabelText('Projekt repozytorium'), 'a');
    expect(within(panel).getByRole('link', { name: 'Repozytoria' })).toHaveAttribute('href', '/projekty/a/repozytoria');
  });

  it('pokazuje wyłącznie zapisaną historię, zachowuje treść źródła i filtruje zdarzenia', async () => {
    const typy = ['PROJECT_CREATED', 'PROJECT_UPDATED', 'DECISION_STATUS_CHANGED', 'CORRECTION_APPLIED', 'WORK_ITEM_COMPLETED'] as const;
    const encje = ['PROJECT', 'PROJECT', 'DECISION', 'CORRECTION', 'WORK_ITEM'] as const;
    const zdarzenia = typy.map((typZdarzenia, numer): ZdarzenieAktywnosci => ({
      id: `z${numer}`, projektId: 'a', typEncji: encje[numer], encjaId: `cel${numer}`, typZdarzenia,
      tytul: numer === 3 ? 'Odrzucono propozycje korekty' : `Zapis ${numer}`, opis: numer === 1 ? 'Status: Pomysł → Aktywny' : undefined,
      utworzono: `2026-11-01T1${numer}:00:00.000Z`, zrodlo: { typ: 'USER', nazwa: 'Autor zapisu' },
    }));
    pokaz(przygotujDane(), zdarzenia);
    const panel = screen.getByRole('region', { name: 'Ostatnia aktywność' });
    expect(within(panel).getAllByRole('heading', { level: 3 }).map((naglowek) => naglowek.textContent)).toEqual(['Zapis 4', 'Odrzucono propozycje korekty', 'Zapis 2', 'Zapis 1', 'Zapis 0']);
    expect(within(panel).getByText('Status: Pomysł → Aktywny')).toBeInTheDocument();
    expect(within(panel).getAllByText('Źródło: Autor zapisu (Użytkownik)')).toHaveLength(5);
    expect(within(panel).getAllByRole('link', { name: 'Alfa' })[0]).toHaveAttribute('href', '/projekty/a#praca-cel4');
    await uzytkownik.setup().selectOptions(screen.getByLabelText('Rodzaj aktywności'), 'CORRECTION');
    expect(within(panel).getAllByRole('heading', { level: 3 })).toHaveLength(1);
    expect(within(panel).queryByText('Zastosowano zatwierdzony zestaw zmian')).not.toBeInTheDocument();
  });

  it('nie wnioskuje o historii z bieżącego statusu i obsługuje pustą bazę', () => {
    const widok = pokaz();
    expect(within(screen.getByRole('region', { name: 'Ostatnia aktywność' })).getByText('Brak zapisanych zdarzeń dla tego widoku.')).toBeInTheDocument();
    widok.unmount();
    pokaz(pusteDaneKopii());
    expect(screen.getByText(/Nie ma bieżącego projektu/)).toBeInTheDocument();
    expect(screen.getByText('Brak spraw wymagających uwagi w bieżących projektach.')).toBeInTheDocument();
    expect(screen.getByLabelText('Projekt repozytorium')).toBeDisabled();
    expect(screen.queryByRole('link', { name: 'Repozytoria' })).not.toBeInTheDocument();
  });
});
