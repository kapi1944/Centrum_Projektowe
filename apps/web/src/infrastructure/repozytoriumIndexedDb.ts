import { nazwyMagazynow, pusteDaneKopii, sprawdzKopie, sprawdzDaneKopii, polaczDane, type DaneKopii } from '../domain/kopieZapasowe';
import daneAplikacji from '../../package.json';
import type { KontekstZapisu, Projekt, Wpis, ZdarzenieAktywnosci } from '../domain/modele';
import { przygotujAkcjeWpisu, utworzProjekt, utworzWpis, zdarzenieUtworzenia, zmienProjekt } from '../domain/operacje';
import type { RepozytoriumProjektowe } from '../domain/repozytorium';
import { wykonajOperacjeUstalen, type AnalizaWplywu, type Decyzja, type StanUstalen } from '../domain/ustalenia';
import { wykonajAnalizeWpisu, type AnalizaWpisu } from '../domain/analizaWpisu';
import { wykonajRealizacje, type StanRealizacji } from '../domain/realizacja';

export function utworzRepozytoriumIndexedDb(
  nazwaBazy = 'centrum-projektowe',
): RepozytoriumProjektowe {
  async function otworzBaze(): Promise<IDBDatabase> {
    return new Promise((rozwiaz, odrzuc) => {
      if (!globalThis.indexedDB) {
        odrzuc(new Error('Ta przeglądarka nie udostępnia IndexedDB.'));
        return;
      }
      const zadanie = indexedDB.open(nazwaBazy, 5);
      let zablokowano = false;
      zadanie.onupgradeneeded = (zdarzenie) => {
        const baza = zadanie.result;
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

  return {
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
              rozwiaz({ format: 'centrum-projektowe', schemaVersion: 1, appVersion: daneAplikacji.version, exportedAt: new Date().toISOString(), data: dane });
            } catch (blad) { odrzuc(blad); }
          };
        });
      } finally { baza.close(); }
    },
    importujKopie: async (kopia, tryb, potwierdzonoZastapienie = false) => {
      // Osobna kopia zapobiega zmianie argumentu podczas oczekiwania na bazę.
      const przyjeta: unknown = structuredClone(kopia);
      sprawdzKopie(przyjeta);
      if (tryb !== 'polacz' && tryb !== 'zastap') throw new Error('Niepoprawny tryb importu.');
      if (tryb === 'zastap' && !potwierdzonoZastapienie) throw new Error('Potwierdź zastąpienie obecnych danych.');
      await zapisz<void>((transakcja, zakoncz, _odczytajProjekt, przerwij) => {
        odczytajDane(transakcja, (obecne) => {
          try {
            const dane = tryb === 'polacz' ? polaczDane(obecne, przyjeta.data) : przyjeta.data;
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
    pobierzAnalizyWpisow: () => pobierzWszystkie<AnalizaWpisu>('analizyWpisow'),
    wykonajOperacjeAnalizyWpisu: (operacja, kontekst) => zapisz((transakcja, zakoncz, _odczytajProjekt, przerwij) => {
      const projekty = transakcja.objectStore('projekty').getAll();
      const wpisy = transakcja.objectStore('wpisy').getAll();
      const decyzje = transakcja.objectStore('decyzje').getAll();
      const analizy = transakcja.objectStore('analizyWplywu').getAll();
      const analizyWpisow = transakcja.objectStore('analizyWpisow').getAll();
      let pozostalo = 5;
      for (const zadanie of [projekty, wpisy, decyzje, analizy, analizyWpisow]) zadanie.onsuccess = () => {
        if (--pozostalo !== 0) return;
        try {
          const wynik = wykonajAnalizeWpisu({ projekty: projekty.result, wpisy: wpisy.result, decyzje: decyzje.result, analizy: analizy.result }, analizyWpisow.result, operacja, kontekst);
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
    zmienProjekt: (id, zmiana, kontekst) => zapisz((transakcja, zakoncz, odczytajProjekt) => {
      odczytajProjekt(id, (projekt) => {
        const wynik = zmienProjekt(projekt, zmiana, kontekst);
        transakcja.objectStore('projekty').put(wynik.projekt);
        transakcja.objectStore('zdarzenia').add(wynik.zdarzenie);
        zakoncz(wynik);
      });
    }),
    pobierzWpisy: () => pobierzWszystkie<Wpis>('wpisy'),
    dodajWpis: (wpis, kontekst: KontekstZapisu) => zapisz<ZdarzenieAktywnosci>((transakcja, zakoncz, odczytajProjekt) => {
      const zdarzenie = zdarzenieUtworzenia(wpis, kontekst);
      function dodaj() {
        transakcja.objectStore('wpisy').add(wpis);
        transakcja.objectStore('zdarzenia').add(zdarzenie);
        zakoncz(zdarzenie);
      }
      if (wpis.projektId === null) dodaj();
      else odczytajProjekt(wpis.projektId, (projekt) => {
        if (projekt.zarchiwizowano) throw new Error('Projekt jest zarchiwizowany.');
        transakcja.objectStore('projekty').put({
          ...projekt, ostatniaAktywnosc: kontekst.czas > projekt.ostatniaAktywnosc ? kontekst.czas : projekt.ostatniaAktywnosc,
        });
        dodaj();
      });
    }),
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
