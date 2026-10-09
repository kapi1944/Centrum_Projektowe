import { pustaRealizacja, type OperacjaRealizacji } from '../../domain/realizacja';
import { useEffect, useState } from 'react';
import type { DaneProjektu, KontekstZapisu, Projekt, Wpis, ZdarzenieAktywnosci, ZmianaProjektu } from '../../domain/modele';
import type { AkcjaWpisu } from '../../domain/modele';
import type { AnalizaWplywu, Decyzja, OperacjaUstalen } from '../../domain/ustalenia';
import { sprawdzDaneProjektu, utworzProjekt } from '../../domain/operacje';
import { aktualizujPunktPowrotu, utworzWpisUzytkownika } from '../../application/przypadkiUzycia';
import type { RepozytoriumProjektowe } from '../../domain/repozytorium';
import type { AnalizaWpisu, AnalysisProvider, OperacjaAnalizyWpisu } from '../../domain/analizaWpisu';
import type { WynikUstalen } from '../../domain/ustalenia';
import { RuleBasedAnalysisProvider } from '../../infrastructure/RuleBasedAnalysisProvider';

const domyslnyDostawcaAnalizy: AnalysisProvider = new RuleBasedAnalysisProvider();

export function useRejestrProjektowy(repozytorium: RepozytoriumProjektowe, dostawcaAnalizy = domyslnyDostawcaAnalizy) {
  const [projekty, ustawProjekty] = useState<Projekt[]>([]);
  const [wpisy, ustawWpisy] = useState<Wpis[]>([]);
  const [zdarzenia, ustawZdarzenia] = useState<ZdarzenieAktywnosci[]>([]);
  const [decyzje, ustawDecyzje] = useState<Decyzja[]>([]);
  const [analizy, ustawAnalizy] = useState<AnalizaWplywu[]>([]);
  const [analizyWpisow, ustawAnalizyWpisow] = useState<AnalizaWpisu[]>([]);
  const [realizacja, ustawRealizacje] = useState(pustaRealizacja);
  const [stan, ustawStan] = useState<'ladowanie' | 'gotowy' | 'blad'>('ladowanie');
  const [blad, ustawBlad] = useState('');
  const [odswiezenie, ustawOdswiezenie] = useState(0);

  useEffect(() => {
    let aktywny = true;
    Promise.all([repozytorium.pobierzProjekty(), repozytorium.pobierzWpisy(), repozytorium.pobierzZdarzenia(), repozytorium.pobierzDecyzje(), repozytorium.pobierzAnalizyWplywu(), repozytorium.pobierzAnalizyWpisow(), repozytorium.pobierzRealizacje()])
      .then(([odczytaneProjekty, odczytaneWpisy, odczytaneZdarzenia, odczytaneDecyzje, odczytaneAnalizy, odczytaneAnalizyWpisow, odczytanaRealizacja]) => {
        if (!aktywny) return;
        ustawProjekty(odczytaneProjekty);
        ustawWpisy(odczytaneWpisy);
        ustawZdarzenia(odczytaneZdarzenia);
        ustawDecyzje(odczytaneDecyzje);
        ustawAnalizy(odczytaneAnalizy);
        ustawAnalizyWpisow(odczytaneAnalizyWpisow);
        ustawRealizacje(odczytanaRealizacja);
        ustawStan('gotowy');
      })
      .catch(() => {
        if (!aktywny) return;
        ustawBlad('Nie udało się odczytać danych lokalnych. Odśwież stronę, aby spróbować ponownie.');
        ustawStan('blad');
      });
    return () => { aktywny = false; };
  }, [repozytorium, odswiezenie]);

  function utworzKontekst(): KontekstZapisu {
    return { idZdarzenia: crypto.randomUUID(), czas: new Date().toISOString(), zrodlo: { typ: 'USER', nazwa: 'Wpis ręczny' } };
  }

  async function dodajProjekt(dane: DaneProjektu) {
    const kontekst = utworzKontekst();
    const projekt = { ...utworzProjekt(dane.nazwa, crypto.randomUUID(), kontekst.czas, kontekst.zrodlo), ...sprawdzDaneProjektu(dane) };
    const zdarzenie = await repozytorium.dodajProjekt(projekt, kontekst);
    ustawProjekty((poprzednie) => [...poprzednie, projekt]);
    ustawZdarzenia((poprzednie) => [...poprzednie, zdarzenie]);
  }

  async function zmienProjekt(id: string, zmiana: ZmianaProjektu) {
    const kontekst = utworzKontekst();
    const wynik = zmiana.rodzaj === 'punktPowrotu'
      ? await aktualizujPunktPowrotu(repozytorium.jednostkaPracy, id, zmiana.dane, kontekst)
      : await repozytorium.zmienProjekt(id, zmiana, kontekst);
    ustawProjekty((poprzednie) => poprzednie.map((projekt) => projekt.id === id ? wynik.projekt : projekt));
    ustawZdarzenia((poprzednie) => [...poprzednie, wynik.zdarzenie]);
  }

  async function dodajWpis(tresc: string, projektId: string | null) {
    const kontekst = utworzKontekst();
    const { wpis, zdarzenie } = await utworzWpisUzytkownika(repozytorium.jednostkaPracy, { id: crypto.randomUUID(), tresc, projektId }, kontekst);
    ustawWpisy((poprzednie) => [...poprzednie, wpis]);
    ustawZdarzenia((poprzednie) => [...poprzednie, zdarzenie]);
    ustawProjekty((poprzednie) => poprzednie.map((projekt) => projekt.id === projektId
      ? { ...projekt, ostatniaAktywnosc: kontekst.czas > projekt.ostatniaAktywnosc ? kontekst.czas : projekt.ostatniaAktywnosc } : projekt));
  }

  async function wykonajAkcjeWpisu(id: string, akcja: AkcjaWpisu) {
    const wynik = await repozytorium.wykonajAkcjeWpisu(id, akcja, utworzKontekst());
    ustawWpisy((poprzednie) => poprzednie.map((wpis) => wpis.id === id ? wynik.wpis : wpis));
    ustawZdarzenia((poprzednie) => [...poprzednie, ...wynik.zdarzenia]);
    const projekt = wynik.projekt;
    if (projekt) ustawProjekty((poprzednie) => poprzednie.some((poprzedni) => poprzedni.id === projekt.id)
      ? poprzednie.map((poprzedni) => poprzedni.id === projekt.id ? projekt : poprzedni) : [...poprzednie, projekt]);
  }

  async function wykonajUstalenie(operacja: OperacjaUstalen) {
    const wynik = await repozytorium.wykonajOperacjeUstalen(operacja, utworzKontekst());
    przyjmijUstalenia(wynik);
  }

  function przyjmijUstalenia(wynik: WynikUstalen) {
    ustawDecyzje((poprzednie) => [...poprzednie.filter((decyzja) => !wynik.decyzje.some((nowa) => nowa.id === decyzja.id)), ...wynik.decyzje]);
    ustawAnalizy((poprzednie) => [...poprzednie.filter((analiza) => !wynik.analizy.some((nowa) => nowa.id === analiza.id)), ...wynik.analizy]);
    ustawProjekty((poprzednie) => poprzednie.map((projekt) => wynik.projekty.find((nowy) => nowy.id === projekt.id) ?? projekt));
    ustawZdarzenia((poprzednie) => [...poprzednie, ...wynik.zdarzenia]);
  }

  async function wykonajAnalizeWpisu(operacja: OperacjaAnalizyWpisu) {
    const wynik = await repozytorium.wykonajOperacjeAnalizyWpisu(operacja, utworzKontekst());
    ustawAnalizyWpisow((poprzednie) => [...poprzednie.filter((analiza) => analiza.id !== wynik.analizaWpisu.id), wynik.analizaWpisu]);
    ustawWpisy((poprzednie) => poprzednie.map((wpis) => wpis.id === wynik.wpis.id ? wynik.wpis : wpis));
    przyjmijUstalenia(wynik);
  }

  async function analizujWpis(wpisId: string) {
    const wpis = wpisy.find((wpis) => wpis.id === wpisId);
    if (!wpis) throw new Error('Wpis nie istnieje.');
    const wynik = await dostawcaAnalizy.analizuj(wpis.trescOryginalna);
    await wykonajAnalizeWpisu({ rodzaj: 'generuj', id: crypto.randomUUID(), wpisId, wynik });
  }

  async function wykonajRealizacje(operacja: OperacjaRealizacji) {
    const wynik = await repozytorium.wykonajOperacjeRealizacji(operacja, utworzKontekst());
    ustawRealizacje(wynik.realizacja);
    ustawProjekty((poprzednie) => poprzednie.map((projekt) => projekt.id === wynik.projekt.id ? wynik.projekt : projekt));
    ustawZdarzenia((poprzednie) => [...poprzednie, ...wynik.zdarzenia]);
  }

  return { odswiez: () => ustawOdswiezenie((poprzednie) => poprzednie + 1), projekty, wpisy, zdarzenia, decyzje, analizy, analizyWpisow, realizacja, wykonajRealizacje, stan, blad, dodajProjekt, zmienProjekt, dodajWpis, wykonajAkcjeWpisu, wykonajUstalenie, analizujWpis, wykonajAnalizeWpisu };
}
