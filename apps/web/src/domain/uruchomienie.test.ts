import { expect, it, vi } from 'vitest';

it('inicjalizuje rejestr i walidatory kopii przy zimnym starcie bez wcześniejszego ładowania stron', async () => {
  vi.resetModules();
  const rejestr = await import('../features/rejestr/useRejestrProjektowy');
  const kopie = await import('./kopieZapasowe');
  expect(typeof rejestr.useRejestrProjektowy).toBe('function');
  expect(() => kopie.sprawdzDaneKopii(kopie.pusteDaneKopii())).not.toThrow();
  expect(kopie.schematDanych.korekty.sprawdz({ typCelu: 'NIEPOPRAWNY' })).toBe(false);
});
