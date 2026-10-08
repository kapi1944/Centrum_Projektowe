import { describe, expect, it } from 'vitest';
import type { KontekstZapisu } from '../domain/modele';
import { utworzProjekt, utworzWpis } from '../domain/operacje';
import type { DaneDecyzji, OperacjaUstalen } from '../domain/ustalenia';
import { utworzRepozytoriumIndexedDb } from './repozytoriumIndexedDb';

function kontekst(): KontekstZapisu {
  return { idZdarzenia: crypto.randomUUID(), czas: new Date().toISOString(), zrodlo: { typ: 'USER', nazwa: 'Wpis ręczny' } };
}
function dane(tytul = 'Ustalenie', projektIds = ['p1', 'p2']): DaneDecyzji {
  return { tytul, opis: 'Opis ustalenia', projektIds, typZrodla: 'USER', nazwaZrodla: 'Rozmowa', odniesienieZrodla: 'Notatka 1', wpisZrodlowyId: 'w1', notatki: 'Uzasadnienie', powiazaneElementy: [] };
}
async function przygotuj() {
  const nazwaBazy = crypto.randomUUID();
  const repozytorium = utworzRepozytoriumIndexedDb(nazwaBazy);
  for (const id of ['p1', 'p2']) await repozytorium.dodajProjekt(utworzProjekt(id, id, '2026-10-08T10:00:00Z'), kontekst());
  const wpis = utworzWpis('  Oryginał\n ', 'p1', 'w1', '2026-10-08T10:00:00Z');
  await repozytorium.dodajWpis(wpis, kontekst());
  const wykonaj = (operacja: OperacjaUstalen) => repozytorium.wykonajOperacjeUstalen(operacja, kontekst());
  return { nazwaBazy, repozytorium, wpis, wykonaj };
}

describe('Decyzje i analiza wpływu', () => {
  it('zapisuje many-to-many, unikalne DEC i pochodzenie po ponownym otwarciu', async () => {
    const { nazwaBazy, repozytorium, wykonaj } = await przygotuj();
    const wyniki = await Promise.all([
      wykonaj({ rodzaj: 'utworz', id: 'd1', dane: dane() }),
      wykonaj({ rodzaj: 'utworz', id: 'd2', dane: dane('Drugie', ['p2']) }),
    ]);
    const ponownieOtwarte = utworzRepozytoriumIndexedDb(nazwaBazy);
    const decyzje = await ponownieOtwarte.pobierzDecyzje();
    expect(decyzje).toHaveLength(2);
    expect(new Set(decyzje.map((decyzja) => decyzja.czytelneId))).toEqual(new Set(['DEC-0001', 'DEC-0002']));
    expect(decyzje.find((decyzja) => decyzja.id === 'd1')).toMatchObject({ projektIds: ['p1', 'p2'], status: 'PROPOSED', typZrodla: 'USER', wpisZrodlowyId: 'w1' });
    expect(decyzje.filter((decyzja) => decyzja.projektIds.includes('p2'))).toHaveLength(2);
    expect(wyniki[0].zdarzenia[0]).toMatchObject({ typZdarzenia: 'DECISION_CREATED', projektIds: ['p1', 'p2'] });
    expect(await repozytorium.pobierzDecyzje()).toEqual(decyzje);
  });

  it('zastępuje atomowo i zachowuje całą treść starej decyzji oraz wcześniejsze zdarzenia', async () => {
    const { repozytorium, wykonaj } = await przygotuj();
    await wykonaj({ rodzaj: 'utworz', id: 'd1', dane: dane() });
    await wykonaj({ rodzaj: 'status', id: 'd1', status: 'IMPLEMENTED', wersja: 1 });
    const przed = (await repozytorium.pobierzDecyzje())[0];
    const historia = await repozytorium.pobierzZdarzenia();
    await wykonaj({ rodzaj: 'zastap', id: 'd1', wersja: 2, noweId: 'd2', dane: dane('Nowe ustalenie') });
    const decyzje = await repozytorium.pobierzDecyzje();
    expect(decyzje.find((decyzja) => decyzja.id === 'd1')).toMatchObject({ ...przed, status: 'SUPERSEDED', zastapionaPrzezId: 'd2', wersja: 3, zaktualizowano: expect.any(String) });
    expect(decyzje.find((decyzja) => decyzja.id === 'd2')).toMatchObject({ czytelneId: 'DEC-0002', status: 'ACCEPTED', projektIds: ['p1', 'p2'] });
    expect(await repozytorium.pobierzZdarzenia()).toEqual(expect.arrayContaining(historia));
    expect((await repozytorium.pobierzZdarzenia()).filter((zdarzenie) => zdarzenie.typZdarzenia === 'DECISION_SUPERSEDED')).toHaveLength(1);
    await expect(wykonaj({ rodzaj: 'status', id: 'd1', status: 'ACCEPTED', wersja: 3 })).rejects.toThrow('historyczny');
    await expect(wykonaj({ rodzaj: 'zastap', id: 'd2', wersja: 1, noweId: 'd1', dane: dane() })).rejects.toThrow('zajęty');
    await expect(wykonaj({ rodzaj: 'zastap', id: 'd2', wersja: 1, noweId: 'd3', dane: dane('Niepełna', ['p1']) })).rejects.toThrow('wszystkie projekty');
  });

  it('analiza wykorzystuje relacje i niczego automatycznie nie nadpisuje', async () => {
    const { repozytorium, wpis, wykonaj } = await przygotuj();
    await wykonaj({ rodzaj: 'utworz', id: 'd1', dane: { ...dane(), powiazaneElementy: [
      { typ: 'TASK', id: 't1', tytul: 'Zadanie' }, { typ: 'DOCUMENT', id: 'doc1', tytul: 'Instrukcja' },
      { typ: 'BLOCKER', id: 'b1', tytul: 'Blokada' }, { typ: 'WORK_ITEM', id: 'wi1', tytul: 'Zakres pracy' },
      { typ: 'PROJECT_ELEMENT', id: 'e1', tytul: 'Element projektu' },
    ] } });
    await wykonaj({ rodzaj: 'status', id: 'd1', status: 'ACCEPTED', wersja: 1 });
    const projekty = await repozytorium.pobierzProjekty();
    const decyzje = await repozytorium.pobierzDecyzje();
    const wynik = await wykonaj({ rodzaj: 'analizuj', zrodlo: { typ: 'CAPTURE', id: wpis.id } });
    expect(wynik.analizy[0].propozycje).toHaveLength(7);
    expect(wynik.analizy[0].propozycje.every((propozycja) => propozycja.stan === 'PENDING')).toBe(true);
    expect(await repozytorium.pobierzProjekty()).toEqual(projekty);
    expect(await repozytorium.pobierzDecyzje()).toEqual(decyzje);
    expect(await repozytorium.pobierzWpisy()).toEqual([wpis]);
  });

  it('zatwierdza tylko wskazaną zmianę i odrzuca inną bez zmiany modelu', async () => {
    const { nazwaBazy, repozytorium, wykonaj } = await przygotuj();
    await wykonaj({ rodzaj: 'utworz', id: 'd1', dane: dane() });
    await wykonaj({ rodzaj: 'status', id: 'd1', status: 'ACCEPTED', wersja: 1 });
    const analiza = (await wykonaj({ rodzaj: 'analizuj', zrodlo: { typ: 'CAPTURE', id: 'w1' } })).analizy[0];
    const zmianaStatusu = analiza.propozycje.find((propozycja) => propozycja.rodzaj === 'DECISION_STATUS')!;
    const punkt = analiza.propozycje.find((propozycja) => propozycja.rodzaj === 'RESUME')!;
    const projekty = await repozytorium.pobierzProjekty();
    await wykonaj({ rodzaj: 'rozstrzygnij', analizaId: analiza.id, propozycjaId: punkt.id, zatwierdz: false });
    expect(await repozytorium.pobierzProjekty()).toEqual(projekty);
    expect((await repozytorium.pobierzDecyzje())[0].status).toBe('ACCEPTED');
    await wykonaj({ rodzaj: 'rozstrzygnij', analizaId: analiza.id, propozycjaId: zmianaStatusu.id, zatwierdz: true });
    const ponownieOtwarte = utworzRepozytoriumIndexedDb(nazwaBazy);
    expect((await ponownieOtwarte.pobierzDecyzje())[0].status).toBe('PROPOSED');
    const stany = (await ponownieOtwarte.pobierzAnalizyWplywu())[0].propozycje.map((propozycja) => propozycja.stan);
    expect(stany).toEqual(['APPROVED', 'REJECTED']);
    const historia = await ponownieOtwarte.pobierzZdarzenia();
    expect(historia.map((zdarzenie) => zdarzenie.typZdarzenia)).toEqual(expect.arrayContaining(['IMPACT_APPROVED', 'IMPACT_REJECTED', 'DECISION_STATUS_CHANGED']));
    await expect(wykonaj({ rodzaj: 'rozstrzygnij', analizaId: analiza.id, propozycjaId: zmianaStatusu.id, zatwierdz: true })).rejects.toThrow('już rozstrzygnięta');
  });

  it('zatwierdza punkt powrotu i samą potrzebę przeglądu ręcznego odnośnika', async () => {
    const { repozytorium, wykonaj } = await przygotuj();
    await wykonaj({ rodzaj: 'utworz', id: 'd1', dane: { ...dane(), powiazaneElementy: [{ typ: 'TASK', id: 't1', tytul: 'Zadanie' }] } });
    const analiza = (await wykonaj({ rodzaj: 'analizuj', zrodlo: { typ: 'DECISION', id: 'd1' } })).analizy[0];
    const decyzje = await repozytorium.pobierzDecyzje();
    for (const propozycja of analiza.propozycje) await wykonaj({ rodzaj: 'rozstrzygnij', analizaId: analiza.id, propozycjaId: propozycja.id, zatwierdz: true });
    expect((await repozytorium.pobierzProjekty()).every((projekt) => projekt.nastepnyKrok === 'Sprawdź wpływ nowej informacji na ustalenia projektu.')).toBe(true);
    expect(await repozytorium.pobierzDecyzje()).toEqual(decyzje);
    expect((await repozytorium.pobierzAnalizyWplywu())[0].propozycje.every((propozycja) => propozycja.stan === 'APPROVED')).toBe(true);
  });

  it('blokuje nieaktualny impact i nie rozstrzyga propozycji po konflikcie', async () => {
    const { repozytorium, wykonaj } = await przygotuj();
    await wykonaj({ rodzaj: 'utworz', id: 'd1', dane: dane() });
    await wykonaj({ rodzaj: 'status', id: 'd1', status: 'ACCEPTED', wersja: 1 });
    const analiza = (await wykonaj({ rodzaj: 'analizuj', zrodlo: { typ: 'CAPTURE', id: 'w1' } })).analizy[0];
    await wykonaj({ rodzaj: 'status', id: 'd1', status: 'IMPLEMENTED', wersja: 2 });
    const projekt = (await repozytorium.pobierzProjekty())[0];
    await repozytorium.zmienProjekt(projekt.id, { rodzaj: 'punktPowrotu', dane: { ...projekt, nastepnyKrok: 'Nowsza praca' } }, kontekst());
    const historia = await repozytorium.pobierzZdarzenia();
    for (const propozycja of analiza.propozycje) await expect(wykonaj({ rodzaj: 'rozstrzygnij', analizaId: analiza.id, propozycjaId: propozycja.id, zatwierdz: true })).rejects.toThrow('zmieni');
    expect((await repozytorium.pobierzDecyzje())[0].status).toBe('IMPLEMENTED');
    expect((await repozytorium.pobierzProjekty())[0].nastepnyKrok).toBe('Nowsza praca');
    expect(await repozytorium.pobierzZdarzenia()).toEqual(historia);
    expect((await repozytorium.pobierzAnalizyWplywu())[0].propozycje.every((propozycja) => propozycja.stan === 'PENDING')).toBe(true);
  });

  it('wycofuje zastąpienie i zatwierdzenie wpływu po błędzie historii', async () => {
    const { repozytorium, wykonaj } = await przygotuj();
    await wykonaj({ rodzaj: 'utworz', id: 'd1', dane: dane() });
    await wykonaj({ rodzaj: 'status', id: 'd1', status: 'ACCEPTED', wersja: 1 });
    const analiza = (await wykonaj({ rodzaj: 'analizuj', zrodlo: { typ: 'CAPTURE', id: 'w1' } })).analizy[0];
    const historia = await repozytorium.pobierzZdarzenia();
    const kolizja = { ...kontekst(), idZdarzenia: historia[0].id };
    const decyzje = await repozytorium.pobierzDecyzje();
    await expect(repozytorium.wykonajOperacjeUstalen({ rodzaj: 'zastap', id: 'd1', wersja: 2, noweId: 'd2', dane: dane() }, kolizja)).rejects.toBeTruthy();
    await expect(repozytorium.wykonajOperacjeUstalen({ rodzaj: 'rozstrzygnij', analizaId: analiza.id, propozycjaId: analiza.propozycje[0].id, zatwierdz: true }, kolizja)).rejects.toBeTruthy();
    expect(await repozytorium.pobierzDecyzje()).toEqual(decyzje);
    expect(await repozytorium.pobierzAnalizyWplywu()).toEqual([analiza]);
    expect(await repozytorium.pobierzZdarzenia()).toEqual(historia);
  });

  it('migruje bazę wersji 2 bez utraty projektu, wpisu i historii', async () => {
    const nazwaBazy = crypto.randomUUID();
    const projekt = utworzProjekt('Projekt', 'p1', '2026-10-08T10:00:00Z');
    const wpis = utworzWpis('  Stary wpis\n ', null, 'w1', projekt.utworzono);
    await new Promise<void>((rozwiaz, odrzuc) => {
      const zadanie = indexedDB.open(nazwaBazy, 2);
      zadanie.onupgradeneeded = () => {
        zadanie.result.createObjectStore('projekty', { keyPath: 'id' }).add(projekt);
        zadanie.result.createObjectStore('wpisy', { keyPath: 'id' }).add(wpis);
        zadanie.result.createObjectStore('zdarzenia', { keyPath: 'id' }).add({ id: 'z1', tytul: 'Dawne zdarzenie' });
      };
      zadanie.onerror = () => odrzuc(zadanie.error);
      zadanie.onsuccess = () => { zadanie.result.close(); rozwiaz(); };
    });
    const repozytorium = utworzRepozytoriumIndexedDb(nazwaBazy);
    expect(await repozytorium.pobierzProjekty()).toEqual([projekt]);
    expect(await repozytorium.pobierzWpisy()).toEqual([wpis]);
    expect(await repozytorium.pobierzZdarzenia()).toEqual([{ id: 'z1', tytul: 'Dawne zdarzenie' }]);
    expect(await repozytorium.pobierzDecyzje()).toEqual([]);
    expect(await repozytorium.pobierzAnalizyWplywu()).toEqual([]);
  });
});
