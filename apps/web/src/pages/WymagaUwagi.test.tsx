import { render, screen, within } from '@testing-library/react';
import uzytkownik from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { expect, it } from 'vitest';
import { Aplikacja } from '../app/Aplikacja';
import { utworzProjekt } from '../domain/operacje';
import { utworzRepozytoriumIndexedDb } from '../infrastructure/repozytoriumIndexedDb';

it('pokazuje powód uwagi, prowadzi do blokera i usuwa uwagę po rozwiązaniu oraz ponownym otwarciu', async () => {
  const repozytorium = utworzRepozytoriumIndexedDb(crypto.randomUUID());
  const czas = '2026-10-11T12:00:00.000Z';
  const kontekst = { czas, idZdarzenia: 'projekt', zrodlo: { typ: 'USER' as const, nazwa: 'Użytkownik' } };
  await repozytorium.dodajProjekt({ ...utworzProjekt('Test uwagi', 'p1', czas), nastepnyKrok: 'Sprawdź dostęp' }, kontekst);
  await repozytorium.wykonajOperacjeRealizacji({ rodzaj: 'blokada', id: 'b1', dane: {
    projektId: 'p1', tytul: 'Brak dostępu', opis: 'Potrzebne uprawnienia', status: 'ACTIVE', waga: 'HIGH',
  } }, { ...kontekst, idZdarzenia: 'bloker' });
  const osoba = uzytkownik.setup();
  const widok = render(<MemoryRouter initialEntries={['/uwaga']}><Aplikacja repozytorium={repozytorium} /></MemoryRouter>);
  await screen.findByRole('heading', { name: 'Wymaga uwagi' });
  expect(screen.getByText('Dlaczego to widzę?')).toBeVisible();
  expect(screen.getByText('Bloker ma status „Aktywna”.')).toBeVisible();
  await osoba.click(screen.getByRole('link', { name: 'Otwórz bloker' }));
  const stan = await screen.findByRole('region', { name: 'Stan teraz' });
  expect(within(stan).getByText('Sprawdź dostęp')).toBeVisible();
  const bloker = screen.getByRole('article', { name: 'Blokada: Brak dostępu' });
  await osoba.click(within(bloker).getByRole('button', { name: 'Rozwiąż blokadę' }));
  await within(bloker).findByText('Rozwiązana · Waga: Wysoka');
  await osoba.click(within(screen.getByRole('navigation')).getByRole('link', { name: 'Wymaga uwagi' }));
  expect(await screen.findByText('Brak spraw wymagających uwagi.')).toBeVisible();
  widok.unmount();
  render(<MemoryRouter initialEntries={['/uwaga']}><Aplikacja repozytorium={repozytorium} /></MemoryRouter>);
  expect(await screen.findByText('Brak spraw wymagających uwagi.')).toBeVisible();
});
