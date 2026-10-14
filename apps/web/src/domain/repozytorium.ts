import type { JednostkaPracyProjektowej, RepozytoriumProjektow, RepozytoriumWpisow, RepozytoriumAnaliz, RepozytoriumDecyzji, RepozytoriumRealizacji, RepozytoriumZdarzen, RepozytoriumKorekt } from './porty';
import type { KopiaZapasowa, TrybImportu } from './kopieZapasowe';
import type { RepozytoriumKontekstu } from './porty';

export interface RepozytoriumProjektowe extends RepozytoriumProjektow, RepozytoriumWpisow, RepozytoriumAnaliz, RepozytoriumDecyzji, RepozytoriumRealizacji, RepozytoriumZdarzen, RepozytoriumKorekt, RepozytoriumKontekstu {
  jednostkaPracy: JednostkaPracyProjektowej;
  eksportujKopie(): Promise<KopiaZapasowa>;
  importujKopie(kopia: unknown, tryb: TrybImportu, potwierdzonoZastapienie?: boolean): Promise<void>;
}
