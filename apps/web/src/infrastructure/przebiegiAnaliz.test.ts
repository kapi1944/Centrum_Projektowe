import { describe, expect, it, vi } from 'vitest';
import type { KopiaZapasowaV1 } from '../domain/kopieZapasowe';
import { odczytajKopie, sprawdzKopie } from '../domain/kopieZapasowe';
import { utworzProjekt, utworzWpis } from '../domain/operacje';
import { uruchomAnalizeWpisu } from '../application/przypadkiUzycia';
import { utworzRepozytoriumIndexedDb } from './repozytoriumIndexedDb';
import { RuleBasedAnalysisProvider } from './RuleBasedAnalysisProvider';

const czas = '2026-10-09T10:00:00Z';
function kontekst() { return { idZdarzenia: crypto.randomUUID(), czas, zrodlo: { typ: 'USER' as const, nazwa: 'Użytkownik' } }; }
function staraKopia(): KopiaZapasowaV1 {
  return { format: 'centrum-projektowe', schemaVersion: 1, appVersion: '0.0.0', exportedAt: czas, data: {
    projekty: [utworzProjekt('Dawny projekt', 'p1', czas)],
    wpisy: [{ ...utworzWpis('  Decyduję: oryginał.\nTrzeba sprawdzić dane.  ', 'p1', 'w1', czas), status: 'APPLIED' }],
    analizyWpisow: [{ id: 'a1', wpisId: 'w1', utworzono: czas, status: 'APPLIED', wersja: 6, sprawdzono: czas, zastosowano: czas,
      typDostawcy: 'RULE_BASED', nazwaDostawcy: 'Dawne reguły', wersjaDostawcy: '1', wersjaAnalizy: '1', elementy: [
        { id: 'a1:1', typ: 'POSSIBLE_DECISION', tresc: 'Oryginalna decyzja', trescOryginalna: 'Oryginalna decyzja', trescEdytowana: 'Korekta użytkownika',
          zrodlo: 'SYSTEM', statusReview: 'EDITED', historiaReview: [{ status: 'EDITED', trescEdytowana: 'Korekta użytkownika', czas, zrodlo: kontekst().zrodlo }],
          zastosowanie: { czas, rodzaj: 'DECISION', encjaId: 'd1', projektId: 'p1' } },
        { id: 'a1:2', typ: 'RECOMMENDED_ACTION', tresc: 'Praca', trescOryginalna: 'Praca', zrodlo: 'SYSTEM', statusReview: 'ACCEPTED',
          historiaReview: [{ status: 'ACCEPTED', czas, zrodlo: kontekst().zrodlo }], zastosowanie: { czas, rodzaj: 'RETAINED' } },
        { id: 'a1:3', typ: 'FACT', tresc: 'Odrzucone', trescOryginalna: 'Odrzucone', zrodlo: 'SYSTEM', statusReview: 'REJECTED',
          historiaReview: [{ status: 'REJECTED', czas, zrodlo: kontekst().zrodlo }] },
      ] }],
    decyzje: [{ id: 'd1', czytelneId: 'DEC-0001', tytul: 'Korekta użytkownika', opis: 'Korekta użytkownika', projektIds: ['p1'], status: 'PROPOSED',
      utworzono: czas, zaktualizowano: czas, wersja: 1, zastapionaPrzezId: null, typZrodla: 'SYSTEM', nazwaZrodla: 'Dawne reguły',
      odniesienieZrodla: 'a1', wpisZrodlowyId: 'w1', analizaWpisuId: 'a1', elementAnalizyId: 'a1:1', notatki: '', powiazaneElementy: [] }],
    elementyPracy: [{ id: 'r1', projektId: 'p1', tytul: 'Praca', opis: '', typ: 'TASK', status: 'TODO', decyzjaIds: ['d1'],
      utworzono: czas, zaktualizowano: czas, wersja: 1, pochodzenie: { wpisId: 'w1', analizaWpisuId: 'a1', elementAnalizyId: 'a1:2' } }],
    zdarzenia: [{ id: 'z1', projektId: 'p1', encjaId: 'w1', typEncji: 'CAPTURE', typZdarzenia: 'CAPTURE_ANALYSIS_APPLIED',
      tytul: 'Dawna historia', utworzono: czas, zrodlo: kontekst().zrodlo }],
    analizyWplywu: [], obszary: [], etapy: [], pytania: [], blokady: [],
  } };
}

async function zapiszV5(nazwaBazy: string, kopia = staraKopia()) {
  sprawdzKopie(kopia);
  await new Promise<void>((rozwiaz, odrzuc) => {
    const zadanie = indexedDB.open(nazwaBazy, 5);
    zadanie.onupgradeneeded = () => {
      for (const [nazwa, rekordy] of Object.entries(kopia.data)) {
        const magazyn = zadanie.result.createObjectStore(nazwa, { keyPath: 'id' });
        if (nazwa === 'decyzje') { magazyn.createIndex('czytelneId', 'czytelneId', { unique: true }); magazyn.createIndex('projektIds', 'projektIds', { multiEntry: true }); }
        if (nazwa === 'analizyWpisow') magazyn.createIndex('wpisId', 'wpisId', { unique: true });
        if (['obszary', 'etapy', 'elementyPracy', 'pytania', 'blokady'].includes(nazwa)) magazyn.createIndex('projektId', 'projektId');
        if (nazwa === 'elementyPracy') magazyn.createIndex('decyzjaIds', 'decyzjaIds', { multiEntry: true });
        if (['elementyPracy', 'pytania'].includes(nazwa)) magazyn.createIndex('elementZrodlowy', ['pochodzenie.analizaWpisuId', 'pochodzenie.elementAnalizyId'], { unique: true });
        for (const rekord of rekordy) magazyn.add(rekord);
      }
    };
    zadanie.onerror = () => odrzuc(zadanie.error);
    zadanie.onsuccess = () => { zadanie.result.close(); rozwiaz(); };
  });
}
async function sprawdzSchemat(nazwaBazy: string, wersja: number) {
  return new Promise<{ wersja: number; unikalnyWpis: boolean; indeksZrodla?: boolean; magazyny: string[] }>((rozwiaz, odrzuc) => {
    const zadanie = indexedDB.open(nazwaBazy, wersja);
    zadanie.onerror = () => odrzuc(zadanie.error);
    zadanie.onsuccess = () => {
      const baza = zadanie.result;
      const wynik = { wersja: baza.version, unikalnyWpis: baza.transaction('analizyWpisow').objectStore('analizyWpisow').index('wpisId').unique,
        magazyny: [...baza.objectStoreNames], indeksZrodla: baza.objectStoreNames.contains('przebiegiAnaliz')
          ? baza.transaction('przebiegiAnaliz').objectStore('przebiegiAnaliz').index('sourceId').unique : undefined };
      baza.close(); rozwiaz(wynik);
    };
  });
}
async function przygotuj() {
  const repozytorium = utworzRepozytoriumIndexedDb(crypto.randomUUID());
  await repozytorium.importujKopie(staraKopia(), 'zastap', true);
  return repozytorium;
}
async function generuj(repozytorium: ReturnType<typeof utworzRepozytoriumIndexedDb>, id: string) {
  return repozytorium.wykonajOperacjeAnalizyWpisu({ rodzaj: 'generuj', id, wpisId: 'w1',
    wynik: await new RuleBasedAnalysisProvider().analizuj(staraKopia().data.wpisy[0].trescOryginalna) }, kontekst());
}

describe('Wersjonowane przebiegi analiz', () => {
  it('migruje v5 → v6 bez zmiany review, źródła, historii i provenance decyzji oraz realizacji', async () => {
    const nazwaBazy = crypto.randomUUID(); const kopia = staraKopia();
    await zapiszV5(nazwaBazy, kopia);
    const repozytorium = utworzRepozytoriumIndexedDb(nazwaBazy);
    const nowa = await repozytorium.eksportujKopie();
    const { przebiegiAnaliz, ...dawne } = nowa.data;
    expect(dawne).toEqual(kopia.data);
    expect(przebiegiAnaliz).toEqual([expect.objectContaining({ id: 'a1', sourceId: 'w1', sourceType: 'CAPTURE', status: 'LEGACY_IMPORTED',
      reviewStatus: 'APPLIED', startedAt: null, finishedAt: null, preferred: true, createdAt: czas,
      migrationSource: { kind: 'INDEXEDDB_V5', legacyAnalysisId: 'a1' } })]);
    expect(przebiegiAnaliz[0]).not.toHaveProperty('model'); expect(przebiegiAnaliz[0]).not.toHaveProperty('promptVersion');
    expect(przebiegiAnaliz[0].output?.elementy[0].tresc).toBe('Oryginalna decyzja');
    expect(await sprawdzSchemat(nazwaBazy, 6)).toMatchObject({ wersja: 6, unikalnyWpis: false, indeksZrodla: false });
    expect((await utworzRepozytoriumIndexedDb(nazwaBazy).eksportujKopie()).data).toEqual(nowa.data);
  });

  it('zachowuje wiele runów jednego źródła i dokładnie jedną preferowaną analizę przy równoczesnym zapisie', async () => {
    const repozytorium = await przygotuj();
    await Promise.all([generuj(repozytorium, 'a2'), generuj(repozytorium, 'a3')]);
    const przebiegi = await repozytorium.pobierzPrzebiegiAnaliz();
    expect(przebiegi).toHaveLength(3);
    expect(przebiegi.every((przebieg) => przebieg.sourceId === 'w1')).toBe(true);
    expect(przebiegi.filter((przebieg) => przebieg.preferred).map((przebieg) => przebieg.id)).toEqual(['a1']);
    expect(przebiegi.find((przebieg) => przebieg.id === 'a2')).toMatchObject({ status: 'SUCCEEDED', reviewStatus: 'GENERATED' });
    expect((await repozytorium.pobierzAnalizyWpisow()).find((analiza) => analiza.id === 'a1')).toEqual(staraKopia().data.analizyWpisow[0]);
    expect((await repozytorium.pobierzWpisy())[0]).toEqual(staraKopia().data.wpisy[0]);
  });

  it('zmienia preferred atomowo, audytuje zmianę i blokuje wybór z nieaktualnej karty', async () => {
    const repozytorium = await przygotuj(); await generuj(repozytorium, 'a2'); await generuj(repozytorium, 'a3');
    const przed = await repozytorium.eksportujKopie();
    const wyniki = await Promise.allSettled(['a2', 'a3'].map((id) => repozytorium.wykonajOperacjePrzebiegu({ rodzaj: 'preferuj', id, poprzedniId: 'a1' }, kontekst())));
    expect(wyniki.map((wynik) => wynik.status).sort()).toEqual(['fulfilled', 'rejected']);
    const po = await repozytorium.eksportujKopie();
    expect(po.data.przebiegiAnaliz.filter((przebieg) => przebieg.preferred)).toHaveLength(1);
    expect(po.data.wpisy).toEqual(przed.data.wpisy); expect(po.data.analizyWpisow).toEqual(przed.data.analizyWpisow);
    expect(po.data.decyzje).toEqual(przed.data.decyzje); expect(po.data.elementyPracy).toEqual(przed.data.elementyPracy);
    expect(po.data.zdarzenia.filter((zdarzenie) => zdarzenie.typZdarzenia === 'ANALYSIS_PREFERRED_CHANGED')).toHaveLength(1);
  });

  it('błąd zapisu historii wycofuje oba markery preferred, nie pozostawia częściowego wyboru', async () => {
    const repozytorium = await przygotuj(); await generuj(repozytorium, 'a2');
    const przed = await repozytorium.eksportujKopie();
    await expect(repozytorium.wykonajOperacjePrzebiegu({ rodzaj: 'preferuj', id: 'a2', poprzedniId: 'a1' }, { ...kontekst(), idZdarzenia: 'z1' })).rejects.toThrow('Nie udało');
    expect((await repozytorium.eksportujKopie()).data).toEqual(przed.data);
  });

  it('błąd podczas upgrade wycofuje magazyn, zmianę indeksu i dane; można ponowić migrację', async () => {
    const nazwaBazy = crypto.randomUUID(); await zapiszV5(nazwaBazy);
    const dodaj = IDBObjectStore.prototype.add;
    const przechwycenie = vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(function (this: IDBObjectStore, rekord, klucz) {
      if (this.name === 'przebiegiAnaliz') dodaj.call(this, rekord, klucz);
      return dodaj.call(this, rekord, klucz);
    });
    try { await expect(utworzRepozytoriumIndexedDb(nazwaBazy).pobierzPrzebiegiAnaliz()).rejects.toThrow('otworzyć'); }
    finally { przechwycenie.mockRestore(); }
    const schemat = await sprawdzSchemat(nazwaBazy, 5);
    expect(schemat).toMatchObject({ wersja: 5, unikalnyWpis: true }); expect(schemat.magazyny).not.toContain('przebiegiAnaliz');
    const nowa = await utworzRepozytoriumIndexedDb(nazwaBazy).eksportujKopie();
    expect(nowa.data.analizyWpisow).toEqual(staraKopia().data.analizyWpisow);
    expect(nowa.data.przebiegiAnaliz).toHaveLength(1);
  });

  it('przechodzi round-trip backup v1 → import/migracja → eksport v2 → ponowny import', async () => {
    const kopia = staraKopia(); expect(() => sprawdzKopie(kopia)).not.toThrow();
    const repozytorium = utworzRepozytoriumIndexedDb(crypto.randomUUID());
    await repozytorium.importujKopie(JSON.parse(JSON.stringify(kopia)), 'zastap', true);
    const nowa = odczytajKopie(JSON.stringify(await repozytorium.eksportujKopie()));
    expect(nowa.schemaVersion).toBe(2);
    if (nowa.schemaVersion !== 2) throw new Error('Eksporter musi zapisać format v2.');
    expect(nowa.data.przebiegiAnaliz[0].migrationSource?.kind).toBe('BACKUP_V1');
    const { przebiegiAnaliz, ...zachowane } = nowa.data;
    expect(zachowane).toEqual(kopia.data); expect(przebiegiAnaliz[0].reviewStatus).toBe('APPLIED');
    await generuj(repozytorium, 'a2');
    const zWieloma = odczytajKopie(JSON.stringify(await repozytorium.eksportujKopie()));
    const drugi = utworzRepozytoriumIndexedDb(crypto.randomUUID());
    await drugi.importujKopie(zWieloma, 'zastap', true);
    expect((await drugi.eksportujKopie()).data).toEqual(zWieloma.data);
  });

  it('blokuje uszkodzone relacje, wynik, review, czasy, cykle i dwa preferred przed importem', async () => {
    const repozytorium = await przygotuj(); await generuj(repozytorium, 'a2');
    const kopia = await repozytorium.eksportujKopie();
    const zmiany = [
      (nowa: typeof kopia) => { nowa.data.przebiegiAnaliz[1] = { ...nowa.data.przebiegiAnaliz[1], preferred: true }; },
      (nowa: typeof kopia) => { nowa.data.przebiegiAnaliz = nowa.data.przebiegiAnaliz.map((przebieg) => ({ ...przebieg, preferred: false })); },
      (nowa: typeof kopia) => { nowa.data.przebiegiAnaliz[0] = { ...nowa.data.przebiegiAnaliz[0], sourceId: 'brak' }; },
      (nowa: typeof kopia) => { nowa.data.przebiegiAnaliz[0] = { ...nowa.data.przebiegiAnaliz[0], reviewStatus: 'GENERATED' }; },
      (nowa: typeof kopia) => { nowa.data.przebiegiAnaliz[0].output!.elementy[0].tresc = 'Podmieniony wynik'; },
      (nowa: typeof kopia) => { Object.assign(nowa.data.przebiegiAnaliz[1], { finishedAt: '2026-01-01T00:00:00Z' }); },
      (nowa: typeof kopia) => { nowa.data.przebiegiAnaliz[0] = { ...nowa.data.przebiegiAnaliz[0], supersedesAnalysisRunId: 'a2' }; nowa.data.przebiegiAnaliz[1] = { ...nowa.data.przebiegiAnaliz[1], supersedesAnalysisRunId: 'a1' }; },
    ];
    for (const zmien of zmiany) {
      const uszkodzona = structuredClone(kopia); zmien(uszkodzona);
      await expect(repozytorium.importujKopie(uszkodzona, 'zastap', true)).rejects.toBeTruthy();
      expect((await repozytorium.eksportujKopie()).data).toEqual(kopia.data);
    }
  });

  it('łączenie starej kopii z już zmigrowaną bazą zachowuje run, późniejszą preferencję i konflikty review', async () => {
    const nazwaBazy = crypto.randomUUID(); const kopia = staraKopia(); await zapiszV5(nazwaBazy, kopia);
    const repozytorium = utworzRepozytoriumIndexedDb(nazwaBazy);
    await generuj(repozytorium, 'a2');
    await repozytorium.wykonajOperacjePrzebiegu({ rodzaj: 'preferuj', id: 'a2', poprzedniId: 'a1' }, kontekst());
    const przed = await repozytorium.eksportujKopie();
    const odczytana = odczytajKopie(JSON.stringify(kopia));
    expect(odczytana.schemaVersion).toBe(1);
    await repozytorium.importujKopie(odczytana, 'polacz');
    expect((await repozytorium.eksportujKopie()).data).toEqual(przed.data);
    kopia.data.analizyWpisow[0].elementy[0].trescEdytowana = 'Inna dawna korekta';
    await expect(repozytorium.importujKopie(kopia, 'polacz')).rejects.toThrow('konflikty');
    expect((await repozytorium.eksportujKopie()).data).toEqual(przed.data);
  });

  it('błąd historii przy zakończeniu runu wycofuje wynik i review, pozostawiając trwały RUNNING', async () => {
    const repozytorium = await przygotuj(); const dostawca = new RuleBasedAnalysisProvider();
    await repozytorium.wykonajOperacjePrzebiegu({ rodzaj: 'rozpocznij', id: 'a2', wpisId: 'w1', provider: dostawca.pochodzenie }, kontekst());
    const przed = await repozytorium.eksportujKopie();
    await expect(repozytorium.wykonajOperacjeAnalizyWpisu({ rodzaj: 'generuj', id: 'a2', wpisId: 'w1',
      wynik: await dostawca.analizuj(staraKopia().data.wpisy[0].trescOryginalna) }, { ...kontekst(), idZdarzenia: 'z1' })).rejects.toThrow('Nie udało');
    expect((await repozytorium.eksportujKopie()).data).toEqual(przed.data);
    await generuj(repozytorium, 'a2');
    expect((await repozytorium.pobierzPrzebiegiAnaliz()).find((przebieg) => przebieg.id === 'a2')?.status).toBe('SUCCEEDED');
  });

  it('trwale zapisuje RUNNING i FAILED bez utraty oryginału, wyniku i dotychczasowej preferencji', async () => {
    const repozytorium = await przygotuj(); const wpis = (await repozytorium.pobierzWpisy())[0];
    const dostawca = new RuleBasedAnalysisProvider();
    const przed = await repozytorium.eksportujKopie();
    vi.spyOn(dostawca, 'analizuj').mockImplementationOnce(async () => {
      const trwajacy = (await repozytorium.pobierzPrzebiegiAnaliz()).find((przebieg) => przebieg.status === 'RUNNING');
      expect(trwajacy).toMatchObject({ startedAt: czas, finishedAt: null, reviewStatus: 'NOT_STARTED', output: null, preferred: false });
      throw new Error('Awaria dostawcy');
    });
    await expect(uruchomAnalizeWpisu(repozytorium, wpis, dostawca, kontekst)).rejects.toThrow('Awaria dostawcy');
    const po = await repozytorium.eksportujKopie();
    expect(po.data.wpisy).toEqual(przed.data.wpisy); expect(po.data.analizyWpisow).toEqual(przed.data.analizyWpisow);
    const nieudany = po.data.przebiegiAnaliz.find((przebieg) => przebieg.status === 'FAILED')!;
    expect(nieudany).toMatchObject({ preferred: false, reviewStatus: 'NOT_STARTED', output: null, finishedAt: czas });
    await expect(repozytorium.wykonajOperacjePrzebiegu({ rodzaj: 'preferuj', id: nieudany.id, poprzedniId: 'a1' }, kontekst())).rejects.toThrow('zakończony');
    const drugi = utworzRepozytoriumIndexedDb(crypto.randomUUID()); await drugi.importujKopie(po, 'zastap', true);
    expect((await drugi.eksportujKopie()).data).toEqual(po.data);
  });

  it('wynik dostawcy po restore nie odtwarza usuniętego runu ani nie analizuje zmienionego źródła', async () => {
    const repozytorium = await przygotuj(); const wpis = (await repozytorium.pobierzWpisy())[0];
    const dostawca = new RuleBasedAnalysisProvider(); const analizuj = dostawca.analizuj.bind(dostawca);
    vi.spyOn(dostawca, 'analizuj').mockImplementationOnce(async (tresc) => {
      const kopia = staraKopia();
      Object.assign(kopia.data.wpisy[0], { trescOryginalna: 'Inne źródło odtworzone podczas pracy dostawcy.' });
      await repozytorium.importujKopie(kopia, 'zastap', true);
      return analizuj(tresc);
    });
    await expect(uruchomAnalizeWpisu(repozytorium, wpis, dostawca, kontekst)).rejects.toThrow('Rozpoczęty przebieg');
    expect(await repozytorium.pobierzPrzebiegiAnaliz()).toHaveLength(1);
    expect(await repozytorium.pobierzAnalizyWpisow()).toEqual(staraKopia().data.analizyWpisow);
  });
});
