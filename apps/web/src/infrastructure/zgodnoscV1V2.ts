import type { KopertaZdarzeniaDomenowego, PrzebiegAnalizy, RekordZrodlowy } from '@centrum-projektowe/domain';
import type { Wpis, ZdarzenieAktywnosci } from '../domain/modele';
import type { AnalizaWpisu, WynikDostawcyAnalizy } from '../domain/analizaWpisu';
import { schematDanych, sprawdzKopie, type KopiaZapasowa } from '../domain/kopieZapasowe';

type ZrodloV2 = RekordZrodlowy<Wpis>;
type AnalizaV2 = PrzebiegAnalizy<WynikDostawcyAnalizy, AnalizaWpisu>;
type ZdarzenieV2 = KopertaZdarzeniaDomenowego<Pick<ZdarzenieAktywnosci, 'tytul' | 'opis' | 'metadane'>, ZdarzenieAktywnosci>;

function porownaj(pierwsza: unknown, druga: unknown): boolean {
  if (pierwsza === druga) return true;
  if (Array.isArray(pierwsza) || Array.isArray(druga)) return Array.isArray(pierwsza) && Array.isArray(druga)
    && pierwsza.length === druga.length && pierwsza.every((wartosc, numer) => porownaj(wartosc, druga[numer]));
  if (!pierwsza || !druga || typeof pierwsza !== 'object' || typeof druga !== 'object') return false;
  if (Object.getPrototypeOf(pierwsza) !== Object.prototype || Object.getPrototypeOf(druga) !== Object.prototype) return false;
  const pierwszyRekord = pierwsza as Record<string, unknown>;
  const drugiRekord = druga as Record<string, unknown>;
  const klucze = Object.keys(pierwszyRekord).filter((klucz) => pierwszyRekord[klucz] !== undefined);
  return klucze.length === Object.keys(drugiRekord).filter((klucz) => drugiRekord[klucz] !== undefined).length
    && klucze.every((klucz) => Object.hasOwn(drugiRekord, klucz) && porownaj(pierwszyRekord[klucz], drugiRekord[klucz]));
}

export function wpisDoZrodla(wpis: Wpis): ZrodloV2 {
  if (!schematDanych.wpisy.sprawdz(wpis)) throw new Error('Niepoprawny wpis v1.');
  const poprzedni = structuredClone(wpis);
  return {
    id: poprzedni.id, schemaVersion: 1, rawText: poprzedni.trescOryginalna, createdAt: poprzedni.utworzono,
    projectId: poprzedni.projektId, source: { kind: poprzedni.typZrodla, origin: structuredClone(poprzedni.zrodlo) }, zgodnoscV1: poprzedni,
  };
}

export function zrodloDoWpisu(zrodlo: ZrodloV2): Wpis {
  if (!zrodlo.zgodnoscV1 || !porownaj(zrodlo, wpisDoZrodla(zrodlo.zgodnoscV1))) throw new Error('Źródło nie ma bezstratnego odpowiednika v1.');
  return structuredClone(zrodlo.zgodnoscV1);
}

export function analizaDoPrzebiegu(analiza: AnalizaWpisu): AnalizaV2 {
  if (!schematDanych.analizyWpisow.sprawdz(analiza)) throw new Error('Niepoprawna analiza v1.');
  const poprzednia = structuredClone(analiza);
  const { typDostawcy, nazwaDostawcy, wersjaDostawcy, wersjaAnalizy, klasyfikacja, podsumowanie } = poprzednia;
  const wynik: WynikDostawcyAnalizy = { typDostawcy, nazwaDostawcy, wersjaDostawcy, wersjaAnalizy, klasyfikacja, podsumowanie,
    elementy: poprzednia.elementy.map(({ typ, tresc, pewnosc, zrodlo }) => ({ typ, tresc, pewnosc, zrodlo })) };
  return {
    id: poprzednia.id, sourceId: poprzednia.wpisId,
    provider: { type: typDostawcy, name: nazwaDostawcy, version: wersjaDostawcy }, schemaVersion: 'capture-analysis-v1',
    startedAt: null, finishedAt: null, status: 'LEGACY_IMPORTED', output: wynik, zgodnoscV1: poprzednia,
  };
}

export function przebiegDoAnalizy(przebieg: AnalizaV2): AnalizaWpisu {
  if (!przebieg.zgodnoscV1 || !porownaj(przebieg, analizaDoPrzebiegu(przebieg.zgodnoscV1))) throw new Error('Przebieg analizy nie ma bezstratnego odpowiednika v1.');
  return structuredClone(przebieg.zgodnoscV1);
}

export function zdarzenieDoKoperty(zdarzenie: ZdarzenieAktywnosci): ZdarzenieV2 {
  if (!schematDanych.zdarzenia.sprawdz(zdarzenie)) throw new Error('Niepoprawne zdarzenie v1.');
  const poprzednie = structuredClone(zdarzenie);
  const { tytul, opis, metadane } = poprzednie;
  return {
    id: poprzednie.id, eventType: poprzednie.typZdarzenia, eventVersion: 1,
    aggregateType: poprzednie.typEncji, aggregateId: poprzednie.encjaId,
    projectIds: [...(poprzednie.projektIds ?? (poprzednie.projektId === null ? [] : [poprzednie.projektId]))],
    occurredAt: poprzednie.utworzono, actor: null, source: structuredClone(poprzednie.zrodlo),
    payload: structuredClone({ tytul, opis, metadane }), zgodnoscV1: poprzednie,
  };
}

export function kopertaDoZdarzenia(koperta: ZdarzenieV2): ZdarzenieAktywnosci {
  if (!koperta.zgodnoscV1 || !porownaj(koperta, zdarzenieDoKoperty(koperta.zgodnoscV1))) throw new Error('Koperta nie ma bezstratnego odpowiednika v1.');
  return structuredClone(koperta.zgodnoscV1);
}

export interface WidokKopiiV2 {
  contractVersion: 1;
  zrodla: ZrodloV2[];
  przebiegi: AnalizaV2[];
  zdarzenia: ZdarzenieV2[];
  zgodnoscV1: KopiaZapasowa;
}

export function kopiaDoWidokuV2(kopia: unknown): WidokKopiiV2 {
  sprawdzKopie(kopia);
  const poprzednia = structuredClone(kopia);
  return { contractVersion: 1, zrodla: poprzednia.data.wpisy.map(wpisDoZrodla),
    przebiegi: poprzednia.data.analizyWpisow.map(analizaDoPrzebiegu), zdarzenia: poprzednia.data.zdarzenia.map(zdarzenieDoKoperty), zgodnoscV1: poprzednia };
}

export function widokDoKopiiV1(widok: WidokKopiiV2): KopiaZapasowa {
  if (!porownaj(widok, kopiaDoWidokuV2(widok.zgodnoscV1))) throw new Error('Widok v2 nie ma bezstratnego odpowiednika kopii v1.');
  return structuredClone(widok.zgodnoscV1);
}
