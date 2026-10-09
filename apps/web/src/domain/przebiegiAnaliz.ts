import type { PrzebiegAnalizy } from '@centrum-projektowe/domain';
import type { AnalizaWpisu, WynikDostawcyAnalizy } from './analizaWpisu';
import type { KontekstZapisu, Wpis, ZdarzenieAktywnosci } from './modele';

export type PrzebiegAnalizyWpisu = PrzebiegAnalizy<WynikDostawcyAnalizy, AnalizaWpisu>;
export type OperacjaPrzebiegu =
  | { rodzaj: 'rozpocznij'; id: string; wpisId: string; provider: PrzebiegAnalizyWpisu['provider']; model?: string; promptVersion?: string; supersedesAnalysisRunId?: string; correctionId?: string; inputText?: string }
  | { rodzaj: 'blad'; id: string }
  | { rodzaj: 'preferuj'; id: string; poprzedniId: string | null };

export function migrujAnalize(analiza: AnalizaWpisu, rodzaj: 'INDEXEDDB_V4' | 'INDEXEDDB_V5' | 'BACKUP_V1'): PrzebiegAnalizyWpisu {
  const { typDostawcy, nazwaDostawcy, wersjaDostawcy, wersjaAnalizy, klasyfikacja, podsumowanie } = analiza;
  return {
    id: analiza.id, sourceId: analiza.wpisId, sourceType: 'CAPTURE',
    provider: { type: typDostawcy, name: nazwaDostawcy, version: wersjaDostawcy },
    schemaVersion: 'capture-analysis-v1', status: 'LEGACY_IMPORTED', startedAt: null, finishedAt: null,
    preferred: true, reviewStatus: analiza.status, createdAt: analiza.utworzono,
    migrationSource: { kind: rodzaj, legacyAnalysisId: analiza.id },
    output: { typDostawcy, nazwaDostawcy, wersjaDostawcy, wersjaAnalizy, klasyfikacja, podsumowanie,
      elementy: analiza.elementy.map(({ typ, tresc, pewnosc, zrodlo }) => ({ typ, tresc, pewnosc, zrodlo })) },
  };
}

export function wykonajOperacjePrzebiegu(przebiegi: PrzebiegAnalizyWpisu[], wpisy: Wpis[], operacja: OperacjaPrzebiegu, kontekst: KontekstZapisu) {
  const poprzedni = przebiegi.find((przebieg) => przebieg.id === operacja.id);
  const wpis = wpisy.find((wpis) => wpis.id === (operacja.rodzaj === 'rozpocznij' ? operacja.wpisId : poprzedni?.sourceId));
  if (!wpis || wpis.status === 'DISMISSED') throw new Error('Wpis nie istnieje lub jest odrzucony.');
  let zapisy: PrzebiegAnalizyWpisu[];
  let typ: ZdarzenieAktywnosci['typZdarzenia'];
  let tytul: string;
  if (operacja.rodzaj === 'rozpocznij') {
    if (poprzedni) throw new Error('Identyfikator przebiegu jest zajęty.');
    if (!['RULE_BASED', 'REMOTE_LLM', 'LOCAL_LLM'].includes(operacja.provider.type)) throw new Error('Niepoprawny dostawca analizy.');
    if (operacja.supersedesAnalysisRunId && !przebiegi.some((przebieg) => przebieg.id === operacja.supersedesAnalysisRunId && przebieg.sourceId === wpis.id)) throw new Error('Poprzedni przebieg nie należy do źródła.');
    zapisy = [{ id: operacja.id, sourceId: wpis.id, sourceType: 'CAPTURE', provider: structuredClone(operacja.provider),
      model: operacja.model, promptVersion: operacja.promptVersion, supersedesAnalysisRunId: operacja.supersedesAnalysisRunId,
      correctionId: operacja.correctionId, inputText: operacja.inputText,
      schemaVersion: 'capture-analysis-v1', status: 'RUNNING', startedAt: kontekst.czas, finishedAt: null, output: null,
      preferred: false, reviewStatus: 'NOT_STARTED', createdAt: kontekst.czas }];
    typ = 'ANALYSIS_RUN_STARTED'; tytul = 'Rozpoczęto nowy przebieg analizy';
  } else if (operacja.rodzaj === 'blad') {
    if (!poprzedni || poprzedni.status !== 'RUNNING') throw new Error('Przebieg nie oczekuje na wynik.');
    if (Date.parse(kontekst.czas) < Date.parse(poprzedni.startedAt)) throw new Error('Koniec przebiegu poprzedza początek.');
    zapisy = [{ ...poprzedni, status: 'FAILED', finishedAt: kontekst.czas, output: null }];
    typ = 'ANALYSIS_RUN_FAILED'; tytul = 'Analiza nie powiodła się — zachowano źródło i poprzednie wyniki';
  } else {
    if (!poprzedni || !['SUCCEEDED', 'LEGACY_IMPORTED'].includes(poprzedni.status)) throw new Error('Wybierz zakończony przebieg z wynikiem.');
    const aktualny = przebiegi.find((przebieg) => przebieg.sourceId === wpis.id && przebieg.preferred);
    if ((aktualny?.id ?? null) !== operacja.poprzedniId) throw new Error('Aktualna analiza zmieniła się. Odśwież dane.');
    if (aktualny?.id === poprzedni.id) throw new Error('Ta analiza jest już aktualna.');
    zapisy = przebiegi.filter((przebieg) => przebieg.sourceId === wpis.id && (przebieg.preferred || przebieg.id === poprzedni.id))
      .map((przebieg) => ({ ...przebieg, preferred: przebieg.id === poprzedni.id }));
    typ = 'ANALYSIS_PREFERRED_CHANGED'; tytul = 'Zmieniono aktualną analizę';
  }
  const zdarzenie: ZdarzenieAktywnosci = { id: kontekst.idZdarzenia, projektId: wpis.projektId, typEncji: 'CAPTURE', encjaId: wpis.id,
    typZdarzenia: typ, tytul, utworzono: kontekst.czas, zrodlo: kontekst.zrodlo,
    metadane: { analysisRunId: operacja.id, ...(operacja.rodzaj === 'preferuj' ? { poprzedniId: operacja.poprzedniId } : {}) } };
  return { zapisy, zdarzenie };
}
