import { describe, expect, it, vi } from 'vitest';
import { BladKonfliktow, nazwyMagazynow, odczytajKopie, pusteDaneKopii, sprawdzKopie, migrujKopie } from '../domain/kopieZapasowe';
import { utworzProjekt, utworzWpis } from '../domain/operacje';
import { utworzRepozytoriumIndexedDb } from './repozytoriumIndexedDb';
import { RuleBasedAnalysisProvider } from './RuleBasedAnalysisProvider';
import { kopiaDoWidokuV2, widokDoKopiiV1 } from './zgodnoscV1V2';

function kontekst() {
  return { idZdarzenia: crypto.randomUUID(), czas: '2026-10-08T12:00:00Z', zrodlo: { typ: 'USER' as const, nazwa: 'Użytkownik' } };
}
async function przygotuj() {
  const repozytorium = utworzRepozytoriumIndexedDb(crypto.randomUUID());
  await repozytorium.dodajProjekt(utworzProjekt('Prywatny projekt', 'p1', kontekst().czas), kontekst());
  const wpis = utworzWpis('  Trzeba sprawdzić kopię.\nCzy działa?\nDecyduję zachować dane.\nWpływ: sprawdzić projekt.  ', 'p1', 'w1', kontekst().czas);
  await repozytorium.dodajWpis(wpis, kontekst());
  let wynik = await repozytorium.wykonajOperacjeAnalizyWpisu({ rodzaj: 'generuj', id: 'a1', wpisId: 'w1', wynik: await new RuleBasedAnalysisProvider().analizuj(wpis.trescOryginalna) }, kontekst());
  wynik = await repozytorium.wykonajOperacjeAnalizyWpisu({ rodzaj: 'rozpocznij', id: 'a1', wersja: wynik.analizaWpisu.wersja }, kontekst());
  for (const element of wynik.analizaWpisu.elementy) wynik = await repozytorium.wykonajOperacjeAnalizyWpisu({ rodzaj: 'review', id: 'a1', wersja: wynik.analizaWpisu.wersja, elementId: element.id, status: 'ACCEPTED' }, kontekst());
  wynik = await repozytorium.wykonajOperacjeAnalizyWpisu({ rodzaj: 'zakoncz', id: 'a1', wersja: wynik.analizaWpisu.wersja }, kontekst());
  wynik = await repozytorium.wykonajOperacjeAnalizyWpisu({ rodzaj: 'zastosuj', id: 'a1', wersja: wynik.analizaWpisu.wersja }, kontekst());
  const decyzja = (await repozytorium.pobierzDecyzje())[0];
  await repozytorium.wykonajOperacjeRealizacji({ rodzaj: 'obszar', id: 'o1', dane: { projektId: 'p1', nazwa: 'Dane', opis: '', status: 'ACTIVE' } }, kontekst());
  await repozytorium.wykonajOperacjeRealizacji({ rodzaj: 'etap', id: 'e1', dane: { projektId: 'p1', obszarId: 'o1', nazwa: 'Kopia', opis: '', kolejnosc: 0, status: 'PLANNED' } }, kontekst());
  await repozytorium.wykonajOperacjeRealizacji({ rodzaj: 'praca', id: 'r1', dane: { projektId: 'p1', obszarId: 'o1', etapId: 'e1', tytul: 'Zapisać kopię', opis: '', typ: 'TASK', status: 'TODO', decyzjaIds: [decyzja.id] } }, kontekst());
  const pytanie = wynik.analizaWpisu.elementy.find((element) => element.typ === 'OPEN_QUESTION')!;
  await repozytorium.wykonajOperacjeRealizacji({ rodzaj: 'konwertuj', id: 'q1', projektId: 'p1', analizaWpisuId: 'a1', elementAnalizyId: pytanie.id }, kontekst());
  await repozytorium.wykonajOperacjeRealizacji({ rodzaj: 'blokada', id: 'b1', dane: { projektId: 'p1', obszarId: 'o1', etapId: 'e1', tytul: 'Brak kopii', opis: '', status: 'ACTIVE', waga: 'HIGH' } }, kontekst());
  return { repozytorium, kopia: migrujKopie(odczytajKopie(JSON.stringify(await repozytorium.eksportujKopie()))) };
}

describe('Kopie zapasowe', () => {
  it('adapter v1 ↔ v2 zachowuje stare magazyny, provenance i import schemaVersion 1', async () => {
    const { kopia } = await przygotuj();
    const daneV1 = Object.fromEntries(Object.entries(kopia.data).filter(([nazwa]) => !['przebiegiAnaliz', 'korekty', 'propozycjeZmian', 'zestawyZmian', 'zdarzeniaDomenowe'].includes(nazwa)));
    const staraKopia = { ...kopia, schemaVersion: 1, data: daneV1 };
    const widok = kopiaDoWidokuV2(staraKopia);
    expect(widok.przebiegi[0].zgodnoscV1).toEqual(kopia.data.analizyWpisow[0]);
    const odtworzona = widokDoKopiiV1(JSON.parse(JSON.stringify(widok)));
    expect(odtworzona).toEqual(staraKopia);
    expect(() => sprawdzKopie(odtworzona)).not.toThrow();
    const repozytorium = utworzRepozytoriumIndexedDb(crypto.randomUUID());
    await repozytorium.importujKopie(odtworzona, 'zastap', true);
    const nowaKopia = await repozytorium.eksportujKopie();
    expect(nowaKopia.data.analizyWpisow).toEqual(kopia.data.analizyWpisow);
    expect(nowaKopia.data.przebiegiAnaliz[0]).toMatchObject({ status: 'LEGACY_IMPORTED', migrationSource: { kind: 'BACKUP_V1' } });
    widok.zrodla.pop();
    expect(() => widokDoKopiiV1(widok)).toThrow('bezstratnego');
    expect(() => kopiaDoWidokuV2({ ...kopia, schemaVersion: 2 })).toThrow();
  });
  it('eksportuje spójny obraz wszystkich 16 magazynów i odtwarza oryginały, historię oraz relacje', async () => {
    const { kopia } = await przygotuj();
    expect(nazwyMagazynow).toHaveLength(16);
    expect(Object.keys(kopia.data)).toEqual(nazwyMagazynow);
    for (const nazwa of nazwyMagazynow) {
      if (['korekty', 'propozycjeZmian', 'zestawyZmian', 'zdarzeniaDomenowe'].includes(nazwa)) expect(kopia.data[nazwa]).toEqual([]);
      else expect(kopia.data[nazwa].length, nazwa).toBeGreaterThan(0);
    }
    const nazwaBazy = crypto.randomUUID();
    await utworzRepozytoriumIndexedDb(nazwaBazy).importujKopie(kopia, 'polacz');
    const ponownie = utworzRepozytoriumIndexedDb(nazwaBazy);
    expect(odczytajKopie(JSON.stringify(await ponownie.eksportujKopie())).data).toEqual(kopia.data);
    expect((await ponownie.pobierzWpisy())[0].trescOryginalna).toBe(kopia.data.wpisy[0].trescOryginalna);
    expect((await ponownie.pobierzRealizacje()).pytania[0].pochodzenie?.wpisId).toBe('w1');
  });

  it('eksportuje pustą bazę i wymaga potwierdzenia także przy zastąpieniu pustą kopią', async () => {
    const pusta = await utworzRepozytoriumIndexedDb(crypto.randomUUID()).eksportujKopie();
    expect(pusta.data).toEqual(pusteDaneKopii());
    const { repozytorium, kopia } = await przygotuj();
    await expect(repozytorium.importujKopie(pusta, 'zastap')).rejects.toThrow('Potwierdź');
    expect(odczytajKopie(JSON.stringify(await repozytorium.eksportujKopie())).data).toEqual(kopia.data);
    await repozytorium.importujKopie(pusta, 'zastap', true);
    expect((await repozytorium.eksportujKopie()).data).toEqual(pusta.data);
  });

  it('odrzuca uszkodzony JSON, obcy format, nieobsługiwaną wersję i niepełną strukturę', async () => {
    const { repozytorium, kopia } = await przygotuj();
    expect(() => odczytajKopie('{')).toThrow('JSON');
    for (const uszkodzona of [null, [], { ...kopia, format: 'obcy' }, { ...kopia, schemaVersion: 4 }, { ...kopia, exportedAt: 'wczoraj' }, { ...kopia, data: {} }, { ...kopia, data: { ...kopia.data, wpisy: null } }]) {
      await expect(repozytorium.importujKopie(uszkodzona, 'zastap', true)).rejects.toBeTruthy();
    }
    expect(odczytajKopie(JSON.stringify(await repozytorium.eksportujKopie())).data).toEqual(kopia.data);
  });

  it('odrzuca błędne typy, statusy, brakujące ID i uszkodzone relacje przed zapisem', async () => {
    const { kopia } = await przygotuj();
    const zmiany = [
      (dane: typeof kopia.data) => { dane.projekty[0].id = ''; },
      (dane: typeof kopia.data) => { Object.assign(dane.elementyPracy[0], { wersja: '1' }); },
      (dane: typeof kopia.data) => { Object.assign(dane.wpisy[0], { status: 'OBCY' }); },
      (dane: typeof kopia.data) => { dane.wpisy[0].projektId = 'brak'; },
      (dane: typeof kopia.data) => { dane.etapy[0].obszarId = 'brak'; },
      (dane: typeof kopia.data) => { dane.elementyPracy[0].decyzjaIds = ['brak']; },
      (dane: typeof kopia.data) => { dane.pytania[0].pochodzenie!.elementAnalizyId = 'brak'; },
      (dane: typeof kopia.data) => { dane.analizyWpisow[0].elementy[0].historiaReview[0].czas = 'błąd'; },
      (dane: typeof kopia.data) => { dane.projekty.push(dane.projekty[0]); },
    ];
    for (const zmien of zmiany) {
      const uszkodzona = structuredClone(kopia); zmien(uszkodzona.data);
      expect(() => sprawdzKopie(uszkodzona)).toThrow();
    }
  });

  it('łączy nowe ID, pomija identyczne rekordy mimo innej kolejności pól, zachowuje obecne dane', async () => {
    const { repozytorium, kopia } = await przygotuj();
    const nowa = structuredClone(kopia);
    nowa.data.projekty[0] = Object.fromEntries(Object.entries(nowa.data.projekty[0]).reverse()) as typeof nowa.data.projekty[0];
    nowa.data.projekty.push(utworzProjekt('Nowy', 'p2', kontekst().czas));
    await repozytorium.importujKopie(nowa, 'polacz');
    await repozytorium.importujKopie(nowa, 'polacz');
    expect(odczytajKopie(JSON.stringify(await repozytorium.eksportujKopie())).data).toEqual(nowa.data);
  });

  it('pokazuje konflikt tego samego ID, nie nadpisuje i nie zapisuje nowych rekordów', async () => {
    const { repozytorium, kopia } = await przygotuj();
    const inna = structuredClone(kopia);
    inna.data.projekty[0].nazwa = 'Zmiana';
    inna.data.projekty.push(utworzProjekt('Nowy', 'p2', kontekst().czas));
    await expect(repozytorium.importujKopie(inna, 'polacz')).rejects.toMatchObject({ konflikty: [{ magazyn: 'projekty', id: 'p1' }] });
    await expect(repozytorium.importujKopie(inna, 'polacz')).rejects.toBeInstanceOf(BladKonfliktow);
    expect(odczytajKopie(JSON.stringify(await repozytorium.eksportujKopie())).data).toEqual(kopia.data);
    await repozytorium.importujKopie(inna, 'zastap', true);
    expect(odczytajKopie(JSON.stringify(await repozytorium.eksportujKopie())).data).toEqual(inna.data);
  });

  it('blokuje kolizję unikalnego numeru decyzji między różnymi ID podczas łączenia', async () => {
    const { repozytorium, kopia } = await przygotuj();
    const druga = structuredClone(kopia);
    druga.data.decyzje.push({ ...druga.data.decyzje[0], id: 'inna-decyzja', czytelneId: 'DEC-0002' });
    await repozytorium.importujKopie(druga, 'polacz');
    const kolizja = structuredClone(kopia);
    kolizja.data.decyzje.push({ ...kopia.data.decyzje[0], id: 'trzecia-decyzja', czytelneId: 'DEC-0002' });
    await expect(repozytorium.importujKopie(kolizja, 'polacz')).rejects.toThrow('unikalne');
    expect((await repozytorium.pobierzDecyzje()).map((decyzja) => decyzja.id)).not.toContain('trzecia-decyzja');
  });

  it('wycofuje usunięcia i wcześniejsze zapisy przy błędzie żądania w późniejszym magazynie', async () => {
    const { repozytorium, kopia } = await przygotuj();
    const nowa = structuredClone(kopia); nowa.data.projekty[0].nazwa = 'Nie może pozostać';
    const dodaj = IDBObjectStore.prototype.add;
    const przechwycenie = vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(function (this: IDBObjectStore, rekord, klucz) {
      if (this.name === 'pytania') dodaj.call(this, rekord, klucz);
      return dodaj.call(this, rekord, klucz);
    });
    try { await expect(repozytorium.importujKopie(nowa, 'zastap', true)).rejects.toThrow('Nie udało'); }
    finally { przechwycenie.mockRestore(); }
    expect(odczytajKopie(JSON.stringify(await repozytorium.eksportujKopie())).data).toEqual(kopia.data);
  });
});
