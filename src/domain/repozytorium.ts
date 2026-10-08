import type { Projekt, Wpis } from './modele';

export interface RepozytoriumProjektowe {
  pobierzProjekty(): Promise<Projekt[]>;
  dodajProjekt(projekt: Projekt): Promise<void>;
  pobierzWpisy(): Promise<Wpis[]>;
  dodajWpis(wpis: Wpis): Promise<void>;
}
