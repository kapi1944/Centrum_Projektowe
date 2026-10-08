import type { Projekt, Wpis } from './modele';

export function utworzProjekt(nazwa: string, id: string, utworzono: string): Projekt {
  if (!nazwa.trim()) throw new Error('Podaj nazwę projektu.');
  return { id, nazwa: nazwa.trim(), utworzono };
}

export function utworzWpis(
  trescOryginalna: string,
  projektId: string | null,
  id: string,
  utworzono: string,
): Wpis {
  if (!trescOryginalna.trim()) throw new Error('Wpis nie może być pusty.');
  return { id, trescOryginalna, projektId, utworzono, stan: 'nowy' };
}
