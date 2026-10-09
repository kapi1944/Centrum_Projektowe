import type { KopertaIntegracji, WynikWysylkiIntegracji } from '@centrum-projektowe/contracts';

export type { PolaczenieZrodla, KopertaIntegracji, WpisKolejkiIntegracji, WynikWysylkiIntegracji } from '@centrum-projektowe/contracts';

export interface KontekstIntegracji {
  contractVersion: 1;
  idempotencyKey: string;
  connectionId: string;
}

export interface DostawcaIntegracji {
  contractVersion: 1;
  providerId: string;
  supportedContractVersions: readonly number[];
  capabilities: { inbound: boolean; outbound: boolean };
  odbierz(kontekst: KontekstIntegracji, kursor?: string): Promise<{ envelopes: KopertaIntegracji[]; cursor?: string }>;
  wyslij(kontekst: KontekstIntegracji, koperta: KopertaIntegracji): Promise<WynikWysylkiIntegracji>;
  sprawdzPolaczenie(kontekst: KontekstIntegracji): Promise<{ available: boolean }>;
}
