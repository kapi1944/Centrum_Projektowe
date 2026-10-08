import type { KontekstZapisu, Projekt, Wpis, WynikZmianyProjektu, ZdarzenieAktywnosci, ZmianaProjektu } from './modele';
import type { AkcjaWpisu, WynikZmianyWpisu } from './modele';
import type { AnalizaWplywu, Decyzja, OperacjaUstalen, WynikUstalen } from './ustalenia';
import type { AnalizaWpisu, OperacjaAnalizyWpisu, WynikAnalizyWpisu } from './analizaWpisu';
import type { OperacjaRealizacji, StanRealizacji, WynikRealizacji } from './realizacja';

export interface RepozytoriumProjektowe {
  pobierzRealizacje(): Promise<StanRealizacji>;
  wykonajOperacjeRealizacji(operacja: OperacjaRealizacji, kontekst: KontekstZapisu): Promise<WynikRealizacji>;
  pobierzAnalizyWpisow(): Promise<AnalizaWpisu[]>;
  wykonajOperacjeAnalizyWpisu(operacja: OperacjaAnalizyWpisu, kontekst: KontekstZapisu): Promise<WynikAnalizyWpisu>;
  pobierzProjekty(): Promise<Projekt[]>;
  dodajProjekt(projekt: Projekt, kontekst: KontekstZapisu): Promise<ZdarzenieAktywnosci>;
  zmienProjekt(id: string, zmiana: ZmianaProjektu, kontekst: KontekstZapisu): Promise<WynikZmianyProjektu>;
  pobierzWpisy(): Promise<Wpis[]>;
  dodajWpis(wpis: Wpis, kontekst: KontekstZapisu): Promise<ZdarzenieAktywnosci>;
  wykonajAkcjeWpisu(id: string, akcja: AkcjaWpisu, kontekst: KontekstZapisu): Promise<WynikZmianyWpisu>;
  pobierzZdarzenia(): Promise<ZdarzenieAktywnosci[]>;
  pobierzDecyzje(): Promise<Decyzja[]>;
  pobierzAnalizyWplywu(): Promise<AnalizaWplywu[]>;
  wykonajOperacjeUstalen(operacja: OperacjaUstalen, kontekst: KontekstZapisu): Promise<WynikUstalen>;
}
