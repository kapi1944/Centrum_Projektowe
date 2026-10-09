import type { KontekstZapisu, Wpis, ZrodloDanych } from './modele';
import { wykonajOperacjeUstalen, type StanUstalen, type WynikUstalen } from './ustalenia';

export const typyAnalizy = {
  FACT: 'Twierdzenia do potwierdzenia', ASSUMPTION: 'Założenia', SUGGESTION: 'Sugestie', POSSIBLE_DECISION: 'Potencjalne decyzje',
  OPEN_QUESTION: 'Pytania', RECOMMENDED_ACTION: 'Proponowane działania', IMPACT_CANDIDATE: 'Możliwy wpływ',
} as const;
export type TypElementuAnalizy = keyof typeof typyAnalizy;
export type StatusReview = 'PENDING' | 'ACCEPTED' | 'EDITED' | 'REJECTED';
export const etykietyReview: Record<StatusReview, string> = {
  PENDING: 'Oczekuje na weryfikację', ACCEPTED: 'Zaakceptowano', EDITED: 'Zaakceptowano po edycji', REJECTED: 'Odrzucono',
};
export const etykietyStatusowAnalizy: Record<AnalizaWpisu['status'], string> = {
  GENERATED: 'Wygenerowana', IN_REVIEW: 'W trakcie weryfikacji', REVIEWED: 'Zweryfikowana', APPLIED: 'Zastosowana',
};
export const etykietyDostawcowAnalizy: Record<WynikDostawcyAnalizy['typDostawcy'], string> = {
  RULE_BASED: 'Analiza regułowa', REMOTE_LLM: 'Zdalny model językowy', LOCAL_LLM: 'Lokalny model językowy',
};
export interface PropozycjaAnalizy {
  typ: TypElementuAnalizy;
  tresc: string;
  pewnosc?: number;
  zrodlo: 'SYSTEM' | 'AI';
}
export interface WynikDostawcyAnalizy {
  typDostawcy: 'RULE_BASED' | 'REMOTE_LLM' | 'LOCAL_LLM';
  nazwaDostawcy?: string;
  wersjaDostawcy?: string;
  wersjaAnalizy: string;
  klasyfikacja?: string;
  podsumowanie?: string;
  elementy: PropozycjaAnalizy[];
}
export interface AnalysisProvider {
  analizuj(trescOryginalna: string): Promise<WynikDostawcyAnalizy>;
}
export interface ElementAnalizy extends PropozycjaAnalizy {
  id: string;
  trescOryginalna: string;
  trescEdytowana?: string;
  statusReview: StatusReview;
  historiaReview: { status: Exclude<StatusReview, 'PENDING'>; trescEdytowana?: string; czas: string; zrodlo: ZrodloDanych }[];
  zastosowanie?: { czas: string; rodzaj: 'DECISION' | 'IMPACT' | 'RETAINED'; encjaId?: string; projektId?: string };
}
export interface AnalizaWpisu extends Omit<WynikDostawcyAnalizy, 'elementy'> {
  id: string;
  wpisId: string;
  utworzono: string;
  status: 'GENERATED' | 'IN_REVIEW' | 'REVIEWED' | 'APPLIED';
  wersja: number;
  sprawdzono?: string;
  zastosowano?: string;
  elementy: ElementAnalizy[];
}
export type OperacjaAnalizyWpisu =
  | { rodzaj: 'generuj'; id: string; wpisId: string; wynik: WynikDostawcyAnalizy }
  | { rodzaj: 'rozpocznij'; id: string; wersja: number }
  | { rodzaj: 'review'; id: string; wersja: number; elementId: string; status: Exclude<StatusReview, 'PENDING'>; trescEdytowana?: string }
  | { rodzaj: 'zakoncz'; id: string; wersja: number }
  | { rodzaj: 'zastosuj'; id: string; wersja: number; projektId?: string };
export interface WynikAnalizyWpisu extends WynikUstalen {
  analizaWpisu: AnalizaWpisu;
  wpis: Wpis;
}

export function wykonajAnalizeWpisu(
  stan: StanUstalen, analizyWpisow: AnalizaWpisu[], operacja: OperacjaAnalizyWpisu, kontekst: KontekstZapisu,
): WynikAnalizyWpisu {
  let analiza: AnalizaWpisu;
  if (operacja.rodzaj === 'generuj') {
    if (analizyWpisow.some((analiza) => analiza.wpisId === operacja.wpisId || analiza.id === operacja.id)) throw new Error('Wpis ma już analizę. Otwórz zapisaną weryfikację.');
    const wynik = operacja.wynik;
    if (!['RULE_BASED', 'REMOTE_LLM', 'LOCAL_LLM'].includes(wynik.typDostawcy) || !wynik.wersjaAnalizy.trim()) throw new Error('Niepoprawne pochodzenie analizy.');
    analiza = {
      ...wynik, id: operacja.id, wpisId: operacja.wpisId, utworzono: kontekst.czas, status: 'GENERATED', wersja: 1,
      elementy: wynik.elementy.map((element, numer) => {
        if (!Object.hasOwn(typyAnalizy, element.typ) || !element.tresc.trim() || !['SYSTEM', 'AI'].includes(element.zrodlo)
          || (element.pewnosc !== undefined && (!Number.isFinite(element.pewnosc) || element.pewnosc < 0 || element.pewnosc > 1))) throw new Error('Niepoprawny element analizy.');
        return { typ: element.typ, tresc: element.tresc, pewnosc: element.pewnosc, zrodlo: element.zrodlo,
          id: `${operacja.id}:${numer + 1}`, trescOryginalna: element.tresc, statusReview: 'PENDING', historiaReview: [] };
      }),
    };
  } else {
    const odczytana = analizyWpisow.find((analiza) => analiza.id === operacja.id);
    if (!odczytana) throw new Error('Analiza wpisu nie istnieje.');
    if (odczytana.wersja !== operacja.wersja) throw new Error('Analiza zmieniła się. Odśwież dane przed weryfikacją lub zastosowaniem.');
    if (odczytana.status === 'APPLIED') throw new Error('Analiza została już zastosowana.');
    analiza = { ...odczytana, wersja: odczytana.wersja + 1, elementy: odczytana.elementy.map((element) => ({ ...element })) };
  }
  const wpis = stan.wpisy.find((wpis) => wpis.id === analiza.wpisId);
  if (!wpis || wpis.status === 'DISMISSED' || wpis.status === 'APPLIED') throw new Error('Wpis nie istnieje lub jest już zamknięty.');
  const wynik: WynikAnalizyWpisu = { analizaWpisu: analiza, wpis: { ...wpis }, decyzje: [], analizy: [], projekty: [], zdarzenia: [] };
  function zdarzenie(typ: 'CAPTURE_ANALYZED' | 'CAPTURE_REVIEWED' | 'CAPTURE_ANALYSIS_APPLIED', tytul: string) {
    wynik.zdarzenia.push({ id: kontekst.idZdarzenia, projektId: wpis!.projektId, typEncji: 'CAPTURE', encjaId: wpis!.id,
      typZdarzenia: typ, tytul, utworzono: kontekst.czas, zrodlo: kontekst.zrodlo,
      metadane: { analizaId: analiza.id, wersjaAnalizy: analiza.wersjaAnalizy, wersjaReview: analiza.wersja,
        elementy: analiza.elementy.map((element) => ({ id: element.id, typ: element.typ, status: element.statusReview, zastosowanie: element.zastosowanie?.rodzaj ?? null })) },
    });
  }
  switch (operacja.rodzaj) {
    case 'generuj':
      if (wpis.status !== 'UNPROCESSED') throw new Error('Analiza wymaga nieprzetworzonego wpisu.');
      wynik.wpis.status = 'ANALYZED';
      wynik.wpis.odlozonoDoAnalizy = null;
      zdarzenie('CAPTURE_ANALYZED', 'Wygenerowano analizę wpisu — wymaga weryfikacji');
      break;
    case 'rozpocznij':
      if (analiza.status !== 'GENERATED') throw new Error('Weryfikacja została już rozpoczęta.');
      analiza.status = 'IN_REVIEW';
      break;
    case 'review': {
      if (analiza.status !== 'IN_REVIEW') throw new Error('Najpierw rozpocznij weryfikację.');
      const element = analiza.elementy.find((element) => element.id === operacja.elementId);
      if (!element || !['ACCEPTED', 'EDITED', 'REJECTED'].includes(operacja.status)) throw new Error('Niepoprawne rozstrzygnięcie elementu.');
      if (operacja.status === 'EDITED' && !operacja.trescEdytowana?.trim()) throw new Error('Treść po edycji nie może być pusta.');
      element.statusReview = operacja.status;
      element.trescEdytowana = operacja.status === 'EDITED' ? operacja.trescEdytowana : undefined;
      element.historiaReview = [...element.historiaReview, { status: operacja.status, trescEdytowana: element.trescEdytowana, czas: kontekst.czas, zrodlo: kontekst.zrodlo }];
      break;
    }
    case 'zakoncz':
      if (analiza.status !== 'IN_REVIEW' || analiza.elementy.some((element) => element.statusReview === 'PENDING')) throw new Error('Rozstrzygnij wszystkie elementy przed zakończeniem weryfikacji.');
      analiza.status = 'REVIEWED';
      analiza.sprawdzono = kontekst.czas;
      wynik.wpis.status = 'REVIEWED';
      zdarzenie('CAPTURE_REVIEWED', 'Zakończono weryfikację analizy wpisu');
      break;
    case 'zastosuj': {
      if (analiza.status !== 'REVIEWED' || analiza.elementy.some((element) => element.statusReview === 'PENDING')) throw new Error('Zakończ weryfikację przed zastosowaniem.');
      const zatwierdzone = analiza.elementy.filter((element) => element.statusReview === 'ACCEPTED' || element.statusReview === 'EDITED');
      if (!zatwierdzone.length) throw new Error('Brak zatwierdzonych elementów do zastosowania.');
      const projektId = wpis.projektId ?? operacja.projektId;
      if (zatwierdzone.some((element) => ['POSSIBLE_DECISION', 'IMPACT_CANDIDATE'].includes(element.typ))
        && !stan.projekty.some((projekt) => projekt.id === projektId && !projekt.zarchiwizowano)) throw new Error('Wybierz aktywny projekt dla decyzji lub wpływu.');
      let stanBiezacy = { ...stan };
      for (const element of zatwierdzone) {
        const tresc = element.statusReview === 'EDITED' ? element.trescEdytowana! : element.trescOryginalna;
        element.zastosowanie = { czas: kontekst.czas, rodzaj: 'RETAINED' };
        if (element.typ !== 'POSSIBLE_DECISION' && element.typ !== 'IMPACT_CANDIDATE') continue;
        const powiazanie = { analizaWpisuId: analiza.id, elementAnalizyId: element.id };
        const wynikUstalen = wykonajOperacjeUstalen(stanBiezacy, element.typ === 'POSSIBLE_DECISION'
          ? { rodzaj: 'utworz', id: `decyzja-${element.id}`, dane: {
            tytul: tresc, opis: tresc, projektIds: [projektId!], typZrodla: element.zrodlo,
            nazwaZrodla: analiza.nazwaDostawcy ?? etykietyDostawcowAnalizy[analiza.typDostawcy], odniesienieZrodla: analiza.id,
            wpisZrodlowyId: wpis.id, ...powiazanie, notatki: 'Zatwierdzony element analizy; decyzja wymaga osobnego przyjęcia.', powiazaneElementy: [],
          } }
          : { rodzaj: 'analizuj', zrodlo: { typ: 'CAPTURE', id: wpis.id }, kontekstAnalizyWpisu: { ...powiazanie, projektId: projektId!, tresc } },
        { ...kontekst, idZdarzenia: `${kontekst.idZdarzenia}:${element.id}` });
        element.zastosowanie = { czas: kontekst.czas, projektId, rodzaj: element.typ === 'POSSIBLE_DECISION' ? 'DECISION' : 'IMPACT',
          encjaId: wynikUstalen.decyzje[0]?.id ?? wynikUstalen.analizy[0]?.id };
        wynik.decyzje.push(...wynikUstalen.decyzje);
        wynik.analizy.push(...wynikUstalen.analizy);
        wynik.zdarzenia.push(...wynikUstalen.zdarzenia);
        wynik.projekty = [...wynik.projekty.filter((projekt) => !wynikUstalen.projekty.some((nowy) => nowy.id === projekt.id)), ...wynikUstalen.projekty];
        stanBiezacy = { ...stanBiezacy, decyzje: [...stanBiezacy.decyzje, ...wynikUstalen.decyzje],
          projekty: stanBiezacy.projekty.map((projekt) => wynikUstalen.projekty.find((nowy) => nowy.id === projekt.id) ?? projekt) };
      }
      analiza.status = 'APPLIED';
      analiza.zastosowano = kontekst.czas;
      wynik.wpis.status = 'APPLIED';
      zdarzenie('CAPTURE_ANALYSIS_APPLIED', 'Zastosowano zatwierdzone elementy analizy wpisu');
      break;
    }
  }
  return wynik;
}
