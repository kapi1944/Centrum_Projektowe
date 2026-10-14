import { describe, expect, it } from 'vitest';
import { pusteDaneKopii, type DaneKopii } from './kopieZapasowe';
import { utworzProjekt, utworzWpis } from './operacje';
import { wykonajKorekte, type DaneKorekty } from './korekty';
import { wykonajRealizacje } from './realizacja';
import { wykonajOperacjeUstalen } from './ustalenia';
import { utworzProjektorStanu, wyliczStanProjektu } from './stanProjektu';
import { utworzRepozytoriumIndexedDb } from '../infrastructure/repozytoriumIndexedDb';

const czas = '2026-10-11T10:00:00.000Z';
const pozniej = '2026-10-11T11:00:00.000Z';
const kontekst = { czas, idZdarzenia: 'zdarzenie', zrodlo: { typ: 'USER' as const, nazwa: 'Użytkownik' } };
function przygotuj() {
  const dane = pusteDaneKopii();
  dane.projekty = [{ ...utworzProjekt('Projekt', 'p1', czas), opis: 'Cel pierwotny' }, utworzProjekt('Drugi', 'p2', czas)];
  return dane;
}
function obraz(dane: DaneKopii) { return wyliczStanProjektu(dane, dane.projekty[0]); }
function zmienCel(dane: DaneKopii, przyjmij: boolean, typ: DaneKorekty['typ'] = 'GOAL_CHANGE') {
  let wynik = wykonajKorekte(dane, { rodzaj: 'utworz', dane: { id: 'k1', projektId: 'p1', celId: 'p1', typCelu: 'PROJECT',
    pole: 'opis', typ, opis: 'Nowy cel', nowaWartosc: 'Cel po korekcie' } }, kontekst);
  let wersja = 1;
  for (const operacja of wynik.propozycjeZmian[0].operations) wynik = wykonajKorekte(wynik,
    { rodzaj: 'review', id: 'k1', wersja: wersja++, operacjaId: operacja.id, status: operacja.rodzaj === 'KOREKTA' && przyjmij ? 'ACCEPTED' : 'REJECTED' },
    { ...kontekst, idZdarzenia: `review-${wersja}` });
  return wykonajKorekte(wynik, { rodzaj: 'zastosuj', id: 'k1', wersja, idempotencyKey: 'zastosowanie' },
    { ...kontekst, czas: pozniej, idZdarzenia: 'zastosowanie' });
}

describe('Deterministyczny aktualny stan projektu', () => {
  it('aktualizuje ograniczenie i uwagę obu projektów wspólnej decyzji, zachowując punkt powrotu oraz źródło korekty', () => {
    let dane = przygotuj();
    dane.projekty[0].podsumowanieAktualnegoStanu = 'Ręczne podsumowanie';
    dane.projekty[0].nastepnyKrok = 'Ręczny krok';
    dane.decyzje = wykonajOperacjeUstalen({ ...dane, analizy: [] }, { rodzaj: 'utworz', id: 'd1', dane: {
      tytul: 'Wspólne ograniczenie', opis: 'A', projektIds: ['p1', 'p2'], typZrodla: 'USER', nazwaZrodla: 'Użytkownik',
      odniesienieZrodla: '', wpisZrodlowyId: null, notatki: '', powiazaneElementy: [],
    } }, kontekst).decyzje;
    const projektor = utworzProjektorStanu();
    expect(projektor(dane).every((obraz) => obraz.uwaga.some((element) => element.typ === 'DECISION_REQUIRED'))).toBe(true);
    dane.decyzje = wykonajOperacjeUstalen({ ...dane, analizy: [] }, { rodzaj: 'status', id: 'd1', wersja: 1, status: 'ACCEPTED' }, kontekst).decyzje;
    expect(projektor(dane).every((obraz) => !obraz.uwaga.some((element) => element.typ === 'DECISION_REQUIRED'))).toBe(true);
    dane = wykonajKorekte(dane, { rodzaj: 'utworz', dane: { id: 'k1', projektId: 'p1', celId: 'd1', typCelu: 'DECISION',
      pole: 'opis', typ: 'TECHNICAL_CONSTRAINT', opis: 'Wspólne wymaganie', nowaWartosc: 'B' } }, kontekst);
    const przed = projektor(dane);
    expect(przed.every((obraz) => obraz.uwaga.some((element) => element.typ === 'REVIEW_REQUIRED'
      && element.odnosnikiZrodel[0].adres === '/projekty/p1/korekty'))).toBe(true);
    let wersja = 1;
    for (const operacja of dane.propozycjeZmian[0].operations) dane = wykonajKorekte(dane, {
      rodzaj: 'review', id: 'k1', wersja: wersja++, operacjaId: operacja.id,
      status: operacja.rodzaj === 'KOREKTA' ? 'ACCEPTED' : 'REJECTED',
    }, { ...kontekst, idZdarzenia: `review-${wersja}` });
    dane = wykonajKorekte(dane, { rodzaj: 'zastosuj', id: 'k1', wersja, idempotencyKey: 'wspolne' },
      { ...kontekst, czas: pozniej, idZdarzenia: 'wspolne' });
    const po = projektor(dane);
    for (const obraz of po) {
      expect(obraz.migawka.aktywneOgraniczenia).toEqual([{ id: 'k1', tytul: 'B', adres: '/projekty/p1/korekty' }]);
      expect(obraz.migawka.ostatnieZmiany[0].adres).toBe('/projekty/p1/korekty');
      expect(obraz.uwaga.some((element) => element.typ === 'REVIEW_REQUIRED')).toBe(false);
    }
    expect(po[0].migawka.podsumowanie).toBe('Ręczne podsumowanie');
    expect(po[0].migawka.sugerowaneDzialania[0].tytul).toBe('Ręczny krok');
    expect(dane.projekty[0]).toMatchObject({ podsumowanieAktualnegoStanu: 'Ręczne podsumowanie', nastepnyKrok: 'Ręczny krok' });
    const ponowione = wykonajKorekte(dane, { rodzaj: 'zastosuj', id: 'k1', wersja, idempotencyKey: 'wspolne' }, kontekst);
    expect(projektor(ponowione)).toEqual(po);
    const odwrocone = structuredClone(dane);
    Object.values(odwrocone).forEach((rekordy) => rekordy.reverse());
    expect(utworzProjektorStanu()(odwrocone)).toEqual(po);
    expect(wyliczStanProjektu(odwrocone, dane.projekty[1])).toEqual(po[1]);
    expect(new Set(po.flatMap((obraz) => obraz.uwaga.map((element) => element.id))).size).toBe(po.flatMap((obraz) => obraz.uwaga).length);
    expect(po.flatMap((obraz) => obraz.uwaga).some((element) => ['FAILED_INTEGRATION', 'STALE_DOCUMENT', 'CONFLICT'].includes(element.typ))).toBe(false);
  });
  it('zaakceptowana korekta celu aktualizuje migawkę po DomainEvents, odrzucona zachowuje ją w całości', () => {
    const dane = przygotuj(); const przed = obraz(dane).migawka;
    const przyjeta = obraz(zmienCel(dane, true)).migawka;
    expect(przyjeta.aktualneCele).toEqual(['Cel po korekcie']);
    expect(przyjeta.rewizja).not.toBe(przed.rewizja);
    expect(przyjeta.wygenerowano).toBe(pozniej);
    expect(przyjeta.ostatnieZmiany).toHaveLength(1);
    expect(obraz(zmienCel(dane, false)).migawka).toEqual(przed);
  });
  it('tworzy uwagę dla aktywnego blokera i usuwa ją po jego rozwiązaniu', () => {
    const dane = przygotuj();
    const wynik = wykonajRealizacje({ ...dane }, { rodzaj: 'blokada', id: 'b1', dane: { projektId: 'p1', tytul: 'Brak dostępu', opis: '', status: 'ACTIVE', waga: 'HIGH' } }, kontekst);
    const zBlokerem = { ...dane, ...wynik.realizacja };
    expect(obraz(zBlokerem).uwaga).toContainEqual(expect.objectContaining({ typ: 'BLOCKER', waga: 'HIGH', powod: 'Bloker ma status „Aktywna”.' }));
    const rozwiazany = wykonajRealizacje(zBlokerem, { rodzaj: 'blokada', id: 'b1', wersja: 1,
      dane: { ...wynik.realizacja.blokady[0], status: 'RESOLVED' } }, { ...kontekst, czas: pozniej });
    expect(obraz({ ...zBlokerem, ...rozwiazany.realizacja }).uwaga.some((element) => element.typ === 'BLOCKER')).toBe(false);
  });
  it('wyklucza zastąpioną decyzję i wykrywa nieaktualne powiązanie aktywnej pracy', () => {
    const dane = przygotuj();
    const daneDecyzji = { tytul: 'Decyzja', opis: 'A', projektIds: ['p1', 'p2'], typZrodla: 'USER' as const,
      nazwaZrodla: 'Użytkownik', odniesienieZrodla: '', wpisZrodlowyId: null, notatki: '', powiazaneElementy: [] };
    dane.decyzje = wykonajOperacjeUstalen({ ...dane, analizy: [] }, { rodzaj: 'utworz', id: 'd1', dane: daneDecyzji }, kontekst).decyzje;
    dane.decyzje = wykonajOperacjeUstalen({ ...dane, analizy: [] }, { rodzaj: 'status', id: 'd1', status: 'ACCEPTED', wersja: 1 }, kontekst).decyzje;
    dane.elementyPracy = [{ id: 'r1', projektId: 'p1', tytul: 'Praca', opis: '', status: 'TODO', typ: 'TASK', decyzjaIds: ['d1'], utworzono: czas, zaktualizowano: czas, wersja: 1 }];
    dane.decyzje = wykonajOperacjeUstalen({ ...dane, analizy: [] }, { rodzaj: 'zastap', id: 'd1', wersja: 2, noweId: 'd2', dane: { ...daneDecyzji, opis: 'B' } }, kontekst).decyzje;
    expect(obraz(dane).migawka.aktywneDecyzje.map((rekord) => rekord.id)).toEqual(['d2']);
    expect(obraz(dane).uwaga.some((rekord) => rekord.typ === 'STALE_DECISION')).toBe(true);
    expect(wyliczStanProjektu(dane, dane.projekty[1]).migawka.aktywneDecyzje.map((rekord) => rekord.id)).toEqual(['d2']);
  });
  it('wykrywa brak kroku; praca zablokowana lub zakończona nie jest sugestią', () => {
    const dane = przygotuj();
    expect(obraz(dane).uwaga.some((rekord) => rekord.typ === 'MISSING_NEXT_STEP')).toBe(true);
    dane.projekty[0].nastepnyKrok = 'Sprawdź wymagania';
    expect(obraz(dane).uwaga.some((rekord) => rekord.typ === 'MISSING_NEXT_STEP')).toBe(false);
    dane.projekty[0].nastepnyKrok = '';
    dane.elementyPracy = [{ id: 'r1', projektId: 'p1', tytul: 'Praca', opis: '', status: 'BLOCKED', typ: 'TASK', decyzjaIds: [], utworzono: czas, zaktualizowano: czas, wersja: 1 }];
    expect(obraz(dane).migawka.sugerowaneDzialania).toEqual([]);
    dane.elementyPracy[0].status = 'TODO';
    expect(obraz(dane).migawka.sugerowaneDzialania[0].tytul).toBe('Praca');
    dane.elementyPracy[0].status = 'DONE';
    expect(obraz(dane).migawka.sugerowaneDzialania).toEqual([]);
  });
  it('powtarza projekcję niezależnie od zegara i kolejności rekordów; nie przelicza obcego projektu', () => {
    const dane = przygotuj(); dane.wpisy = [utworzWpis('A', 'p1', 'w1', czas), utworzWpis('B', 'p1', 'w2', czas)];
    const projektor = utworzProjektorStanu(); const przed = projektor(dane);
    expect(projektor(structuredClone(dane))[0]).toBe(przed[0]);
    const odwrocone = { ...dane, wpisy: [...dane.wpisy].reverse() };
    expect(obraz(odwrocone)).toEqual(obraz(dane));
    const po = projektor(zmienCel(dane, true));
    expect(po[1]).toBe(przed[1]);
    expect(po[0]).not.toBe(przed[0]);
    expect(projektor(zmienCel(dane, false))[0].migawka).toEqual(przed[0].migawka);
  });
  it('odtwarza stan po eksporcie i imporcie bez zapisywania dodatkowego źródła prawdy', async () => {
    const dane = zmienCel(przygotuj(), true);
    const repozytorium = utworzRepozytoriumIndexedDb(crypto.randomUUID());
    await repozytorium.importujKopie({ format: 'centrum-projektowe', schemaVersion: 4, appVersion: '0.0.0', exportedAt: pozniej, data: dane }, 'zastap', true);
    const odczytane = (await repozytorium.eksportujKopie()).data;
    expect(obraz(odczytane)).toEqual(obraz(dane));
  });
  it('ograniczenie pochodzi z zaakceptowanej korekty i znika, gdy wartość przestaje obowiązywać', () => {
    const dane = zmienCel(przygotuj(), true, 'TECHNICAL_CONSTRAINT');
    expect(obraz(dane).migawka.aktywneOgraniczenia.map((rekord) => rekord.tytul)).toEqual(['Cel po korekcie']);
    dane.projekty[0].opis = 'Inne wymaganie';
    expect(obraz(dane).migawka.aktywneOgraniczenia).toEqual([]);
    expect(obraz(zmienCel(przygotuj(), false, 'TECHNICAL_CONSTRAINT')).migawka.aktywneOgraniczenia).toEqual([]);
  });
  it('publikuje nowy obraz dopiero po zastosowaniu korekty w IndexedDB, a review nie zmienia migawki', async () => {
    const repozytorium = utworzRepozytoriumIndexedDb(crypto.randomUUID());
    await repozytorium.dodajProjekt(przygotuj().projekty[0], kontekst);
    const przed = obraz((await repozytorium.eksportujKopie()).data).migawka;
    await repozytorium.wykonajOperacjeKorekty({ rodzaj: 'utworz', dane: { id: 'k1', projektId: 'p1', celId: 'p1', typCelu: 'PROJECT',
      pole: 'opis', typ: 'GOAL_CHANGE', opis: 'Nowy cel', nowaWartosc: 'Cel po transakcji' } }, { ...kontekst, idZdarzenia: 'korekta' });
    let wersja = 1;
    for (const operacja of (await repozytorium.pobierzKorekty()).propozycjeZmian[0].operations) {
      await repozytorium.wykonajOperacjeKorekty({ rodzaj: 'review', id: 'k1', wersja: wersja++, operacjaId: operacja.id,
        status: operacja.rodzaj === 'KOREKTA' ? 'ACCEPTED' : 'REJECTED' }, { ...kontekst, idZdarzenia: `review-${wersja}` });
    }
    const poReview = obraz((await repozytorium.eksportujKopie()).data);
    expect(poReview.migawka).toEqual(przed);
    expect(poReview.uwaga.some((rekord) => rekord.typ === 'REVIEW_REQUIRED')).toBe(true);
    await repozytorium.wykonajOperacjeKorekty({ rodzaj: 'zastosuj', id: 'k1', wersja, idempotencyKey: 'apply' },
      { ...kontekst, czas: pozniej, idZdarzenia: 'apply' });
    const po = obraz((await repozytorium.eksportujKopie()).data);
    expect(po.migawka.aktualneCele).toEqual(['Cel po transakcji']);
    expect(po.uwaga.some((rekord) => rekord.typ === 'REVIEW_REQUIRED')).toBe(false);
  });
  it('wycisza uwagę dla projektów archiwalnych i zakończonych', () => {
    const dane = przygotuj(); dane.projekty[0].status = 'COMPLETED';
    expect(obraz(dane).uwaga).toEqual([]);
    dane.projekty[0].status = 'ACTIVE'; dane.projekty[0].zarchiwizowano = pozniej;
    expect(obraz(dane).uwaga).toEqual([]);
  });
});
