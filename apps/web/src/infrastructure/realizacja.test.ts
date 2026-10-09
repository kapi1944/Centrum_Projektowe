import { describe, expect, it } from 'vitest';
import type { KontekstZapisu } from '../domain/modele';
import { utworzProjekt, utworzWpis } from '../domain/operacje';
import { pustaRealizacja, type DaneElementuPracy, type OperacjaRealizacji } from '../domain/realizacja';
import type { DaneDecyzji } from '../domain/ustalenia';
import { RuleBasedAnalysisProvider } from './RuleBasedAnalysisProvider';
import { utworzRepozytoriumIndexedDb } from './repozytoriumIndexedDb';

function kontekst(idZdarzenia: string = crypto.randomUUID()): KontekstZapisu {
  return { idZdarzenia, czas: '2026-10-09T10:00:00Z', zrodlo: { typ: 'USER', nazwa: 'Użytkownik' } };
}
function danePracy(zmiany: Partial<DaneElementuPracy> = {}): DaneElementuPracy {
  return { projektId: 'p1', typ: 'RESEARCH', tytul: 'Sprawdzić możliwości', opis: 'Badanie przed decyzją', status: 'TODO', decyzjaIds: [], ...zmiany };
}
async function przygotuj() {
  const nazwaBazy = crypto.randomUUID();
  const repozytorium = utworzRepozytoriumIndexedDb(nazwaBazy);
  for (const id of ['p1', 'p2']) await repozytorium.dodajProjekt({ ...utworzProjekt(id, id, '2026-10-08T10:00:00Z'), nastepnyKrok: 'Ręcznie wskazany krok' }, kontekst());
  await repozytorium.dodajWpis(utworzWpis('  Trzeba sprawdzić zapis.\nCzy jest trwały?  ', 'p1', 'w1', '2026-10-08T10:00:00Z'), kontekst());
  for (const id of ['d1', 'd2']) {
    const dane: DaneDecyzji = { tytul: id, opis: 'Ustalenie', projektIds: ['p1'], typZrodla: 'USER', nazwaZrodla: 'Użytkownik', odniesienieZrodla: '', wpisZrodlowyId: 'w1', notatki: '', powiazaneElementy: [{ typ: 'TASK', id: 'dawny-odnosnik', tytul: 'Zachowany odnośnik' }] };
    await repozytorium.wykonajOperacjeUstalen({ rodzaj: 'utworz', id, dane }, kontekst());
  }
  const wykonaj = (operacja: OperacjaRealizacji) => repozytorium.wykonajOperacjeRealizacji(operacja, kontekst());
  async function zachowajAnalize() {
    const wpis = (await repozytorium.pobierzWpisy())[0];
    let wynik = await repozytorium.wykonajOperacjeAnalizyWpisu({ rodzaj: 'generuj', id: 'a1', wpisId: wpis.id, wynik: await new RuleBasedAnalysisProvider().analizuj(wpis.trescOryginalna) }, kontekst());
    wynik = await repozytorium.wykonajOperacjeAnalizyWpisu({ rodzaj: 'rozpocznij', id: 'a1', wersja: wynik.analizaWpisu.wersja }, kontekst());
    for (const element of wynik.analizaWpisu.elementy) wynik = await repozytorium.wykonajOperacjeAnalizyWpisu({ rodzaj: 'review', id: 'a1', wersja: wynik.analizaWpisu.wersja, elementId: element.id,
      status: element.typ === 'RECOMMENDED_ACTION' ? 'EDITED' : 'ACCEPTED', trescEdytowana: element.typ === 'RECOMMENDED_ACTION' ? 'Zatwierdzona korekta działania' : undefined }, kontekst());
    wynik = await repozytorium.wykonajOperacjeAnalizyWpisu({ rodzaj: 'zakoncz', id: 'a1', wersja: wynik.analizaWpisu.wersja }, kontekst());
    return repozytorium.wykonajOperacjeAnalizyWpisu({ rodzaj: 'zastosuj', id: 'a1', wersja: wynik.analizaWpisu.wersja }, kontekst());
  }
  return { nazwaBazy, repozytorium, wykonaj, zachowajAnalize };
}

describe('Realizacja projektu w IndexedDB', () => {
  it('zapisuje hierarchię projekt → obszar → etap → praca i odtwarza ją po ponownym otwarciu', async () => {
    const { repozytorium, wykonaj, nazwaBazy } = await przygotuj();
    await wykonaj({ rodzaj: 'obszar', id: 'o1', dane: { projektId: 'p1', nazwa: 'Dane', opis: 'Warstwa danych', status: 'ACTIVE' } });
    await wykonaj({ rodzaj: 'etap', id: 'e1', dane: { projektId: 'p1', obszarId: 'o1', nazwa: 'Próba', opis: '', status: 'IN_PROGRESS', kolejnosc: 2 } });
    await wykonaj({ rodzaj: 'praca', id: 'r1', dane: danePracy({ obszarId: 'o1', etapId: 'e1', typ: 'EXPERIMENT' }) });
    const stan = await utworzRepozytoriumIndexedDb(nazwaBazy).pobierzRealizacje();
    expect(stan.obszary[0]).toMatchObject({ id: 'o1', projektId: 'p1' });
    expect(stan.etapy[0]).toMatchObject({ id: 'e1', obszarId: 'o1', kolejnosc: 2 });
    expect(stan.elementyPracy[0]).toMatchObject({ id: 'r1', obszarId: 'o1', etapId: 'e1', typ: 'EXPERIMENT' });
    expect((await repozytorium.pobierzProjekty())[0].nastepnyKrok).toBe('Ręcznie wskazany krok');
  });

  it('pozwala na pracę bez obszaru i etapu, zapisuje ukończenie i blokuje utraconą edycję', async () => {
    const { repozytorium, wykonaj } = await przygotuj();
    await wykonaj({ rodzaj: 'praca', id: 'r1', dane: danePracy({ typ: 'WAITING', status: 'WAITING' }) });
    await wykonaj({ rodzaj: 'praca', id: 'r1', wersja: 1, dane: danePracy({ typ: 'WAITING', status: 'DONE' }) });
    await expect(wykonaj({ rodzaj: 'praca', id: 'r1', wersja: 1, dane: danePracy() })).rejects.toThrow('zmienił');
    expect((await repozytorium.pobierzRealizacje()).elementyPracy[0]).toMatchObject({ status: 'DONE', zakonczono: kontekst().czas, wersja: 2 });
    expect((await repozytorium.pobierzZdarzenia()).filter((zdarzenie) => zdarzenie.typEncji === 'WORK_ITEM').map((zdarzenie) => zdarzenie.typZdarzenia).sort()).toEqual(['WORK_ITEM_COMPLETED', 'WORK_ITEM_CREATED']);
  });

  it('utrzymuje relację wiele-do-wielu z decyzjami i pozwala ją edytować bez zmiany dawnych odnośników', async () => {
    const { repozytorium, wykonaj } = await przygotuj();
    const decyzje = await repozytorium.pobierzDecyzje();
    await wykonaj({ rodzaj: 'praca', id: 'r1', dane: danePracy({ decyzjaIds: ['d1', 'd2', 'd1'] }) });
    await wykonaj({ rodzaj: 'praca', id: 'r2', dane: danePracy({ decyzjaIds: ['d1', 'd2'] }) });
    let stan = await repozytorium.pobierzRealizacje();
    expect(stan.elementyPracy.map((praca) => praca.decyzjaIds)).toEqual([['d1', 'd2'], ['d1', 'd2']]);
    expect(stan.elementyPracy.filter((praca) => praca.decyzjaIds.includes('d1'))).toHaveLength(2);
    await wykonaj({ rodzaj: 'praca', id: 'r1', wersja: 1, dane: danePracy({ decyzjaIds: ['d2'] }) });
    stan = await repozytorium.pobierzRealizacje();
    expect(stan.elementyPracy.find((praca) => praca.id === 'r1')?.decyzjaIds).toEqual(['d2']);
    expect(await repozytorium.pobierzDecyzje()).toEqual(decyzje);
  });

  it('rozstrzyga osobne pytanie, wymaga odpowiedzi i zachowuje ją oraz datę', async () => {
    const { repozytorium, wykonaj } = await przygotuj();
    const dane = { projektId: 'p1', pytanie: 'Czy działa?', kontekst: 'Próba', status: 'OPEN' as const };
    await wykonaj({ rodzaj: 'pytanie', id: 'q1', dane });
    await expect(wykonaj({ rodzaj: 'pytanie', id: 'q1', wersja: 1, dane: { ...dane, status: 'ANSWERED' } })).rejects.toThrow('odpowiedź');
    await wykonaj({ rodzaj: 'pytanie', id: 'q1', wersja: 1, dane: { ...dane, status: 'ANSWERED', odpowiedz: 'Potwierdzono w próbie' } });
    await wykonaj({ rodzaj: 'pytanie', id: 'q2', dane: { ...dane, status: 'DISMISSED' } });
    expect((await repozytorium.pobierzRealizacje()).pytania[0]).toMatchObject({ status: 'ANSWERED', odpowiedz: 'Potwierdzono w próbie', rozstrzygnieto: kontekst().czas });
    expect((await repozytorium.pobierzZdarzenia()).filter((zdarzenie) => zdarzenie.typZdarzenia === 'QUESTION_RESOLVED')).toHaveLength(2);
  });

  it('tworzy i rozwiązuje blokadę bez historii każdej edycji oraz bez zmiany następnego kroku', async () => {
    const { repozytorium, wykonaj } = await przygotuj();
    const dane = { projektId: 'p1', tytul: 'Brak sprzętu', opis: 'Potrzebny do próby', status: 'ACTIVE' as const, waga: 'CRITICAL' as const };
    await wykonaj({ rodzaj: 'blokada', id: 'b1', dane });
    await wykonaj({ rodzaj: 'blokada', id: 'b1', wersja: 1, dane: { ...dane, opis: 'Doprecyzowany opis' } });
    await wykonaj({ rodzaj: 'blokada', id: 'b1', wersja: 2, dane: { ...dane, status: 'RESOLVED' } });
    expect((await repozytorium.pobierzRealizacje()).blokady[0]).toMatchObject({ status: 'RESOLVED', waga: 'CRITICAL', rozstrzygnieto: kontekst().czas });
    expect((await repozytorium.pobierzZdarzenia()).filter((zdarzenie) => zdarzenie.typEncji === 'BLOCKER').map((zdarzenie) => zdarzenie.typZdarzenia).sort()).toEqual(['BLOCKER_CREATED', 'BLOCKER_RESOLVED']);
    expect((await repozytorium.pobierzProjekty())[0].nastepnyKrok).toBe('Ręcznie wskazany krok');
  });

  it('konwertuje zachowane działanie po edycji i pytanie z pełnym pochodzeniem, bez ponownej analizy', async () => {
    const { repozytorium, wykonaj, zachowajAnalize } = await przygotuj();
    await zachowajAnalize();
    const analizyPrzed = await repozytorium.pobierzAnalizyWpisow();
    const wpisyPrzed = await repozytorium.pobierzWpisy();
    await wykonaj({ rodzaj: 'konwertuj', id: 'r1', projektId: 'p1', analizaWpisuId: 'a1', elementAnalizyId: 'a1:1', typPracy: 'RESEARCH' });
    await wykonaj({ rodzaj: 'konwertuj', id: 'q1', projektId: 'p1', analizaWpisuId: 'a1', elementAnalizyId: 'a1:2' });
    const stan = await repozytorium.pobierzRealizacje();
    expect(stan.elementyPracy[0]).toMatchObject({ typ: 'RESEARCH', tytul: 'Zatwierdzona korekta działania', pochodzenie: { analizaWpisuId: 'a1', elementAnalizyId: 'a1:1', wpisId: 'w1' } });
    expect(stan.pytania[0]).toMatchObject({ pytanie: 'Czy jest trwały?', pochodzenie: { analizaWpisuId: 'a1', elementAnalizyId: 'a1:2', wpisId: 'w1' } });
    await wykonaj({ rodzaj: 'praca', id: 'r1', wersja: 1, dane: danePracy({ status: 'DONE' }) });
    expect((await repozytorium.pobierzRealizacje()).elementyPracy[0].pochodzenie).toEqual(stan.elementyPracy[0].pochodzenie);
    expect(await repozytorium.pobierzAnalizyWpisow()).toEqual(analizyPrzed);
    expect(await repozytorium.pobierzWpisy()).toEqual(wpisyPrzed);
  });

  it('blokuje podwójną konwersję z dwóch kart, także pod innym identyfikatorem', async () => {
    const { repozytorium, zachowajAnalize, nazwaBazy } = await przygotuj();
    await zachowajAnalize();
    const operacja = { rodzaj: 'konwertuj', projektId: 'p1', analizaWpisuId: 'a1', elementAnalizyId: 'a1:1' } as const;
    const wyniki = await Promise.allSettled([
      repozytorium.wykonajOperacjeRealizacji({ ...operacja, id: 'r1' }, kontekst()),
      utworzRepozytoriumIndexedDb(nazwaBazy).wykonajOperacjeRealizacji({ ...operacja, id: 'r2' }, kontekst()),
    ]);
    expect(wyniki.filter((wynik) => wynik.status === 'fulfilled')).toHaveLength(1);
    expect((await repozytorium.pobierzRealizacje()).elementyPracy).toHaveLength(1);
  });

  it('odrzuca obce relacje, przeniesienie zajętego etapu i zapis w archiwalnym projekcie', async () => {
    const { repozytorium, wykonaj } = await przygotuj();
    await wykonaj({ rodzaj: 'obszar', id: 'o2', dane: { projektId: 'p2', nazwa: 'Obcy', opis: '', status: 'ACTIVE' } });
    await expect(wykonaj({ rodzaj: 'praca', id: 'r1', dane: danePracy({ obszarId: 'o2' }) })).rejects.toThrow('nie należy');
    await expect(wykonaj({ rodzaj: 'praca', id: 'r1', dane: danePracy({ projektId: 'p2', decyzjaIds: ['d1'] }) })).rejects.toThrow('decyzja');
    const etap = { projektId: 'p1', nazwa: 'Etap', opis: '', status: 'PLANNED' as const, kolejnosc: 0 };
    await wykonaj({ rodzaj: 'etap', id: 'e1', dane: etap });
    await wykonaj({ rodzaj: 'praca', id: 'r1', dane: danePracy({ etapId: 'e1' }) });
    await wykonaj({ rodzaj: 'obszar', id: 'o1', dane: { projektId: 'p1', nazwa: 'Własny', opis: '', status: 'ACTIVE' } });
    await expect(wykonaj({ rodzaj: 'etap', id: 'e1', wersja: 1, dane: { ...etap, obszarId: 'o1' } })).rejects.toThrow('powiązane elementy');
    await expect(wykonaj({ rodzaj: 'praca', id: 'r2', dane: danePracy({ obszarId: 'o1', etapId: 'e1' }) })).rejects.toThrow('Etap');
    await repozytorium.zmienProjekt('p1', { rodzaj: 'archiwizacja' }, kontekst());
    await expect(wykonaj({ rodzaj: 'praca', id: 'r3', dane: danePracy() })).rejects.toThrow('niearchiwalny');
  });

  it('wycofuje rekord, relacje i aktywność projektu po błędzie zapisu historii, pozwalając ponowić konwersję', async () => {
    const { repozytorium, zachowajAnalize } = await przygotuj();
    await zachowajAnalize();
    const projektyPrzed = await repozytorium.pobierzProjekty();
    const historiaPrzed = await repozytorium.pobierzZdarzenia();
    const operacja = { rodzaj: 'konwertuj', id: 'r1', projektId: 'p1', analizaWpisuId: 'a1', elementAnalizyId: 'a1:1' } as const;
    await expect(repozytorium.wykonajOperacjeRealizacji(operacja, { ...kontekst(historiaPrzed[0].id), czas: '2026-10-10T10:00:00Z' })).rejects.toThrow();
    expect(await repozytorium.pobierzRealizacje()).toEqual(pustaRealizacja);
    expect(await repozytorium.pobierzProjekty()).toEqual(projektyPrzed);
    expect(await repozytorium.pobierzZdarzenia()).toEqual(historiaPrzed);
    await repozytorium.wykonajOperacjeRealizacji(operacja, kontekst());
    expect((await repozytorium.pobierzRealizacje()).elementyPracy).toHaveLength(1);
  });

  it('migracja v4 → v5 zachowuje wszystkie sześć dawnych magazynów, analizy i ręczne odnośniki', async () => {
    const { repozytorium, zachowajAnalize } = await przygotuj();
    await zachowajAnalize();
    await repozytorium.wykonajOperacjeUstalen({ rodzaj: 'analizuj', zrodlo: { typ: 'CAPTURE', id: 'w1' } }, kontekst());
    const dawne = {
      projekty: await repozytorium.pobierzProjekty(), wpisy: await repozytorium.pobierzWpisy(), zdarzenia: await repozytorium.pobierzZdarzenia(),
      decyzje: await repozytorium.pobierzDecyzje(), analizyWplywu: await repozytorium.pobierzAnalizyWplywu(), analizyWpisow: await repozytorium.pobierzAnalizyWpisow(),
    };
    const nazwaBazy = crypto.randomUUID();
    await new Promise<void>((rozwiaz, odrzuc) => {
      const zadanie = indexedDB.open(nazwaBazy, 4);
      zadanie.onupgradeneeded = () => {
        for (const [nazwa, rekordy] of Object.entries(dawne)) {
          const magazyn = zadanie.result.createObjectStore(nazwa, { keyPath: 'id' });
          if (nazwa === 'decyzje') { magazyn.createIndex('czytelneId', 'czytelneId', { unique: true }); magazyn.createIndex('projektIds', 'projektIds', { multiEntry: true }); }
          if (nazwa === 'analizyWpisow') magazyn.createIndex('wpisId', 'wpisId', { unique: true });
          for (const rekord of rekordy) magazyn.add(rekord);
        }
      };
      zadanie.onerror = () => odrzuc(zadanie.error);
      zadanie.onsuccess = () => { zadanie.result.close(); rozwiaz(); };
    });
    const poMigracji = utworzRepozytoriumIndexedDb(nazwaBazy);
    expect(await poMigracji.pobierzRealizacje()).toEqual(pustaRealizacja);
    expect(await poMigracji.pobierzProjekty()).toEqual(dawne.projekty);
    expect(await poMigracji.pobierzWpisy()).toEqual(dawne.wpisy);
    expect(await poMigracji.pobierzZdarzenia()).toEqual(dawne.zdarzenia);
    expect(await poMigracji.pobierzDecyzje()).toEqual(dawne.decyzje);
    expect(await poMigracji.pobierzAnalizyWplywu()).toEqual(dawne.analizyWplywu);
    expect(await poMigracji.pobierzAnalizyWpisow()).toEqual(dawne.analizyWpisow);
    await poMigracji.wykonajOperacjeRealizacji({ rodzaj: 'konwertuj', id: 'r1', projektId: 'p1', analizaWpisuId: 'a1', elementAnalizyId: 'a1:1' }, kontekst());
    expect((await poMigracji.pobierzRealizacje()).elementyPracy).toHaveLength(1);
  });
});
