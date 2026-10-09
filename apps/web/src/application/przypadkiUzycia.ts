import type { JednostkaPracyProjektowej } from '../domain/porty';
import type { KontekstZapisu, PunktPowrotu, Wpis, WynikZmianyProjektu, ZdarzenieAktywnosci } from '../domain/modele';
import { utworzWpis, zdarzenieUtworzenia, zmienProjekt } from '../domain/operacje';
import type { RepozytoriumAnaliz } from '../domain/porty';
import type { AnalysisProvider } from '../domain/analizaWpisu';

export async function uruchomAnalizeWpisu(repozytorium: RepozytoriumAnaliz, wpis: Wpis, dostawca: AnalysisProvider, utworzKontekst: () => KontekstZapisu) {
  const id = crypto.randomUUID();
  await repozytorium.wykonajOperacjePrzebiegu({ rodzaj: 'rozpocznij', id, wpisId: wpis.id, provider: dostawca.pochodzenie }, utworzKontekst());
  try {
    const wynik = await dostawca.analizuj(wpis.trescOryginalna);
    return await repozytorium.wykonajOperacjeAnalizyWpisu({ rodzaj: 'generuj', id, wpisId: wpis.id, wynik, wymagajRozpoczetego: true, trescZrodlowa: wpis.trescOryginalna }, utworzKontekst());
  } catch (blad) {
    if ((await repozytorium.pobierzPrzebiegiAnaliz()).some((przebieg) => przebieg.id === id && przebieg.status === 'RUNNING')) {
      await repozytorium.wykonajOperacjePrzebiegu({ rodzaj: 'blad', id }, utworzKontekst());
    }
    throw blad;
  }
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
