import { describe, expect, it } from 'vitest';
import { utworzProjekt, utworzWpis } from './operacje';

describe('Operacje domenowe', () => {
  it('zachowuje oryginalny wpis wraz z odstępami i nowymi liniami', () => {
    const oryginal = '  Pomysł\n\nDruga linia  ';
    expect(utworzWpis(oryginal, null, 'wpis-1', '2026-10-08T10:00:00Z')).toEqual({
      id: 'wpis-1', trescOryginalna: oryginal, projektId: null,
      utworzono: '2026-10-08T10:00:00Z', stan: 'nowy',
    });
  });

  it('odrzuca pusty wpis i pustą nazwę projektu', () => {
    expect(() => utworzWpis(' \n ', null, '1', '2026-10-08')).toThrow();
    expect(() => utworzProjekt('  ', '1', '2026-10-08')).toThrow();
  });

  it('normalizuje nazwę projektu', () => {
    expect(utworzProjekt('  Centrum  ', '1', '2026-10-08').nazwa).toBe('Centrum');
  });
});
