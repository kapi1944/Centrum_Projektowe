import type { JednostkaPracyProjektowej, RepozytoriumProjektow, RepozytoriumWpisow, RepozytoriumAnaliz, RepozytoriumDecyzji, RepozytoriumRealizacji, RepozytoriumZdarzen } from './porty';
import type { KopiaZapasowa, TrybImportu } from './kopieZapasowe';

export interface RepozytoriumProjektowe extends RepozytoriumProjektow, RepozytoriumWpisow, RepozytoriumAnaliz, RepozytoriumDecyzji, RepozytoriumRealizacji, RepozytoriumZdarzen {
  jednostkaPracy: JednostkaPracyProjektowej;
  eksportujKopie(): Promise<KopiaZapasowa>;
  importujKopie(kopia: unknown, tryb: TrybImportu, potwierdzonoZastapienie?: boolean): Promise<void>;
}
