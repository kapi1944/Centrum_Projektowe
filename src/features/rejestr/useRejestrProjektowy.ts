import { useEffect, useState } from 'react';
import type { DaneProjektu, KontekstZapisu, Projekt, Wpis, ZdarzenieAktywnosci, ZmianaProjektu } from '../../domain/modele';
import type { AkcjaWpisu } from '../../domain/modele';
import type { AnalizaWplywu, Decyzja, OperacjaUstalen } from '../../domain/ustalenia';
import { sprawdzDaneProjektu, utworzProjekt, utworzWpis } from '../../domain/operacje';
import type { RepozytoriumProjektowe } from '../../domain/repozytorium';

export function useRejestrProjektowy(repozytorium: RepozytoriumProjektowe) {
  const [projekty, ustawProjekty] = useState<Projekt[]>([]);
  const [wpisy, ustawWpisy] = useState<Wpis[]>([]);
  const [zdarzenia, ustawZdarzenia] = useState<ZdarzenieAktywnosci[]>([]);
  const [decyzje, ustawDecyzje] = useState<Decyzja[]>([]);
  const [analizy, ustawAnalizy] = useState<AnalizaWplywu[]>([]);
  const [stan, ustawStan] = useState<'ladowanie' | 'gotowy' | 'blad'>('ladowanie');
  const [blad, ustawBlad] = useState('');

  useEffect(() => {
    let aktywny = true;
    Promise.all([repozytorium.pobierzProjekty(), repozytorium.pobierzWpisy(), repozytorium.pobierzZdarzenia(), repozytorium.pobierzDecyzje(), repozytorium.pobierzAnalizyWplywu()])
      .then(([odczytaneProjekty, odczytaneWpisy, odczytaneZdarzenia, odczytaneDecyzje, odczytaneAnalizy]) => {
        if (!aktywny) return;
        ustawProjekty(odczytaneProjekty);
        ustawWpisy(odczytaneWpisy);
        ustawZdarzenia(odczytaneZdarzenia);
        ustawDecyzje(odczytaneDecyzje);
        ustawAnalizy(odczytaneAnalizy);
        ustawStan('gotowy');
      })
      .catch(() => {
        if (!aktywny) return;
        ustawBlad('Nie udało się odczytać danych lokalnych. Odśwież stronę, aby spróbować ponownie.');
        ustawStan('blad');
      });
    return () => { aktywny = false; };
  }, [repozytorium]);

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
    const wynik = await repozytorium.zmienProjekt(id, zmiana, utworzKontekst());
    ustawProjekty((poprzednie) => poprzednie.map((projekt) => projekt.id === id ? wynik.projekt : projekt));
    ustawZdarzenia((poprzednie) => [...poprzednie, wynik.zdarzenie]);
  }

  async function dodajWpis(tresc: string, projektId: string | null) {
    const kontekst = utworzKontekst();
    const wpis = utworzWpis(tresc, projektId, crypto.randomUUID(), kontekst.czas, kontekst.zrodlo);
    const zdarzenie = await repozytorium.dodajWpis(wpis, kontekst);
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
    ustawDecyzje((poprzednie) => [...poprzednie.filter((decyzja) => !wynik.decyzje.some((nowa) => nowa.id === decyzja.id)), ...wynik.decyzje]);
    ustawAnalizy((poprzednie) => [...poprzednie.filter((analiza) => !wynik.analizy.some((nowa) => nowa.id === analiza.id)), ...wynik.analizy]);
    ustawProjekty((poprzednie) => poprzednie.map((projekt) => wynik.projekty.find((nowy) => nowy.id === projekt.id) ?? projekt));
    ustawZdarzenia((poprzednie) => [...poprzednie, ...wynik.zdarzenia]);
  }

  return { projekty, wpisy, zdarzenia, decyzje, analizy, stan, blad, dodajProjekt, zmienProjekt, dodajWpis, wykonajAkcjeWpisu, wykonajUstalenie };
}
