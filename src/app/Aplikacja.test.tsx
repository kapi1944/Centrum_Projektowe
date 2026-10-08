import { render, screen } from '@testing-library/react';
import uzytkownik from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { RepozytoriumProjektowe } from '../domain/repozytorium';
import { utworzRepozytoriumIndexedDb } from '../infrastructure/repozytoriumIndexedDb';
import { Aplikacja } from './Aplikacja';

describe('Shell aplikacji', () => {
  it('tworzy projekt, zapisuje przypisany oryginał i odczytuje go po ponownym montowaniu', async () => {
    const nazwaBazy = crypto.randomUUID();
    const osoba = uzytkownik.setup();
    const widok = render(<MemoryRouter><Aplikacja repozytorium={utworzRepozytoriumIndexedDb(nazwaBazy)} /></MemoryRouter>);
    await screen.findByRole('heading', { name: 'Centrum Projektowe' });
    await osoba.click(screen.getByRole('link', { name: 'Projekty' }));
    await osoba.type(screen.getByLabelText('Nazwa projektu'), 'Mój projekt');
    await osoba.click(screen.getByRole('button', { name: 'Dodaj projekt' }));
    await screen.findByRole('heading', { name: 'Mój projekt' });
    await osoba.click(screen.getByRole('link', { name: 'Inbox' }));
    const oryginal = '  Pomysł\nDruga linia  ';
    await osoba.type(screen.getByLabelText('Treść wpisu'), oryginal);
    await osoba.selectOptions(screen.getByLabelText('Projekt'), screen.getByRole('option', { name: 'Mój projekt' }));
    await osoba.click(screen.getByRole('button', { name: 'Zapisz wpis' }));
    await screen.findByText('Oryginalny wpis zapisany lokalnie.');
    widok.unmount();
    render(<MemoryRouter initialEntries={['/inbox']}><Aplikacja repozytorium={utworzRepozytoriumIndexedDb(nazwaBazy)} /></MemoryRouter>);
    const zapisany = await screen.findByText('Pomysł Druga linia');
    expect(zapisany.textContent).toBe(oryginal);
    expect(screen.getByText(/Mój projekt ·/)).toBeInTheDocument();
  });

  it('pokazuje błąd odczytu zamiast pozorować pustą bazę', async () => {
    const repozytorium: RepozytoriumProjektowe = {
      pobierzProjekty: vi.fn().mockRejectedValue(new Error('Brak storage')),
      pobierzWpisy: vi.fn().mockResolvedValue([]),
      dodajProjekt: vi.fn(), dodajWpis: vi.fn(),
    };
    render(<MemoryRouter><Aplikacja repozytorium={repozytorium} /></MemoryRouter>);
    expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się odczytać');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('zachowuje treść formularza po błędzie zapisu', async () => {
    const osoba = uzytkownik.setup();
    const repozytorium: RepozytoriumProjektowe = {
      pobierzProjekty: vi.fn().mockResolvedValue([]), pobierzWpisy: vi.fn().mockResolvedValue([]),
      dodajProjekt: vi.fn(), dodajWpis: vi.fn().mockRejectedValue(new Error('Brak miejsca')),
    };
    render(<MemoryRouter initialEntries={['/inbox']}><Aplikacja repozytorium={repozytorium} /></MemoryRouter>);
    await osoba.type(await screen.findByLabelText('Treść wpisu'), 'Nie zgub tej myśli');
    await osoba.click(screen.getByRole('button', { name: 'Zapisz wpis' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Treść pozostaje');
    expect(screen.getByLabelText('Treść wpisu')).toHaveValue('Nie zgub tej myśli');
    expect(screen.queryByText('Oryginalny wpis zapisany lokalnie.')).not.toBeInTheDocument();
  });
});
