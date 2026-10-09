import { describe, expect, it } from 'vitest';
import { analizaDoPrzebiegu, przebiegDoAnalizy, wpisDoZrodla, zrodloDoWpisu, zdarzenieDoKoperty, kopertaDoZdarzenia } from './zgodnoscV1V2';
import { utworzWpis } from '../domain/operacje';
import type { ZdarzenieAktywnosci } from '../domain/modele';
import type { AnalizaWpisu } from '../domain/analizaWpisu';

const czas = '2026-10-09T10:00:00Z';
const zrodlo = { typ: 'AI' as const, nazwa: 'Dostawca historyczny' };

describe('Zgodność danych v1 i v2', () => {
  it('zachowuje oryginał, status, odłożenie i pochodzenie importu, bez współdzielenia referencji', () => {
    const wpis = { ...utworzWpis('  Oryginał\n ', 'p1', 'w1', czas, zrodlo, 'IMPORT'), status: 'DISMISSED' as const, odlozonoDoAnalizy: null };
    const rekord = wpisDoZrodla(wpis);
    expect(zrodloDoWpisu(rekord)).toEqual(wpis);
    expect(rekord.rawText).toBe(wpis.trescOryginalna);
    expect(rekord.source).toEqual({ kind: 'IMPORT', origin: zrodlo });
    rekord.source.origin.nazwa = 'Korekta projekcji';
    expect(wpis.zrodlo.nazwa).toBe('Dostawca historyczny');
    expect(() => zrodloDoWpisu(rekord)).toThrow('bezstratnego');
  });

  it('zachowuje ID, wersje dostawcy, review, edycje i skutki analizy, nie wymyśla czasów runu', () => {
    const analiza: AnalizaWpisu = { id: 'a1', wpisId: 'w1', utworzono: czas, typDostawcy: 'REMOTE_LLM', nazwaDostawcy: 'Dawny', wersjaDostawcy: 'reguly-7', wersjaAnalizy: 'format-stary',
      status: 'APPLIED', wersja: 4, sprawdzono: czas, zastosowano: czas, elementy: [
        { id: 'a1:1', typ: 'POSSIBLE_DECISION', tresc: 'Propozycja', trescOryginalna: 'Propozycja', trescEdytowana: 'Korekta', zrodlo: 'AI', pewnosc: 0.7, statusReview: 'EDITED',
          historiaReview: [{ status: 'EDITED', trescEdytowana: 'Korekta', czas, zrodlo: { typ: 'USER', nazwa: 'Użytkownik' } }], zastosowanie: { czas, rodzaj: 'DECISION', encjaId: 'd1', projektId: 'p1' } },
        { id: 'a1:2', typ: 'FACT', tresc: 'Odrzucone', trescOryginalna: 'Odrzucone', zrodlo: 'AI', statusReview: 'REJECTED', historiaReview: [{ status: 'REJECTED', czas, zrodlo }] },
      ] };
    const przebieg = analizaDoPrzebiegu(analiza);
    expect(przebieg).toMatchObject({ id: 'a1', sourceId: 'w1', provider: { type: 'REMOTE_LLM', name: 'Dawny', version: 'reguly-7' }, schemaVersion: 'capture-analysis-v1', status: 'LEGACY_IMPORTED', startedAt: null, finishedAt: null });
    expect(przebieg).not.toHaveProperty('model');
    expect(przebieg).not.toHaveProperty('promptVersion');
    expect(przebieg.output?.elementy[0].tresc).toBe('Propozycja');
    expect(przebieg.output?.wersjaAnalizy).toBe('format-stary');
    expect(przebiegDoAnalizy(przebieg)).toEqual(analiza);
    expect(przebiegDoAnalizy(JSON.parse(JSON.stringify(przebieg)))).toEqual(analiza);
    expect(() => przebiegDoAnalizy({ ...przebieg, supersedesAnalysisRunId: 'nowy-run' })).toThrow('bezstratnego');
  });

  it('mapuje historię wielu projektów i nullable ID bez zmyślania aktora ani zmiany pochodzenia', () => {
    const zdarzenie: ZdarzenieAktywnosci = { id: 'z1', projektId: 'p1', projektIds: ['p1', 'p2'], typEncji: 'DECISION', encjaId: null, typZdarzenia: 'DECISION_SUPERSEDED',
      tytul: 'Zastąpiono', opis: 'Historia', utworzono: czas, zrodlo, metadane: { analizaId: 'a1', elementy: [{ id: 'a1:1', status: 'EDITED' }] } };
    const koperta = zdarzenieDoKoperty(zdarzenie);
    expect(koperta).toMatchObject({ id: 'z1', eventType: 'DECISION_SUPERSEDED', eventVersion: 1, aggregateType: 'DECISION', aggregateId: null, projectIds: ['p1', 'p2'], occurredAt: czas, actor: null, source: zrodlo });
    expect(kopertaDoZdarzenia(koperta)).toEqual(zdarzenie);
    expect(zdarzenieDoKoperty({ ...zdarzenie, projektId: null, projektIds: undefined }).projectIds).toEqual([]);
    expect(zdarzenieDoKoperty({ ...zdarzenie, projektIds: undefined }).projectIds).toEqual(['p1']);
    expect(() => kopertaDoZdarzenia({ ...koperta, actor: { typ: 'USER', nazwa: 'Inny aktor' } })).toThrow('bezstratnego');
  });

  it('blokuje downgrade natywnego v2 oraz zmian źródła i schematu', () => {
    const rekord = wpisDoZrodla(utworzWpis('Oryginał', null, 'w1', czas));
    expect(() => zrodloDoWpisu({ ...rekord, zgodnoscV1: undefined })).toThrow('bezstratnego');
    expect(() => zrodloDoWpisu({ ...rekord, rawText: 'Inny oryginał' })).toThrow('bezstratnego');
    expect(() => zrodloDoWpisu({ ...rekord, preferredAnalysisRunId: 'nowy' })).toThrow('bezstratnego');
    expect(() => zrodloDoWpisu({ ...rekord, schemaVersion: 2 } as unknown as typeof rekord)).toThrow('bezstratnego');
  });
});
