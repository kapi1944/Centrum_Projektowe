import { afterEach, describe, expect, it, vi } from 'vitest';
import { aktualizujPunktPowrotu, utworzWpisUzytkownika } from './przypadkiUzycia';
import { utworzProjekt } from '../domain/operacje';
import type { PortyTransakcji } from '../domain/porty';
import { utworzRepozytoriumIndexedDb } from '../infrastructure/repozytoriumIndexedDb';

function kontekst(idZdarzenia: string = crypto.randomUUID(), czas = '2026-10-09T10:00:00Z') {
  return { idZdarzenia, czas, zrodlo: { typ: 'USER' as const, nazwa: 'Wpis ręczny' } };
}
async function przygotuj() {
  const nazwaBazy = crypto.randomUUID();
  const repozytorium = utworzRepozytoriumIndexedDb(nazwaBazy);
  const projekt = utworzProjekt('Projekt', 'p1', '2026-10-08T10:00:00Z');
  await repozytorium.dodajProjekt(projekt, kontekst('utworzenie'));
  return { nazwaBazy, repozytorium, projekt };
}
afterEach(() => vi.restoreAllMocks());

describe('Przypadki użycia i jednostka pracy', () => {
  it('otwiera wyłącznie wymagane magazyny, zachowuje oryginał i odczyt po ponownym otwarciu', async () => {
    const { nazwaBazy, repozytorium } = await przygotuj();
    const otworzTransakcje = IDBDatabase.prototype.transaction;
    let potwierdzoneZapisy = 0;
    const transakcje = vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(function (this: IDBDatabase, magazyny, tryb, opcje) {
      const transakcja = otworzTransakcje.call(this, magazyny, tryb, opcje);
      if (tryb === 'readwrite') transakcja.addEventListener('complete', () => { potwierdzoneZapisy++; });
      return transakcja;
    });
    const dane = { id: 'luzny', tresc: '  Oryginał\n ', projektId: null };
    await utworzWpisUzytkownika(repozytorium.jednostkaPracy, dane, kontekst());
    expect(potwierdzoneZapisy).toBe(1);
    await utworzWpisUzytkownika(repozytorium.jednostkaPracy, { ...dane, id: 'przypisany', projektId: 'p1' }, kontekst());
    expect(potwierdzoneZapisy).toBe(2);
    await aktualizujPunktPowrotu(repozytorium.jednostkaPracy, 'p1', { ostatnioPracowanoNad: 'Domena', podsumowanieAktualnegoStanu: 'Gotowe', nastepnyKrok: 'Review' }, kontekst());
    expect(potwierdzoneZapisy).toBe(3);
    expect(transakcje.mock.calls.filter((wywolanie) => wywolanie[1] === 'readwrite').map((wywolanie) => wywolanie[0])).toEqual([
      ['wpisy', 'zdarzenia'], ['projekty', 'wpisy', 'zdarzenia'], ['projekty', 'zdarzenia'],
    ]);
    const ponownie = utworzRepozytoriumIndexedDb(nazwaBazy);
    expect((await ponownie.pobierzWpisy()).map((wpis) => wpis.trescOryginalna)).toEqual([dane.tresc, dane.tresc]);
    expect((await ponownie.pobierzProjekty())[0].nastepnyKrok).toBe('Review');
    expect(await ponownie.pobierzZdarzenia()).toHaveLength(4);
  });

  it('błąd historii wycofuje wpis, aktywność projektu i punkt powrotu', async () => {
    const { repozytorium } = await przygotuj();
    const przed = await repozytorium.eksportujKopie();
    await expect(utworzWpisUzytkownika(repozytorium.jednostkaPracy, { id: 'w1', tresc: 'Treść', projektId: 'p1' }, kontekst('utworzenie', '2026-10-10T10:00:00Z'))).rejects.toThrow('Nie udało się zapisać');
    await expect(aktualizujPunktPowrotu(repozytorium.jednostkaPracy, 'p1', { ostatnioPracowanoNad: 'Zmiana', podsumowanieAktualnegoStanu: '', nastepnyKrok: 'Nowy' }, kontekst('utworzenie'))).rejects.toThrow('Nie udało się zapisać');
    expect((await repozytorium.eksportujKopie()).data).toEqual(przed.data);
  });

  it('nie nadpisuje oryginału ani historii przy kolizji ID wpisu', async () => {
    const { repozytorium } = await przygotuj();
    const dane = { id: 'w1', tresc: 'Oryginał', projektId: 'p1' };
    await utworzWpisUzytkownika(repozytorium.jednostkaPracy, dane, kontekst());
    const przed = await repozytorium.eksportujKopie();
    await expect(utworzWpisUzytkownika(repozytorium.jednostkaPracy, { ...dane, tresc: 'Nadpisanie' }, kontekst())).rejects.toThrow();
    expect((await repozytorium.eksportujKopie()).data).toEqual(przed.data);
  });

  it('odczytuje aktualny projekt w transakcji, chroni nowszą aktywność i blokuje archiwum', async () => {
    const { repozytorium } = await przygotuj();
    await repozytorium.zmienProjekt('p1', { rodzaj: 'edycja', dane: { ...(await repozytorium.pobierzProjekty())[0], opis: 'Aktualny opis' } }, kontekst('edycja', '2026-10-10T10:00:00Z'));
    await aktualizujPunktPowrotu(repozytorium.jednostkaPracy, 'p1', { ostatnioPracowanoNad: '', podsumowanieAktualnegoStanu: '', nastepnyKrok: 'Powrót' }, kontekst());
    expect((await repozytorium.pobierzProjekty())[0]).toMatchObject({ opis: 'Aktualny opis', ostatniaAktywnosc: '2026-10-10T10:00:00Z' });
    await repozytorium.zmienProjekt('p1', { rodzaj: 'archiwizacja' }, kontekst());
    const przed = await repozytorium.eksportujKopie();
    await expect(utworzWpisUzytkownika(repozytorium.jednostkaPracy, { id: 'w1', tresc: 'Treść', projektId: 'p1' }, kontekst())).rejects.toThrow('zarchiwizowany');
    await expect(aktualizujPunktPowrotu(repozytorium.jednostkaPracy, 'p1', { ostatnioPracowanoNad: '', podsumowanieAktualnegoStanu: '', nastepnyKrok: 'Zmiana' }, kontekst())).rejects.toThrow('zarchiwizowany');
    expect((await repozytorium.eksportujKopie()).data).toEqual(przed.data);
  });

  it('nie udostępnia niezadeklarowanego portu i wycofuje wcześniejsze zapisy przy próbie jego użycia', async () => {
    const { repozytorium, projekt } = await przygotuj();
    await expect(repozytorium.jednostkaPracy.wykonaj(['projekty'], (repozytoria, zakoncz) => {
      expect(Object.keys(repozytoria)).toEqual(['projekty']);
      // @ts-expect-error Zakres transakcji nie udostępnia wpisów.
      expect(repozytoria.wpisy).toBeUndefined();
      repozytoria.projekty.zapisz({ ...projekt, opis: 'Zmiana do wycofania' });
      const nadmiernyZakres = repozytoria as PortyTransakcji;
      nadmiernyZakres.wpisy.dodaj({ id: 'w1', trescOryginalna: 'Treść', projektId: null, utworzono: kontekst().czas, status: 'UNPROCESSED', typZrodla: 'MANUAL', zrodlo: kontekst().zrodlo });
      zakoncz(undefined);
    })).rejects.toThrow();
    expect((await repozytorium.pobierzProjekty())[0]).toEqual(projekt);
    expect(await repozytorium.pobierzWpisy()).toEqual([]);
  });

  it('wycofuje zapis, gdy callback nie wskazał zakończenia', async () => {
    const { repozytorium, projekt } = await przygotuj();
    await expect(repozytorium.jednostkaPracy.wykonaj(['projekty'], (repozytoria) => {
      repozytoria.projekty.zapisz({ ...projekt, opis: 'Niekompletna operacja' });
    })).rejects.toThrow('Nie zakończono');
    expect(await repozytorium.pobierzProjekty()).toEqual([projekt]);
  });

  it('odrzuca asynchroniczny callback przed commit zamiast pozwolić na częściowy zapis', async () => {
    const { repozytorium, projekt } = await przygotuj();
    await expect(repozytorium.jednostkaPracy.wykonaj(['projekty'], async (repozytoria, zakoncz) => {
      repozytoria.projekty.zapisz({ ...projekt, opis: 'Niekompletna operacja' });
      await Promise.resolve();
      zakoncz(undefined);
    })).rejects.toThrow('asynchronicznych');
    expect(await repozytorium.pobierzProjekty()).toEqual([projekt]);
  });
});
