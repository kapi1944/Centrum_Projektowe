export interface JednostkaPracy<Porty> {
  wykonaj<Klucz extends keyof Porty, Wynik>(
    magazyny: readonly Klucz[],
    wykonaj: (repozytoria: Pick<Porty, Klucz>, zakoncz: (wynik: Wynik) => void) => void,
  ): Promise<Wynik>;
}

export interface PochodzenieDanych {
  typ: 'USER' | 'SYSTEM' | 'AI';
  nazwa: string;
}

export interface RekordZrodlowy<Poprzedni = unknown> {
  readonly id: string;
  readonly schemaVersion: 1;
  readonly rawText: string;
  readonly createdAt: string;
  readonly projectId: string | null;
  readonly source: { readonly kind: 'MANUAL' | 'IMPORT' | 'OTHER'; readonly origin: PochodzenieDanych };
  readonly preferredAnalysisRunId?: string;
  readonly zgodnoscV1?: Poprzedni;
}

interface PodstawaPrzebiegu<Poprzedni> {
  readonly id: string;
  readonly sourceId: string;
  readonly sourceType: 'CAPTURE';
  readonly provider: { readonly type: 'RULE_BASED' | 'REMOTE_LLM' | 'LOCAL_LLM'; readonly name?: string; readonly version?: string };
  readonly model?: string;
  readonly promptVersion?: string;
  readonly schemaVersion: string;
  readonly preferred: boolean;
  readonly reviewStatus: 'NOT_STARTED' | 'GENERATED' | 'IN_REVIEW' | 'REVIEWED' | 'APPLIED';
  readonly createdAt: string;
  readonly migrationSource?: { readonly kind: 'INDEXEDDB_V4' | 'INDEXEDDB_V5' | 'BACKUP_V1'; readonly legacyAnalysisId: string };
  readonly supersedesAnalysisRunId?: string;
  readonly zgodnoscV1?: Poprzedni;
}

export type PrzebiegAnalizy<Wynik = unknown, Poprzedni = unknown> = PodstawaPrzebiegu<Poprzedni> & (
  | { readonly status: 'RUNNING'; readonly startedAt: string; readonly finishedAt: null; readonly output: null }
  | { readonly status: 'SUCCEEDED'; readonly startedAt: string; readonly finishedAt: string; readonly output: Wynik }
  | { readonly status: 'FAILED' | 'CANCELLED'; readonly startedAt: string; readonly finishedAt: string; readonly output: null }
  | { readonly status: 'LEGACY_IMPORTED'; readonly startedAt: null; readonly finishedAt: null; readonly output: Wynik }
);

export interface PolecenieZmiany {
  readonly rodzaj: 'propozycjaDecyzji' | 'kandydatWplywu' | 'zachowajElement';
  readonly sourceId: string;
  readonly analysisRunId: string;
  readonly elementId: string;
  readonly tresc: string;
  readonly projectId?: string;
}

export interface PropozycjaZmiany {
  readonly id: string;
  readonly schemaVersion: 1;
  readonly sourceId: string;
  readonly analysisRunId: string;
  readonly elementIds: readonly string[];
  readonly operations: readonly PolecenieZmiany[];
  readonly expectedRevisions: Readonly<Record<string, string>>;
}

export interface ZestawZmian {
  readonly id: string;
  readonly schemaVersion: 1;
  readonly proposalId: string;
  readonly reviewId: string;
  readonly reviewRevision: number;
  readonly operations: readonly PolecenieZmiany[];
  readonly expectedRevisions: Readonly<Record<string, string>>;
  readonly idempotencyKey: string;
}

export interface KopertaZdarzeniaDomenowego<Dane = unknown, Poprzedni = unknown> {
  readonly id: string;
  readonly eventType: string;
  readonly eventVersion: number;
  readonly aggregateType: string;
  readonly aggregateId: string | null;
  readonly projectIds: readonly string[];
  readonly occurredAt: string;
  readonly actor: PochodzenieDanych | null;
  readonly source: PochodzenieDanych;
  readonly payload: Dane;
  readonly zgodnoscV1?: Poprzedni;
}
