import { statusyProjektu, type DaneProjektu, type KontekstZapisu, type Projekt, type Wpis, type ZmianaProjektu, type WynikZmianyProjektu, type ZrodloDanych, type ZdarzenieAktywnosci } from './modele';

export function sprawdzDaneProjektu(dane: DaneProjektu): DaneProjektu {
  if (!dane.nazwa.trim()) throw new Error('Podaj nazwę projektu.');
  if (!Object.hasOwn(statusyProjektu, dane.status)) throw new Error('Nieznany status projektu.');
  return {
    nazwa: dane.nazwa.trim(), opis: dane.opis, status: dane.status,
    podsumowanieAktualnegoStanu: dane.podsumowanieAktualnegoStanu,
    ostatnioPracowanoNad: dane.ostatnioPracowanoNad, nastepnyKrok: dane.nastepnyKrok,
  };
}

export function utworzProjekt(
  nazwa: string, id: string, utworzono: string,
  zrodlo: ZrodloDanych = { typ: 'USER', nazwa: 'Wpis ręczny' },
): Projekt {
  const dane = sprawdzDaneProjektu({ nazwa, opis: '', status: 'IDEA', podsumowanieAktualnegoStanu: '', ostatnioPracowanoNad: '', nastepnyKrok: '' });
  return { ...dane, id, utworzono, zaktualizowano: utworzono, ostatniaAktywnosc: utworzono, zarchiwizowano: null, zrodlo };
}

export function utworzWpis(
  trescOryginalna: string,
  projektId: string | null,
  id: string,
  utworzono: string,
  zrodlo: ZrodloDanych = { typ: 'USER', nazwa: 'Wpis ręczny' },
  typZrodla: Wpis['typZrodla'] = 'MANUAL',
): Wpis {
  if (!trescOryginalna.trim()) throw new Error('Wpis nie może być pusty.');
  return { id, trescOryginalna, projektId, utworzono, status: 'UNPROCESSED', typZrodla, zrodlo };
}

export function zmienProjekt(projekt: Projekt, zmiana: ZmianaProjektu, kontekst: KontekstZapisu): WynikZmianyProjektu {
  if (projekt.zarchiwizowano) throw new Error('Projekt jest zarchiwizowany.');
  const nowy = zmiana.rodzaj === 'edycja'
    ? { ...projekt, ...sprawdzDaneProjektu(zmiana.dane) }
    : { ...projekt, zarchiwizowano: kontekst.czas };
  nowy.zaktualizowano = kontekst.czas;
  nowy.ostatniaAktywnosc = kontekst.czas > projekt.ostatniaAktywnosc ? kontekst.czas : projekt.ostatniaAktywnosc;
  const pola = ['nazwa', 'opis', 'status', 'podsumowanieAktualnegoStanu', 'ostatnioPracowanoNad', 'nastepnyKrok', 'zarchiwizowano'] as const;
  const zmiany = pola.filter((pole) => projekt[pole] !== nowy[pole])
    .map((pole) => ({ pole, poprzednio: projekt[pole], obecnie: nowy[pole] }));
  if (zmiany.length === 0) throw new Error('Brak zmian do zapisania.');
  const etykietyPol = {
    nazwa: 'Nazwa', opis: 'Opis', status: 'Status', podsumowanieAktualnegoStanu: 'Podsumowanie stanu',
    ostatnioPracowanoNad: 'Ostatnio pracowano nad', nastepnyKrok: 'Następny krok', zarchiwizowano: 'Data archiwizacji',
  };
  function opiszWartosc(pole: typeof pola[number], wartosc: string | null): string {
    if (!wartosc) return '(brak)';
    return pole === 'status' ? statusyProjektu[wartosc as Projekt['status']] : wartosc;
  }
  return {
    projekt: nowy,
    zdarzenie: {
      id: kontekst.idZdarzenia, projektId: projekt.id, typEncji: 'PROJECT', encjaId: projekt.id,
      typZdarzenia: zmiana.rodzaj === 'edycja' ? 'PROJECT_UPDATED' : 'PROJECT_ARCHIVED',
      tytul: zmiana.rodzaj === 'edycja' ? 'Zmieniono projekt' : 'Zarchiwizowano projekt',
      opis: zmiany.map(({ pole, poprzednio, obecnie }) => `${etykietyPol[pole]}: ${opiszWartosc(pole, poprzednio)} → ${opiszWartosc(pole, obecnie)}`).join('\n'),
      utworzono: kontekst.czas, zrodlo: kontekst.zrodlo, metadane: { zmiany },
    },
  };
}

export function zdarzenieUtworzenia(rekord: Projekt | Wpis, kontekst: KontekstZapisu): ZdarzenieAktywnosci {
  const czyProjekt = 'nazwa' in rekord;
  return {
    id: kontekst.idZdarzenia, projektId: czyProjekt ? rekord.id : rekord.projektId,
    typEncji: czyProjekt ? 'PROJECT' : 'CAPTURE', encjaId: rekord.id,
    typZdarzenia: czyProjekt ? 'PROJECT_CREATED' : 'CAPTURE_CREATED',
    tytul: czyProjekt ? 'Utworzono projekt' : 'Zapisano surowy wpis',
    utworzono: kontekst.czas, zrodlo: kontekst.zrodlo,
  };
}
