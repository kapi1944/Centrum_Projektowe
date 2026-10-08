import type { KontekstZapisu, Projekt, PunktPowrotu, Wpis, ZdarzenieAktywnosci, ZrodloDanych } from './modele';
import { zmienProjekt } from './operacje';

export const statusyDecyzji = {
  PROPOSED: 'Propozycje', ACCEPTED: 'Aktywne', IMPLEMENTATION_PLANNED: 'Planowane',
  PARTIALLY_IMPLEMENTED: 'Częściowo wdrożone', IMPLEMENTED: 'Wdrożone', SUPERSEDED: 'Zastąpione', REJECTED: 'Odrzucone',
} as const;
export type StatusDecyzji = keyof typeof statusyDecyzji;
export interface PowiazanyElement {
  typ: 'TASK' | 'WORK_ITEM' | 'PROJECT_ELEMENT' | 'BLOCKER' | 'DOCUMENT';
  id: string;
  tytul: string;
}
export const typyElementow = { TASK: 'Zadanie', WORK_ITEM: 'Element pracy', PROJECT_ELEMENT: 'Element projektu', BLOCKER: 'Bloker', DOCUMENT: 'Dokumentacja' } as const;
export interface DaneDecyzji {
  tytul: string;
  opis: string;
  projektIds: string[];
  typZrodla: ZrodloDanych['typ'];
  nazwaZrodla: string;
  odniesienieZrodla: string;
  wpisZrodlowyId: string | null;
  analizaWpisuId?: string;
  elementAnalizyId?: string;
  notatki: string;
  powiazaneElementy: PowiazanyElement[];
}
export interface Decyzja extends DaneDecyzji {
  id: string;
  czytelneId: string;
  status: StatusDecyzji;
  utworzono: string;
  zaktualizowano: string;
  wersja: number;
  zastapionaPrzezId: string | null;
}
export type ZrodloWplywu = { typ: 'CAPTURE' | 'DECISION'; id: string };
interface PodstawaPropozycji {
  id: string;
  tytul: string;
  uzasadnienie: string;
  stan: 'PENDING' | 'APPROVED' | 'REJECTED';
  rozstrzygnieto?: string;
}
export type PropozycjaWplywu = PodstawaPropozycji & (
  { rodzaj: 'DECISION_STATUS'; decyzjaId: string; wersja: number; poprzedniStatus: StatusDecyzji; proponowanyStatus: 'PROPOSED' }
  | { rodzaj: 'RESUME'; projektId: string; poprzednio: PunktPowrotu; proponowane: PunktPowrotu }
  | { rodzaj: 'REVIEW'; element: PowiazanyElement }
);
export interface AnalizaWplywu {
  id: string;
  zrodlo: ZrodloWplywu;
  projektIds: string[];
  utworzono: string;
  propozycje: PropozycjaWplywu[];
  zrodloAnalizyWpisu?: { analizaWpisuId: string; elementAnalizyId: string; tresc: string };
}
export type OperacjaUstalen =
  | { rodzaj: 'utworz'; id: string; dane: DaneDecyzji }
  | { rodzaj: 'status'; id: string; status: Exclude<StatusDecyzji, 'SUPERSEDED'>; wersja: number }
  | { rodzaj: 'zastap'; id: string; wersja: number; noweId: string; dane: DaneDecyzji }
  | { rodzaj: 'analizuj'; zrodlo: ZrodloWplywu; kontekstAnalizyWpisu?: { analizaWpisuId: string; elementAnalizyId: string; tresc: string; projektId: string } }
  | { rodzaj: 'rozstrzygnij'; analizaId: string; propozycjaId: string; zatwierdz: boolean };
export interface StanUstalen {
  projekty: Projekt[];
  wpisy: Wpis[];
  decyzje: Decyzja[];
  analizy: AnalizaWplywu[];
}
export interface WynikUstalen {
  decyzje: Decyzja[];
  analizy: AnalizaWplywu[];
  projekty: Projekt[];
  zdarzenia: ZdarzenieAktywnosci[];
}

export function wykonajOperacjeUstalen(stan: StanUstalen, operacja: OperacjaUstalen, kontekst: KontekstZapisu): WynikUstalen {
  const wynik: WynikUstalen = { decyzje: [], analizy: [], projekty: [], zdarzenia: [] };
  function projekt(id: string): Projekt {
    const znaleziony = stan.projekty.find((projekt) => projekt.id === id);
    if (!znaleziony || znaleziony.zarchiwizowano) throw new Error('Projekt nie istnieje lub jest archiwalny.');
    return znaleziony;
  }
  function decyzja(id: string): Decyzja {
    const znaleziona = stan.decyzje.find((decyzja) => decyzja.id === id);
    if (!znaleziona) throw new Error('Decyzja nie istnieje.');
    return znaleziona;
  }
  function zdarzenie(typ: ZdarzenieAktywnosci['typZdarzenia'], tytul: string, id: string, projektIds: string[], opis?: string) {
    wynik.zdarzenia.push({
      id: wynik.zdarzenia.length === 0 ? kontekst.idZdarzenia : `${kontekst.idZdarzenia}:${wynik.zdarzenia.length}`,
      projektId: projektIds[0] ?? null, projektIds, typEncji: typ.startsWith('DECISION') ? 'DECISION' : 'IMPACT',
      encjaId: id, typZdarzenia: typ, tytul, opis, utworzono: kontekst.czas, zrodlo: kontekst.zrodlo,
    });
  }
  function aktywnosc(projektIds: string[]) {
    for (const id of projektIds) {
      const odczytany = projekt(id);
      if (!wynik.projekty.some((projekt) => projekt.id === id)) wynik.projekty.push({
        ...odczytany, ostatniaAktywnosc: kontekst.czas > odczytany.ostatniaAktywnosc ? kontekst.czas : odczytany.ostatniaAktywnosc,
      });
    }
  }
  function nowaDecyzja(id: string, dane: DaneDecyzji, status: 'PROPOSED' | 'ACCEPTED'): Decyzja {
    if (stan.decyzje.some((decyzja) => decyzja.id === id)) throw new Error('Identyfikator decyzji jest zajęty.');
    if (!dane.tytul.trim() || !dane.opis.trim()) throw new Error('Podaj tytuł i opis decyzji.');
    const projektIds = [...new Set(dane.projektIds)];
    if (!projektIds.length) throw new Error('Wybierz co najmniej jeden projekt.');
    projektIds.forEach(projekt);
    if (!['USER', 'SYSTEM', 'AI'].includes(dane.typZrodla) || !dane.nazwaZrodla.trim()) throw new Error('Podaj poprawne źródło.');
    if (dane.wpisZrodlowyId && !stan.wpisy.some((wpis) => wpis.id === dane.wpisZrodlowyId)) throw new Error('Źródłowy wpis nie istnieje.');
    if (dane.powiazaneElementy.some((element) => !Object.hasOwn(typyElementow, element.typ) || !element.id.trim() || !element.tytul.trim())) throw new Error('Uzupełnij identyfikator i nazwę powiązanego elementu.');
    const numer = Math.max(0, ...stan.decyzje.map((decyzja) => Number(decyzja.czytelneId.slice(4)))) + 1;
    const nowa: Decyzja = {
      ...dane, tytul: dane.tytul.trim(), projektIds, id, czytelneId: `DEC-${String(numer).padStart(4, '0')}`,
      status, utworzono: kontekst.czas, zaktualizowano: kontekst.czas, wersja: 1, zastapionaPrzezId: null,
    };
    wynik.decyzje.push(nowa);
    zdarzenie('DECISION_CREATED', `Utworzono ${nowa.czytelneId}`, id, projektIds, nowa.tytul);
    aktywnosc(projektIds);
    return nowa;
  }
  function zmienStatus(odczytana: Decyzja, status: Exclude<StatusDecyzji, 'SUPERSEDED'>, wersja: number) {
    if (odczytana.wersja !== wersja) throw new Error('Decyzja zmieniła się. Odśwież dane i sprawdź ją ponownie.');
    if (odczytana.status === 'SUPERSEDED' || odczytana.zastapionaPrzezId) throw new Error('Zastąpiona decyzja zachowuje swój historyczny status.');
    if (!Object.hasOwn(statusyDecyzji, status) || (status as string) === 'SUPERSEDED' || status === odczytana.status) throw new Error('Niepoprawna zmiana statusu.');
    wynik.decyzje.push({ ...odczytana, status, zaktualizowano: kontekst.czas, wersja: odczytana.wersja + 1 });
    zdarzenie('DECISION_STATUS_CHANGED', `Zmieniono status ${odczytana.czytelneId}`, odczytana.id, odczytana.projektIds, `${statusyDecyzji[odczytana.status]} → ${statusyDecyzji[status]}`);
    aktywnosc(odczytana.projektIds);
  }

  switch (operacja.rodzaj) {
    case 'utworz': nowaDecyzja(operacja.id, operacja.dane, 'PROPOSED'); break;
    case 'status': zmienStatus(decyzja(operacja.id), operacja.status, operacja.wersja); break;
    case 'zastap': {
      const stara = decyzja(operacja.id);
      if (stara.wersja !== operacja.wersja) throw new Error('Decyzja zmieniła się. Odśwież dane.');
      if (['SUPERSEDED', 'REJECTED', 'PROPOSED'].includes(stara.status)) throw new Error('Zastąpić można obowiązującą decyzję.');
      if (!stara.projektIds.every((id) => operacja.dane.projektIds.includes(id))) throw new Error('Nowa decyzja musi obejmować wszystkie projekty poprzedniej.');
      const nowa = nowaDecyzja(operacja.noweId, operacja.dane, 'ACCEPTED');
      wynik.decyzje.push({ ...stara, status: 'SUPERSEDED', zastapionaPrzezId: nowa.id, zaktualizowano: kontekst.czas, wersja: stara.wersja + 1 });
      zdarzenie('DECISION_SUPERSEDED', `${stara.czytelneId} zastąpiono przez ${nowa.czytelneId}`, stara.id, stara.projektIds);
      break;
    }
    case 'analizuj': {
      let projektIds: string[];
      if (operacja.zrodlo.typ === 'CAPTURE') {
        const wpis = stan.wpisy.find((wpis) => wpis.id === operacja.zrodlo.id);
        if (!wpis) throw new Error('Wpis nie istnieje.');
        const projektId = wpis.projektId ?? operacja.kontekstAnalizyWpisu?.projektId;
        projektIds = projektId ? [projektId] : [];
      } else projektIds = decyzja(operacja.zrodlo.id).projektIds;
      const id = `wplyw-${kontekst.idZdarzenia}`;
      const propozycje: PropozycjaWplywu[] = [];
      const podstawa = (tytul: string) => ({ id: `${id}:${propozycje.length + 1}`, tytul, uzasadnienie: 'Wspólny projekt lub jawna relacja ze źródłem. To reguła relacyjna, nie analiza znaczenia treści.', stan: 'PENDING' as const });
      const powiazane = stan.decyzje.filter((decyzja) => decyzja.projektIds.some((id) => projektIds.includes(id))
        && !(operacja.zrodlo.typ === 'DECISION' && decyzja.id === operacja.zrodlo.id) && !['SUPERSEDED', 'REJECTED'].includes(decyzja.status));
      for (const odczytana of powiazane) {
        if (odczytana.status !== 'PROPOSED') propozycje.push({ ...podstawa(`Sprawdź ustalenie ${odczytana.czytelneId}: ${odczytana.tytul}`), rodzaj: 'DECISION_STATUS', decyzjaId: odczytana.id, wersja: odczytana.wersja, poprzedniStatus: odczytana.status, proponowanyStatus: 'PROPOSED' });
      }
      const elementy = operacja.zrodlo.typ === 'DECISION' ? [...powiazane, decyzja(operacja.zrodlo.id)] : powiazane;
      const klucze = new Set<string>();
      for (const odczytana of elementy) for (const element of odczytana.powiazaneElementy) {
        const klucz = `${element.typ}:${element.id}`;
        if (klucze.has(klucz)) continue;
        klucze.add(klucz);
        propozycje.push({ ...podstawa(`Sprawdź: ${typyElementow[element.typ]} — ${element.tytul}`), rodzaj: 'REVIEW', element });
      }
      for (const idProjektu of projektIds) {
        const odczytany = stan.projekty.find((projekt) => projekt.id === idProjektu && !projekt.zarchiwizowano);
        if (!odczytany) continue;
        const poprzednio = punktPowrotu(odczytany);
        const proponowane = { ...poprzednio, nastepnyKrok: 'Sprawdź wpływ nowej informacji na ustalenia projektu.' };
        if (poprzednio.nastepnyKrok !== proponowane.nastepnyKrok) propozycje.push({ ...podstawa(`Punkt powrotu: ${odczytany.nazwa}`), rodzaj: 'RESUME', projektId: idProjektu, poprzednio, proponowane });
      }
      const pochodzenie = operacja.kontekstAnalizyWpisu;
      wynik.analizy.push({ id, zrodlo: operacja.zrodlo, projektIds, utworzono: kontekst.czas, propozycje,
        ...(pochodzenie ? { zrodloAnalizyWpisu: { analizaWpisuId: pochodzenie.analizaWpisuId, elementAnalizyId: pochodzenie.elementAnalizyId, tresc: pochodzenie.tresc } } : {}),
      });
      zdarzenie('IMPACT_ANALYZED', 'Sprawdzono możliwy wpływ informacji', id, projektIds);
      break;
    }
    case 'rozstrzygnij': {
      const analiza = stan.analizy.find((analiza) => analiza.id === operacja.analizaId);
      const propozycja = analiza?.propozycje.find((propozycja) => propozycja.id === operacja.propozycjaId);
      if (!analiza || !propozycja) throw new Error('Propozycja wpływu nie istnieje.');
      if (propozycja.stan !== 'PENDING') throw new Error('Propozycja została już rozstrzygnięta.');
      if (operacja.zatwierdz) {
        if (propozycja.rodzaj === 'DECISION_STATUS') zmienStatus(decyzja(propozycja.decyzjaId), propozycja.proponowanyStatus, propozycja.wersja);
        if (propozycja.rodzaj === 'RESUME') {
          const odczytany = projekt(propozycja.projektId);
          if (JSON.stringify(punktPowrotu(odczytany)) !== JSON.stringify(propozycja.poprzednio)) throw new Error('Punkt powrotu zmienił się. Odrzuć tę propozycję i sprawdź wpływ ponownie.');
          const zmiana = zmienProjekt(odczytany, { rodzaj: 'punktPowrotu', dane: propozycja.proponowane }, { ...kontekst, idZdarzenia: `${kontekst.idZdarzenia}:punkt` });
          wynik.projekty.push(zmiana.projekt);
          wynik.zdarzenia.push(zmiana.zdarzenie);
        }
      }
      wynik.analizy.push({ ...analiza, propozycje: analiza.propozycje.map((obecna) => obecna.id === propozycja.id ? { ...obecna, stan: operacja.zatwierdz ? 'APPROVED' : 'REJECTED', rozstrzygnieto: kontekst.czas } : obecna) });
      zdarzenie(operacja.zatwierdz ? 'IMPACT_APPROVED' : 'IMPACT_REJECTED', operacja.zatwierdz ? 'Zatwierdzono pojedynczą propozycję wpływu' : 'Odrzucono propozycję wpływu', analiza.id, analiza.projektIds, propozycja.tytul);
      break;
    }
  }
  return wynik;
}

function punktPowrotu(projekt: Projekt): PunktPowrotu {
  return { ostatnioPracowanoNad: projekt.ostatnioPracowanoNad, podsumowanieAktualnegoStanu: projekt.podsumowanieAktualnegoStanu, nastepnyKrok: projekt.nastepnyKrok };
}
