import type { Projekt, Wpis } from '../domain/modele';
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
      const zadanie = indexedDB.open(nazwaBazy, 1);
      let zablokowano = false;
      zadanie.onupgradeneeded = () => {
        const baza = zadanie.result;
        baza.createObjectStore('projekty', { keyPath: 'id' });
        baza.createObjectStore('wpisy', { keyPath: 'id' });
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

  async function dodaj(magazyn: 'projekty' | 'wpisy', rekord: Projekt | Wpis): Promise<void> {
    const baza = await otworzBaze();
    try {
      await new Promise<void>((rozwiaz, odrzuc) => {
        const transakcja = baza.transaction(['projekty', 'wpisy'], 'readwrite');
        transakcja.oncomplete = () => rozwiaz();
        transakcja.onabort = () => odrzuc(transakcja.error ?? new Error('Zapis przerwany.'));
        if ('projektId' in rekord && rekord.projektId !== null) {
          const zadanie = transakcja.objectStore('projekty').get(rekord.projektId);
          zadanie.onsuccess = () => {
            if (!zadanie.result) transakcja.abort();
            else transakcja.objectStore(magazyn).add(rekord);
          };
        } else {
          transakcja.objectStore(magazyn).add(rekord);
        }
      });
    } finally {
      baza.close();
    }
  }

  return {
    pobierzProjekty: () => pobierzWszystkie<Projekt>('projekty'),
    dodajProjekt: (projekt) => dodaj('projekty', projekt),
    pobierzWpisy: () => pobierzWszystkie<Wpis>('wpisy'),
    dodajWpis: (wpis) => dodaj('wpisy', wpis),
  };
}
