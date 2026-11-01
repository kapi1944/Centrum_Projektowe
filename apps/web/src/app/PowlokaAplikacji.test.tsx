import { render, screen, within } from '@testing-library/react';
import uzytkownik from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { PowlokaAplikacji } from './PowlokaAplikacji';

describe('Nawigacja powłoki Glassplate Solid', () => {
  it('zwija sidebar i zachowuje nazwy oraz adresy nawigacji', async () => {
    const osoba = uzytkownik.setup();
    render(<MemoryRouter><PowlokaAplikacji><h1>Treść ekranu</h1></PowlokaAplikacji></MemoryRouter>);
    await osoba.click(screen.getByRole('button', { name: 'Zwiń sidebar' }));
    expect(screen.getByRole('button', { name: 'Rozwiń sidebar' })).toHaveAttribute('aria-expanded', 'false');
    const nawigacja = screen.getByRole('navigation', { name: 'Główna nawigacja' });
    expect(within(nawigacja).getByRole('link', { name: 'Start' })).toHaveAttribute('aria-current', 'page');
    expect(within(nawigacja).getByRole('link', { name: 'Skrzynka' })).toHaveAttribute('href', '/inbox');
    await osoba.click(screen.getByRole('button', { name: 'Rozwiń sidebar' }));
    expect(screen.getByRole('button', { name: 'Zwiń sidebar' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('zamyka menu przez Escape i przywraca fokus do przycisku', async () => {
    const osoba = uzytkownik.setup();
    render(<MemoryRouter><PowlokaAplikacji><h1>Treść ekranu</h1></PowlokaAplikacji></MemoryRouter>);
    await osoba.click(screen.getByRole('button', { name: 'Otwórz menu' }));
    expect(screen.getByRole('button', { name: 'Zamknij menu' })).toHaveAttribute('aria-expanded', 'true');
    await osoba.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Otwórz menu' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Otwórz menu' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('udostępnia moduły otwartego projektu i zamyka menu po nawigacji', async () => {
    const osoba = uzytkownik.setup();
    render(<MemoryRouter initialEntries={['/projekty/projekt-1/korekty']}><PowlokaAplikacji><h1>Treść ekranu</h1></PowlokaAplikacji></MemoryRouter>);
    await osoba.click(screen.getByRole('button', { name: 'Otwórz menu' }));
    const nawigacja = screen.getByRole('navigation', { name: 'Główna nawigacja' });
    expect(within(nawigacja).getByRole('link', { name: 'Korekty i rewizje' })).toHaveAttribute('aria-current', 'page');
    expect(within(nawigacja).getByRole('link', { name: 'Repozytoria i kontekst' })).toHaveAttribute('href', '/projekty/projekt-1/repozytoria');
    await osoba.click(within(nawigacja).getByRole('link', { name: 'Ustalenia' }));
    expect(screen.getByRole('button', { name: 'Otwórz menu' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('main')).toHaveFocus();
    expect(within(nawigacja).getByRole('link', { name: 'Ustalenia' })).toHaveAttribute('aria-current', 'page');
  });
});
