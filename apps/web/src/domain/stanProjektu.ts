import type { DaneKopii } from './kopieZapasowe';
import type { Projekt } from './modele';
import type { Decyzja } from './ustalenia';
import type { Blokada, ElementPracy, OtwartePytanie } from './realizacja';

export const typyUwagi = {
  BLOCKER: 'Bloker', DECISION_REQUIRED: 'Potrzebna decyzja', STALE_DECISION: 'Nieaktualna decyzja',
  UNPROCESSED_CAPTURE: 'Nieprzetworzony wpis', STALE_DOCUMENT: 'Nieaktualny dokument', CONFLICT: 'Konflikt',
  REVIEW_REQUIRED: 'Wymagana weryfikacja', FAILED_INTEGRATION: 'Błąd integracji', MISSING_NEXT_STEP: 'Brak następnego kroku',
} as const;
export const wagiUwagi = { LOW: 'Niska', MEDIUM: 'Średnia', HIGH: 'Wysoka', CRITICAL: 'Krytyczna' } as const;
export interface OdnosnikStanu { id: string; tytul: string; adres: string }
export interface ElementUwagi {
  id: string; projektId: string; typ: keyof typeof typyUwagi; waga: keyof typeof wagiUwagi;
  tytul: string; opis: string; powod: string; odnosnikiZrodel: OdnosnikStanu[]; utworzono: string; rozwiazano?: string;
}
export interface MigawkaProjektu {
  projektId: string; rewizja: string; wygenerowano: string; podsumowanie: string;
  aktualneCele: string[]; aktywneOgraniczenia: OdnosnikStanu[]; aktywneDecyzje: Decyzja[];
  otwartePytania: OtwartePytanie[]; blokery: Blokada[]; aktualnaPraca: ElementPracy[];
  sugerowaneDzialania: OdnosnikStanu[]; nieaktualneElementy: OdnosnikStanu[];
  ostatnieZmiany: OdnosnikStanu[];
}
export type ProjectSnapshot = MigawkaProjektu;
export type AttentionItem = ElementUwagi;
export interface ObrazProjektu { migawka: MigawkaProjektu; uwaga: ElementUwagi[] }

function uporzadkuj<T extends { id: string }>(rekordy: T[]): T[] {
  return [...rekordy].sort((lewy, prawy) => lewy.id < prawy.id ? -1 : lewy.id > prawy.id ? 1 : 0);
}

export function wyliczStanProjektu(dane: DaneKopii, projekt: Projekt): ObrazProjektu {
  const adresProjektu = `/projekty/${projekt.id}`;
  const odnosnik = (id: string, tytul: string, adres = adresProjektu): OdnosnikStanu => ({ id, tytul, adres });
  const decyzje = uporzadkuj(dane.decyzje.filter((rekord) => rekord.projektIds.includes(projekt.id)));
  const praca = uporzadkuj(dane.elementyPracy.filter((rekord) => rekord.projektId === projekt.id && !['DONE', 'ABANDONED'].includes(rekord.status)));
  const pytania = uporzadkuj(dane.pytania.filter((rekord) => rekord.projektId === projekt.id && rekord.status === 'OPEN'));
  const blokery = uporzadkuj(dane.blokady.filter((rekord) => rekord.projektId === projekt.id && rekord.status === 'ACTIVE'));
  const aktywneDecyzje = decyzje.filter((rekord) => !['PROPOSED', 'SUPERSEDED', 'REJECTED'].includes(rekord.status));
  // Ograniczenia pochodzą wyłącznie z zastosowanych korekt, nadal odpowiadających bieżącej wartości celu.
  const ograniczenia = uporzadkuj(dane.korekty.filter((rekord) => rekord.projektId === projekt.id && rekord.status === 'APPLIED'
    && ['CONSTRAINT_CHANGE', 'TECHNICAL_CONSTRAINT'].includes(rekord.typ))).filter((korekta) => {
    const zdarzenie = dane.zdarzeniaDomenowe.find((rekord) => rekord.payload.correctionId === korekta.id
      && rekord.eventType === 'CORRECTION_VALUE_CHANGED');
    const po = zdarzenie?.payload.after as Record<string, unknown> | undefined;
    const cel = [...dane.projekty, ...dane.decyzje, ...dane.elementyPracy, ...dane.pytania, ...dane.blokady].find((rekord) => rekord.id === po?.id);
    return !!cel && !!korekta.pole && (cel as unknown as Record<string, unknown>)[korekta.pole] === po?.[korekta.pole]
      && (!('status' in cel) || !['SUPERSEDED', 'REJECTED', 'RESOLVED', 'DISMISSED', 'DONE', 'ABANDONED'].includes(cel.status));
  }).map((korekta) => {
    const zdarzenie = dane.zdarzeniaDomenowe.find((rekord) => rekord.payload.correctionId === korekta.id && rekord.eventType === 'CORRECTION_VALUE_CHANGED')!;
    return odnosnik(korekta.id, String((zdarzenie.payload.after as Record<string, unknown>)[korekta.pole!]), `${adresProjektu}/korekty`);
  });
  const nieaktualne = praca.flatMap((rekord) => rekord.decyzjaIds.filter((id) => decyzje.some((decyzja) => decyzja.id === id
    && ['SUPERSEDED', 'REJECTED'].includes(decyzja.status))).map((id) => odnosnik(`${rekord.id}:${id}`, `${rekord.tytul} — powiązana decyzja już nie obowiązuje`)));
  const sugerowane = projekt.nastepnyKrok.trim() ? [odnosnik(projekt.id, projekt.nastepnyKrok)]
    : praca.filter((rekord) => ['TODO', 'IN_PROGRESS'].includes(rekord.status))
      .sort((lewy, prawy) => ({ HIGH: 0, MEDIUM: 1, LOW: 2 }[lewy.priorytet ?? 'MEDIUM']) - ({ HIGH: 0, MEDIUM: 1, LOW: 2 }[prawy.priorytet ?? 'MEDIUM']))
      .slice(0, 1).map((rekord) => odnosnik(rekord.id, rekord.tytul));
  const tresc = { podsumowanie: projekt.podsumowanieAktualnegoStanu, aktualneCele: projekt.opis.trim() ? [projekt.opis] : [],
    aktywneOgraniczenia: ograniczenia, aktywneDecyzje, otwartePytania: pytania, blokery, aktualnaPraca: praca,
    sugerowaneDzialania: sugerowane, nieaktualneElementy: nieaktualne };
  const zdarzenia = dane.zdarzeniaDomenowe.filter((rekord) => rekord.projectIds.includes(projekt.id));
  const ostatniCzas = zdarzenia.map((rekord) => rekord.occurredAt).sort((lewy, prawy) => Date.parse(prawy) - Date.parse(lewy))[0];
  const ostatnieZmiany = uporzadkuj(zdarzenia.filter((rekord) => rekord.occurredAt === ostatniCzas)).map((rekord) =>
    odnosnik(rekord.id, dane.korekty.find((korekta) => korekta.id === rekord.payload.correctionId)?.opis ?? 'Zastosowano zatwierdzoną zmianę', `${adresProjektu}/korekty`));
  const wygenerowano = [projekt.zaktualizowano, ...zdarzenia.map((rekord) => rekord.occurredAt),
    ...decyzje.map((rekord) => rekord.zaktualizowano), ...dane.elementyPracy.filter((rekord) => rekord.projektId === projekt.id).map((rekord) => rekord.zaktualizowano),
    ...dane.blokady.filter((rekord) => rekord.projektId === projekt.id).map((rekord) => rekord.zaktualizowano),
    ...dane.pytania.filter((rekord) => rekord.projektId === projekt.id).map((rekord) => rekord.zaktualizowano)]
    .sort((lewy, prawy) => Date.parse(prawy) - Date.parse(lewy) || lewy.localeCompare(prawy))[0];
  // Rewizja jest pełnym kluczem treści, bez kolizji skrótu i bez zależności od zegara odczytu.
  const migawka: MigawkaProjektu = { projektId: projekt.id, rewizja: JSON.stringify({ ...tresc, ostatnieZmiany, wygenerowano }), wygenerowano, ...tresc, ostatnieZmiany };
  const uwaga: ElementUwagi[] = [];
  function dodaj(typ: ElementUwagi['typ'], id: string, tytul: string, opis: string, powod: string, utworzono: string,
    odnosnikiZrodel: OdnosnikStanu[], waga: ElementUwagi['waga'] = 'MEDIUM') {
    uwaga.push({ id: `${projekt.id}:${typ}:${id}`, projektId: projekt.id, typ, waga, tytul, opis, powod, utworzono, odnosnikiZrodel });
  }
  if (!projekt.zarchiwizowano && !['COMPLETED', 'ABANDONED'].includes(projekt.status)) {
    for (const bloker of blokery) dodaj('BLOCKER', bloker.id, bloker.tytul, bloker.opis, 'Bloker ma status „Aktywna”.', bloker.utworzono, [odnosnik(bloker.id, 'Otwórz bloker')], bloker.waga);
    for (const decyzja of decyzje.filter((rekord) => rekord.status === 'PROPOSED')) dodaj('DECISION_REQUIRED', decyzja.id, decyzja.tytul, decyzja.opis,
      'Decyzja ma status „Propozycja”; nie zaliczamy jej do obowiązujących decyzji.', decyzja.utworzono, [odnosnik(decyzja.id, 'Zweryfikuj decyzję', `${adresProjektu}/ustalenia`)]);
    for (const element of nieaktualne) dodaj('STALE_DECISION', element.id, element.tytul, 'Sprawdź powiązanie pracy z decyzją.',
      'Aktywna praca odwołuje się do decyzji zastąpionej lub odrzuconej.', wygenerowano, [element, odnosnik(element.id, 'Sprawdź decyzje', `${adresProjektu}/ustalenia`)]);
    for (const wpis of uporzadkuj(dane.wpisy.filter((rekord) => rekord.projektId === projekt.id && rekord.status === 'UNPROCESSED'))) dodaj('UNPROCESSED_CAPTURE', wpis.id,
      'Wpis czeka na przetworzenie', wpis.trescOryginalna, 'Wpis ma status „Nieprzetworzony”.', wpis.utworzono, [odnosnik(wpis.id, 'Otwórz skrzynkę', '/inbox')]);
    for (const korekta of uporzadkuj(dane.korekty.filter((rekord) => rekord.projektId === projekt.id && rekord.status === 'PROPOSED'))) dodaj('REVIEW_REQUIRED', korekta.id,
      'Korekta czeka na rozstrzygnięcie', korekta.opis, 'Korekta pozostaje propozycją do czasu zastosowania zatwierdzonego zestawu zmian.', korekta.utworzono, [odnosnik(korekta.id, 'Zweryfikuj korektę', `${adresProjektu}/korekty`)]);
    for (const analiza of uporzadkuj(dane.analizyWplywu.filter((rekord) => rekord.projektIds.includes(projekt.id) && rekord.zrodlo.typ !== 'CORRECTION'))) {
      for (const propozycja of uporzadkuj(analiza.propozycje.filter((rekord) => rekord.stan === 'PENDING'))) dodaj('REVIEW_REQUIRED', propozycja.id,
        propozycja.tytul, propozycja.uzasadnienie, 'Analiza wpływu zawiera propozycję oczekującą na zatwierdzenie. Nie jest to ustalenie.', analiza.utworzono,
        [odnosnik(propozycja.id, 'Sprawdź wpływ', `${adresProjektu}/ustalenia`)]);
    }
    for (const analiza of uporzadkuj(dane.analizyWpisow.filter((rekord) => rekord.status !== 'APPLIED'
      && dane.wpisy.some((wpis) => wpis.id === rekord.wpisId && wpis.projektId === projekt.id && wpis.status !== 'DISMISSED')
      && dane.przebiegiAnaliz.some((przebieg) => przebieg.id === rekord.id && przebieg.preferred)))) dodaj('REVIEW_REQUIRED', analiza.id,
        'Analiza wpisu wymaga rozstrzygnięcia', 'Zweryfikuj lub zastosuj aktualną analizę.', 'Preferowana analiza nie została zastosowana.', analiza.utworzono,
        [odnosnik(analiza.id, 'Zweryfikuj analizę', '/inbox')]);
    if (!sugerowane.length) dodaj('MISSING_NEXT_STEP', projekt.id, 'Brak następnego kroku', 'Uzupełnij punkt powrotu lub dodaj pracę do wykonania.',
      'Punkt powrotu nie zawiera następnego kroku i nie ma pracy w statusie „Do zrobienia” ani „W toku”.', wygenerowano, [odnosnik(projekt.id, 'Ustal następny krok')]);
  }
  return { migawka, uwaga: uporzadkuj(uwaga) };
}

// Lokalny cache projekcji: po transakcji zmienia się tylko obraz dotkniętych projektów.
export function utworzProjektorStanu() {
  const pamiec = new Map<string, { klucz: string; obraz: ObrazProjektu }>();
  return (dane: DaneKopii): ObrazProjektu[] => {
    const istnieja = new Set(dane.projekty.map((projekt) => projekt.id));
    for (const id of pamiec.keys()) if (!istnieja.has(id)) pamiec.delete(id);
    return uporzadkuj(dane.projekty).map((projekt) => {
      const wpisIds = new Set(dane.wpisy.filter((wpis) => wpis.projektId === projekt.id).map((wpis) => wpis.id));
      const lokalne = {
        ...dane, projekty: [projekt],
        wpisy: uporzadkuj(dane.wpisy.filter((rekord) => wpisIds.has(rekord.id))),
        decyzje: uporzadkuj(dane.decyzje.filter((rekord) => rekord.projektIds.includes(projekt.id))),
        elementyPracy: uporzadkuj(dane.elementyPracy.filter((rekord) => rekord.projektId === projekt.id)),
        pytania: uporzadkuj(dane.pytania.filter((rekord) => rekord.projektId === projekt.id)),
        blokady: uporzadkuj(dane.blokady.filter((rekord) => rekord.projektId === projekt.id)),
        korekty: uporzadkuj(dane.korekty.filter((rekord) => rekord.projektId === projekt.id)),
        zdarzeniaDomenowe: uporzadkuj(dane.zdarzeniaDomenowe.filter((rekord) => rekord.projectIds.includes(projekt.id))),
        analizyWplywu: uporzadkuj(dane.analizyWplywu.filter((rekord) => rekord.projektIds.includes(projekt.id))),
        analizyWpisow: uporzadkuj(dane.analizyWpisow.filter((rekord) => wpisIds.has(rekord.wpisId))),
        przebiegiAnaliz: uporzadkuj(dane.przebiegiAnaliz.filter((rekord) => wpisIds.has(rekord.sourceId))),
        zdarzenia: [], propozycjeZmian: [], zestawyZmian: [], obszary: [], etapy: [],
      };
      const klucz = JSON.stringify(lokalne);
      const poprzedni = pamiec.get(projekt.id);
      if (poprzedni?.klucz === klucz) return poprzedni.obraz;
      const obraz = wyliczStanProjektu(lokalne, projekt);
      if (poprzedni?.obraz.migawka.rewizja === obraz.migawka.rewizja) obraz.migawka = poprzedni.obraz.migawka;
      pamiec.set(projekt.id, { klucz, obraz });
      return obraz;
    });
  };
}
