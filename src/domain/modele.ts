export interface Projekt {
  id: string;
  nazwa: string;
  utworzono: string;
}

export interface Wpis {
  id: string;
  trescOryginalna: string;
  projektId: string | null;
  utworzono: string;
  stan: 'nowy';
}
