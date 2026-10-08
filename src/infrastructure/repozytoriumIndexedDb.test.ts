import { describe, expect, it } from 'vitest';
import { utworzProjekt, utworzWpis } from '../domain/operacje';
import { utworzRepozytoriumIndexedDb } from './repozytoriumIndexedDb';

describe('Repozytorium IndexedDB', () => {
  it('odczytuje zapisane dane z nowej instancji repozytorium', async () => {
    const nazwaBazy = crypto.randomUUID();
    const repozytorium = utworzRepozytoriumIndexedDb(nazwaBazy);
    const projekt = utworzProjekt('Projekt', 'p1', '2026-10-08');
    const wpis = utworzWpis('  Oryginał\n ', projekt.id, 'w1', '2026-10-08');
    await repozytorium.dodajProjekt(projekt);
    await repozytorium.dodajWpis(wpis);
    const ponownieOtwarte = utworzRepozytoriumIndexedDb(nazwaBazy);
    expect(await ponownieOtwarte.pobierzProjekty()).toEqual([projekt]);
    expect(await ponownieOtwarte.pobierzWpisy()).toEqual([wpis]);
  });

  it('nie nadpisuje istniejącego oryginału przy powtórzonym identyfikatorze', async () => {
    const repozytorium = utworzRepozytoriumIndexedDb(crypto.randomUUID());
    const wpis = utworzWpis('Oryginał', null, 'w1', '2026-10-08');
    await repozytorium.dodajWpis(wpis);
    await expect(repozytorium.dodajWpis({ ...wpis, trescOryginalna: 'Zmieniony' })).rejects.toBeTruthy();
    expect(await repozytorium.pobierzWpisy()).toEqual([wpis]);
  });

  it('odrzuca przypisanie do nieistniejącego projektu bez częściowego zapisu', async () => {
    const repozytorium = utworzRepozytoriumIndexedDb(crypto.randomUUID());
    await expect(repozytorium.dodajWpis(utworzWpis('Treść', 'brak', 'w1', '2026-10-08'))).rejects.toBeTruthy();
    expect(await repozytorium.pobierzWpisy()).toEqual([]);
  });
});
