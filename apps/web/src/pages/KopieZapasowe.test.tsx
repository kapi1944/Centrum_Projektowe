import { render, screen, within } from '@testing-library/react';
import uzytkownik from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Aplikacja } from '../app/Aplikacja';
import { utworzRepozytoriumIndexedDb } from '../infrastructure/repozytoriumIndexedDb';
import { utworzProjekt } from '../domain/operacje';

function plikKopii(kopia: unknown) {
  const plik = new File([JSON.stringify(kopia)], 'kopia.json', { type: 'application/json' });
  // jsdom nie udostępnia jeszcze Blob.text.
  Object.defineProperty(plik, 'text', { value: async () => JSON.stringify(kopia) });
  return plik;
}
const kontekst = { idZdarzenia: 'z1', czas: '2026-10-08T12:00:00Z', zrodlo: { typ: 'USER' as const, nazwa: 'Użytkownik' } };

describe('Ekran kopii zapasowych', () => {
  it('sprawdza plik bez zapisu, wymaga potwierdzenia zastąpienia i odświeża rejestr po odtworzeniu', async () => {
    const osoba = uzytkownik.setup();
    const repozytorium = utworzRepozytoriumIndexedDb(crypto.randomUUID());
    const kopia = await repozytorium.eksportujKopie();
    kopia.data.projekty.push(utworzProjekt('Odtworzony projekt', 'p1', kontekst.czas));
    render(<MemoryRouter initialEntries={['/dane']}><Aplikacja repozytorium={repozytorium} /></MemoryRouter>);
    await screen.findByRole('heading', { name: 'Dane i kopie zapasowe' });
    expect(screen.getByText(/Plik kopii zapasowej może zawierać prywatne/)).toBeInTheDocument();
    await osoba.upload(screen.getByLabelText('Plik kopii zapasowej'), plikKopii(kopia));
    expect(screen.queryByRole('button', { name: 'Odtwórz z kopii' })).not.toBeInTheDocument();
    await osoba.click(screen.getByRole('button', { name: 'Sprawdź kopię' }));
    await screen.findByRole('heading', { name: 'Kopia zawiera' });
    expect(screen.getByText('Projektów: 1')).toBeInTheDocument();
    expect(await repozytorium.pobierzProjekty()).toEqual([]);
    await osoba.selectOptions(screen.getByLabelText('Sposób odtworzenia'), 'zastap');
    expect(screen.getByRole('button', { name: 'Odtwórz z kopii' })).toBeDisabled();
    await osoba.click(screen.getByRole('checkbox'));
    await osoba.click(screen.getByRole('button', { name: 'Odtwórz z kopii' }));
    await screen.findByText('Odtworzono dane z kopii zapasowej.');
    await osoba.click(within(screen.getByRole('navigation')).getByRole('link', { name: 'Projekty' }));
    await screen.findByRole('heading', { name: 'Odtworzony projekt' });
  });

  it('pokazuje konflikt i oba opisy bez nadpisania, a po zmianie pliku usuwa stary podgląd', async () => {
    const osoba = uzytkownik.setup();
    const repozytorium = utworzRepozytoriumIndexedDb(crypto.randomUUID());
    await repozytorium.dodajProjekt(utworzProjekt('Obecny projekt', 'p1', kontekst.czas), kontekst);
    const kopia = await repozytorium.eksportujKopie(); kopia.data.projekty[0].nazwa = 'Projekt z kopii';
    render(<MemoryRouter initialEntries={['/dane']}><Aplikacja repozytorium={repozytorium} /></MemoryRouter>);
    const wybor = await screen.findByLabelText('Plik kopii zapasowej');
    await osoba.upload(wybor, plikKopii(kopia));
    await osoba.click(screen.getByRole('button', { name: 'Sprawdź kopię' }));
    await osoba.click(await screen.findByRole('button', { name: 'Odtwórz z kopii' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('konflikty');
    await osoba.click(screen.getByText('Projektów — p1'));
    expect(screen.getByText('Obecny projekt')).toBeVisible();
    expect(screen.getByText('Projekt z kopii')).toBeVisible();
    expect((await repozytorium.pobierzProjekty())[0].nazwa).toBe('Obecny projekt');
    await osoba.upload(wybor, plikKopii({ format: 'obcy' }));
    expect(screen.queryByRole('heading', { name: 'Kopia zawiera' })).not.toBeInTheDocument();
    await osoba.click(screen.getByRole('button', { name: 'Sprawdź kopię' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('To nie jest kopia');
  });
});
