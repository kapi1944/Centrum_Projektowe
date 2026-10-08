import type { KontekstZapisu, Projekt, Wpis, WynikZmianyProjektu, ZdarzenieAktywnosci, ZmianaProjektu } from './modele';

export interface RepozytoriumProjektowe {
  pobierzProjekty(): Promise<Projekt[]>;
  dodajProjekt(projekt: Projekt, kontekst: KontekstZapisu): Promise<ZdarzenieAktywnosci>;
  zmienProjekt(id: string, zmiana: ZmianaProjektu, kontekst: KontekstZapisu): Promise<WynikZmianyProjektu>;
  pobierzWpisy(): Promise<Wpis[]>;
  dodajWpis(wpis: Wpis, kontekst: KontekstZapisu): Promise<ZdarzenieAktywnosci>;
  pobierzZdarzenia(): Promise<ZdarzenieAktywnosci[]>;
}
