import type { JednostkaPracy } from '@centrum-projektowe/domain';
import type { AkcjaWpisu, KontekstZapisu, Projekt, Wpis, WynikZmianyProjektu, WynikZmianyWpisu, ZdarzenieAktywnosci, ZmianaProjektu } from './modele';
import type { AnalizaWpisu, OperacjaAnalizyWpisu, WynikAnalizyWpisu } from './analizaWpisu';
import type { OperacjaPrzebiegu, PrzebiegAnalizyWpisu } from './przebiegiAnaliz';
import type { AnalizaWplywu, Decyzja, OperacjaUstalen, WynikUstalen } from './ustalenia';
import type { OperacjaRealizacji, StanRealizacji, WynikRealizacji } from './realizacja';
import type { DaneKopii } from './kopieZapasowe';
import type { OperacjaKorekty, StanKorekt } from './korekty';

export interface RepozytoriumKorekt {
  pobierzKorekty(): Promise<StanKorekt>;
  wykonajOperacjeKorekty(operacja: OperacjaKorekty, kontekst: KontekstZapisu): Promise<void>;
}

export interface RepozytoriumProjektow {
  pobierzProjekty(): Promise<Projekt[]>;
  dodajProjekt(projekt: Projekt, kontekst: KontekstZapisu): Promise<ZdarzenieAktywnosci>;
  zmienProjekt(id: string, zmiana: ZmianaProjektu, kontekst: KontekstZapisu): Promise<WynikZmianyProjektu>;
}
export interface RepozytoriumWpisow {
  pobierzWpisy(): Promise<Wpis[]>;
  dodajWpis(wpis: Wpis, kontekst: KontekstZapisu): Promise<ZdarzenieAktywnosci>;
  wykonajAkcjeWpisu(id: string, akcja: AkcjaWpisu, kontekst: KontekstZapisu): Promise<WynikZmianyWpisu>;
}
export interface RepozytoriumAnaliz {
  pobierzPrzebiegiAnaliz(): Promise<PrzebiegAnalizyWpisu[]>;
  wykonajOperacjePrzebiegu(operacja: OperacjaPrzebiegu, kontekst: KontekstZapisu): Promise<void>;
  pobierzAnalizyWpisow(): Promise<AnalizaWpisu[]>;
  wykonajOperacjeAnalizyWpisu(operacja: OperacjaAnalizyWpisu, kontekst: KontekstZapisu): Promise<WynikAnalizyWpisu>;
}
export interface RepozytoriumDecyzji {
  pobierzDecyzje(): Promise<Decyzja[]>;
  pobierzAnalizyWplywu(): Promise<AnalizaWplywu[]>;
  wykonajOperacjeUstalen(operacja: OperacjaUstalen, kontekst: KontekstZapisu): Promise<WynikUstalen>;
}
export interface RepozytoriumRealizacji {
  pobierzRealizacje(): Promise<StanRealizacji>;
  wykonajOperacjeRealizacji(operacja: OperacjaRealizacji, kontekst: KontekstZapisu): Promise<WynikRealizacji>;
}
export interface RepozytoriumZdarzen {
  pobierzZdarzenia(): Promise<ZdarzenieAktywnosci[]>;
}

export interface PortyTransakcji {
  rewizje: {
    pobierz(obsluz: (dane: DaneKopii) => void): void;
    zapisz<K extends keyof DaneKopii>(magazyn: K, rekord: DaneKopii[K][number], nowy: boolean): void;
  };
  projekty: {
    pobierz(id: string, obsluz: (projekt: Projekt | undefined) => void): void;
    zapisz(projekt: Projekt): void;
  };
  wpisy: { dodaj(wpis: Wpis): void };
  zdarzenia: { dodaj(zdarzenie: ZdarzenieAktywnosci): void };
}
export type JednostkaPracyProjektowej = JednostkaPracy<PortyTransakcji>;
