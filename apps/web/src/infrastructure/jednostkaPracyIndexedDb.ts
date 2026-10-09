import type { JednostkaPracyProjektowej, PortyTransakcji } from '../domain/porty';

export function utworzJednostkePracyIndexedDb(otworzBaze: () => Promise<IDBDatabase>): JednostkaPracyProjektowej {
  return {
    async wykonaj<Magazyn extends keyof PortyTransakcji, Wynik>(magazyny: readonly Magazyn[], wykonaj: (repozytoria: Pick<PortyTransakcji, Magazyn>, zakoncz: (wynik: Wynik) => void) => void): Promise<Wynik> {
      if (!magazyny.length || magazyny.some((nazwa) => !['projekty', 'wpisy', 'zdarzenia'].includes(nazwa))) throw new Error('Nieobsługiwany zakres jednostki pracy.');
      const baza = await otworzBaze();
      try {
        return await new Promise<Wynik>((rozwiaz, odrzuc) => {
          const transakcja = baza.transaction([...new Set(magazyny)], 'readwrite');
          let wynik: Wynik;
          let bladOperacji: unknown;
          let zakonczono = false;
          let aktywna = true;
          let oczekujaceOdczyty = 0;
          transakcja.oncomplete = () => { aktywna = false; rozwiaz(wynik); };
          transakcja.onabort = () => {
            aktywna = false;
            odrzuc(bladOperacji instanceof Error && !(bladOperacji instanceof DOMException)
              ? bladOperacji : new Error('Nie udało się zapisać danych lokalnych. Spróbuj ponownie.'));
          };
          function przerwij(blad: unknown) {
            if (!aktywna) return;
            bladOperacji = blad;
            aktywna = false;
            transakcja.abort();
          }
          function sprawdzOtwartosc() {
            if (zakonczono || !aktywna) throw new Error('Jednostka pracy została zakończona.');
          }
          function wywolaj(obsluz: () => unknown) {
            try {
              const zwrot = obsluz();
              if (zwrot && typeof zwrot === 'object' && 'then' in zwrot) {
                void Promise.resolve(zwrot).catch(() => undefined);
                throw new Error('Jednostka pracy nie dopuszcza asynchronicznych callbacków.');
              }
              if (oczekujaceOdczyty === 0 && !zakonczono) throw new Error('Nie zakończono jednostki pracy.');
            } catch (blad) { przerwij(blad); }
          }
          const dostepne: PortyTransakcji = {
            projekty: {
              pobierz(id, obsluz) {
                sprawdzOtwartosc();
                const zadanie = transakcja.objectStore('projekty').get(id);
                oczekujaceOdczyty++;
                zadanie.onsuccess = () => {
                  oczekujaceOdczyty--;
                  wywolaj(() => obsluz(zadanie.result));
                };
              },
              zapisz(projekt) { sprawdzOtwartosc(); transakcja.objectStore('projekty').put(projekt); },
            },
            wpisy: { dodaj(wpis) { sprawdzOtwartosc(); transakcja.objectStore('wpisy').add(wpis); } },
            zdarzenia: { dodaj(zdarzenie) { sprawdzOtwartosc(); transakcja.objectStore('zdarzenia').add(zdarzenie); } },
          };
          const repozytoria = Object.fromEntries(magazyny.map((nazwa) => [nazwa, dostepne[nazwa]])) as Pick<PortyTransakcji, Magazyn>;
          wywolaj(() => wykonaj(repozytoria, (wartosc) => {
            sprawdzOtwartosc();
            wynik = wartosc;
            zakonczono = true;
          }));
        });
      } finally { baza.close(); }
    },
  };
}
