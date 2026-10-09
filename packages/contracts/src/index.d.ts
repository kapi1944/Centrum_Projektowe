export interface StanHuba {
  status: 'ok';
  version: string;
  timestamp: string;
}

export interface PolaczenieZrodla {
  contractVersion: 1;
  idempotencyKey: string;
  providerId: string;
  connectionId: string;
  resourceType: string;
  externalId: string;
  url?: string;
  externalRevision?: string;
  sourceId?: string;
}

export interface KopertaIntegracji {
  contractVersion: 1;
  idempotencyKey: string;
  envelopeId: string;
  providerId: string;
  connectionId: string;
  direction: 'INBOUND' | 'OUTBOUND';
  sourceLink: PolaczenieZrodla;
  occurredAt: string;
  payloadSchemaVersion: string;
  payload: unknown;
  correlationId?: string;
  causationId?: string;
}

export type WynikWysylkiIntegracji =
  | { status: 'DELIVERED'; externalId: string; externalRevision?: string }
  | { status: 'RETRY_WAIT' | 'REJECTED' | 'UNKNOWN'; reason: string };

export interface WpisKolejkiIntegracji {
  contractVersion: 1;
  idempotencyKey: string;
  id: string;
  envelope: KopertaIntegracji;
  changeSetId?: string;
  status: 'PENDING' | 'IN_FLIGHT' | 'DELIVERED' | 'RETRY_WAIT' | 'REJECTED' | 'UNKNOWN';
  attempts: number;
  createdAt: string;
  nextAttemptAt?: string;
  lastError?: string;
  receipt?: Extract<WynikWysylkiIntegracji, { status: 'DELIVERED' }>;
}
