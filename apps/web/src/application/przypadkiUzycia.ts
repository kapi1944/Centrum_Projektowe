import type { JednostkaPracyProjektowej } from '../domain/porty';
import type { KontekstZapisu, PunktPowrotu, Wpis, WynikZmianyProjektu, ZdarzenieAktywnosci } from '../domain/modele';
import { utworzWpis, zdarzenieUtworzenia, zmienProjekt } from '../domain/operacje';
import type { RepozytoriumAnaliz } from '../domain/porty';
import type { AnalysisProvider } from '../domain/analizaWpisu';
import type { RepozytoriumProjektowe } from '../domain/repozytorium';

export async function uruchomAnalizeWpisu(repozytorium: RepozytoriumAnaliz, wpis: Wpis, dostawca: AnalysisProvider, utworzKontekst: () => KontekstZapisu,
  korekta?: { correctionId: string; inputText: string; supersedesAnalysisRunId?: string }) {
  const id = crypto.randomUUID();
  await repozytorium.wykonajOperacjePrzebiegu({ rodzaj: 'rozpocznij', id, wpisId: wpis.id, provider: dostawca.pochodzenie, ...korekta }, utworzKontekst());
  try {
    const wynik = await dostawca.analizuj(korekta?.inputText ?? wpis.trescOryginalna);
    return await repozytorium.wykonajOperacjeAnalizyWpisu({ rodzaj: 'generuj', id, wpisId: wpis.id, wynik, wymagajRozpoczetego: true, trescZrodlowa: wpis.trescOryginalna }, utworzKontekst());
  } catch (blad) {
    if ((await repozytorium.pobierzPrzebiegiAnaliz()).some((przebieg) => przebieg.id === id && przebieg.status === 'RUNNING')) {
      await repozytorium.wykonajOperacjePrzebiegu({ rodzaj: 'blad', id }, utworzKontekst());
    }
    throw blad;
  }
}

export async function uruchomAnalizePoKorekcie(repozytorium: RepozytoriumProjektowe, korektaId: string, dostawca: AnalysisProvider, utworzKontekst: () => KontekstZapisu) {
  const stan = await repozytorium.pobierzKorekty();
  const korekta = stan.korekty.find((korekta) => korekta.id === korektaId);
  const zmiana = stan.zestawyZmian.find((zestaw) => zestaw.correctionId === korektaId)?.operations.find((zmiana) => zmiana.rodzaj === 'KOREKTA');
  if (!korekta || korekta.status !== 'APPLIED' || !zmiana || !['CAPTURE', 'ANALYSIS_RUN'].includes(korekta.typCelu)) throw new Error('Nowa analiza wymaga zastosowanej korekty źródła lub analizy.');
  const przebiegi = await repozytorium.pobierzPrzebiegiAnaliz();
  const poprzedni = przebiegi.find((przebieg) => przebieg.id === korekta.celId);
  const wpis = (await repozytorium.pobierzWpisy()).find((wpis) => wpis.id === (korekta.typCelu === 'ANALYSIS_RUN' ? poprzedni?.sourceId : korekta.celId));
  if (!wpis) throw new Error('Źródło korekty nie istnieje.');
  const aktualny = przebiegi.find((przebieg) => przebieg.sourceId === wpis.id && przebieg.preferred);
  const wynik = await uruchomAnalizeWpisu(repozytorium, wpis, dostawca, utworzKontekst, {
    correctionId: korekta.id, inputText: zmiana.status === 'EDITED' ? zmiana.trescEdytowana! : zmiana.tresc,
    supersedesAnalysisRunId: poprzedni?.id ?? aktualny?.id,
  });
  if (aktualny) await repozytorium.wykonajOperacjePrzebiegu({ rodzaj: 'preferuj', id: wynik.analizaWpisu.id, poprzedniId: aktualny.id }, utworzKontekst());
  return wynik;
}

export async function utworzWpisUzytkownika(
  jednostkaPracy: JednostkaPracyProjektowej,
  dane: { id: string; tresc: string; projektId: string | null },
  kontekst: KontekstZapisu,
) {
  const wpis = utworzWpis(dane.tresc, dane.projektId, dane.id, kontekst.czas, kontekst.zrodlo);
  const zdarzenie = await zapiszNowyWpis(jednostkaPracy, wpis, kontekst);
  return { wpis, zdarzenie };
}

export function zapiszNowyWpis(jednostkaPracy: JednostkaPracyProjektowej, wpis: Wpis, kontekst: KontekstZapisu): Promise<ZdarzenieAktywnosci> {
  const magazyny = wpis.projektId === null ? ['wpisy', 'zdarzenia'] as const : ['projekty', 'wpisy', 'zdarzenia'] as const;
  return jednostkaPracy.wykonaj(magazyny, (repozytoria, zakoncz) => {
    const zdarzenie = zdarzenieUtworzenia(wpis, kontekst);
    function dodaj() {
      repozytoria.wpisy.dodaj(wpis);
      repozytoria.zdarzenia.dodaj(zdarzenie);
      zakoncz(zdarzenie);
    }
    if (wpis.projektId === null) dodaj();
    else repozytoria.projekty.pobierz(wpis.projektId, (projekt) => {
      if (!projekt) throw new Error('Projekt nie istnieje.');
      if (projekt.zarchiwizowano) throw new Error('Projekt jest zarchiwizowany.');
      repozytoria.projekty.zapisz({ ...projekt, ostatniaAktywnosc: kontekst.czas > projekt.ostatniaAktywnosc ? kontekst.czas : projekt.ostatniaAktywnosc });
      dodaj();
    });
  });
}

export function aktualizujPunktPowrotu(jednostkaPracy: JednostkaPracyProjektowej, id: string, dane: PunktPowrotu, kontekst: KontekstZapisu): Promise<WynikZmianyProjektu> {
  return jednostkaPracy.wykonaj(['projekty', 'zdarzenia'], (repozytoria, zakoncz) => {
    repozytoria.projekty.pobierz(id, (projekt) => {
      if (!projekt) throw new Error('Projekt nie istnieje.');
      const wynik = zmienProjekt(projekt, { rodzaj: 'punktPowrotu', dane }, kontekst);
      repozytoria.projekty.zapisz(wynik.projekt);
      repozytoria.zdarzenia.dodaj(wynik.zdarzenie);
      zakoncz(wynik);
    });
  });
}
