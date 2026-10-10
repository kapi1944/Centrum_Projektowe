import type { KorektaUzytkownika, PropozycjaZmiany, ZestawZmian, KopertaZdarzeniaDomenowego } from '@centrum-projektowe/domain';
import type { DaneKopii } from './kopieZapasowe';
import { sprawdzHistorieZmianyWartosci } from './kopieZapasowe';
import type { KontekstZapisu } from './modele';
import { wykonajOperacjeUstalen } from './ustalenia';
import type { StatusReview } from './analizaWpisu';

export const typyKorekt = {
  FACT_CORRECTION: 'Korekta faktu', PREFERENCE_CHANGE: 'Zmiana preferencji', GOAL_CHANGE: 'Zmiana celu',
  SCOPE_CHANGE: 'Zmiana zakresu', PRIORITY_CHANGE: 'Zmiana priorytetu', CONSTRAINT_CHANGE: 'Zmiana ograniczenia',
  TECHNICAL_CONSTRAINT: 'Ograniczenie techniczne', TEST_RESULT: 'Wynik testu', REJECTION: 'Odrzucenie', OTHER: 'Inne',
} as const;
export const typyCelow = { PROJECT: 'Projekt', RESUME: 'Gdzie skończyłem?', DECISION: 'Decyzja', WORK_ITEM: 'Element pracy',
  QUESTION: 'Pytanie', BLOCKER: 'Bloker', CAPTURE: 'Oryginalny wpis', ANALYSIS_RUN: 'Przebieg analizy' } as const;
export const polaKorekty = {
  PROJECT: { opis: 'Opis / cel / zakres projektu' },
  RESUME: { ostatnioPracowanoNad: 'Ostatnio robiłem', podsumowanieAktualnegoStanu: 'Aktualny stan', nastepnyKrok: 'Następny krok' },
  DECISION: { opis: 'Treść decyzji' }, WORK_ITEM: { tytul: 'Tytuł', opis: 'Opis', priorytet: 'Priorytet' },
  QUESTION: { pytanie: 'Pytanie', kontekst: 'Kontekst', odpowiedz: 'Odpowiedź' }, BLOCKER: { tytul: 'Tytuł', opis: 'Opis' },
  CAPTURE: {}, ANALYSIS_RUN: {},
} as const;
export type { KorektaUzytkownika };
export type DaneKorekty = Omit<KorektaUzytkownika, 'utworzono' | 'utworzyl' | 'status' | 'typZrodla' | 'poprzedniaWartosc'>;
export interface OperacjaZmianyKorekty {
  id: string; rodzaj: 'KOREKTA' | 'WPLYW'; tresc: string; status: StatusReview; trescEdytowana?: string;
  propozycjaWplywuId?: string;
  historiaReview: { status: Exclude<StatusReview, 'PENDING'>; trescEdytowana?: string; czas: string; autor: string }[];
}
export type PropozycjaKorekty = PropozycjaZmiany<OperacjaZmianyKorekty> & {
  correctionId: string; impactAnalysisId: string; reviewRevision: number; createdAt: string;
};
export type ZestawZmianKorekty = ZestawZmian<OperacjaZmianyKorekty> & { correctionId: string; appliedAt: string };
export type ZdarzenieKorekty = KopertaZdarzeniaDomenowego<{
  correctionId: string; changeSetId: string; operationId: string; before: unknown; after: unknown;
}>;
export interface StanKorekt {
  korekty: KorektaUzytkownika[]; propozycjeZmian: PropozycjaKorekty[]; zestawyZmian: ZestawZmianKorekty[];
  zdarzeniaDomenowe: ZdarzenieKorekty[];
}
export const pusteKorekty: StanKorekt = { korekty: [], propozycjeZmian: [], zestawyZmian: [], zdarzeniaDomenowe: [] };
export type OperacjaKorekty =
  | { rodzaj: 'utworz'; dane: DaneKorekty }
  | { rodzaj: 'review'; id: string; wersja: number; operacjaId: string; status: Exclude<StatusReview, 'PENDING'>; trescEdytowana?: string }
  | { rodzaj: 'zastosuj'; id: string; wersja: number; idempotencyKey: string }
  | { rodzaj: 'odwroc'; id: string; noweId: string };

const magazynyCelow = { PROJECT: 'projekty', RESUME: 'projekty', DECISION: 'decyzje', WORK_ITEM: 'elementyPracy',
  QUESTION: 'pytania', BLOCKER: 'blokady', CAPTURE: 'wpisy', ANALYSIS_RUN: 'przebiegiAnaliz' } as const;

export function odczytajCel(dane: DaneKopii, korekta: Pick<KorektaUzytkownika, 'typCelu' | 'celId' | 'projektId' | 'pole'>) {
  const cel = dane[magazynyCelow[korekta.typCelu]].find((rekord) => rekord.id === korekta.celId);
  if (!cel) throw new Error('Cel korekty nie istnieje.');
  const projektId = 'projektId' in cel ? cel.projektId : 'sourceId' in cel
    ? dane.wpisy.find((wpis) => wpis.id === cel.sourceId)?.projektId : cel.id;
  if ('projektIds' in cel ? !cel.projektIds.includes(korekta.projektId) : projektId !== korekta.projektId) throw new Error('Cel należy do innego projektu.');
  if (korekta.pole && !Object.hasOwn(polaKorekty[korekta.typCelu], korekta.pole)) throw new Error('Nieobsługiwane pole korekty.');
  return cel;
}
export function wartoscCelu(dane: DaneKopii, korekta: Pick<KorektaUzytkownika, 'typCelu' | 'celId' | 'projektId' | 'pole'>): string {
  const cel = odczytajCel(dane, korekta);
  if (korekta.pole) return String((cel as unknown as Record<string, unknown>)[korekta.pole] ?? '');
  return 'trescOryginalna' in cel ? cel.trescOryginalna : 'output' in cel ? cel.output?.podsumowanie ?? '' : '';
}
function rewizjaCelu(dane: DaneKopii, korekta: KorektaUzytkownika): string { return JSON.stringify(odczytajCel(dane, korekta)); }

// Zwracamy nowy stan; adapter zapisuje wyłącznie zmienione rekordy w jednej jednostce pracy.
export function wykonajKorekte(obecne: DaneKopii, operacja: OperacjaKorekty, kontekst: KontekstZapisu): DaneKopii {
  const dane = structuredClone(obecne);
  const stanUstalen = () => ({ projekty: dane.projekty, wpisy: dane.wpisy, decyzje: dane.decyzje, analizy: dane.analizyWplywu });
  function aktywnosc(korekta: KorektaUzytkownika, typ: 'CORRECTION_CREATED' | 'CORRECTION_REVIEWED' | 'CORRECTION_APPLIED', tytul: string, projektIds = projektyKorekty(korekta)) {
    for (const projektId of projektIds) dane.zdarzenia.push({
      id: projektId === korekta.projektId ? kontekst.idZdarzenia : `${kontekst.idZdarzenia}:projekt:${projektId}`,
      projektId, typEncji: 'CORRECTION', encjaId: korekta.id, metadane: { operacjaZrodlowaId: kontekst.idZdarzenia },
      typZdarzenia: typ, tytul, utworzono: kontekst.czas, zrodlo: kontekst.zrodlo });
  }
  function projektyKorekty(korekta: KorektaUzytkownika): string[] {
    return korekta.typCelu === 'DECISION'
      ? [...new Set(dane.decyzje.find((decyzja) => decyzja.id === korekta.celId)!.projektIds)] : [korekta.projektId];
  }
  function utworz(nowe: DaneKorekty) {
    const projekt = dane.projekty.find((projekt) => projekt.id === nowe.projektId && !projekt.zarchiwizowano);
    if (!projekt || !nowe.id.trim() || !Object.hasOwn(typyKorekt, nowe.typ) || !Object.hasOwn(typyCelow, nowe.typCelu)
      || !nowe.opis.trim() || dane.korekty.some((korekta) => korekta.id === nowe.id)) throw new Error('Niepoprawna lub powtórzona korekta.');
    if (!['CAPTURE', 'ANALYSIS_RUN'].includes(nowe.typCelu) && (!nowe.pole || nowe.nowaWartosc === undefined)) throw new Error('Wskaż pole i wartość po korekcie.');
    const korekta: KorektaUzytkownika = { ...nowe, poprzedniaWartosc: wartoscCelu(dane, nowe), status: 'PROPOSED',
      utworzono: kontekst.czas, utworzyl: kontekst.zrodlo.nazwa, typZrodla: kontekst.zrodlo.typ };
    dane.korekty.push(korekta);
    const wynik = wykonajOperacjeUstalen(stanUstalen(), { rodzaj: 'analizuj', zrodlo: { typ: 'CORRECTION', id: korekta.id },
      projektIdsKorekty: projektyKorekty(korekta) }, kontekst);
    const analiza = wynik.analizy[0];
    analiza.propozycje = analiza.propozycje.filter((wplyw) => !(wplyw.rodzaj === 'DECISION_STATUS' && korekta.typCelu === 'DECISION' && wplyw.decyzjaId === korekta.celId)
      && !(wplyw.rodzaj === 'RESUME' && korekta.typCelu === 'RESUME' && wplyw.projektId === korekta.celId));
    // Rozszerzamy tę samą analizę wpływu o istniejące encje pracy i analizy.
    for (const [typ, rekordy] of [['WORK_ITEM', dane.elementyPracy], ['QUESTION', dane.pytania], ['BLOCKER', dane.blokady]] as const) {
      for (const rekord of rekordy.filter((rekord) => korekta.typCelu === 'DECISION'
        ? dane.decyzje.find((decyzja) => decyzja.id === korekta.celId)!.powiazaneElementy.some((element) => element.typ === typ && element.id === rekord.id)
          || ('decyzjaIds' in rekord && rekord.decyzjaIds.includes(korekta.celId))
        : rekord.projektId === korekta.projektId).filter((rekord) =>
        !analiza.propozycje.some((propozycja) => propozycja.rodzaj === 'REVIEW' && propozycja.element.typ === typ && propozycja.element.id === rekord.id))) analiza.propozycje.push({
        id: `${analiza.id}:cel:${typ}:${rekord.id}`, rodzaj: 'REVIEW', stan: 'PENDING',
        tytul: `Sprawdź: ${typyCelow[typ]} — ${'tytul' in rekord ? rekord.tytul : rekord.pytanie}`,
        uzasadnienie: korekta.typCelu === 'DECISION' ? 'Jawne powiązanie z korygowaną decyzją; kandydat do sprawdzenia.' : 'Wspólny projekt z korektą; kandydat do sprawdzenia przez użytkownika.',
        element: { typ, id: rekord.id, tytul: 'tytul' in rekord ? rekord.tytul : rekord.pytanie },
      });
    }
    for (const przebieg of dane.przebiegiAnaliz.filter((przebieg) => korekta.typCelu === 'DECISION'
      ? dane.decyzje.find((decyzja) => decyzja.id === korekta.celId)!.powiazaneElementy.some((element) => element.typ === 'ANALYSIS_RUN' && element.id === przebieg.id)
      : dane.wpisy.some((wpis) => wpis.id === przebieg.sourceId && wpis.projektId === korekta.projektId)).filter((przebieg) =>
      !analiza.propozycje.some((propozycja) => propozycja.rodzaj === 'REVIEW' && propozycja.element.typ === 'ANALYSIS_RUN' && propozycja.element.id === przebieg.id))) {
      analiza.propozycje.push({ id: `${analiza.id}:run:${przebieg.id}`, rodzaj: 'REVIEW', stan: 'PENDING',
        tytul: 'Sprawdź powiązany przebieg analizy', uzasadnienie: 'Wspólny projekt z korektą.',
        element: { typ: 'ANALYSIS_RUN', id: przebieg.id, tytul: 'Przebieg analizy' } });
    }
    dane.analizyWplywu.push(analiza);
    dane.propozycjeZmian.push({ id: `propozycja-${korekta.id}`, schemaVersion: 1, sourceId: korekta.id,
      analysisRunId: korekta.typCelu === 'ANALYSIS_RUN' ? korekta.celId : undefined, elementIds: [], correctionId: korekta.id,
      impactAnalysisId: analiza.id, reviewRevision: 1, createdAt: kontekst.czas,
      expectedRevisions: { cel: rewizjaCelu(dane, korekta) }, operations: [
        { id: `${korekta.id}:zmiana`, rodzaj: 'KOREKTA', tresc: korekta.nowaWartosc ?? korekta.opis, status: 'PENDING', historiaReview: [] },
        ...analiza.propozycje.map((wplyw) => ({ id: `${korekta.id}:${wplyw.id}`, rodzaj: 'WPLYW' as const,
          tresc: wplyw.tytul, status: 'PENDING' as const, historiaReview: [], propozycjaWplywuId: wplyw.id })),
      ] });
    aktywnosc(korekta, 'CORRECTION_CREATED', 'Zgłoszono korektę — wymaga weryfikacji');
  }
  if (operacja.rodzaj === 'utworz') { utworz(operacja.dane); return dane; }
  const korekta = dane.korekty.find((korekta) => korekta.id === operacja.id);
  if (!korekta) throw new Error('Korekta nie istnieje.');
  const propozycja = dane.propozycjeZmian.find((propozycja) => propozycja.correctionId === korekta.id)!;
  if (operacja.rodzaj === 'odwroc') {
    const zastosowana = dane.zestawyZmian.find((zestaw) => zestaw.correctionId === korekta.id);
    if (!zastosowana?.operations.some((zmiana) => zmiana.rodzaj === 'KOREKTA') || !korekta.pole) throw new Error('Ta korekta nie ma odwracalnej zmiany pola.');
    const zdarzenie = dane.zdarzeniaDomenowe.find((zdarzenie) => zdarzenie.payload?.changeSetId === zastosowana.id && zdarzenie.eventType === 'CORRECTION_VALUE_CHANGED');
    if (!zdarzenie) throw new Error('Brak poprawnej historii zmiany wartości. Nie można odwrócić korekty.');
    sprawdzHistorieZmianyWartosci(dane, zdarzenie, korekta, zastosowana);
    const celId = korekta.typCelu === 'DECISION' ? (zdarzenie?.payload.after as { id: string }).id : korekta.celId;
    utworz({ ...korekta, id: operacja.noweId, celId, nowaWartosc: korekta.poprzedniaWartosc,
      opis: `Odwrócenie korekty: ${korekta.opis}`, odwracaKorekteId: korekta.id });
    return dane;
  }
  if (dane.projekty.find((projekt) => projekt.id === korekta.projektId)?.zarchiwizowano) throw new Error('Projekt jest archiwalny.');
  if (operacja.rodzaj === 'zastosuj') {
    const poprzedni = dane.zestawyZmian.find((zestaw) => zestaw.idempotencyKey === operacja.idempotencyKey);
    if (poprzedni) {
      if (poprzedni.correctionId !== korekta.id || poprzedni.reviewRevision !== operacja.wersja) throw new Error('Klucz zastosowania jest zajęty.');
      return dane;
    }
    if (!operacja.idempotencyKey.trim()) throw new Error('Podaj klucz zastosowania.');
  }
  if (korekta.status !== 'PROPOSED' || propozycja.reviewRevision !== operacja.wersja) throw new Error('Review zmieniło się lub korekta została rozstrzygnięta. Odśwież dane.');
  if (operacja.rodzaj === 'review') {
    if (!['ACCEPTED', 'EDITED', 'REJECTED'].includes(operacja.status)) throw new Error('Niepoprawny stan review.');
    const zmiana = propozycja.operations.find((zmiana) => zmiana.id === operacja.operacjaId);
    if (!zmiana) throw new Error('Propozycja nie istnieje.');
    if (operacja.status === 'EDITED' && !operacja.trescEdytowana?.trim()) throw new Error('Treść po edycji nie może być pusta.');
    dane.propozycjeZmian = dane.propozycjeZmian.map((obecna) => obecna.id !== propozycja.id ? obecna : { ...propozycja,
      reviewRevision: propozycja.reviewRevision + 1, operations: propozycja.operations.map((obecna) => obecna.id !== zmiana.id ? obecna : {
        ...zmiana, status: operacja.status, trescEdytowana: operacja.status === 'EDITED' ? operacja.trescEdytowana : undefined,
        historiaReview: [...zmiana.historiaReview, { status: operacja.status, trescEdytowana: operacja.status === 'EDITED' ? operacja.trescEdytowana : undefined, czas: kontekst.czas, autor: kontekst.zrodlo.nazwa }],
      }) });
    aktywnosc(korekta, 'CORRECTION_REVIEWED', 'Zapisano weryfikację propozycji korekty');
    return dane;
  }
  if (propozycja.operations.some((zmiana) => zmiana.status === 'PENDING')) throw new Error('Rozstrzygnij wszystkie propozycje przed zastosowaniem.');
  const zmiany = propozycja.operations.filter((zmiana) => zmiana.status === 'ACCEPTED' || zmiana.status === 'EDITED');
  const zestaw: ZestawZmianKorekty = { id: `zestaw-${korekta.id}`, schemaVersion: 1, proposalId: propozycja.id,
    reviewId: propozycja.id, reviewRevision: propozycja.reviewRevision, correctionId: korekta.id, operations: structuredClone(zmiany),
    expectedRevisions: propozycja.expectedRevisions, idempotencyKey: operacja.idempotencyKey, appliedAt: kontekst.czas };
  const dotknieteProjekty = new Set(projektyKorekty(korekta));
  function zdarzenie(zmiana: OperacjaZmianyKorekty, typ: string, przed: unknown, po: unknown, projektIds = projektyKorekty(korekta!)) {
    projektIds.forEach((id) => dotknieteProjekty.add(id));
    dane.zdarzeniaDomenowe.push({ id: `${kontekst.idZdarzenia}:domena:${zmiana.id}`, eventType: typ, eventVersion: 1,
      aggregateType: 'CORRECTION', aggregateId: korekta!.id, projectIds: [...new Set(projektIds)], occurredAt: kontekst.czas,
      actor: kontekst.zrodlo, source: kontekst.zrodlo,
      payload: { correctionId: korekta!.id, changeSetId: zestaw.id, operationId: zmiana.id,
        before: JSON.parse(JSON.stringify(przed)), after: JSON.parse(JSON.stringify(po)) } });
  }
  for (const zmiana of propozycja.operations) {
    if (zmiana.rodzaj === 'KOREKTA' && zmiana.status !== 'REJECTED') {
      if (rewizjaCelu(dane, korekta) !== propozycja.expectedRevisions.cel) throw new Error('Cel korekty zmienił się. Zgłoś nową korektę.');
      const przed = structuredClone(odczytajCel(dane, korekta));
      const tresc = zmiana.status === 'EDITED' ? zmiana.trescEdytowana! : zmiana.tresc;
      if (korekta.typCelu === 'DECISION') {
        const decyzja = dane.decyzje.find((decyzja) => decyzja.id === korekta.celId)!;
        const wynik = wykonajOperacjeUstalen(stanUstalen(), { rodzaj: 'zastap', id: decyzja.id, wersja: decyzja.wersja,
          noweId: `decyzja-${korekta.id}`, dane: { ...decyzja, opis: tresc, typZrodla: korekta.typZrodla,
            nazwaZrodla: korekta.utworzyl, odniesienieZrodla: `Korekta ${korekta.id}` } }, { ...kontekst, idZdarzenia: `${kontekst.idZdarzenia}:decyzja` });
        for (const nowa of wynik.decyzje) dane.decyzje = [...dane.decyzje.filter((obecna) => obecna.id !== nowa.id), nowa];
        const nowa = wynik.decyzje.find((decyzja) => decyzja.id === `decyzja-${korekta.id}`)!;
        zdarzenie(zmiana, 'CORRECTION_VALUE_CHANGED', przed, nowa, [...decyzja.projektIds, ...nowa.projektIds]);
      } else if (korekta.pole) {
        if (korekta.pole === 'priorytet' && !['LOW', 'MEDIUM', 'HIGH'].includes(tresc)) throw new Error('Wybierz poprawny priorytet.');
        const po = { ...przed, [korekta.pole]: tresc, zaktualizowano: kontekst.czas, ...('wersja' in przed ? { wersja: przed.wersja + 1 } : {}) };
        const magazyn = magazynyCelow[korekta.typCelu];
        (dane[magazyn] as { id: string }[]) = dane[magazyn].map((rekord) => rekord.id === po.id ? po : rekord);
        zdarzenie(zmiana, 'CORRECTION_VALUE_CHANGED', przed, po);
      } else zdarzenie(zmiana, 'CORRECTION_KNOWLEDGE_RETAINED', przed, { tresc, korektaId: korekta.id });
    }
    if (zmiana.rodzaj === 'WPLYW') {
      const analiza = dane.analizyWplywu.find((analiza) => analiza.id === propozycja.impactAnalysisId)!;
      const wplyw = analiza.propozycje.find((wplyw) => wplyw.id === zmiana.propozycjaWplywuId)!;
      const przed = structuredClone(wplyw.rodzaj === 'DECISION_STATUS' ? dane.decyzje.find((decyzja) => decyzja.id === wplyw.decyzjaId)
        : wplyw.rodzaj === 'RESUME' ? dane.projekty.find((projekt) => projekt.id === wplyw.projektId) : wplyw);
      if (zmiana.status === 'EDITED' && wplyw.rodzaj === 'RESUME') wplyw.proponowanePoReview = { ...wplyw.proponowane, nastepnyKrok: zmiana.trescEdytowana! };
      else if (zmiana.status === 'EDITED') wplyw.uzasadnieniePoReview = zmiana.trescEdytowana!;
      const wynik = wykonajOperacjeUstalen(stanUstalen(), { rodzaj: 'rozstrzygnij', analizaId: analiza.id, propozycjaId: wplyw.id,
        zatwierdz: zmiana.status !== 'REJECTED' }, { ...kontekst, idZdarzenia: `${kontekst.idZdarzenia}:${zmiana.id}` });
      for (const nowa of wynik.decyzje) dane.decyzje = [...dane.decyzje.filter((obecna) => obecna.id !== nowa.id), nowa];
      for (const nowy of wynik.projekty) dane.projekty = dane.projekty.map((projekt) => projekt.id === nowy.id ? nowy : projekt);
      for (const nowa of wynik.analizy) dane.analizyWplywu = dane.analizyWplywu.map((analiza) => analiza.id === nowa.id ? nowa : analiza);
      if (zmiana.status !== 'REJECTED') zdarzenie(zmiana, 'CORRECTION_IMPACT_APPLIED', przed, wynik,
        [...projektyKorekty(korekta), ...wynik.decyzje.flatMap((decyzja) => decyzja.projektIds), ...wynik.projekty.map((projekt) => projekt.id)]);
    }
  }
  if (zmiany.length) dane.zestawyZmian.push(zestaw);
  if (zmiany.length) dane.projekty = dane.projekty.map((projekt) => dotknieteProjekty.has(projekt.id)
    ? { ...projekt, ostatniaAktywnosc: kontekst.czas > projekt.ostatniaAktywnosc ? kontekst.czas : projekt.ostatniaAktywnosc } : projekt);
  dane.korekty = dane.korekty.map((obecna) => obecna.id === korekta.id ? { ...korekta, status: zmiany.length ? 'APPLIED' : 'REJECTED' } : obecna);
  aktywnosc(korekta, 'CORRECTION_APPLIED', zmiany.length ? 'Zastosowano zatwierdzony zestaw zmian' : 'Odrzucono propozycje korekty', [...dotknieteProjekty]);
  return dane;
}
