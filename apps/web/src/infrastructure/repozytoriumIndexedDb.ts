import { nazwyMagazynow, pusteDaneKopii, migrujKopie, sprawdzDaneKopii, polaczDane, schematDanych, type DaneKopii } from '../domain/kopieZapasowe';
import daneAplikacji from '../../package.json';
import type { Projekt, Wpis, ZdarzenieAktywnosci } from '../domain/modele';
import { przygotujAkcjeWpisu, utworzProjekt, utworzWpis, zdarzenieUtworzenia, zmienProjekt } from '../domain/operacje';
import type { RepozytoriumProjektowe } from '../domain/repozytorium';
import { wykonajOperacjeUstalen, type AnalizaWplywu, type Decyzja, type StanUstalen } from '../domain/ustalenia';
import { wykonajAnalizeWpisu, type AnalizaWpisu } from '../domain/analizaWpisu';
import { wykonajRealizacje, type StanRealizacji } from '../domain/realizacja';
import { utworzJednostkePracyIndexedDb } from './jednostkaPracyIndexedDb';
import { aktualizujPunktPowrotu, zapiszNowyWpis } from '../application/przypadkiUzycia';
import { migrujAnalize, wykonajOperacjePrzebiegu, type PrzebiegAnalizyWpisu } from '../domain/przebiegiAnaliz';
import { wykonajKorekte } from '../domain/korekty';

export function utworzRepozytoriumIndexedDb(
  nazwaBazy = 'centrum-projektowe',
): RepozytoriumProjektowe {
  async function otworzBaze(): Promise<IDBDatabase> {
    return new Promise((rozwiaz, odrzuc) => {
      if (!globalThis.indexedDB) {
        odrzuc(new Error('Ta przeglądarka nie udostępnia IndexedDB.'));
        return;
      }
      const zadanie = indexedDB.open(nazwaBazy, 7);
      let zablokowano = false;
      zadanie.onupgradeneeded = (zdarzenie) => {
        const baza = zadanie.result;
        if (zdarzenie.oldVersion < 7) {
          for (const nazwa of ['korekty', 'propozycjeZmian', 'zestawyZmian', 'zdarzeniaDomenowe']) baza.createObjectStore(nazwa, { keyPath: 'id' });
        }
        if (zdarzenie.oldVersion === 0) {
          baza.createObjectStore('projekty', { keyPath: 'id' });
          baza.createObjectStore('wpisy', { keyPath: 'id' });
        }
        if (zdarzenie.oldVersion < 2) baza.createObjectStore('zdarzenia', { keyPath: 'id' });
        if (zdarzenie.oldVersion < 3) {
          const decyzje = baza.createObjectStore('decyzje', { keyPath: 'id' });
          decyzje.createIndex('czytelneId', 'czytelneId', { unique: true });
          decyzje.createIndex('projektIds', 'projektIds', { multiEntry: true });
          baza.createObjectStore('analizyWplywu', { keyPath: 'id' });
        }
        if (zdarzenie.oldVersion < 4) {
          const analizy = baza.createObjectStore('analizyWpisow', { keyPath: 'id' });
          analizy.createIndex('wpisId', 'wpisId', { unique: true });
        }
        if (zdarzenie.oldVersion < 5) {
          for (const nazwa of ['obszary', 'etapy', 'elementyPracy', 'pytania', 'blokady']) {
            const magazyn = baza.createObjectStore(nazwa, { keyPath: 'id' });
            magazyn.createIndex('projektId', 'projektId');
            if (nazwa === 'elementyPracy') magazyn.createIndex('decyzjaIds', 'decyzjaIds', { multiEntry: true });
            if (nazwa === 'elementyPracy' || nazwa === 'pytania') magazyn.createIndex('elementZrodlowy', ['pochodzenie.analizaWpisuId', 'pochodzenie.elementAnalizyId'], { unique: true });
          }
        }
        if (zdarzenie.oldVersion === 1) {
          const transakcja = zadanie.transaction!;
          const projekty = transakcja.objectStore('projekty').openCursor();
          projekty.onsuccess = () => {
            const kursor = projekty.result;
            if (!kursor) { przeniesWpisy(); return; }
            const poprzedni = kursor.value as { id: string; nazwa: string; utworzono: string };
            kursor.update(utworzProjekt(poprzedni.nazwa, poprzedni.id, poprzedni.utworzono));
            kursor.continue();
          };
          function przeniesWpisy() {
            const wpisy = transakcja.objectStore('wpisy').openCursor();
            wpisy.onsuccess = () => {
              const kursor = wpisy.result;
              if (!kursor) return;
              const poprzedni = kursor.value as { id: string; trescOryginalna: string; projektId: string | null; utworzono: string };
              kursor.update(utworzWpis(poprzedni.trescOryginalna, poprzedni.projektId, poprzedni.id, poprzedni.utworzono));
              if (poprzedni.projektId) {
                const projekt = transakcja.objectStore('projekty').get(poprzedni.projektId);
                projekt.onsuccess = () => {
                  const odczytany = projekt.result as Projekt | undefined;
                  if (odczytany && poprzedni.utworzono > odczytany.ostatniaAktywnosc) {
                    transakcja.objectStore('projekty').put({ ...odczytany, ostatniaAktywnosc: poprzedni.utworzono });
                  }
                };
              }
              kursor.continue();
            };
          }
        }
        if (zdarzenie.oldVersion < 6) {
          const transakcja = zadanie.transaction!;
          const analizy = transakcja.objectStore('analizyWpisow');
          analizy.deleteIndex('wpisId');
          analizy.createIndex('wpisId', 'wpisId');
          const przebiegi = baza.createObjectStore('przebiegiAnaliz', { keyPath: 'id' });
          przebiegi.createIndex('sourceId', 'sourceId');
          // Stary rekord review i jego ID pozostają bez zmian; upgrade jest jedną transakcją.
          if (zdarzenie.oldVersion >= 4) odczytajDane(transakcja, (dane) => {
            try {
              dane.przebiegiAnaliz = dane.analizyWpisow.map((analiza) => migrujAnalize(analiza, zdarzenie.oldVersion === 4 ? 'INDEXEDDB_V4' : 'INDEXEDDB_V5'));
              sprawdzDaneKopii(dane);
              for (const przebieg of dane.przebiegiAnaliz) przebiegi.add(przebieg);
            } catch { transakcja.abort(); }
          });
        }
      };
      zadanie.onsuccess = () => {
        if (zablokowano) zadanie.result.close();
        else rozwiaz(zadanie.result);
      };
      zadanie.onerror = () => odrzuc(new Error('Nie udało się otworzyć lokalnej bazy danych.'));
      zadanie.onblocked = () => {
        zablokowano = true;
        odrzuc(new Error('Zamknij pozostałe karty aplikacji i odśwież stronę.'));
      };
    });
  }

  async function pobierzWszystkie<T>(magazyn: string): Promise<T[]> {
    const baza = await otworzBaze();
    try {
      return await new Promise<T[]>((rozwiaz, odrzuc) => {
        const transakcja = baza.transaction(magazyn, 'readonly');
        const zadanie = transakcja.objectStore(magazyn).getAll();
        transakcja.oncomplete = () => rozwiaz(zadanie.result as T[]);
        transakcja.onabort = () => odrzuc(new Error('Nie udało się odczytać danych lokalnych.'));
      });
    } finally {
      baza.close();
    }
  }

  async function zapisz<T>(wykonaj: (
    transakcja: IDBTransaction,
    zakoncz: (wynik: T) => void,
    odczytajProjekt: (id: string, obsluz: (projekt: Projekt) => void) => void,
    przerwij: (blad: unknown) => void,
  ) => void): Promise<T> {
    const baza = await otworzBaze();
    try {
      return await new Promise<T>((rozwiaz, odrzuc) => {
        const transakcja = baza.transaction(nazwyMagazynow, 'readwrite');
        let wynik: T;
        let bladOperacji: unknown;
        transakcja.oncomplete = () => rozwiaz(wynik);
        transakcja.onabort = () => odrzuc(bladOperacji instanceof Error && !(bladOperacji instanceof DOMException) ? bladOperacji : new Error('Nie udało się zapisać danych lokalnych. Spróbuj ponownie.'));
        function przerwij(blad: unknown) {
          bladOperacji = blad;
          transakcja.abort();
        }
        function odczytajProjekt(id: string, obsluz: (projekt: Projekt) => void) {
          const zadanie = transakcja.objectStore('projekty').get(id);
          zadanie.onsuccess = () => {
            try {
              if (!zadanie.result) throw new Error('Projekt nie istnieje.');
              obsluz(zadanie.result as Projekt);
            } catch (blad) {
              przerwij(blad);
            }
          };
        }
        try {
          wykonaj(transakcja, (wartosc) => { wynik = wartosc; }, odczytajProjekt, przerwij);
        } catch (blad) {
          bladOperacji = blad;
          transakcja.abort();
        }
      });
    } finally {
      baza.close();
    }
  }

  function odczytajDane(transakcja: IDBTransaction, zakoncz: (dane: DaneKopii) => void) {
    const dane = pusteDaneKopii();
    let pozostalo = nazwyMagazynow.length;
    for (const nazwa of nazwyMagazynow) {
      const zadanie = transakcja.objectStore(nazwa).getAll();
      zadanie.onsuccess = () => {
        dane[nazwa] = zadanie.result;
        if (--pozostalo === 0) zakoncz(dane);
      };
    }
  }

  const jednostkaPracy = utworzJednostkePracyIndexedDb(otworzBaze);
  async function repozytoriumKorekt(): Promise<DaneKopii> {
    const baza = await otworzBaze();
    try {
      return await new Promise((rozwiaz, odrzuc) => {
        const transakcja = baza.transaction(nazwyMagazynow, 'readonly');
        let dane: DaneKopii;
        odczytajDane(transakcja, (odczytane) => { dane = odczytane; });
        transakcja.oncomplete = () => rozwiaz(dane);
        transakcja.onabort = () => odrzuc(new Error('Nie udało się odczytać korekt.'));
      });
    } finally { baza.close(); }
  }
  return {
    jednostkaPracy,
    pobierzKorekty: async () => {
      const kopia = await repozytoriumKorekt();
      return { korekty: kopia.korekty, propozycjeZmian: kopia.propozycjeZmian, zestawyZmian: kopia.zestawyZmian, zdarzeniaDomenowe: kopia.zdarzeniaDomenowe };
    },
    wykonajOperacjeKorekty: (operacja, kontekst) => jednostkaPracy.wykonaj(['rewizje'], (repozytoria, zakoncz) => {
      repozytoria.rewizje.pobierz((przed) => {
        const po = wykonajKorekte(przed, operacja, kontekst);
        sprawdzDaneKopii(po);
        for (const magazyn of nazwyMagazynow) for (const rekord of po[magazyn]) {
          const poprzedni = przed[magazyn].find((poprzedni) => poprzedni.id === rekord.id);
          if (JSON.stringify(poprzedni) !== JSON.stringify(rekord)) repozytoria.rewizje.zapisz(magazyn, rekord, !poprzedni);
        }
        zakoncz(undefined);
      });
    }),
    eksportujKopie: async () => {
      const baza = await otworzBaze();
      try {
        return await new Promise((rozwiaz, odrzuc) => {
          const transakcja = baza.transaction(nazwyMagazynow, 'readonly');
          let dane: DaneKopii;
          odczytajDane(transakcja, (odczytane) => { dane = odczytane; });
          transakcja.onabort = () => odrzuc(new Error('Nie udało się odczytać kopii zapasowej.'));
          transakcja.oncomplete = () => {
            try {
              // Spójny obraz wszystkich magazynów pochodzi z jednej transakcji.
              sprawdzDaneKopii(dane);
              rozwiaz({ format: 'centrum-projektowe', schemaVersion: 3, appVersion: daneAplikacji.version, exportedAt: new Date().toISOString(), data: dane });
            } catch (blad) { odrzuc(blad); }
          };
        });
      } finally { baza.close(); }
    },
    importujKopie: async (kopia, tryb, potwierdzonoZastapienie = false) => {
      // Osobna kopia zapobiega zmianie argumentu podczas oczekiwania na bazę.
      const przyjeta = migrujKopie(kopia);
      const staryFormat = (kopia as { schemaVersion: number }).schemaVersion === 1;
      if (tryb !== 'polacz' && tryb !== 'zastap') throw new Error('Niepoprawny tryb importu.');
      if (tryb === 'zastap' && !potwierdzonoZastapienie) throw new Error('Potwierdź zastąpienie obecnych danych.');
      await zapisz<void>((transakcja, zakoncz, _odczytajProjekt, przerwij) => {
        odczytajDane(transakcja, (obecne) => {
          try {
            let importowane = przyjeta.data;
            if (tryb === 'polacz' && staryFormat) {
              // Kopia v1 nie zna runów ani późniejszego wyboru aktualnej analizy.
              importowane = { ...przyjeta.data, przebiegiAnaliz: przyjeta.data.przebiegiAnaliz.map((przebieg) => {
                const istniejacy = obecne.przebiegiAnaliz.find((obecny) => obecny.id === przebieg.id);
                if (istniejacy && obecne.analizyWpisow.some((analiza) => analiza.id === przebieg.id)) return istniejacy;
                return obecne.przebiegiAnaliz.some((obecny) => obecny.sourceId === przebieg.sourceId && obecny.preferred)
                  ? { ...przebieg, preferred: false } : przebieg;
              }) };
            }
            const dane = tryb === 'polacz' ? polaczDane(obecne, importowane) : importowane;
            for (const nazwa of nazwyMagazynow) {
              const magazyn = transakcja.objectStore(nazwa);
              if (tryb === 'zastap') magazyn.clear();
              const obecneId = new Set(obecne[nazwa].map((rekord) => rekord.id));
              for (const rekord of dane[nazwa]) {
                if (tryb === 'zastap' || !obecneId.has(rekord.id)) magazyn.add(rekord);
              }
            }
            zakoncz();
          } catch (blad) { przerwij(blad); }
        });
      });
    },
    pobierzRealizacje: async () => {
      const baza = await otworzBaze();
      try {
        return await new Promise<StanRealizacji>((rozwiaz, odrzuc) => {
          const nazwy = ['obszary', 'etapy', 'elementyPracy', 'pytania', 'blokady'] as const;
          const transakcja = baza.transaction(nazwy, 'readonly');
          const [obszary, etapy, elementyPracy, pytania, blokady] = nazwy.map((nazwa) => transakcja.objectStore(nazwa).getAll());
          transakcja.oncomplete = () => rozwiaz({ obszary: obszary.result, etapy: etapy.result, elementyPracy: elementyPracy.result, pytania: pytania.result, blokady: blokady.result });
          transakcja.onabort = () => odrzuc(new Error('Nie udało się odczytać realizacji projektu.'));
        });
      } finally { baza.close(); }
    },
    wykonajOperacjeRealizacji: (operacja, kontekst) => zapisz((transakcja, zakoncz, _odczytajProjekt, przerwij) => {
      const nazwy = ['obszary', 'etapy', 'elementyPracy', 'pytania', 'blokady', 'projekty', 'decyzje', 'wpisy', 'analizyWpisow'] as const;
      const zadania = nazwy.map((nazwa) => transakcja.objectStore(nazwa).getAll());
      let pozostalo = zadania.length;
      for (const zadanie of zadania) zadanie.onsuccess = () => {
        if (--pozostalo !== 0) return;
        try {
          const [obszary, etapy, elementyPracy, pytania, blokady, projekty, decyzje, wpisy, analizyWpisow] = zadania.map((zadanie) => zadanie.result);
          const wynik = wykonajRealizacje({ obszary, etapy, elementyPracy, pytania, blokady, projekty, decyzje, wpisy, analizyWpisow }, operacja, kontekst);
          if (operacja.rodzaj === 'konwertuj' || operacja.wersja === undefined) transakcja.objectStore(wynik.zapis.magazyn).add(wynik.zapis.rekord);
          else transakcja.objectStore(wynik.zapis.magazyn).put(wynik.zapis.rekord);
          transakcja.objectStore('projekty').put(wynik.projekt);
          for (const zdarzenie of wynik.zdarzenia) transakcja.objectStore('zdarzenia').add(zdarzenie);
          zakoncz(wynik);
        } catch (blad) { przerwij(blad); }
      };
    }),
    pobierzPrzebiegiAnaliz: () => pobierzWszystkie<PrzebiegAnalizyWpisu>('przebiegiAnaliz'),
    wykonajOperacjePrzebiegu: (operacja, kontekst) => zapisz<void>((transakcja, zakoncz, _odczytajProjekt, przerwij) => {
      odczytajDane(transakcja, (dane) => {
        try {
          if (operacja.rodzaj === 'rozpocznij' && operacja.correctionId) {
            const korekta = dane.korekty.find((korekta) => korekta.id === operacja.correctionId);
            if (!korekta || !dane.projekty.some((projekt) => projekt.id === korekta.projektId && !projekt.zarchiwizowano)) throw new Error('Projekt korekty jest archiwalny lub nie istnieje.');
          }
          const wynik = wykonajOperacjePrzebiegu(dane.przebiegiAnaliz, dane.wpisy, operacja, kontekst);
          dane.przebiegiAnaliz = [...dane.przebiegiAnaliz.filter((przebieg) => !wynik.zapisy.some((nowy) => nowy.id === przebieg.id)), ...wynik.zapisy];
          sprawdzDaneKopii(dane);
          for (const przebieg of wynik.zapisy) {
            if (operacja.rodzaj === 'rozpocznij') transakcja.objectStore('przebiegiAnaliz').add(przebieg);
            else transakcja.objectStore('przebiegiAnaliz').put(przebieg);
          }
          transakcja.objectStore('zdarzenia').add(wynik.zdarzenie);
          zakoncz();
        } catch (blad) { przerwij(blad); }
      });
    }),
    pobierzAnalizyWpisow: () => pobierzWszystkie<AnalizaWpisu>('analizyWpisow'),
    wykonajOperacjeAnalizyWpisu: (operacja, kontekst) => zapisz((transakcja, zakoncz, _odczytajProjekt, przerwij) => {
      const projekty = transakcja.objectStore('projekty').getAll();
      const wpisy = transakcja.objectStore('wpisy').getAll();
      const decyzje = transakcja.objectStore('decyzje').getAll();
      const analizy = transakcja.objectStore('analizyWplywu').getAll();
      const analizyWpisow = transakcja.objectStore('analizyWpisow').getAll();
      const przebiegi = transakcja.objectStore('przebiegiAnaliz').getAll();
      let pozostalo = 6;
      for (const zadanie of [projekty, wpisy, decyzje, analizy, analizyWpisow, przebiegi]) zadanie.onsuccess = () => {
        if (--pozostalo !== 0) return;
        try {
          const wynik = wykonajAnalizeWpisu({ projekty: projekty.result, wpisy: wpisy.result, decyzje: decyzje.result, analizy: analizy.result }, analizyWpisow.result, operacja, kontekst);
          const dotychczasowe = przebiegi.result as PrzebiegAnalizyWpisu[];
          const poprzedni = dotychczasowe.find((przebieg) => przebieg.id === wynik.analizaWpisu.id);
          let przebieg: PrzebiegAnalizyWpisu;
          if (operacja.rodzaj === 'generuj') {
            if (operacja.wymagajRozpoczetego && !poprzedni) throw new Error('Rozpoczęty przebieg został zastąpiony lub usunięty przez odtworzenie danych.');
            if (operacja.trescZrodlowa !== undefined && wynik.wpis.trescOryginalna !== operacja.trescZrodlowa) throw new Error('Źródło zmieniło się podczas analizy. Uruchom nowy przebieg.');
            if (poprzedni && (poprzedni.status !== 'RUNNING' || poprzedni.sourceId !== operacja.wpisId)) throw new Error('Przebieg nie oczekuje na ten wynik.');
            const provider = { type: operacja.wynik.typDostawcy, name: operacja.wynik.nazwaDostawcy, version: operacja.wynik.wersjaDostawcy };
            if (poprzedni && (poprzedni.provider.type !== provider.type || poprzedni.provider.name !== provider.name || poprzedni.provider.version !== provider.version)) throw new Error('Wynik pochodzi od innego dostawcy.');
            const poczatek = poprzedni?.startedAt ?? kontekst.czas;
            if (Date.parse(kontekst.czas) < Date.parse(poczatek)) throw new Error('Koniec przebiegu poprzedza początek.');
            przebieg = { ...poprzedni, id: operacja.id, sourceId: operacja.wpisId, sourceType: 'CAPTURE', provider,
              schemaVersion: 'capture-analysis-v1', status: 'SUCCEEDED', startedAt: poczatek, finishedAt: kontekst.czas,
              output: structuredClone(operacja.wynik), preferred: !dotychczasowe.some((inny) => inny.sourceId === operacja.wpisId && inny.preferred),
              reviewStatus: wynik.analizaWpisu.status, createdAt: poprzedni?.createdAt ?? kontekst.czas };
          } else {
            if (!poprzedni || !['SUCCEEDED', 'LEGACY_IMPORTED'].includes(poprzedni.status)) throw new Error('Brak zakończonego przebiegu analizy.');
            przebieg = { ...poprzedni, reviewStatus: wynik.analizaWpisu.status };
          }
          if (!przebieg.preferred) wynik.wpis = wpisy.result.find((wpis: Wpis) => wpis.id === wynik.wpis.id);
          if (!schematDanych.przebiegiAnaliz.sprawdz(przebieg)) throw new Error('Niepoprawny rekord przebiegu analizy.');
          if (poprzedni) transakcja.objectStore('przebiegiAnaliz').put(przebieg);
          else transakcja.objectStore('przebiegiAnaliz').add(przebieg);
          const magazyn = transakcja.objectStore('analizyWpisow');
          if (operacja.rodzaj === 'generuj') magazyn.add(wynik.analizaWpisu);
          else magazyn.put(wynik.analizaWpisu);
          transakcja.objectStore('wpisy').put(wynik.wpis);
          for (const decyzja of wynik.decyzje) transakcja.objectStore('decyzje').add(decyzja);
          for (const analiza of wynik.analizy) transakcja.objectStore('analizyWplywu').add(analiza);
          for (const projekt of wynik.projekty) transakcja.objectStore('projekty').put(projekt);
          for (const zdarzenie of wynik.zdarzenia) transakcja.objectStore('zdarzenia').add(zdarzenie);
          zakoncz(wynik);
        } catch (blad) { przerwij(blad); }
      };
    }),
    pobierzDecyzje: () => pobierzWszystkie<Decyzja>('decyzje'),
    pobierzAnalizyWplywu: () => pobierzWszystkie<AnalizaWplywu>('analizyWplywu'),
    wykonajOperacjeUstalen: (operacja, kontekst) => zapisz((transakcja, zakoncz, _odczytajProjekt, przerwij) => {
      const projekty = transakcja.objectStore('projekty').getAll();
      const wpisy = transakcja.objectStore('wpisy').getAll();
      const decyzje = transakcja.objectStore('decyzje').getAll();
      const analizy = transakcja.objectStore('analizyWplywu').getAll();
      let pozostalo = 4;
      for (const zadanie of [projekty, wpisy, decyzje, analizy]) zadanie.onsuccess = () => {
        if (--pozostalo !== 0) return;
        try {
          const stan: StanUstalen = { projekty: projekty.result, wpisy: wpisy.result, decyzje: decyzje.result, analizy: analizy.result };
          if ((operacja.rodzaj === 'analizuj' && operacja.zrodlo.typ === 'CORRECTION')
            || (operacja.rodzaj === 'rozstrzygnij' && stan.analizy.find((analiza) => analiza.id === operacja.analizaId)?.zrodlo.typ === 'CORRECTION')) throw new Error('Wpływ korekty wymaga review i zastosowania przez zestaw zmian korekty.');
          const wynik = wykonajOperacjeUstalen(stan, operacja, kontekst);
          for (const decyzja of wynik.decyzje) {
            const magazyn = transakcja.objectStore('decyzje');
            if (stan.decyzje.some((poprzednia) => poprzednia.id === decyzja.id)) magazyn.put(decyzja);
            else magazyn.add(decyzja);
          }
          for (const analiza of wynik.analizy) {
            const magazyn = transakcja.objectStore('analizyWplywu');
            if (stan.analizy.some((poprzednia) => poprzednia.id === analiza.id)) magazyn.put(analiza);
            else magazyn.add(analiza);
          }
          for (const projekt of wynik.projekty) transakcja.objectStore('projekty').put(projekt);
          for (const zdarzenie of wynik.zdarzenia) transakcja.objectStore('zdarzenia').add(zdarzenie);
          zakoncz(wynik);
        } catch (blad) { przerwij(blad); }
      };
    }),
    pobierzProjekty: () => pobierzWszystkie<Projekt>('projekty'),
    dodajProjekt: (projekt, kontekst) => zapisz<ZdarzenieAktywnosci>((transakcja, zakoncz) => {
      const zdarzenie = zdarzenieUtworzenia(projekt, kontekst);
      transakcja.objectStore('projekty').add(projekt);
      transakcja.objectStore('zdarzenia').add(zdarzenie);
      zakoncz(zdarzenie);
    }),
    zmienProjekt: (id, zmiana, kontekst) => zmiana.rodzaj === 'punktPowrotu'
      ? aktualizujPunktPowrotu(jednostkaPracy, id, zmiana.dane, kontekst)
      : zapisz((transakcja, zakoncz, odczytajProjekt) => {
        odczytajProjekt(id, (projekt) => {
          const wynik = zmienProjekt(projekt, zmiana, kontekst);
          transakcja.objectStore('projekty').put(wynik.projekt);
          transakcja.objectStore('zdarzenia').add(wynik.zdarzenie);
          zakoncz(wynik);
        });
      }),
    pobierzWpisy: () => pobierzWszystkie<Wpis>('wpisy'),
    dodajWpis: (wpis, kontekst) => zapiszNowyWpis(jednostkaPracy, wpis, kontekst),
    pobierzZdarzenia: () => pobierzWszystkie<ZdarzenieAktywnosci>('zdarzenia'),
    wykonajAkcjeWpisu: (id, akcja, kontekst) => zapisz((transakcja, zakoncz, odczytajProjekt, przerwij) => {
      const zadanie = transakcja.objectStore('wpisy').get(id);
      zadanie.onsuccess = () => {
        try {
          if (!zadanie.result) throw new Error('Wpis nie istnieje.');
          const wynik = przygotujAkcjeWpisu(zadanie.result as Wpis, akcja, kontekst);
          function zapiszWynik() {
            transakcja.objectStore('wpisy').put(wynik.wpis);
            for (const zdarzenie of wynik.zdarzenia) transakcja.objectStore('zdarzenia').add(zdarzenie);
            zakoncz(wynik);
          }
          if (wynik.projekt) {
            transakcja.objectStore('projekty').add(wynik.projekt);
            zapiszWynik();
          } else if (wynik.wpis.projektId !== null) {
            odczytajProjekt(wynik.wpis.projektId, (projekt) => {
              if (akcja.rodzaj === 'przypisanie' && projekt.zarchiwizowano) throw new Error('Projekt jest zarchiwizowany.');
              wynik.projekt = { ...projekt, ostatniaAktywnosc: kontekst.czas > projekt.ostatniaAktywnosc ? kontekst.czas : projekt.ostatniaAktywnosc };
              transakcja.objectStore('projekty').put(wynik.projekt);
              zapiszWynik();
            });
          } else zapiszWynik();
        } catch (blad) { przerwij(blad); }
      };
    }),
  };
}
