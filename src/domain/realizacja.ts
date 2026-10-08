import type { AnalizaWpisu } from './analizaWpisu';
import type { KontekstZapisu, Projekt, Wpis, ZdarzenieAktywnosci } from './modele';
import type { Decyzja } from './ustalenia';

export const statusyObszaru = { ACTIVE: 'Aktywny', COMPLETED: 'Zakończony', ARCHIVED: 'Archiwalny' } as const;
export const statusyEtapu = { PLANNED: 'Zaplanowany', IN_PROGRESS: 'W toku', COMPLETED: 'Zakończony', ABANDONED: 'Porzucony' } as const;
export const typyPracy = {
  TASK: 'Zadanie', RESEARCH: 'Badanie', EXPERIMENT: 'Eksperyment', CONTACT: 'Kontakt',
  PURCHASE: 'Zakup', FOLLOW_UP: 'Dalsze działanie', WAITING: 'Oczekiwanie',
} as const;
export const statusyPracy = { TODO: 'Do zrobienia', IN_PROGRESS: 'W toku', WAITING: 'Oczekuje', BLOCKED: 'Zablokowane', DONE: 'Zakończone', ABANDONED: 'Porzucone' } as const;
export const priorytetyPracy = { LOW: 'Niski', MEDIUM: 'Średni', HIGH: 'Wysoki' } as const;
export const statusyPytania = { OPEN: 'Otwarte', ANSWERED: 'Z odpowiedzią', DISMISSED: 'Odrzucone' } as const;
export const statusyBlokady = { ACTIVE: 'Aktywna', RESOLVED: 'Rozwiązana', DISMISSED: 'Odrzucona' } as const;
export const wagiBlokady = { LOW: 'Niska', MEDIUM: 'Średnia', HIGH: 'Wysoka', CRITICAL: 'Krytyczna' } as const;

interface Umiejscowienie { projektId: string; obszarId?: string; etapId?: string }
export interface PochodzenieAnalizy { analizaWpisuId: string; elementAnalizyId: string; wpisId: string }
interface RekordRealizacji { id: string; utworzono: string; zaktualizowano: string; wersja: number }
export interface DaneObszaru { projektId: string; nazwa: string; opis: string; status: keyof typeof statusyObszaru }
export interface Obszar extends DaneObszaru, RekordRealizacji {}
export interface DaneEtapu extends Omit<Umiejscowienie, 'etapId'> { nazwa: string; opis: string; status: keyof typeof statusyEtapu; kolejnosc: number }
export interface Etap extends DaneEtapu, RekordRealizacji {}
export interface DaneElementuPracy extends Umiejscowienie {
  typ: keyof typeof typyPracy; tytul: string; opis: string; status: keyof typeof statusyPracy;
  priorytet?: keyof typeof priorytetyPracy; decyzjaIds: string[];
}
export interface ElementPracy extends DaneElementuPracy, RekordRealizacji { zakonczono?: string; pochodzenie?: PochodzenieAnalizy }
export interface DanePytania extends Umiejscowienie { pytanie: string; kontekst: string; status: keyof typeof statusyPytania; odpowiedz?: string }
export interface OtwartePytanie extends DanePytania, RekordRealizacji { rozstrzygnieto?: string; pochodzenie?: PochodzenieAnalizy }
export interface DaneBlokady extends Umiejscowienie { tytul: string; opis: string; status: keyof typeof statusyBlokady; waga: keyof typeof wagiBlokady }
export interface Blokada extends DaneBlokady, RekordRealizacji { rozstrzygnieto?: string }
export interface StanRealizacji { obszary: Obszar[]; etapy: Etap[]; elementyPracy: ElementPracy[]; pytania: OtwartePytanie[]; blokady: Blokada[] }
export const pustaRealizacja: StanRealizacji = { obszary: [], etapy: [], elementyPracy: [], pytania: [], blokady: [] };

type ZapisRealizacji = { rodzaj: 'obszar'; dane: DaneObszaru } | { rodzaj: 'etap'; dane: DaneEtapu }
  | { rodzaj: 'praca'; dane: DaneElementuPracy } | { rodzaj: 'pytanie'; dane: DanePytania } | { rodzaj: 'blokada'; dane: DaneBlokady };
export type OperacjaRealizacji = (ZapisRealizacji & { id: string; wersja?: number })
  | { rodzaj: 'konwertuj'; id: string; projektId: string; analizaWpisuId: string; elementAnalizyId: string; typPracy?: keyof typeof typyPracy };
export type ZapisanyRekord = { magazyn: 'obszary'; rekord: Obszar } | { magazyn: 'etapy'; rekord: Etap }
  | { magazyn: 'elementyPracy'; rekord: ElementPracy } | { magazyn: 'pytania'; rekord: OtwartePytanie } | { magazyn: 'blokady'; rekord: Blokada };
export interface WynikRealizacji {
  realizacja: StanRealizacji; zapis: ZapisanyRekord; projekt: Projekt; zdarzenia: ZdarzenieAktywnosci[];
}

export function wykonajRealizacje(
  stan: StanRealizacji & { projekty: Projekt[]; decyzje: Decyzja[]; wpisy: Wpis[]; analizyWpisow: AnalizaWpisu[] },
  operacja: OperacjaRealizacji, kontekst: KontekstZapisu,
): WynikRealizacji {
  const projektId = operacja.rodzaj === 'konwertuj' ? operacja.projektId : operacja.dane.projektId;
  const projekt = stan.projekty.find((projekt) => projekt.id === projektId && !projekt.zarchiwizowano);
  if (!projekt) throw new Error('Wybierz istniejący, niearchiwalny projekt.');
  if (!operacja.id.trim()) throw new Error('Brak identyfikatora rekordu.');
  const zdarzenia: ZdarzenieAktywnosci[] = [];
  function zdarzenie(typZdarzenia: ZdarzenieAktywnosci['typZdarzenia'], typEncji: ZdarzenieAktywnosci['typEncji'], tytul: string) {
    zdarzenia.push({ id: kontekst.idZdarzenia, projektId, encjaId: operacja.id, typEncji, typZdarzenia, tytul,
      utworzono: kontekst.czas, zrodlo: kontekst.zrodlo });
  }
  function sprawdzEdycje<T extends RekordRealizacji & { projektId: string }>(rekordy: T[], wersja?: number) {
    const poprzedni = rekordy.find((rekord) => rekord.id === operacja.id);
    if (poprzedni ? poprzedni.wersja !== wersja || poprzedni.projektId !== projektId : wersja !== undefined) {
      throw new Error('Rekord zmienił się lub identyfikator jest zajęty. Odśwież dane.');
    }
    return poprzedni;
  }
  function daty(poprzedni?: RekordRealizacji): RekordRealizacji {
    return { id: operacja.id, utworzono: poprzedni?.utworzono ?? kontekst.czas, zaktualizowano: kontekst.czas, wersja: (poprzedni?.wersja ?? 0) + 1 };
  }
  function sprawdzPolozenie(dane: Umiejscowienie) {
    if (dane.obszarId && !stan.obszary.some((obszar) => obszar.id === dane.obszarId && obszar.projektId === projektId)) throw new Error('Obszar nie należy do projektu.');
    if (dane.etapId && !stan.etapy.some((etap) => etap.id === dane.etapId && etap.projektId === projektId && etap.obszarId === dane.obszarId)) throw new Error('Etap nie należy do wybranego projektu i obszaru.');
  }
  function sprawdzEtykiete(mapa: object, wartosc: string) {
    if (!Object.hasOwn(mapa, wartosc)) throw new Error('Niepoprawny typ, status lub priorytet.');
  }
  function wymagana(tresc: string) {
    if (!tresc.trim()) throw new Error('Uzupełnij nazwę, tytuł lub treść pytania.');
  }
  let zapis: ZapisanyRekord;
  switch (operacja.rodzaj) {
    case 'obszar': {
      const dane = operacja.dane;
      wymagana(dane.nazwa); sprawdzEtykiete(statusyObszaru, dane.status);
      zapis = { magazyn: 'obszary', rekord: { ...dane, ...daty(sprawdzEdycje(stan.obszary, operacja.wersja)) } };
      break;
    }
    case 'etap': {
      const dane = operacja.dane;
      wymagana(dane.nazwa); sprawdzEtykiete(statusyEtapu, dane.status); sprawdzPolozenie(dane);
      if (!Number.isSafeInteger(dane.kolejnosc) || dane.kolejnosc < 0) throw new Error('Kolejność musi być nieujemną liczbą całkowitą.');
      const poprzedni = sprawdzEdycje(stan.etapy, operacja.wersja);
      if (poprzedni && poprzedni.obszarId !== dane.obszarId && [...stan.elementyPracy, ...stan.pytania, ...stan.blokady].some((rekord) => rekord.etapId === poprzedni.id)) throw new Error('Etap ma powiązane elementy. Najpierw zmień ich przypisanie.');
      zapis = { magazyn: 'etapy', rekord: { ...dane, ...daty(poprzedni) } };
      break;
    }
    case 'praca': {
      const dane = operacja.dane;
      wymagana(dane.tytul); sprawdzPolozenie(dane); sprawdzEtykiete(typyPracy, dane.typ); sprawdzEtykiete(statusyPracy, dane.status);
      if (dane.priorytet) sprawdzEtykiete(priorytetyPracy, dane.priorytet);
      const decyzjaIds = [...new Set(dane.decyzjaIds)];
      if (decyzjaIds.some((id) => !stan.decyzje.some((decyzja) => decyzja.id === id && decyzja.projektIds.includes(projektId)))) throw new Error('Powiązana decyzja nie należy do projektu.');
      const poprzedni = sprawdzEdycje(stan.elementyPracy, operacja.wersja);
      const rekord: ElementPracy = { ...dane, decyzjaIds, ...daty(poprzedni), pochodzenie: poprzedni?.pochodzenie,
        zakonczono: dane.status === 'DONE' ? poprzedni?.zakonczono ?? kontekst.czas : undefined };
      zapis = { magazyn: 'elementyPracy', rekord };
      if (!poprzedni) zdarzenie('WORK_ITEM_CREATED', 'WORK_ITEM', `Utworzono element pracy: ${dane.tytul}`);
      else if (poprzedni.status !== 'DONE' && dane.status === 'DONE') zdarzenie('WORK_ITEM_COMPLETED', 'WORK_ITEM', `Ukończono element pracy: ${dane.tytul}`);
      break;
    }
    case 'pytanie': {
      const dane = operacja.dane;
      wymagana(dane.pytanie); sprawdzPolozenie(dane); sprawdzEtykiete(statusyPytania, dane.status);
      if (dane.status === 'ANSWERED' && !dane.odpowiedz?.trim()) throw new Error('Podaj odpowiedź na pytanie.');
      const poprzedni = sprawdzEdycje(stan.pytania, operacja.wersja);
      zapis = { magazyn: 'pytania', rekord: { ...dane, ...daty(poprzedni), pochodzenie: poprzedni?.pochodzenie,
        odpowiedz: dane.status === 'ANSWERED' ? dane.odpowiedz : undefined,
        rozstrzygnieto: dane.status === 'OPEN' ? undefined : poprzedni?.status === dane.status ? poprzedni.rozstrzygnieto : kontekst.czas } };
      if (dane.status !== 'OPEN' && dane.status !== poprzedni?.status) zdarzenie('QUESTION_RESOLVED', 'QUESTION', `${dane.status === 'ANSWERED' ? 'Odpowiedziano na pytanie' : 'Odrzucono pytanie'}: ${dane.pytanie}`);
      break;
    }
    case 'blokada': {
      const dane = operacja.dane;
      wymagana(dane.tytul); sprawdzPolozenie(dane); sprawdzEtykiete(statusyBlokady, dane.status); sprawdzEtykiete(wagiBlokady, dane.waga);
      const poprzedni = sprawdzEdycje(stan.blokady, operacja.wersja);
      zapis = { magazyn: 'blokady', rekord: { ...dane, ...daty(poprzedni), rozstrzygnieto: dane.status === 'ACTIVE' ? undefined : poprzedni?.status === dane.status ? poprzedni.rozstrzygnieto : kontekst.czas } };
      if (!poprzedni) zdarzenie('BLOCKER_CREATED', 'BLOCKER', `Utworzono blokadę: ${dane.tytul}`);
      else if (poprzedni.status !== 'RESOLVED' && dane.status === 'RESOLVED') zdarzenie('BLOCKER_RESOLVED', 'BLOCKER', `Rozwiązano blokadę: ${dane.tytul}`);
      break;
    }
    case 'konwertuj': {
      const analiza = stan.analizyWpisow.find((analiza) => analiza.id === operacja.analizaWpisuId);
      const element = analiza?.elementy.find((element) => element.id === operacja.elementAnalizyId);
      const wpis = stan.wpisy.find((wpis) => wpis.id === analiza?.wpisId);
      if (!analiza || analiza.status !== 'APPLIED' || !wpis || !element || element.zastosowanie?.rodzaj !== 'RETAINED'
        || !['ACCEPTED', 'EDITED'].includes(element.statusReview) || !['RECOMMENDED_ACTION', 'OPEN_QUESTION'].includes(element.typ)) throw new Error('Wybierz zatwierdzony i zachowany element zastosowanej analizy.');
      if (wpis.projektId && wpis.projektId !== projektId) throw new Error('Wybierz projekt przypisany do wpisu.');
      if ([...stan.elementyPracy, ...stan.pytania].some((rekord) => rekord.pochodzenie?.analizaWpisuId === analiza.id && rekord.pochodzenie.elementAnalizyId === element.id)) throw new Error('Ten element analizy został już przekształcony.');
      const pochodzenie = { analizaWpisuId: analiza.id, elementAnalizyId: element.id, wpisId: wpis.id };
      const tresc = element.statusReview === 'EDITED' ? element.trescEdytowana! : element.trescOryginalna;
      if (element.typ === 'RECOMMENDED_ACTION') {
        sprawdzEdycje(stan.elementyPracy);
        const typ = operacja.typPracy ?? 'TASK'; sprawdzEtykiete(typyPracy, typ);
        zapis = { magazyn: 'elementyPracy', rekord: { ...daty(), projektId, typ, tytul: tresc, opis: '', status: 'TODO', decyzjaIds: [], pochodzenie } };
        zdarzenie('WORK_ITEM_CREATED', 'WORK_ITEM', `Utworzono element pracy z analizy: ${tresc}`);
      } else {
        sprawdzEdycje(stan.pytania);
        zapis = { magazyn: 'pytania', rekord: { ...daty(), projektId, pytanie: tresc, kontekst: '', status: 'OPEN', pochodzenie } };
      }
      break;
    }
  }
  const realizacja: StanRealizacji = { obszary: stan.obszary, etapy: stan.etapy, elementyPracy: stan.elementyPracy, pytania: stan.pytania, blokady: stan.blokady };
  // Wspólny identyfikator i projekt są sprawdzone przed zastąpieniem pojedynczego rekordu.
  switch (zapis.magazyn) {
    case 'obszary': realizacja.obszary = [...stan.obszary.filter((rekord) => rekord.id !== zapis.rekord.id), zapis.rekord]; break;
    case 'etapy': realizacja.etapy = [...stan.etapy.filter((rekord) => rekord.id !== zapis.rekord.id), zapis.rekord]; break;
    case 'elementyPracy': realizacja.elementyPracy = [...stan.elementyPracy.filter((rekord) => rekord.id !== zapis.rekord.id), zapis.rekord]; break;
    case 'pytania': realizacja.pytania = [...stan.pytania.filter((rekord) => rekord.id !== zapis.rekord.id), zapis.rekord]; break;
    case 'blokady': realizacja.blokady = [...stan.blokady.filter((rekord) => rekord.id !== zapis.rekord.id), zapis.rekord]; break;
  }
  return { realizacja, zapis, projekt: { ...projekt, ostatniaAktywnosc: kontekst.czas > projekt.ostatniaAktywnosc ? kontekst.czas : projekt.ostatniaAktywnosc }, zdarzenia };
}
