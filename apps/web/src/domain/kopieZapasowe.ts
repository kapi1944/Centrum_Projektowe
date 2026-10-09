import { statusyProjektu, etykietyStatusowWpisu } from './modele';
import type { Projekt, Wpis, ZdarzenieAktywnosci } from './modele';
import { statusyDecyzji, typyElementow } from './ustalenia';
import type { Decyzja, AnalizaWplywu } from './ustalenia';
import { typyAnalizy, etykietyReview, etykietyStatusowAnalizy, etykietyDostawcowAnalizy } from './analizaWpisu';
import type { AnalizaWpisu } from './analizaWpisu';
import { statusyObszaru, statusyEtapu, statusyPracy, typyPracy, priorytetyPracy, statusyPytania, statusyBlokady, wagiBlokady } from './realizacja';
import type { StanRealizacji } from './realizacja';
import { migrujAnalize, type PrzebiegAnalizyWpisu } from './przebiegiAnaliz';

export interface DaneKopii extends StanRealizacji {
  projekty: Projekt[]; wpisy: Wpis[]; zdarzenia: ZdarzenieAktywnosci[];
  decyzje: Decyzja[]; analizyWplywu: AnalizaWplywu[]; analizyWpisow: AnalizaWpisu[];
  przebiegiAnaliz: PrzebiegAnalizyWpisu[];
}
export interface KopiaZapasowa {
  format: 'centrum-projektowe'; schemaVersion: 2; appVersion: string; exportedAt: string; data: DaneKopii;
}
export interface KopiaZapasowaV1 extends Omit<KopiaZapasowa, 'schemaVersion' | 'data'> {
  schemaVersion: 1; data: Omit<DaneKopii, 'przebiegiAnaliz'>;
}
export type TrybImportu = 'polacz' | 'zastap';

type Walidator = (wartosc: unknown) => boolean;
const tekst: Walidator = (wartosc) => typeof wartosc === 'string';
const identyfikator: Walidator = (wartosc) => tekst(wartosc) && (wartosc as string).trim().length > 0;
const data: Walidator = (wartosc) => tekst(wartosc) && Number.isFinite(Date.parse(wartosc as string));
const liczba: Walidator = (wartosc) => typeof wartosc === 'number' && Number.isFinite(wartosc);
const wersja: Walidator = (wartosc) => liczba(wartosc) && Number.isSafeInteger(wartosc) && (wartosc as number) > 0;
const opcjonalne = (sprawdz: Walidator): Walidator => (wartosc) => wartosc === undefined || sprawdz(wartosc);
const lubNull = (sprawdz: Walidator): Walidator => (wartosc) => wartosc === null || sprawdz(wartosc);
const lista = (sprawdz: Walidator): Walidator => (wartosc) => Array.isArray(wartosc) && wartosc.every(sprawdz);
const wybor = (wartosci: readonly string[]): Walidator => (wartosc) => typeof wartosc === 'string' && wartosci.includes(wartosc);
const etykiety = (mapa: object) => wybor(Object.keys(mapa));
function obiekt(pola: Record<string, Walidator>): Walidator {
  return (wartosc) => typeof wartosc === 'object' && wartosc !== null && !Array.isArray(wartosc)
    && Object.entries(pola).every(([pole, sprawdz]) => sprawdz((wartosc as Record<string, unknown>)[pole]));
}
const zrodlo = obiekt({ typ: wybor(['USER', 'SYSTEM', 'AI']), nazwa: tekst });
const podstawa = { id: identyfikator, utworzono: data };
const aktualizacja = { ...podstawa, zaktualizowano: data, wersja };
const polozenie = { projektId: identyfikator, obszarId: opcjonalne(identyfikator), etapId: opcjonalne(identyfikator) };
const pochodzenie = obiekt({ analizaWpisuId: identyfikator, elementAnalizyId: identyfikator, wpisId: identyfikator });
const elementPowiazany = obiekt({ typ: etykiety(typyElementow), id: identyfikator, tytul: tekst });
const punktPowrotu = obiekt({ ostatnioPracowanoNad: tekst, podsumowanieAktualnegoStanu: tekst, nastepnyKrok: tekst });
const propozycjaPodstawa = { id: identyfikator, tytul: tekst, uzasadnienie: tekst, stan: wybor(['PENDING', 'APPROVED', 'REJECTED']), rozstrzygnieto: opcjonalne(data) };
const propozycja: Walidator = (wartosc) => [
  obiekt({ ...propozycjaPodstawa, rodzaj: wybor(['DECISION_STATUS']), decyzjaId: identyfikator, wersja, poprzedniStatus: etykiety(statusyDecyzji), proponowanyStatus: wybor(['PROPOSED']) }),
  obiekt({ ...propozycjaPodstawa, rodzaj: wybor(['RESUME']), projektId: identyfikator, poprzednio: punktPowrotu, proponowane: punktPowrotu }),
  obiekt({ ...propozycjaPodstawa, rodzaj: wybor(['REVIEW']), element: elementPowiazany }),
].some((sprawdz) => sprawdz(wartosc));
const metadane: Walidator = (wartosc) => wartosc === null || ['string', 'boolean'].includes(typeof wartosc) || liczba(wartosc)
  || (Array.isArray(wartosc) ? wartosc.every(metadane) : typeof wartosc === 'object' && wartosc !== null && Object.values(wartosc).every(metadane));

// Jedyny pełny rejestr magazynów: format, walidacja i transakcje korzystają z tych samych kluczy.
export const schematDanych = {
  projekty: { etykieta: 'Projektów', sprawdz: obiekt({ ...podstawa, nazwa: tekst, opis: tekst, status: etykiety(statusyProjektu),
    podsumowanieAktualnegoStanu: tekst, ostatnioPracowanoNad: tekst, nastepnyKrok: tekst, zaktualizowano: data,
    ostatniaAktywnosc: data, zarchiwizowano: lubNull(data), zrodlo }) },
  wpisy: { etykieta: 'Wpisów', sprawdz: obiekt({ ...podstawa, trescOryginalna: tekst, projektId: lubNull(identyfikator),
    status: etykiety(etykietyStatusowWpisu), typZrodla: wybor(['MANUAL', 'IMPORT', 'OTHER']), zrodlo, odlozonoDoAnalizy: opcjonalne(lubNull(data)) }) },
  zdarzenia: { etykieta: 'Zdarzeń historii', sprawdz: obiekt({ ...podstawa, projektId: lubNull(identyfikator), projektIds: opcjonalne(lista(identyfikator)),
    encjaId: lubNull(identyfikator), typEncji: wybor(['PROJECT', 'CAPTURE', 'DECISION', 'IMPACT', 'WORK_ITEM', 'QUESTION', 'BLOCKER']),
    typZdarzenia: wybor(['PROJECT_CREATED', 'PROJECT_UPDATED', 'PROJECT_ARCHIVED', 'PROJECT_RESUME_UPDATED', 'CAPTURE_CREATED', 'CAPTURE_ASSIGNED', 'CAPTURE_DEFERRED', 'CAPTURE_DISMISSED', 'CAPTURE_ANALYZED', 'CAPTURE_REVIEWED', 'CAPTURE_ANALYSIS_APPLIED', 'ANALYSIS_RUN_STARTED', 'ANALYSIS_RUN_FAILED', 'ANALYSIS_PREFERRED_CHANGED', 'DECISION_CREATED', 'DECISION_STATUS_CHANGED', 'DECISION_SUPERSEDED', 'IMPACT_ANALYZED', 'IMPACT_APPROVED', 'IMPACT_REJECTED', 'WORK_ITEM_CREATED', 'WORK_ITEM_COMPLETED', 'QUESTION_RESOLVED', 'BLOCKER_CREATED', 'BLOCKER_RESOLVED']),
    tytul: tekst, opis: opcjonalne(tekst), zrodlo, metadane: opcjonalne((wartosc) => obiekt({})(wartosc) && metadane(wartosc)) }) },
  decyzje: { etykieta: 'Decyzji', sprawdz: obiekt({ ...aktualizacja, czytelneId: (wartosc) => tekst(wartosc) && /^DEC-\d+$/.test(wartosc as string),
    tytul: tekst, opis: tekst, projektIds: (wartosc) => lista(identyfikator)(wartosc) && (wartosc as string[]).length > 0,
    status: etykiety(statusyDecyzji), typZrodla: wybor(['USER', 'SYSTEM', 'AI']), nazwaZrodla: tekst, odniesienieZrodla: tekst,
    wpisZrodlowyId: lubNull(identyfikator), analizaWpisuId: opcjonalne(identyfikator), elementAnalizyId: opcjonalne(identyfikator),
    notatki: tekst, powiazaneElementy: lista(elementPowiazany), zastapionaPrzezId: lubNull(identyfikator) }) },
  analizyWplywu: { etykieta: 'Analiz wpływu', sprawdz: obiekt({ ...podstawa, zrodlo: obiekt({ typ: wybor(['CAPTURE', 'DECISION']), id: identyfikator }),
    projektIds: lista(identyfikator), propozycje: lista(propozycja), zrodloAnalizyWpisu: opcjonalne(obiekt({ analizaWpisuId: identyfikator, elementAnalizyId: identyfikator, tresc: tekst })) }) },
  analizyWpisow: { etykieta: 'Analiz wpisów', sprawdz: obiekt({ ...podstawa, wpisId: identyfikator, status: etykiety(etykietyStatusowAnalizy), wersja,
    typDostawcy: etykiety(etykietyDostawcowAnalizy), nazwaDostawcy: opcjonalne(tekst), wersjaDostawcy: opcjonalne(tekst), wersjaAnalizy: tekst,
    klasyfikacja: opcjonalne(tekst), podsumowanie: opcjonalne(tekst), sprawdzono: opcjonalne(data), zastosowano: opcjonalne(data),
    elementy: lista(obiekt({ id: identyfikator, typ: etykiety(typyAnalizy), tresc: tekst, trescOryginalna: tekst, trescEdytowana: opcjonalne(tekst),
      pewnosc: opcjonalne(liczba), zrodlo: wybor(['SYSTEM', 'AI']), statusReview: etykiety(etykietyReview),
      historiaReview: lista(obiekt({ status: wybor(['ACCEPTED', 'EDITED', 'REJECTED']), trescEdytowana: opcjonalne(tekst), czas: data, zrodlo })),
      zastosowanie: opcjonalne(obiekt({ czas: data, rodzaj: wybor(['DECISION', 'IMPACT', 'RETAINED']), encjaId: opcjonalne(identyfikator), projektId: opcjonalne(identyfikator) })) })) }) },
  obszary: { etykieta: 'Obszarów', sprawdz: obiekt({ ...aktualizacja, projektId: identyfikator, nazwa: tekst, opis: tekst, status: etykiety(statusyObszaru) }) },
  etapy: { etykieta: 'Etapów', sprawdz: obiekt({ ...aktualizacja, projektId: identyfikator, obszarId: opcjonalne(identyfikator), nazwa: tekst, opis: tekst, status: etykiety(statusyEtapu), kolejnosc: (wartosc) => liczba(wartosc) && Number.isSafeInteger(wartosc) && (wartosc as number) >= 0 }) },
  elementyPracy: { etykieta: 'Elementów pracy', sprawdz: obiekt({ ...aktualizacja, ...polozenie, typ: etykiety(typyPracy), tytul: tekst, opis: tekst,
    status: etykiety(statusyPracy), priorytet: opcjonalne(etykiety(priorytetyPracy)), decyzjaIds: lista(identyfikator), zakonczono: opcjonalne(data), pochodzenie: opcjonalne(pochodzenie) }) },
  pytania: { etykieta: 'Pytań', sprawdz: obiekt({ ...aktualizacja, ...polozenie, pytanie: tekst, kontekst: tekst, status: etykiety(statusyPytania), odpowiedz: opcjonalne(tekst), rozstrzygnieto: opcjonalne(data), pochodzenie: opcjonalne(pochodzenie) }) },
  blokady: { etykieta: 'Blokad', sprawdz: obiekt({ ...aktualizacja, ...polozenie, tytul: tekst, opis: tekst, status: etykiety(statusyBlokady), waga: etykiety(wagiBlokady), rozstrzygnieto: opcjonalne(data) }) },
  przebiegiAnaliz: { etykieta: 'Przebiegów analiz', sprawdz: (wartosc: unknown) => {
    if (!obiekt({ id: identyfikator, sourceId: identyfikator, sourceType: wybor(['CAPTURE']),
      provider: obiekt({ type: etykiety(etykietyDostawcowAnalizy), name: opcjonalne(tekst), version: opcjonalne(tekst) }),
      model: opcjonalne(tekst), promptVersion: opcjonalne(tekst), schemaVersion: wybor(['capture-analysis-v1']),
      preferred: (wartosc) => typeof wartosc === 'boolean', reviewStatus: wybor(['NOT_STARTED', 'GENERATED', 'IN_REVIEW', 'REVIEWED', 'APPLIED']),
      createdAt: data, supersedesAnalysisRunId: opcjonalne(identyfikator),
      migrationSource: opcjonalne(obiekt({ kind: wybor(['INDEXEDDB_V4', 'INDEXEDDB_V5', 'BACKUP_V1']), legacyAnalysisId: identyfikator })) })(wartosc)) return false;
    const przebieg = wartosc as PrzebiegAnalizyWpisu;
    if (przebieg.status === 'LEGACY_IMPORTED') return przebieg.startedAt === null && przebieg.finishedAt === null
      && przebieg.output !== null && przebieg.migrationSource?.legacyAnalysisId === przebieg.id;
    if (przebieg.migrationSource !== undefined || !data(przebieg.startedAt)) return false;
    if (przebieg.status === 'RUNNING') return przebieg.finishedAt === null && przebieg.output === null && !przebieg.preferred && przebieg.reviewStatus === 'NOT_STARTED';
    if (!data(przebieg.finishedAt) || Date.parse(przebieg.finishedAt!) < Date.parse(przebieg.startedAt!)) return false;
    if (przebieg.status === 'SUCCEEDED') return przebieg.output !== null && przebieg.reviewStatus !== 'NOT_STARTED';
    return ['FAILED', 'CANCELLED'].includes(przebieg.status) && przebieg.output === null && !przebieg.preferred && przebieg.reviewStatus === 'NOT_STARTED';
  } },
} satisfies Record<keyof DaneKopii, { etykieta: string; sprawdz: Walidator }>;
export const nazwyMagazynow = Object.keys(schematDanych) as (keyof DaneKopii)[];
export function pusteDaneKopii(): DaneKopii {
  return Object.fromEntries(nazwyMagazynow.map((nazwa) => [nazwa, []])) as unknown as DaneKopii;
}

export function sprawdzDaneKopii(wartosc: unknown): asserts wartosc is DaneKopii {
  sprawdzDane(wartosc, 2);
}
function sprawdzDane(wartosc: unknown, wersjaKopii: 1 | 2) {
  if (!obiekt({})(wartosc)) throw new Error('Niepoprawna struktura danych kopii.');
  const dane = wartosc as DaneKopii;
  const magazyny = wersjaKopii === 1 ? nazwyMagazynow.filter((nazwa) => nazwa !== 'przebiegiAnaliz') : nazwyMagazynow;
  if (Object.keys(dane).some((nazwa) => !magazyny.includes(nazwa as keyof DaneKopii))) throw new Error('Kopia zawiera nieobsługiwany magazyn.');
  for (const nazwa of magazyny) {
    if (!lista(schematDanych[nazwa].sprawdz)(dane[nazwa])) throw new Error(`Niepoprawne rekordy: ${schematDanych[nazwa].etykieta}.`);
    unikalne(dane[nazwa].map((rekord) => rekord.id));
  }
  sprawdzRelacje(dane, wersjaKopii);
}
function unikalne(wartosci: string[]) {
  if (new Set(wartosci).size !== wartosci.length) throw new Error('Kopia zawiera powtórzone identyfikatory lub klucze unikalne.');
}
function sprawdzRelacje(dane: DaneKopii, wersjaKopii: 1 | 2) {
  function znajdz<K extends keyof DaneKopii>(magazyn: K, id: string): DaneKopii[K][number] {
    const rekord = dane[magazyn].find((rekord) => rekord.id === id);
    if (!rekord) throw new Error('Kopia zawiera odwołanie do nieistniejącego rekordu.');
    return rekord;
  }
  function elementAnalizy(analizaId: string, elementId: string, wpisId?: string) {
    const analiza = znajdz('analizyWpisow', analizaId);
    if (!analiza.elementy.some((element) => element.id === elementId) || (wpisId && analiza.wpisId !== wpisId)) throw new Error('Niepoprawne pochodzenie z analizy wpisu.');
  }
  unikalne(dane.decyzje.map((rekord) => rekord.czytelneId));
  if (wersjaKopii === 1) unikalne(dane.analizyWpisow.map((rekord) => rekord.wpisId));
  const pochodzenia: string[] = [];
  for (const wpis of dane.wpisy) if (wpis.projektId) znajdz('projekty', wpis.projektId);
  for (const decyzja of dane.decyzje) {
    decyzja.projektIds.forEach((id) => znajdz('projekty', id));
    if (decyzja.wpisZrodlowyId) znajdz('wpisy', decyzja.wpisZrodlowyId);
    if (decyzja.zastapionaPrzezId) znajdz('decyzje', decyzja.zastapionaPrzezId);
    if (decyzja.analizaWpisuId || decyzja.elementAnalizyId) elementAnalizy(decyzja.analizaWpisuId ?? '', decyzja.elementAnalizyId ?? '', decyzja.wpisZrodlowyId ?? undefined);
  }
  for (const rekord of [...dane.obszary, ...dane.etapy, ...dane.elementyPracy, ...dane.pytania, ...dane.blokady]) znajdz('projekty', rekord.projektId);
  for (const rekord of [...dane.etapy, ...dane.elementyPracy, ...dane.pytania, ...dane.blokady]) {
    if (rekord.obszarId && znajdz('obszary', rekord.obszarId).projektId !== rekord.projektId) throw new Error('Obszar należy do innego projektu.');
    if ('etapId' in rekord && rekord.etapId) {
      const etap = znajdz('etapy', rekord.etapId);
      if (etap.projektId !== rekord.projektId || etap.obszarId !== rekord.obszarId) throw new Error('Niepoprawne przypisanie do etapu.');
    }
  }
  for (const praca of dane.elementyPracy) for (const id of praca.decyzjaIds) {
    if (!znajdz('decyzje', id).projektIds.includes(praca.projektId)) throw new Error('Decyzja należy do innego projektu.');
  }
  for (const rekord of [...dane.elementyPracy, ...dane.pytania]) if (rekord.pochodzenie) {
    const zrodlo = rekord.pochodzenie;
    znajdz('wpisy', zrodlo.wpisId);
    elementAnalizy(zrodlo.analizaWpisuId, zrodlo.elementAnalizyId, zrodlo.wpisId);
    pochodzenia.push(JSON.stringify([zrodlo.analizaWpisuId, zrodlo.elementAnalizyId]));
  }
  unikalne(pochodzenia);
  for (const analiza of dane.analizyWpisow) {
    znajdz('wpisy', analiza.wpisId); unikalne(analiza.elementy.map((element) => element.id));
    for (const element of analiza.elementy) {
      if (element.statusReview === 'EDITED' && element.trescEdytowana === undefined) throw new Error('Brak zatwierdzonej treści po edycji.');
      const zastosowanie = element.zastosowanie;
      if (zastosowanie?.projektId) znajdz('projekty', zastosowanie.projektId);
      if (zastosowanie && zastosowanie.rodzaj !== 'RETAINED') znajdz(zastosowanie.rodzaj === 'DECISION' ? 'decyzje' : 'analizyWplywu', zastosowanie.encjaId ?? '');
    }
  }
  for (const analiza of dane.analizyWplywu) {
    znajdz(analiza.zrodlo.typ === 'CAPTURE' ? 'wpisy' : 'decyzje', analiza.zrodlo.id);
    analiza.projektIds.forEach((id) => znajdz('projekty', id));
    unikalne(analiza.propozycje.map((propozycja) => propozycja.id));
    if (analiza.zrodloAnalizyWpisu) elementAnalizy(analiza.zrodloAnalizyWpisu.analizaWpisuId, analiza.zrodloAnalizyWpisu.elementAnalizyId);
    for (const propozycja of analiza.propozycje) {
      if (propozycja.rodzaj === 'RESUME') znajdz('projekty', propozycja.projektId);
      if (propozycja.rodzaj === 'DECISION_STATUS') znajdz('decyzje', propozycja.decyzjaId);
      // REVIEW i powiazaneElementy to ręczne odnośniki, także do zewnętrznych obiektów.
    }
  }
  if (wersjaKopii === 2) {
    const zWynikiem = dane.przebiegiAnaliz.filter((przebieg) => przebieg.status === 'SUCCEEDED' || przebieg.status === 'LEGACY_IMPORTED');
    for (const analiza of dane.analizyWpisow) {
      if (!zWynikiem.some((przebieg) => przebieg.id === analiza.id)) throw new Error('Brak przebiegu zapisanej analizy.');
    }
    for (const przebieg of dane.przebiegiAnaliz) {
      znajdz('wpisy', przebieg.sourceId);
      if (przebieg.supersedesAnalysisRunId) {
        const poprzedni = znajdz('przebiegiAnaliz', przebieg.supersedesAnalysisRunId);
        if (poprzedni.sourceId !== przebieg.sourceId || poprzedni.id === przebieg.id) throw new Error('Niepoprawne zastępowanie przebiegu.');
        const odwiedzone = new Set([przebieg.id]);
        let nastepny: PrzebiegAnalizyWpisu | undefined = poprzedni;
        while (nastepny) {
          if (odwiedzone.has(nastepny.id)) throw new Error('Cykl zastępowania analiz.');
          odwiedzone.add(nastepny.id);
          nastepny = nastepny.supersedesAnalysisRunId ? znajdz('przebiegiAnaliz', nastepny.supersedesAnalysisRunId) : undefined;
        }
      }
      if (przebieg.status === 'SUCCEEDED' || przebieg.status === 'LEGACY_IMPORTED') {
        const analiza = znajdz('analizyWpisow', przebieg.id);
        const historyczny = migrujAnalize(analiza, 'BACKUP_V1');
        if (analiza.wpisId !== przebieg.sourceId || analiza.status !== przebieg.reviewStatus
          || JSON.stringify(uporzadkuj(przebieg.output)) !== JSON.stringify(uporzadkuj(historyczny.output))
          || JSON.stringify(uporzadkuj(przebieg.provider)) !== JSON.stringify(uporzadkuj(historyczny.provider))) throw new Error('Przebieg nie odpowiada wynikowi i review analizy.');
      } else if (dane.analizyWpisow.some((analiza) => analiza.id === przebieg.id)) throw new Error('Niezakończony przebieg nie może mieć review.');
    }
    for (const sourceId of new Set(zWynikiem.map((przebieg) => przebieg.sourceId))) {
      if (zWynikiem.filter((przebieg) => przebieg.sourceId === sourceId && przebieg.preferred).length !== 1) throw new Error('Źródło musi mieć dokładnie jedną aktualną analizę z wynikiem.');
    }
  }
  const magazynyEncji = { PROJECT: 'projekty', CAPTURE: 'wpisy', DECISION: 'decyzje', IMPACT: 'analizyWplywu', WORK_ITEM: 'elementyPracy', QUESTION: 'pytania', BLOCKER: 'blokady' } as const;
  for (const zdarzenie of dane.zdarzenia) {
    if (zdarzenie.projektId) znajdz('projekty', zdarzenie.projektId);
    zdarzenie.projektIds?.forEach((id) => znajdz('projekty', id));
    if (zdarzenie.encjaId) znajdz(magazynyEncji[zdarzenie.typEncji], zdarzenie.encjaId);
  }
}
export function sprawdzKopie(wartosc: unknown): asserts wartosc is KopiaZapasowa | KopiaZapasowaV1 {
  if (!obiekt({ format: wybor(['centrum-projektowe']) })(wartosc)) throw new Error('To nie jest kopia Centrum Projektowego.');
  const kopia = wartosc as KopiaZapasowa | KopiaZapasowaV1;
  if (kopia.schemaVersion !== 1 && kopia.schemaVersion !== 2) throw new Error('Nieobsługiwana wersja schematu kopii.');
  if (!obiekt({ appVersion: identyfikator, exportedAt: data })(kopia)) throw new Error('Niepoprawne metadane kopii.');
  sprawdzDane(kopia.data, kopia.schemaVersion);
}
export function migrujKopie(wartosc: unknown): KopiaZapasowa {
  sprawdzKopie(wartosc);
  const kopia = structuredClone(wartosc);
  if (kopia.schemaVersion === 2) return kopia;
  const wynik: KopiaZapasowa = { ...kopia, schemaVersion: 2, data: { ...kopia.data,
    przebiegiAnaliz: kopia.data.analizyWpisow.map((analiza) => migrujAnalize(analiza, 'BACKUP_V1')) } };
  sprawdzDaneKopii(wynik.data);
  return wynik;
}
export function odczytajKopie(tekstKopii: string): KopiaZapasowa | KopiaZapasowaV1 {
  let kopia: unknown;
  try { kopia = JSON.parse(tekstKopii); } catch { throw new Error('Nie udało się odczytać pliku JSON.'); }
  sprawdzKopie(kopia);
  return kopia;
}
function uporzadkuj(wartosc: unknown): unknown {
  if (Array.isArray(wartosc)) return wartosc.map(uporzadkuj);
  if (wartosc && typeof wartosc === 'object') return Object.fromEntries(Object.entries(wartosc).filter(([, wartosc]) => wartosc !== undefined).sort(([pierwszy], [drugi]) => pierwszy.localeCompare(drugi)).map(([klucz, wartosc]) => [klucz, uporzadkuj(wartosc)]));
  return wartosc;
}
export interface KonfliktKopii { magazyn: keyof DaneKopii; id: string; obecny: unknown; importowany: unknown }
export class BladKonfliktow extends Error {
  constructor(public konflikty: KonfliktKopii[]) { super('Wykryto konflikty. Żadne dane nie zostały zapisane.'); }
}
export function polaczDane(obecne: DaneKopii, importowane: DaneKopii): DaneKopii {
  const wynik = pusteDaneKopii();
  const konflikty: KonfliktKopii[] = [];
  for (const magazyn of nazwyMagazynow) {
    const rekordy = new Map(obecne[magazyn].map((rekord) => [rekord.id, rekord]));
    for (const rekord of importowane[magazyn]) {
      const obecny = rekordy.get(rekord.id);
      if (obecny && JSON.stringify(uporzadkuj(obecny)) !== JSON.stringify(uporzadkuj(rekord))) konflikty.push({ magazyn, id: rekord.id, obecny, importowany: rekord });
      else if (!obecny) rekordy.set(rekord.id, rekord);
    }
    // Klucze i rekordy są zweryfikowane wspólnym rejestrem przed zapisem.
    (wynik[magazyn] as { id: string }[]) = [...rekordy.values()];
  }
  if (konflikty.length) throw new BladKonfliktow(konflikty);
  sprawdzDaneKopii(wynik);
  return wynik;
}
