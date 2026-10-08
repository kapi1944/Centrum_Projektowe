import { render, screen, within } from '@testing-library/react';
import osoba from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Aplikacja } from '../../app/Aplikacja';
import { utworzProjekt, utworzWpis } from '../../domain/operacje';
import type { DaneDecyzji } from '../../domain/ustalenia';
import { utworzRepozytoriumIndexedDb } from '../../infrastructure/repozytoriumIndexedDb';

function kontekst() {
  return { idZdarzenia: crypto.randomUUID(), czas: new Date().toISOString(), zrodlo: { typ: 'USER', nazwa: 'Wpis ręczny' } as const };
}
async function przygotuj() {
  const repozytorium = utworzRepozytoriumIndexedDb(crypto.randomUUID());
  for (const [id, nazwa] of [['p1', 'Alfa'], ['p2', 'Beta']]) await repozytorium.dodajProjekt(utworzProjekt(nazwa, id, '2026-10-08T10:00:00Z'), kontekst());
  await repozytorium.dodajWpis(utworzWpis('  Źródłowa informacja\n ', 'p1', 'w1', '2026-10-08T10:00:00Z'), kontekst());
  return repozytorium;
}

describe('Rejestr ustaleń w UI', () => {
  it('tworzy wspólną decyzję, zmienia status i pokazuje obie strony zastąpienia oraz historię drugiego projektu', async () => {
    const repozytorium = await przygotuj();
    const uzytkownik = osoba.setup();
    render(<MemoryRouter initialEntries={['/projekty/p1']}><Aplikacja repozytorium={repozytorium} /></MemoryRouter>);
    await uzytkownik.click(await screen.findByRole('link', { name: 'Ustalenia projektu' }));
    await uzytkownik.click(screen.getByRole('button', { name: 'Nowa decyzja' }));
    await uzytkownik.type(screen.getByLabelText('Tytuł decyzji'), 'Wspólne ustalenie');
    await uzytkownik.type(screen.getByLabelText('Opis decyzji'), 'Zachowujemy dane lokalnie');
    await uzytkownik.click(screen.getByRole('checkbox', { name: 'Beta' }));
    await uzytkownik.selectOptions(screen.getByLabelText('Źródłowy wpis'), 'w1');
    await uzytkownik.click(screen.getByRole('button', { name: 'Dodaj odnośnik' }));
    await uzytkownik.selectOptions(screen.getByLabelText('Rodzaj elementu'), 'DOCUMENT');
    await uzytkownik.type(screen.getByLabelText('Identyfikator elementu'), 'DOC-1');
    await uzytkownik.type(screen.getByLabelText('Nazwa elementu'), 'Instrukcja');
    await uzytkownik.click(screen.getByRole('button', { name: 'Zapisz propozycję decyzji' }));
    const karta = await screen.findByRole('article', { name: 'DEC-0001: Wspólne ustalenie' });
    expect(within(karta).getByRole('link', { name: 'Alfa' })).toBeInTheDocument();
    expect(within(karta).getByRole('link', { name: 'Beta' })).toBeInTheDocument();
    await uzytkownik.click(within(karta).getByText('Powiązany wpis — oryginał'));
    expect(within(karta).getByText('Źródłowa informacja').textContent).toBe('  Źródłowa informacja\n ');
    expect(within(karta).getByText(/Instrukcja \(DOC-1\)/)).toBeInTheDocument();
    await uzytkownik.selectOptions(screen.getByLabelText('Nowy status DEC-0001'), 'ACCEPTED');
    await uzytkownik.click(within(karta).getByRole('button', { name: 'Zmień status' }));
    await uzytkownik.selectOptions(screen.getByLabelText('Widok ustaleń'), 'ACCEPTED');
    await uzytkownik.click(await screen.findByRole('button', { name: 'Zastąp nową decyzją' }));
    await uzytkownik.clear(screen.getByLabelText('Tytuł decyzji'));
    await uzytkownik.type(screen.getByLabelText('Tytuł decyzji'), 'Nowe ustalenie');
    await uzytkownik.click(screen.getByRole('button', { name: 'Zatwierdź zastąpienie decyzji' }));
    const nowa = await screen.findByRole('article', { name: 'DEC-0002: Nowe ustalenie' });
    expect(within(nowa).getByText(/Zastępuje/)).toBeInTheDocument();
    await uzytkownik.click(within(nowa).getByRole('link', { name: 'DEC-0001' }));
    const stara = await screen.findByRole('article', { name: 'DEC-0001: Wspólne ustalenie' });
    expect(within(stara).getByText(/Zastąpione przez/)).toBeInTheDocument();
    expect(within(stara).queryByRole('button', { name: 'Zmień status' })).not.toBeInTheDocument();
    await uzytkownik.click(within(stara).getByRole('link', { name: 'Beta' }));
    await uzytkownik.click(screen.getByRole('link', { name: 'Wróć do projektu' }));
    expect(await screen.findByText('DEC-0001 zastąpiono przez DEC-0002')).toBeInTheDocument();
    expect(screen.getByText('Utworzono DEC-0001')).toBeInTheDocument();
  });

  it('pokazuje propozycje wpływu w Inbox, zatwierdza jedną i odrzuca drugą', async () => {
    const repozytorium = await przygotuj();
    const dane: DaneDecyzji = { tytul: 'Ustalenie', opis: 'Opis', projektIds: ['p1'], typZrodla: 'USER', nazwaZrodla: 'Wpis ręczny', odniesienieZrodla: '', wpisZrodlowyId: 'w1', notatki: '', powiazaneElementy: [] };
    await repozytorium.wykonajOperacjeUstalen({ rodzaj: 'utworz', id: 'd1', dane }, kontekst());
    await repozytorium.wykonajOperacjeUstalen({ rodzaj: 'status', id: 'd1', wersja: 1, status: 'ACCEPTED' }, kontekst());
    const projekty = await repozytorium.pobierzProjekty();
    const uzytkownik = osoba.setup();
    render(<MemoryRouter initialEntries={['/inbox']}><Aplikacja repozytorium={repozytorium} /></MemoryRouter>);
    await uzytkownik.click(await screen.findByText('Analiza wpływu'));
    await uzytkownik.click(screen.getByRole('button', { name: 'Sprawdź wpływ na podstawie relacji' }));
    await screen.findByText('Ta informacja może zmieniać 2 istniejące elementy projektu.');
    expect((await repozytorium.pobierzDecyzje())[0].status).toBe('ACCEPTED');
    const analiza = screen.getByRole('region', { name: 'Wynik analizy wpływu' });
    const karty = within(analiza).getAllByRole('listitem');
    await uzytkownik.click(within(karty[0]).getByRole('button', { name: 'Zatwierdź tę zmianę' }));
    expect(await within(karty[0]).findByRole('status')).toHaveTextContent('Zatwierdzono');
    await uzytkownik.click(within(karty[1]).getByRole('button', { name: 'Odrzuć tę zmianę' }));
    expect(await within(karty[1]).findByRole('status')).toHaveTextContent('Odrzucono');
    expect((await repozytorium.pobierzDecyzje())[0].status).toBe('PROPOSED');
    expect(await repozytorium.pobierzProjekty()).toEqual(projekty.map((projekt) => projekt.id === 'p1' ? { ...projekt, ostatniaAktywnosc: expect.any(String) } : projekt));
    expect((await repozytorium.pobierzWpisy())[0].trescOryginalna).toBe('  Źródłowa informacja\n ');
  });
});
