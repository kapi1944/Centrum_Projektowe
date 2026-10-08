import type { KontekstZapisu, Projekt, Wpis, ZdarzenieAktywnosci } from '../domain/modele';
import { utworzProjekt, utworzWpis, zdarzenieUtworzenia, zmienProjekt } from '../domain/operacje';
import type { RepozytoriumProjektowe } from '../domain/repozytorium';

export function utworzRepozytoriumIndexedDb(
  nazwaBazy = 'centrum-projektowe',
): RepozytoriumProjektowe {
  async function otworzBaze(): Promise<IDBDatabase> {
    return new Promise((rozwiaz, odrzuc) => {
      if (!globalThis.indexedDB) {
        odrzuc(new Error('Ta przeglądarka nie udostępnia IndexedDB.'));
        return;
      }
      const zadanie = indexedDB.open(nazwaBazy, 2);
      let zablokowano = false;
      zadanie.onupgradeneeded = (zdarzenie) => {
        const baza = zadanie.result;
        if (zdarzenie.oldVersion === 0) {
          baza.createObjectStore('projekty', { keyPath: 'id' });
          baza.createObjectStore('wpisy', { keyPath: 'id' });
        }
        baza.createObjectStore('zdarzenia', { keyPath: 'id' });
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
      zadanie.onerror = () => odrzuc(zadanie.error);
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
        transakcja.onabort = () => odrzuc(transakcja.error ?? new Error('Odczyt przerwany.'));
      });
    } finally {
      baza.close();
    }
  }

  async function zapisz<T>(wykonaj: (
    transakcja: IDBTransaction,
    zakoncz: (wynik: T) => void,
    odczytajProjekt: (id: string, obsluz: (projekt: Projekt) => void) => void,
  ) => void): Promise<T> {
    const baza = await otworzBaze();
    try {
      return await new Promise<T>((rozwiaz, odrzuc) => {
        const transakcja = baza.transaction(['projekty', 'wpisy', 'zdarzenia'], 'readwrite');
        let wynik: T;
        let bladOperacji: unknown;
        transakcja.oncomplete = () => rozwiaz(wynik);
        transakcja.onabort = () => odrzuc(bladOperacji ?? transakcja.error ?? new Error('Zapis przerwany.'));
        function odczytajProjekt(id: string, obsluz: (projekt: Projekt) => void) {
          const zadanie = transakcja.objectStore('projekty').get(id);
          zadanie.onsuccess = () => {
            try {
              if (!zadanie.result) throw new Error('Projekt nie istnieje.');
              obsluz(zadanie.result as Projekt);
            } catch (blad) {
              bladOperacji = blad;
              transakcja.abort();
            }
          };
        }
        try {
          wykonaj(transakcja, (wartosc) => { wynik = wartosc; }, odczytajProjekt);
        } catch (blad) {
          bladOperacji = blad;
          transakcja.abort();
        }
      });
    } finally {
      baza.close();
    }
  }

  return {
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
  };
}
