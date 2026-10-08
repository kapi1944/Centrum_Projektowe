export const statusyProjektu = {
  IDEA: 'Pomysł', PLANNING: 'Planowanie', ACTIVE: 'Aktywny', BLOCKED: 'Zablokowany',
  PAUSED: 'Wstrzymany', MAINTENANCE: 'Utrzymanie', COMPLETED: 'Zakończony', ABANDONED: 'Porzucony',
} as const;

export type StatusProjektu = keyof typeof statusyProjektu;
export type StatusWpisu = 'UNPROCESSED' | 'ANALYZED' | 'REVIEWED' | 'APPLIED' | 'DISMISSED';
export type TypZrodlaWpisu = 'MANUAL' | 'IMPORT' | 'OTHER';

export interface ZrodloDanych {
  typ: 'USER' | 'SYSTEM' | 'AI';
  nazwa: string;
}

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
}

export type WartoscMetadanych = string | number | boolean | null | WartoscMetadanych[] | { [klucz: string]: WartoscMetadanych };

export interface ZdarzenieAktywnosci {
  readonly id: string;
  readonly projektId: string | null;
  readonly typEncji: 'PROJECT' | 'CAPTURE';
  readonly encjaId: string | null;
  readonly typZdarzenia: 'PROJECT_CREATED' | 'PROJECT_UPDATED' | 'PROJECT_ARCHIVED' | 'CAPTURE_CREATED';
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

export type ZmianaProjektu = { rodzaj: 'edycja'; dane: DaneProjektu } | { rodzaj: 'archiwizacja' };

export interface WynikZmianyProjektu {
  projekt: Projekt;
  zdarzenie: ZdarzenieAktywnosci;
}
