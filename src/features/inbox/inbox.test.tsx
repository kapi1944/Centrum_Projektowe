import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import osoba from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Aplikacja } from '../../app/Aplikacja';
import { utworzProjekt } from '../../domain/operacje';
import { utworzRepozytoriumIndexedDb } from '../../infrastructure/repozytoriumIndexedDb';

describe('Szybki Inbox', () => {
  it.each(['Control', 'Meta'])('zachowuje wielowierszowy oryginał i zapisuje skrótem %s+Enter', async (modyfikator) => {
    const repozytorium = utworzRepozytoriumIndexedDb(crypto.randomUUID());
    const uzytkownik = osoba.setup();
    render(<MemoryRouter initialEntries={['/inbox']}><Aplikacja repozytorium={repozytorium} /></MemoryRouter>);
    const pole = await screen.findByLabelText('Co chcesz zapisać?');
    await uzytkownik.type(pole, '  Pomysł{Enter}Druga linia  ');
    expect(await repozytorium.pobierzWpisy()).toEqual([]);
    await uzytkownik.keyboard(`{${modyfikator}>}{Enter}{/${modyfikator}}`);
    await screen.findByText('Oryginalny wpis zapisany lokalnie.');
    const wpisy = await repozytorium.pobierzWpisy();
    expect(wpisy).toHaveLength(1);
    expect(wpisy[0]).toMatchObject({ trescOryginalna: '  Pomysł\nDruga linia  ', projektId: null, status: 'UNPROCESSED' });
    expect(await repozytorium.pobierzZdarzenia()).toEqual([expect.objectContaining({ typZdarzenia: 'CAPTURE_CREATED', encjaId: wpisy[0].id })]);
    expect(pole).toHaveValue('');
  });

  it('blokuje puste zapisy i ponowiony skrót podczas zapisywania', async () => {
    const repozytorium = utworzRepozytoriumIndexedDb(crypto.randomUUID());
    render(<MemoryRouter initialEntries={['/inbox']}><Aplikacja repozytorium={repozytorium} /></MemoryRouter>);
    const pole = await screen.findByLabelText('Co chcesz zapisać?');
    fireEvent.change(pole, { target: { value: '  \n ' } });
    fireEvent.keyDown(pole, { key: 'Enter', ctrlKey: true });
    expect(await repozytorium.pobierzWpisy()).toEqual([]);
    fireEvent.change(pole, { target: { value: 'Jedna myśl' } });
    fireEvent.keyDown(pole, { key: 'Enter', ctrlKey: true });
    fireEvent.keyDown(pole, { key: 'Enter', ctrlKey: true, repeat: true });
    await screen.findByText('Oryginalny wpis zapisany lokalnie.');
    expect(await repozytorium.pobierzWpisy()).toHaveLength(1);
  });

  it('tworzy projekt IDEA z wpisu i zachowuje przypięty oryginał po ponownym otwarciu', async () => {
    const nazwaBazy = crypto.randomUUID();
    const repozytorium = utworzRepozytoriumIndexedDb(nazwaBazy);
    const uzytkownik = osoba.setup();
    const widok = render(<MemoryRouter initialEntries={['/inbox']}><Aplikacja repozytorium={repozytorium} /></MemoryRouter>);
    await uzytkownik.type(await screen.findByLabelText('Co chcesz zapisać?'), '  Zbudować prototyp\n ');
    await uzytkownik.click(screen.getByRole('button', { name: 'Zapisz' }));
    await uzytkownik.click(await screen.findByRole('button', { name: 'Utwórz projekt' }));
    const oryginal = (await repozytorium.pobierzWpisy())[0];
    await uzytkownik.type(screen.getByLabelText('Nazwa nowego projektu'), 'Prototyp');
    await uzytkownik.type(screen.getByLabelText('Opis nowego projektu (opcjonalny)'), 'Mały eksperyment');
    await uzytkownik.click(screen.getByRole('button', { name: 'Utwórz i przypnij wpis' }));
    await uzytkownik.click(await screen.findByRole('link', { name: 'Prototyp' }));
    expect(screen.getByText('Utworzono projekt')).toBeInTheDocument();
    expect(screen.getByText('Dołączono wpis do projektu')).toBeInTheDocument();
    const projekt = (await repozytorium.pobierzProjekty())[0];
    expect(projekt).toMatchObject({ status: 'IDEA', opis: 'Mały eksperyment' });
    widok.unmount();
    const ponownieOtwarte = utworzRepozytoriumIndexedDb(nazwaBazy);
    render(<MemoryRouter initialEntries={['/inbox']}><Aplikacja repozytorium={ponownieOtwarte} /></MemoryRouter>);
    await screen.findByRole('link', { name: 'Prototyp' });
    expect(await ponownieOtwarte.pobierzWpisy()).toEqual([{ ...oryginal, projektId: projekt.id }]);
  });

  it('dołącza zapisany wpis do istniejącego projektu', async () => {
    const repozytorium = utworzRepozytoriumIndexedDb(crypto.randomUUID());
    const zrodlo = { typ: 'USER', nazwa: 'Wpis ręczny' } as const;
    await repozytorium.dodajProjekt(utworzProjekt('Istniejący', 'p1', '2026-10-08T10:00:00Z'), {
      czas: '2026-10-08T10:00:00Z', idZdarzenia: 'z1', zrodlo,
    });
    const uzytkownik = osoba.setup();
    render(<MemoryRouter initialEntries={['/inbox']}><Aplikacja repozytorium={repozytorium} /></MemoryRouter>);
    await uzytkownik.type(await screen.findByLabelText('Co chcesz zapisać?'), 'Obserwacja');
    await uzytkownik.click(screen.getByRole('button', { name: 'Zapisz' }));
    await uzytkownik.click(await screen.findByRole('button', { name: 'Dołącz do projektu' }));
    await uzytkownik.selectOptions(screen.getByLabelText('Projekt docelowy'), 'p1');
    await uzytkownik.click(screen.getByRole('button', { name: 'Dołącz wpis' }));
    await screen.findByRole('link', { name: 'Istniejący' });
    expect((await repozytorium.pobierzWpisy())[0]).toMatchObject({ trescOryginalna: 'Obserwacja', projektId: 'p1' });
    expect(await repozytorium.pobierzZdarzenia()).toEqual(expect.arrayContaining([expect.objectContaining({ typZdarzenia: 'CAPTURE_ASSIGNED', projektId: 'p1' })]));
    expect(screen.queryByRole('button', { name: 'Utwórz projekt' })).not.toBeInTheDocument();
  });

  it('odkłada analizę i odrzuca bez usuwania oryginału', async () => {
    const repozytorium = utworzRepozytoriumIndexedDb(crypto.randomUUID());
    const uzytkownik = osoba.setup();
    render(<MemoryRouter initialEntries={['/inbox']}><Aplikacja repozytorium={repozytorium} /></MemoryRouter>);
    await uzytkownik.type(await screen.findByLabelText('Co chcesz zapisać?'), 'Luźna myśl');
    await uzytkownik.click(screen.getByRole('button', { name: 'Zapisz' }));
    await uzytkownik.click(await screen.findByRole('button', { name: 'Analizuj później' }));
    await screen.findByText(/Do analizy później/);
    expect((await repozytorium.pobierzWpisy())[0].status).toBe('UNPROCESSED');
    await uzytkownik.click(screen.getByRole('button', { name: 'Odrzuć' }));
    await waitFor(() => expect(screen.queryByText('Luźna myśl')).not.toBeInTheDocument());
    await uzytkownik.click(screen.getByLabelText('Pokaż odrzucone'));
    expect(screen.getByText('Luźna myśl')).toBeInTheDocument();
    expect((await repozytorium.pobierzWpisy())[0]).toMatchObject({ trescOryginalna: 'Luźna myśl', status: 'DISMISSED' });
    expect((await repozytorium.pobierzZdarzenia()).map((zdarzenie) => zdarzenie.typZdarzenia)).toEqual(expect.arrayContaining(['CAPTURE_CREATED', 'CAPTURE_DEFERRED', 'CAPTURE_DISMISSED']));
  });
});
