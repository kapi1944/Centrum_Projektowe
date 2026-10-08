import { describe, expect, it } from 'vitest';
import { utworzProjekt, utworzWpis } from '../domain/operacje';
import { utworzRepozytoriumIndexedDb } from './repozytoriumIndexedDb';

function kontekst(czas = '2026-10-08T10:00:00Z', idZdarzenia = crypto.randomUUID()) {
  return { idZdarzenia, czas, zrodlo: { typ: 'USER', nazwa: 'Wpis ręczny' } as const };
}

describe('Repozytorium IndexedDB', () => {
  it('odczytuje zapisane dane z nowej instancji repozytorium', async () => {
    const nazwaBazy = crypto.randomUUID();
    const repozytorium = utworzRepozytoriumIndexedDb(nazwaBazy);
    const projekt = utworzProjekt('Projekt', 'p1', '2026-10-08');
    const wpis = utworzWpis('  Oryginał\n ', projekt.id, 'w1', '2026-10-08');
    await repozytorium.dodajProjekt(projekt, kontekst(projekt.utworzono));
    await repozytorium.dodajWpis(wpis, kontekst(wpis.utworzono));
    const ponownieOtwarte = utworzRepozytoriumIndexedDb(nazwaBazy);
    expect(await ponownieOtwarte.pobierzProjekty()).toEqual([projekt]);
    expect(await ponownieOtwarte.pobierzWpisy()).toEqual([wpis]);
  });

  it('nie nadpisuje istniejącego oryginału przy powtórzonym identyfikatorze', async () => {
    const repozytorium = utworzRepozytoriumIndexedDb(crypto.randomUUID());
    const wpis = utworzWpis('Oryginał', null, 'w1', '2026-10-08');
    await repozytorium.dodajWpis(wpis, kontekst());
    await expect(repozytorium.dodajWpis({ ...wpis, trescOryginalna: 'Zmieniony' }, kontekst())).rejects.toBeTruthy();
    expect(await repozytorium.pobierzWpisy()).toEqual([wpis]);
    expect(await repozytorium.pobierzZdarzenia()).toHaveLength(1);
  });

  it('odrzuca przypisanie do nieistniejącego projektu bez częściowego zapisu', async () => {
    const repozytorium = utworzRepozytoriumIndexedDb(crypto.randomUUID());
    await expect(repozytorium.dodajWpis(utworzWpis('Treść', 'brak', 'w1', '2026-10-08'), kontekst())).rejects.toBeTruthy();
    expect(await repozytorium.pobierzWpisy()).toEqual([]);
    expect(await repozytorium.pobierzZdarzenia()).toEqual([]);
  });

  it('zachowuje edycję, status, pamięć i historię po ponownym otwarciu', async () => {
    const nazwaBazy = crypto.randomUUID();
    const repozytorium = utworzRepozytoriumIndexedDb(nazwaBazy);
    const projekt = utworzProjekt('Projekt', 'p1', '2026-10-08T10:00:00Z');
    const utworzenie = await repozytorium.dodajProjekt(projekt, kontekst());
    const wynik = await repozytorium.zmienProjekt(projekt.id, { rodzaj: 'edycja', dane: {
      ...projekt, nazwa: 'Nowa nazwa', opis: 'Opis', status: 'ACTIVE',
      podsumowanieAktualnegoStanu: 'Fundament gotowy', ostatnioPracowanoNad: 'Persistence', nastepnyKrok: 'Inbox',
    } }, kontekst('2026-10-08T11:00:00Z'));
    const ponownieOtwarte = utworzRepozytoriumIndexedDb(nazwaBazy);
    expect(await ponownieOtwarte.pobierzProjekty()).toEqual([wynik.projekt]);
    expect(wynik.projekt).toMatchObject({ utworzono: projekt.utworzono, zaktualizowano: '2026-10-08T11:00:00Z', ostatniaAktywnosc: '2026-10-08T11:00:00Z' });
    expect(await ponownieOtwarte.pobierzZdarzenia()).toEqual(expect.arrayContaining([utworzenie, wynik.zdarzenie]));
    expect(wynik.zdarzenie.opis).toContain('Status: Pomysł → Aktywny');
    expect(wynik.zdarzenie.metadane?.zmiany).toEqual(expect.arrayContaining([{ pole: 'nastepnyKrok', poprzednio: '', obecnie: 'Inbox' }]));
  });

  it('archiwizuje bez usuwania wpisów lub wcześniejszych zdarzeń', async () => {
    const repozytorium = utworzRepozytoriumIndexedDb(crypto.randomUUID());
    const projekt = utworzProjekt('Projekt', 'p1', '2026-10-08T10:00:00Z');
    await repozytorium.dodajProjekt(projekt, kontekst());
    const wpis = utworzWpis('  Oryginał\n ', projekt.id, 'w1', '2026-10-08T11:00:00Z');
    await repozytorium.dodajWpis(wpis, kontekst(wpis.utworzono));
    expect((await repozytorium.pobierzProjekty())[0].ostatniaAktywnosc).toBe(wpis.utworzono);
    const przedArchiwizacja = await repozytorium.pobierzZdarzenia();
    const wynik = await repozytorium.zmienProjekt(projekt.id, { rodzaj: 'archiwizacja' }, kontekst('2026-10-08T12:00:00Z'));
    expect(wynik.projekt.zarchiwizowano).toBe('2026-10-08T12:00:00Z');
    expect(await repozytorium.pobierzWpisy()).toEqual([wpis]);
    expect(await repozytorium.pobierzZdarzenia()).toEqual(expect.arrayContaining(przedArchiwizacja));
    expect(await repozytorium.pobierzZdarzenia()).toHaveLength(3);
    await expect(repozytorium.zmienProjekt(projekt.id, { rodzaj: 'edycja', dane: { ...projekt, nazwa: 'Zmiana' } }, kontekst())).rejects.toThrow('zarchiwizowany');
    await expect(repozytorium.dodajWpis({ ...wpis, id: 'w2' }, kontekst())).rejects.toThrow('zarchiwizowany');
  });

  it('wycofuje zmianę projektu i zapis wpisu, gdy zdarzenie ma zajęty identyfikator', async () => {
    const repozytorium = utworzRepozytoriumIndexedDb(crypto.randomUUID());
    const projekt = utworzProjekt('Projekt', 'p1', '2026-10-08T10:00:00Z');
    const wspolnyKontekst = kontekst();
    const oryginalneZdarzenie = await repozytorium.dodajProjekt(projekt, wspolnyKontekst);
    await expect(repozytorium.zmienProjekt(projekt.id, { rodzaj: 'edycja', dane: { ...projekt, nazwa: 'Zmiana' } }, wspolnyKontekst)).rejects.toBeTruthy();
    await expect(repozytorium.dodajWpis(utworzWpis('Wpis', projekt.id, 'w1', '2026-10-08T11:00:00Z'), wspolnyKontekst)).rejects.toBeTruthy();
    await expect(repozytorium.dodajProjekt({ ...projekt, id: 'p2' }, wspolnyKontekst)).rejects.toBeTruthy();
    expect(await repozytorium.pobierzProjekty()).toEqual([projekt]);
    expect(await repozytorium.pobierzWpisy()).toEqual([]);
    expect(await repozytorium.pobierzZdarzenia()).toEqual([oryginalneZdarzenie]);
  });

  it('odrzuca edycję nieistniejącego projektu i zapis bez zmian', async () => {
    const repozytorium = utworzRepozytoriumIndexedDb(crypto.randomUUID());
    const projekt = utworzProjekt('Projekt', 'p1', '2026-10-08T10:00:00Z');
    await expect(repozytorium.zmienProjekt('brak', { rodzaj: 'archiwizacja' }, kontekst())).rejects.toThrow('nie istnieje');
    await repozytorium.dodajProjekt(projekt, kontekst());
    await expect(repozytorium.zmienProjekt(projekt.id, { rodzaj: 'edycja', dane: projekt }, kontekst())).rejects.toThrow('Brak zmian');
    expect(await repozytorium.pobierzZdarzenia()).toHaveLength(1);
  });

  it('migruje bazę etapu 0, zachowując oryginały, relacje i ostatnią aktywność', async () => {
    const nazwaBazy = crypto.randomUUID();
    const projekt = { id: 'p1', nazwa: 'Dawny projekt', utworzono: '2026-10-07T10:00:00Z' };
    const wpis = { id: 'w1', trescOryginalna: '  Dawny oryginał\n ', projektId: 'p1', utworzono: '2026-10-08T10:00:00Z', stan: 'nowy' };
    const wczesniejszyWpis = { ...wpis, id: 'w2', utworzono: '2026-10-07T12:00:00Z' };
    const luznyWpis = { ...wpis, id: 'w3', projektId: null };
    await new Promise<void>((rozwiaz, odrzuc) => {
      const zadanie = indexedDB.open(nazwaBazy, 1);
      zadanie.onupgradeneeded = () => {
        zadanie.result.createObjectStore('projekty', { keyPath: 'id' }).add(projekt);
        const wpisy = zadanie.result.createObjectStore('wpisy', { keyPath: 'id' });
        for (const rekord of [wpis, wczesniejszyWpis, luznyWpis]) wpisy.add(rekord);
      };
      zadanie.onerror = () => odrzuc(zadanie.error);
      zadanie.onsuccess = () => { zadanie.result.close(); rozwiaz(); };
    });
    const repozytorium = utworzRepozytoriumIndexedDb(nazwaBazy);
    expect(await repozytorium.pobierzProjekty()).toEqual([{
      ...utworzProjekt(projekt.nazwa, projekt.id, projekt.utworzono), ostatniaAktywnosc: wpis.utworzono,
    }]);
    expect(await repozytorium.pobierzWpisy()).toEqual([wpis, wczesniejszyWpis, luznyWpis].map((rekord) => utworzWpis(rekord.trescOryginalna, rekord.projektId, rekord.id, rekord.utworzono)));
    expect(await repozytorium.pobierzZdarzenia()).toEqual([]);
    await repozytorium.zmienProjekt(projekt.id, { rodzaj: 'archiwizacja' }, kontekst());
    const ponownieOtwarte = utworzRepozytoriumIndexedDb(nazwaBazy);
    expect(await ponownieOtwarte.pobierzWpisy()).toEqual(await repozytorium.pobierzWpisy());
    expect(await ponownieOtwarte.pobierzZdarzenia()).toHaveLength(1);
  });
});
