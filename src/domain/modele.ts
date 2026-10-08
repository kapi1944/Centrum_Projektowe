export const statusyProjektu = {
  IDEA: 'Pomysł', PLANNING: 'Planowanie', ACTIVE: 'Aktywny', BLOCKED: 'Zablokowany',
  PAUSED: 'Wstrzymany', MAINTENANCE: 'Utrzymanie', COMPLETED: 'Zakończony', ABANDONED: 'Porzucony',
} as const;

export type StatusProjektu = keyof typeof statusyProjektu;
export type StatusWpisu = 'UNPROCESSED' | 'ANALYZED' | 'REVIEWED' | 'APPLIED' | 'DISMISSED';
export const etykietyStatusowWpisu: Record<StatusWpisu, string> = {
  UNPROCESSED: 'Nieprzetworzony', ANALYZED: 'Przeanalizowany', REVIEWED: 'Zweryfikowany', APPLIED: 'Zastosowany', DISMISSED: 'Odrzucony',
};
export type TypZrodlaWpisu = 'MANUAL' | 'IMPORT' | 'OTHER';

export interface ZrodloDanych {
  typ: 'USER' | 'SYSTEM' | 'AI';
  nazwa: string;
}

export const etykietyZrodel: Record<ZrodloDanych['typ'], string> = {
  USER: 'Użytkownik', SYSTEM: 'System', AI: 'Sztuczna inteligencja',
};

export interface DaneProjektu {
  nazwa: string;
  opis: string;
  status: StatusProjektu;
  podsumowanieAktualnegoStanu: string;
  ostatnioPracowanoNad: string;
  nastepnyKrok: string;
}

export interface Projekt extends DaneProjektu {
  id: string;
  utworzono: string;
  zaktualizowano: string;
  ostatniaAktywnosc: string;
  zarchiwizowano: string | null;
  zrodlo: ZrodloDanych;
}

export interface Wpis {
  readonly id: string;
  readonly trescOryginalna: string;
  projektId: string | null;
  readonly utworzono: string;
  status: StatusWpisu;
  typZrodla: TypZrodlaWpisu;
  zrodlo: ZrodloDanych;
  odlozonoDoAnalizy?: string | null;
}

export type WartoscMetadanych = string | number | boolean | null | WartoscMetadanych[] | { [klucz: string]: WartoscMetadanych };

export interface ZdarzenieAktywnosci {
  readonly id: string;
  readonly projektId: string | null;
  readonly projektIds?: string[];
  readonly typEncji: 'PROJECT' | 'CAPTURE' | 'DECISION' | 'IMPACT';
  readonly encjaId: string | null;
  readonly typZdarzenia: 'PROJECT_CREATED' | 'PROJECT_UPDATED' | 'PROJECT_ARCHIVED' | 'PROJECT_RESUME_UPDATED'
    | 'CAPTURE_CREATED' | 'CAPTURE_ASSIGNED' | 'CAPTURE_DEFERRED' | 'CAPTURE_DISMISSED'
    | 'CAPTURE_ANALYZED' | 'CAPTURE_REVIEWED' | 'CAPTURE_ANALYSIS_APPLIED'
    | 'DECISION_CREATED' | 'DECISION_STATUS_CHANGED' | 'DECISION_SUPERSEDED'
    | 'IMPACT_ANALYZED' | 'IMPACT_APPROVED' | 'IMPACT_REJECTED';
  readonly tytul: string;
  readonly opis?: string;
  readonly utworzono: string;
  readonly metadane?: { [klucz: string]: WartoscMetadanych };
  readonly zrodlo: ZrodloDanych;
}

export interface KontekstZapisu {
  idZdarzenia: string;
  czas: string;
  zrodlo: ZrodloDanych;
}

export type PunktPowrotu = Pick<DaneProjektu, 'ostatnioPracowanoNad' | 'podsumowanieAktualnegoStanu' | 'nastepnyKrok'>;

export type ZmianaProjektu = { rodzaj: 'edycja'; dane: DaneProjektu } | { rodzaj: 'archiwizacja' }
  | { rodzaj: 'punktPowrotu'; dane: PunktPowrotu };

export type AkcjaWpisu = { rodzaj: 'przypisanie'; projektId: string }
  | { rodzaj: 'nowyProjekt'; idProjektu: string; nazwa: string; opis: string; idZdarzeniaProjektu: string }
  | { rodzaj: 'odlozenie' } | { rodzaj: 'odrzucenie' };

export interface WynikZmianyWpisu {
  wpis: Wpis;
  projekt: Projekt | null;
  zdarzenia: ZdarzenieAktywnosci[];
}

export interface WynikZmianyProjektu {
  projekt: Projekt;
  zdarzenie: ZdarzenieAktywnosci;
}
