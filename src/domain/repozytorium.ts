import type { KontekstZapisu, Projekt, Wpis, WynikZmianyProjektu, ZdarzenieAktywnosci, ZmianaProjektu } from './modele';
import type { AkcjaWpisu, WynikZmianyWpisu } from './modele';
import type { AnalizaWplywu, Decyzja, OperacjaUstalen, WynikUstalen } from './ustalenia';

export interface RepozytoriumProjektowe {
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
