import { render, screen, within } from '@testing-library/react';
import osoba from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Aplikacja } from '../../app/Aplikacja';
import { utworzProjekt } from '../../domain/operacje';
import { utworzRepozytoriumIndexedDb } from '../../infrastructure/repozytoriumIndexedDb';
import { Start } from '../../pages/Start';

describe('Punkt powrotu i dashboard', () => {
  it('aktualizuje punkt powrotu, aktywność i historię, a dashboard czyta zapisane dane', async () => {
    const nazwaBazy = crypto.randomUUID();
    const repozytorium = utworzRepozytoriumIndexedDb(nazwaBazy);
    const projekt = { ...utworzProjekt('Projekt', 'p1', '2026-10-07T10:00:00Z'), opis: 'Opis pozostaje', status: 'ACTIVE' } as const;
    await repozytorium.dodajProjekt(projekt, { czas: projekt.utworzono, idZdarzenia: 'z1', zrodlo: projekt.zrodlo });
    const uzytkownik = osoba.setup();
    const widok = render(<MemoryRouter initialEntries={['/projekty/p1']}><Aplikacja repozytorium={repozytorium} /></MemoryRouter>);
    await uzytkownik.click(await screen.findByRole('button', { name: 'Aktualizuj punkt powrotu' }));
    await uzytkownik.type(screen.getByLabelText('Ostatnio robiłem'), 'Sprawdzałem zapis');
    await uzytkownik.type(screen.getByLabelText('Aktualny stan'), 'Dane działają');
    await uzytkownik.type(screen.getByLabelText('Następny krok'), 'Dopracować Inbox');
    await uzytkownik.click(screen.getByRole('button', { name: 'Zapisz punkt powrotu' }));
    await screen.findByText('Aktualizowano punkt powrotu');
    const sekcja = screen.getByRole('region', { name: 'Gdzie skończyłem?' });
    expect(within(sekcja).getByText('Sprawdzałem zapis')).toBeInTheDocument();
    const zapisany = (await repozytorium.pobierzProjekty())[0];
    expect(zapisany).toMatchObject({ nazwa: projekt.nazwa, status: 'ACTIVE', opis: projekt.opis, utworzono: projekt.utworzono });
    expect(zapisany.ostatniaAktywnosc > projekt.ostatniaAktywnosc).toBe(true);
    expect(await repozytorium.pobierzZdarzenia()).toEqual(expect.arrayContaining([expect.objectContaining({ typZdarzenia: 'PROJECT_RESUME_UPDATED' })]));
    widok.unmount();
    render(<MemoryRouter><Aplikacja repozytorium={utworzRepozytoriumIndexedDb(nazwaBazy)} /></MemoryRouter>);
    expect(await screen.findByText('Dane działają')).toBeInTheDocument();
    expect(screen.getByText('Dopracować Inbox')).toBeInTheDocument();
  });

  it('filtruje według statusu, skraca kontekst i pokazuje archiwum tylko w filtrze Wszystkie', async () => {
    const uzytkownik = osoba.setup();
    const bazowy = utworzProjekt('Aktywny', 'p1', '2026-10-08T10:00:00Z');
    const projekty = [
      { ...bazowy, status: 'ACTIVE', podsumowanieAktualnegoStanu: 's'.repeat(200), nastepnyKrok: 'k'.repeat(200) },
      { ...bazowy, id: 'p2', nazwa: 'Pomysł', status: 'IDEA' },
      { ...bazowy, id: 'p3', nazwa: 'Pauza', status: 'PAUSED' },
      { ...bazowy, id: 'p4', nazwa: 'Archiwum', status: 'ACTIVE', zarchiwizowano: bazowy.utworzono },
    ] as const;
    render(<MemoryRouter><Start projekty={[...projekty]} wpisy={[]} /></MemoryRouter>);
    const filtr = screen.getByLabelText('Filtr projektów');
    expect(screen.getByText(`${'s'.repeat(160)}…`)).toBeInTheDocument();
    expect(screen.getByText(`${'k'.repeat(160)}…`)).toBeInTheDocument();
    for (const [status, nazwa] of [['ACTIVE', 'Aktywny'], ['IDEA', 'Pomysł'], ['PAUSED', 'Pauza']]) {
      await uzytkownik.selectOptions(filtr, status);
      const karty = screen.getByRole('region', { name: 'Twoje projekty' });
      expect(within(karty).getAllByRole('link')).toHaveLength(1);
      expect(within(karty).getByRole('link', { name: nazwa })).toBeInTheDocument();
    }
    await uzytkownik.selectOptions(filtr, 'wszystkie');
    expect(within(screen.getByRole('region', { name: 'Twoje projekty' })).getAllByRole('link')).toHaveLength(4);
    expect(screen.getByRole('link', { name: 'Archiwum' })).toBeInTheDocument();
  });
});
