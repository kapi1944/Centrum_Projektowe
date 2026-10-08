import { describe, expect, it } from 'vitest';
import type { AkcjaWpisu, KontekstZapisu } from '../domain/modele';
import { utworzProjekt, utworzWpis } from '../domain/operacje';
import { utworzRepozytoriumIndexedDb } from './repozytoriumIndexedDb';

function kontekst(czas = '2026-10-08T11:00:00Z'): KontekstZapisu {
  return { czas, idZdarzenia: crypto.randomUUID(), zrodlo: { typ: 'USER', nazwa: 'Wpis ręczny' } };
}

async function przygotujBaze() {
  const nazwaBazy = crypto.randomUUID();
  const repozytorium = utworzRepozytoriumIndexedDb(nazwaBazy);
  const wpis = utworzWpis('  Surowy oryginał\n\n ', null, 'w1', '2026-10-08T10:00:00Z', { typ: 'SYSTEM', nazwa: 'Import' }, 'IMPORT');
  await repozytorium.dodajWpis(wpis, kontekst(wpis.utworzono));
  return { nazwaBazy, repozytorium, wpis };
}

function nowyProjekt(): AkcjaWpisu {
  return { rodzaj: 'nowyProjekt', idProjektu: crypto.randomUUID(), nazwa: '  Nowy projekt  ', opis: 'Opis', idZdarzeniaProjektu: crypto.randomUUID() };
}

describe('Transakcje workflow wpisów', () => {
  it('atomowo tworzy projekt IDEA, przypina oryginał i zachowuje oba zdarzenia po otwarciu', async () => {
    const { nazwaBazy, repozytorium, wpis } = await przygotujBaze();
    const wynik = await repozytorium.wykonajAkcjeWpisu(wpis.id, nowyProjekt(), kontekst());
    const ponownieOtwarte = utworzRepozytoriumIndexedDb(nazwaBazy);
    expect(wynik.projekt).toMatchObject({ nazwa: 'Nowy projekt', opis: 'Opis', status: 'IDEA' });
    expect(await ponownieOtwarte.pobierzWpisy()).toEqual([{ ...wpis, projektId: wynik.projekt!.id }]);
    expect(await ponownieOtwarte.pobierzProjekty()).toEqual([wynik.projekt]);
    expect(await ponownieOtwarte.pobierzZdarzenia()).toHaveLength(3);
    expect(wynik.zdarzenia.map((zdarzenie) => zdarzenie.typZdarzenia)).toEqual(['PROJECT_CREATED', 'CAPTURE_ASSIGNED']);
    expect(wynik.zdarzenia.every((zdarzenie) => zdarzenie.projektId === wynik.projekt!.id)).toBe(true);
    expect(wynik.zdarzenia[0].metadane).toEqual({ wpisZrodlowyId: wpis.id });
  });

  it('wycofuje projekt, przypisanie i historię przy kolizji dowolnego zdarzenia', async () => {
    for (const kolizja of ['utworzenie', 'przypisanie']) {
      const { repozytorium, wpis } = await przygotujBaze();
      const zdarzeniaPrzed = await repozytorium.pobierzZdarzenia();
      const akcja = nowyProjekt();
      const kontekstZapisu = kontekst();
      if (kolizja === 'utworzenie' && akcja.rodzaj === 'nowyProjekt') akcja.idZdarzeniaProjektu = zdarzeniaPrzed[0].id;
      else kontekstZapisu.idZdarzenia = zdarzeniaPrzed[0].id;
      await expect(repozytorium.wykonajAkcjeWpisu(wpis.id, akcja, kontekstZapisu)).rejects.toBeTruthy();
      expect(await repozytorium.pobierzWpisy()).toEqual([wpis]);
      expect(await repozytorium.pobierzProjekty()).toEqual([]);
      expect(await repozytorium.pobierzZdarzenia()).toEqual(zdarzeniaPrzed);
    }
  });

  it('przypisuje raz, podnosi aktywność i zachowuje dane projektu oraz pochodzenie wpisu', async () => {
    const { repozytorium, wpis } = await przygotujBaze();
    const projekt = { ...utworzProjekt('Istniejący', 'p1', wpis.utworzono), opis: 'Bez zmian', nastepnyKrok: 'Dalej' };
    await repozytorium.dodajProjekt(projekt, kontekst(projekt.utworzono));
    const wynik = await repozytorium.wykonajAkcjeWpisu(wpis.id, { rodzaj: 'przypisanie', projektId: projekt.id }, kontekst());
    expect(wynik.wpis).toEqual({ ...wpis, projektId: projekt.id });
    expect(wynik.projekt).toEqual({ ...projekt, ostatniaAktywnosc: '2026-10-08T11:00:00Z' });
    await expect(repozytorium.wykonajAkcjeWpisu(wpis.id, nowyProjekt(), kontekst())).rejects.toThrow('już przypisany');
    expect(await repozytorium.pobierzProjekty()).toHaveLength(1);
    expect(await repozytorium.pobierzZdarzenia()).toHaveLength(3);
  });

  it('odrzuca brakujący lub zarchiwizowany projekt bez zmiany wpisu', async () => {
    const { repozytorium, wpis } = await przygotujBaze();
    await expect(repozytorium.wykonajAkcjeWpisu(wpis.id, { rodzaj: 'przypisanie', projektId: 'brak' }, kontekst())).rejects.toThrow('nie istnieje');
    const projekt = utworzProjekt('Archiwum', 'p1', wpis.utworzono);
    await repozytorium.dodajProjekt(projekt, kontekst());
    await repozytorium.zmienProjekt(projekt.id, { rodzaj: 'archiwizacja' }, kontekst());
    const historia = await repozytorium.pobierzZdarzenia();
    await expect(repozytorium.wykonajAkcjeWpisu(wpis.id, { rodzaj: 'przypisanie', projektId: projekt.id }, kontekst())).rejects.toThrow('zarchiwizowany');
    expect(await repozytorium.pobierzWpisy()).toEqual([wpis]);
    expect(await repozytorium.pobierzZdarzenia()).toEqual(historia);
  });

  it('odłożenie nie pozoruje analizy, a odrzucenie zachowuje oryginał i historię', async () => {
    const { nazwaBazy, repozytorium, wpis } = await przygotujBaze();
    const odlozony = await repozytorium.wykonajAkcjeWpisu(wpis.id, { rodzaj: 'odlozenie' }, kontekst());
    expect(odlozony.wpis).toEqual({ ...wpis, odlozonoDoAnalizy: '2026-10-08T11:00:00Z' });
    await expect(repozytorium.wykonajAkcjeWpisu(wpis.id, { rodzaj: 'odlozenie' }, kontekst())).rejects.toThrow('już odłożony');
    await repozytorium.wykonajAkcjeWpisu(wpis.id, { rodzaj: 'odrzucenie' }, kontekst());
    const ponownieOtwarte = utworzRepozytoriumIndexedDb(nazwaBazy);
    expect(await ponownieOtwarte.pobierzWpisy()).toEqual([{ ...wpis, status: 'DISMISSED', odlozonoDoAnalizy: null }]);
    await expect(repozytorium.wykonajAkcjeWpisu(wpis.id, nowyProjekt(), kontekst())).rejects.toThrow('nieprzetworzonego');
    expect(await ponownieOtwarte.pobierzZdarzenia()).toHaveLength(3);
  });

  it('dwa równoczesne żądania nie tworzą dwóch projektów z jednego wpisu', async () => {
    const { repozytorium, wpis } = await przygotujBaze();
    const wyniki = await Promise.allSettled([
      repozytorium.wykonajAkcjeWpisu(wpis.id, nowyProjekt(), kontekst()),
      repozytorium.wykonajAkcjeWpisu(wpis.id, nowyProjekt(), kontekst()),
    ]);
    expect(wyniki.map((wynik) => wynik.status).sort()).toEqual(['fulfilled', 'rejected']);
    expect(await repozytorium.pobierzProjekty()).toHaveLength(1);
    expect(await repozytorium.pobierzZdarzenia()).toHaveLength(3);
  });

  it('aktualizuje wyłącznie punkt powrotu w najnowszym stanie projektu', async () => {
    const { repozytorium } = await przygotujBaze();
    const projekt = utworzProjekt('Nazwa', 'p1', '2026-10-08T10:00:00Z');
    await repozytorium.dodajProjekt(projekt, kontekst());
    await repozytorium.zmienProjekt(projekt.id, { rodzaj: 'edycja', dane: { ...projekt, opis: 'Nowy opis', status: 'ACTIVE' } }, kontekst());
    const wynik = await repozytorium.zmienProjekt(projekt.id, { rodzaj: 'punktPowrotu', dane: {
      ...projekt, ostatnioPracowanoNad: 'Kod', podsumowanieAktualnegoStanu: 'Działa', nastepnyKrok: 'Testy',
    } }, kontekst('2026-10-08T12:00:00Z'));
    expect(wynik.projekt).toMatchObject({ opis: 'Nowy opis', status: 'ACTIVE', ostatnioPracowanoNad: 'Kod', nastepnyKrok: 'Testy', ostatniaAktywnosc: '2026-10-08T12:00:00Z' });
    expect(wynik.zdarzenie.typZdarzenia).toBe('PROJECT_RESUME_UPDATED');
  });
});
