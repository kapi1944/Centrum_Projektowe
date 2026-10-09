import { describe, expect, it } from 'vitest';
import { sprawdzDaneProjektu, utworzProjekt, utworzWpis, zmienProjekt } from './operacje';
import { statusyProjektu } from './modele';

describe('Operacje domenowe', () => {
  it('zachowuje oryginalny wpis wraz z odstępami i nowymi liniami', () => {
    const oryginal = '  Pomysł\n\nDruga linia  ';
    expect(utworzWpis(oryginal, null, 'wpis-1', '2026-10-08T10:00:00Z')).toEqual({
      id: 'wpis-1', trescOryginalna: oryginal, projektId: null,
      utworzono: '2026-10-08T10:00:00Z', status: 'UNPROCESSED', typZrodla: 'MANUAL', zrodlo: { typ: 'USER', nazwa: 'Wpis ręczny' },
    });
  });

  it('odrzuca pusty wpis i pustą nazwę projektu', () => {
    expect(() => utworzWpis(' \n ', null, '1', '2026-10-08')).toThrow();
    expect(() => utworzProjekt('  ', '1', '2026-10-08')).toThrow();
  });

  it('normalizuje nazwę projektu', () => {
    expect(utworzProjekt('  Centrum  ', '1', '2026-10-08').nazwa).toBe('Centrum');
  });

  it('obsługuje wszystkie statusy projektu, zachowując tożsamość i czas utworzenia', () => {
    const projekt = utworzProjekt('Projekt', 'p1', '2026-10-08T10:00:00Z');
    for (const status of Object.keys(statusyProjektu) as (keyof typeof statusyProjektu)[]) {
      const wynik = zmienProjekt(projekt, { rodzaj: 'edycja', dane: { ...projekt, status, opis: 'Nowy opis' } }, {
        idZdarzenia: 'z1', czas: '2026-10-08T11:00:00Z', zrodlo: { typ: 'USER', nazwa: 'Wpis ręczny' },
      });
      expect(wynik.projekt).toMatchObject({ id: 'p1', utworzono: projekt.utworzono, status, opis: 'Nowy opis' });
      expect(wynik.zdarzenie.metadane?.zmiany).toBeDefined();
      expect(projekt.opis).toBe('');
    }
  });

  it('nie pozwala zmienić pól technicznych przez dane edycji', () => {
    const projekt = utworzProjekt('Projekt', 'p1', '2026-10-08');
    expect(sprawdzDaneProjektu({ ...projekt, id: 'inne' } as typeof projekt)).not.toHaveProperty('id');
  });

  it('przechowuje pochodzenie i rodzaj źródła niezależnie od oryginału', () => {
    const zrodlo = { typ: 'AI', nazwa: 'ChatGPT' } as const;
    const wpis = utworzWpis('  Cytat\n ', null, 'w1', '2026-10-08', zrodlo, 'IMPORT');
    expect(wpis).toMatchObject({ trescOryginalna: '  Cytat\n ', zrodlo, typZrodla: 'IMPORT' });
  });
});
