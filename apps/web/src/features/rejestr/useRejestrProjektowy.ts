import { pusteKorekty, type OperacjaKorekty } from '../../domain/korekty';
import type { DaneKopii } from '../../domain/kopieZapasowe';
import { pustaRealizacja, type OperacjaRealizacji } from '../../domain/realizacja';
import { useEffect, useState } from 'react';
import type { DaneProjektu, KontekstZapisu, Projekt, Wpis, ZdarzenieAktywnosci, ZmianaProjektu } from '../../domain/modele';
import type { AkcjaWpisu } from '../../domain/modele';
import type { AnalizaWplywu, Decyzja, OperacjaUstalen } from '../../domain/ustalenia';
import { sprawdzDaneProjektu, utworzProjekt } from '../../domain/operacje';
import { aktualizujPunktPowrotu, utworzWpisUzytkownika, uruchomAnalizeWpisu, uruchomAnalizePoKorekcie } from '../../application/przypadkiUzycia';
import type { RepozytoriumProjektowe } from '../../domain/repozytorium';
import type { AnalizaWpisu, AnalysisProvider, OperacjaAnalizyWpisu, WynikAnalizyWpisu } from '../../domain/analizaWpisu';
import type { PrzebiegAnalizyWpisu } from '../../domain/przebiegiAnaliz';
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
  const [przebiegiAnaliz, ustawPrzebiegiAnaliz] = useState<PrzebiegAnalizyWpisu[]>([]);
  const [korekty, ustawKorekty] = useState(pusteKorekty);
  const [realizacja, ustawRealizacje] = useState(pustaRealizacja);
  const [stan, ustawStan] = useState<'ladowanie' | 'gotowy' | 'blad'>('ladowanie');
  const [blad, ustawBlad] = useState('');
  const [odswiezenie, ustawOdswiezenie] = useState(0);

  useEffect(() => {
    let aktywny = true;
    Promise.all([repozytorium.pobierzProjekty(), repozytorium.pobierzWpisy(), repozytorium.pobierzZdarzenia(), repozytorium.pobierzDecyzje(), repozytorium.pobierzAnalizyWplywu(), repozytorium.pobierzAnalizyWpisow(), repozytorium.pobierzRealizacje(), repozytorium.pobierzPrzebiegiAnaliz(), repozytorium.pobierzKorekty()])
      .then(([odczytaneProjekty, odczytaneWpisy, odczytaneZdarzenia, odczytaneDecyzje, odczytaneAnalizy, odczytaneAnalizyWpisow, odczytanaRealizacja, odczytanePrzebiegi, odczytaneKorekty]) => {
        if (!aktywny) return;
        ustawProjekty(odczytaneProjekty);
        ustawWpisy(odczytaneWpisy);
        ustawZdarzenia(odczytaneZdarzenia);
        ustawDecyzje(odczytaneDecyzje);
        ustawAnalizy(odczytaneAnalizy);
        ustawAnalizyWpisow(odczytaneAnalizyWpisow);
        ustawPrzebiegiAnaliz(odczytanePrzebiegi);
        ustawRealizacje(odczytanaRealizacja);
        ustawKorekty(odczytaneKorekty);
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
    przyjmijAnalize(wynik);
    await odswiezPrzebiegi();
  }

  function przyjmijAnalize(wynik: WynikAnalizyWpisu) {
    ustawAnalizyWpisow((poprzednie) => [...poprzednie.filter((analiza) => analiza.id !== wynik.analizaWpisu.id), wynik.analizaWpisu]);
    ustawWpisy((poprzednie) => poprzednie.map((wpis) => wpis.id === wynik.wpis.id ? wynik.wpis : wpis));
    przyjmijUstalenia(wynik);
  }

  async function analizujWpis(wpisId: string) {
    const wpis = wpisy.find((wpis) => wpis.id === wpisId);
    if (!wpis) throw new Error('Wpis nie istnieje.');
    try { przyjmijAnalize(await uruchomAnalizeWpisu(repozytorium, wpis, dostawcaAnalizy, utworzKontekst)); }
    finally { await odswiezPrzebiegi(); }
  }

  async function odswiezPrzebiegi() {
    const [przebiegi, historia] = await Promise.all([repozytorium.pobierzPrzebiegiAnaliz(), repozytorium.pobierzZdarzenia()]);
    ustawPrzebiegiAnaliz(przebiegi); ustawZdarzenia(historia);
  }

  async function preferujAnalize(id: string) {
    const przebieg = przebiegiAnaliz.find((przebieg) => przebieg.id === id);
    if (!przebieg) throw new Error('Przebieg nie istnieje.');
    const poprzedni = przebiegiAnaliz.find((inny) => inny.sourceId === przebieg.sourceId && inny.preferred);
    await repozytorium.wykonajOperacjePrzebiegu({ rodzaj: 'preferuj', id, poprzedniId: poprzedni?.id ?? null }, utworzKontekst());
    await odswiezPrzebiegi();
  }

  async function wykonajRealizacje(operacja: OperacjaRealizacji) {
    const wynik = await repozytorium.wykonajOperacjeRealizacji(operacja, utworzKontekst());
    ustawRealizacje(wynik.realizacja);
    ustawProjekty((poprzednie) => poprzednie.map((projekt) => projekt.id === wynik.projekt.id ? wynik.projekt : projekt));
    ustawZdarzenia((poprzednie) => [...poprzednie, ...wynik.zdarzenia]);
  }

  async function wykonajKorekte(operacja: OperacjaKorekty) {
    await repozytorium.wykonajOperacjeKorekty(operacja, utworzKontekst());
    ustawOdswiezenie((poprzednie) => poprzednie + 1);
  }
  async function analizujKorekte(id: string) {
    try { await uruchomAnalizePoKorekcie(repozytorium, id, dostawcaAnalizy, utworzKontekst); }
    finally { ustawOdswiezenie((poprzednie) => poprzednie + 1); }
  }
  const daneKorekt: DaneKopii = { ...realizacja, ...korekty, projekty, wpisy, zdarzenia, decyzje, analizyWplywu: analizy, analizyWpisow, przebiegiAnaliz };
  return { daneKorekt, wykonajKorekte, analizujKorekte, odswiez: () => ustawOdswiezenie((poprzednie) => poprzednie + 1), projekty, wpisy, zdarzenia, decyzje, analizy, analizyWpisow, przebiegiAnaliz, preferujAnalize, realizacja, wykonajRealizacje, stan, blad, dodajProjekt, zmienProjekt, dodajWpis, wykonajAkcjeWpisu, wykonajUstalenie, analizujWpis, wykonajAnalizeWpisu };
}
