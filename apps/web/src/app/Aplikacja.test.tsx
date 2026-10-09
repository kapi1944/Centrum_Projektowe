import { render, screen, within } from '@testing-library/react';
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
    const nawigacja = screen.getByRole('navigation', { name: 'Główna nawigacja' });
    expect(within(nawigacja).getByRole('link', { name: 'Skrzynka' })).toHaveAttribute('href', '/inbox');
    expect(nawigacja).not.toHaveTextContent(/Inbox/i);
    expect(screen.getByText(/W Skrzynce możesz analizować wpisy/)).toBeInTheDocument();
    expect(screen.queryByText(/Analiza wpisów będzie dostępna/)).not.toBeInTheDocument();
    await osoba.click(screen.getByRole('link', { name: 'Projekty' }));
    await osoba.type(screen.getByLabelText('Nazwa projektu'), 'Mój projekt');
    await osoba.click(screen.getByRole('button', { name: 'Dodaj projekt' }));
    await screen.findByRole('heading', { name: 'Mój projekt' });
    await osoba.click(screen.getByRole('link', { name: 'Skrzynka' }));
    const oryginal = '  Pomysł\nDruga linia  ';
    await osoba.type(screen.getByLabelText('Co chcesz zapisać?'), oryginal);
    await osoba.selectOptions(screen.getByLabelText('Projekt'), screen.getByRole('option', { name: 'Mój projekt' }));
    await osoba.click(screen.getByRole('button', { name: 'Zapisz' }));
    await screen.findByText('Oryginalny wpis zapisany lokalnie.');
    widok.unmount();
    render(<MemoryRouter initialEntries={['/inbox']}><Aplikacja repozytorium={utworzRepozytoriumIndexedDb(nazwaBazy)} /></MemoryRouter>);
    const zapisany = await screen.findByText('Pomysł Druga linia');
    expect(zapisany.textContent).toBe(oryginal);
    expect(screen.getByRole('link', { name: 'Mój projekt' })).toBeInTheDocument();
  });

  it('pokazuje błąd odczytu zamiast pozorować pustą bazę', async () => {
    const repozytorium: RepozytoriumProjektowe = { eksportujKopie: vi.fn(), importujKopie: vi.fn(),
      pobierzRealizacje: vi.fn().mockResolvedValue({ obszary: [], etapy: [], elementyPracy: [], pytania: [], blokady: [] }), wykonajOperacjeRealizacji: vi.fn(),
      pobierzProjekty: vi.fn().mockRejectedValue(new Error('Brak storage')),
      pobierzWpisy: vi.fn().mockResolvedValue([]),
      dodajProjekt: vi.fn(), dodajWpis: vi.fn(),
      zmienProjekt: vi.fn(), pobierzZdarzenia: vi.fn().mockResolvedValue([]),
      wykonajAkcjeWpisu: vi.fn(),
      pobierzDecyzje: vi.fn().mockResolvedValue([]), pobierzAnalizyWplywu: vi.fn().mockResolvedValue([]), wykonajOperacjeUstalen: vi.fn(),
      pobierzAnalizyWpisow: vi.fn().mockResolvedValue([]), wykonajOperacjeAnalizyWpisu: vi.fn(),
    };
    render(<MemoryRouter><Aplikacja repozytorium={repozytorium} /></MemoryRouter>);
    expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się odczytać');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('zachowuje treść formularza po błędzie zapisu', async () => {
    const osoba = uzytkownik.setup();
    const repozytorium: RepozytoriumProjektowe = { eksportujKopie: vi.fn(), importujKopie: vi.fn(),
      pobierzRealizacje: vi.fn().mockResolvedValue({ obszary: [], etapy: [], elementyPracy: [], pytania: [], blokady: [] }), wykonajOperacjeRealizacji: vi.fn(),
      pobierzProjekty: vi.fn().mockResolvedValue([]), pobierzWpisy: vi.fn().mockResolvedValue([]),
      dodajProjekt: vi.fn(), dodajWpis: vi.fn().mockRejectedValue(new Error('Brak miejsca')),
      zmienProjekt: vi.fn(), pobierzZdarzenia: vi.fn().mockResolvedValue([]),
      wykonajAkcjeWpisu: vi.fn(),
      pobierzDecyzje: vi.fn().mockResolvedValue([]), pobierzAnalizyWplywu: vi.fn().mockResolvedValue([]), wykonajOperacjeUstalen: vi.fn(),
      pobierzAnalizyWpisow: vi.fn().mockResolvedValue([]), wykonajOperacjeAnalizyWpisu: vi.fn(),
    };
    render(<MemoryRouter initialEntries={['/inbox']}><Aplikacja repozytorium={repozytorium} /></MemoryRouter>);
    await osoba.type(await screen.findByLabelText('Co chcesz zapisać?'), 'Nie zgub tej myśli');
    await osoba.click(screen.getByRole('button', { name: 'Zapisz' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Treść pozostaje');
    expect(screen.getByLabelText('Co chcesz zapisać?')).toHaveValue('Nie zgub tej myśli');
    expect(screen.queryByText('Oryginalny wpis zapisany lokalnie.')).not.toBeInTheDocument();
  });

  it('edytuje pamięć i status projektu, pokazuje historię i zachowuje archiwum po ponownym otwarciu', async () => {
    const nazwaBazy = crypto.randomUUID();
    const repozytorium = utworzRepozytoriumIndexedDb(nazwaBazy);
    const osoba = uzytkownik.setup();
    const widok = render(<MemoryRouter initialEntries={['/projekty']}><Aplikacja repozytorium={repozytorium} /></MemoryRouter>);
    await osoba.type(await screen.findByLabelText('Nazwa projektu'), 'Pamięć projektu');
    await osoba.type(screen.getByLabelText('Opis'), 'Pierwszy opis');
    await osoba.click(screen.getByRole('button', { name: 'Dodaj projekt' }));
    await osoba.click(await screen.findByRole('link', { name: 'Pamięć projektu' }));
    expect(screen.getByText('Utworzono projekt')).toBeInTheDocument();
    expect(screen.getAllByText(/Wpis ręczny \(Użytkownik\)/).length).toBeGreaterThan(0);
    await osoba.click(screen.getByRole('button', { name: 'Edytuj projekt' }));
    await osoba.selectOptions(screen.getByLabelText('Status projektu'), 'ACTIVE');
    await osoba.clear(screen.getByLabelText('Opis'));
    await osoba.type(screen.getByLabelText('Opis'), 'Aktualny opis');
    await osoba.type(screen.getByLabelText('Podsumowanie aktualnego stanu'), 'Gotowy fundament');
    await osoba.type(screen.getByLabelText('Ostatnio pracowano nad'), 'Warstwa danych');
    await osoba.type(screen.getByLabelText('Następny krok'), 'Przygotować Inbox');
    await osoba.click(screen.getByRole('button', { name: 'Zapisz zmiany' }));
    expect(await screen.findByText('Zmieniono projekt')).toBeInTheDocument();
    expect(screen.getByText('Aktywny')).toBeInTheDocument();
    expect(screen.getByText('Gotowy fundament')).toBeInTheDocument();
    expect(screen.getByText('Warstwa danych')).toBeInTheDocument();
    expect(screen.getByText('Przygotować Inbox')).toBeInTheDocument();
    await osoba.click(screen.getByRole('button', { name: 'Archiwizuj projekt' }));
    await screen.findByText('Zarchiwizowano projekt');
    const projekt = (await repozytorium.pobierzProjekty())[0];
    widok.unmount();
    render(<MemoryRouter initialEntries={[`/projekty/${projekt.id}`]}><Aplikacja repozytorium={utworzRepozytoriumIndexedDb(nazwaBazy)} /></MemoryRouter>);
    expect(await screen.findByText(/Projekt archiwalny od/)).toBeInTheDocument();
    expect(screen.getByText('Aktualny opis')).toBeInTheDocument();
    expect(screen.getByText('Przygotować Inbox')).toBeInTheDocument();
    expect(screen.getByText('Utworzono projekt')).toBeInTheDocument();
    expect(screen.getByText('Zmieniono projekt')).toBeInTheDocument();
    expect(screen.getByText('Zarchiwizowano projekt')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edytuj projekt' })).not.toBeInTheDocument();
  });

  it.each(['/nieznana', '/projekty/nieistniejacy', '/projekty/nieistniejacy/ustalenia'])(
    'obsługuje bezpośrednie wejście na nieistniejący adres %s', async (adres) => {
      render(<MemoryRouter initialEntries={[adres]}><Aplikacja repozytorium={utworzRepozytoriumIndexedDb(crypto.randomUUID())} /></MemoryRouter>);
      expect(await screen.findByRole('heading', { name: adres === '/nieznana' ? 'Nie znaleziono strony' : 'Nie znaleziono projektu' })).toBeInTheDocument();
      expect(within(screen.getByRole('main')).getByRole('link', { name: adres === '/nieznana' ? 'Wróć na start' : /^(Wróć do projektów|Projekty)$/ })).toHaveAttribute('href', adres === '/nieznana' ? '/' : '/projekty');
    },
  );
});
