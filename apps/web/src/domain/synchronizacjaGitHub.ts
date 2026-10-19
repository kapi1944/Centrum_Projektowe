import type { PolaczenieRepozytorium } from './kontekstRepozytorium';

export const statusyGitHub = { NIEPOLACZONE: 'Niepołączone', GOTOWE: 'Gotowe do sprawdzenia', SPRAWDZANIE: 'Sprawdzanie', POLACZONE: 'Połączone', NIEAKTUALNE: 'Dane nieaktualne', OFFLINE: 'Offline', BRAK_DOSTEPU: 'Brak dostępu', NIEZNALEZIONE: 'Nie znaleziono', LIMIT: 'Limit API', BLAD: 'Błąd synchronizacji' } as const;
export type StatusGitHub = keyof typeof statusyGitHub;
export interface TozsamoscGitHub {
  identyfikator: number; wlasciciel: string; nazwa: string; adres: string;
  domyslnaGalaz: string; widocznosc: 'public'; archiwalne: boolean;
}
export interface CommitRepozytorium { sha: string; opis: string; czas: string }
export interface OdczytGitHub {
  tozsamosc: TozsamoscGitHub; commity: CommitRepozytorium[];
  galezie: { nazwa: string; sha: string }[]; ograniczoneGalezie: boolean;
}
export interface StanGitHub {
  tozsamosc?: TozsamoscGitHub; status: StatusGitHub; ostatniaProba: string;
  ostatniaObserwacja?: string; komunikat: string; ponowPo?: string;
}
// Przyszły uwierzytelniony adapter musi mieć własny cache i granicę sesji; port nie przenosi sekretów.
export interface CzytnikRepozytorium {
  odczytaj(repo: PolaczenieRepozytorium, sygnal?: AbortSignal): Promise<OdczytGitHub>;
}
export class BladGitHub extends Error {
  constructor(public readonly status: StatusGitHub, komunikat: string, public readonly ponowPo?: string) { super(komunikat); }
}
export function rozpoznajAdresGitHub(wartosc: string): { wlasciciel: string; nazwa: string } {
  let adres: URL;
  try { adres = new URL(wartosc); } catch { throw new BladGitHub('BLAD', 'Podaj adres https://github.com/właściciel/repozytorium.'); }
  const dopasowanie = /^\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9_.-]{1,100})\/?$/.exec(adres.pathname);
  if (adres.protocol !== 'https:' || adres.hostname !== 'github.com' || adres.port || adres.username || adres.password || adres.search || adres.hash || !dopasowanie
    || ['.', '..'].includes(dopasowanie[2]!)) throw new BladGitHub('BLAD', 'Obsługiwane są wyłącznie adresy repozytoriów https://github.com bez parametrów i poświadczeń.');
  const nazwa = dopasowanie[2]!.replace(/\.git$/, '');
  if (!nazwa || ['.', '..'].includes(nazwa)) throw new BladGitHub('BLAD', 'Niepoprawna nazwa repozytorium.');
  return { wlasciciel: dopasowanie[1]!, nazwa };
}
function obiekt(w: unknown): w is Record<string, unknown> { return !!w && typeof w === 'object' && !Array.isArray(w); }
function pola(w: Record<string, unknown>, lista: string[]) { return Object.keys(w).every((klucz) => lista.includes(klucz)); }
function czas(w: unknown): w is string { return typeof w === 'string' && Number.isFinite(Date.parse(w)); }
export function poprawnySha(w: unknown): w is string { return typeof w === 'string' && /^[a-f0-9]{40}$/.test(w); }
export function poprawnaGalaz(w: unknown): w is string { return typeof w === 'string' && w.length > 0 && w.length <= 255 && !/[\x00-\x20\x7f~^:?*\[\\]/.test(w) && !w.includes('..') && !w.includes('@{') && !w.startsWith('/') && !w.endsWith('/') && !w.endsWith('.lock'); }
export function sprawdzTozsamoscGitHub(w: unknown): w is TozsamoscGitHub {
  if (!obiekt(w) || !pola(w, ['identyfikator', 'wlasciciel', 'nazwa', 'adres', 'domyslnaGalaz', 'widocznosc', 'archiwalne']) || !Number.isSafeInteger(w.identyfikator) || Number(w.identyfikator) <= 0
    || typeof w.adres !== 'string' || w.widocznosc !== 'public' || typeof w.archiwalne !== 'boolean' || !poprawnaGalaz(w.domyslnaGalaz)) return false;
  try { const adres = rozpoznajAdresGitHub(w.adres); return adres.wlasciciel === w.wlasciciel && adres.nazwa === w.nazwa && w.adres === `https://github.com/${adres.wlasciciel}/${adres.nazwa}`; } catch { return false; }
}
export function sprawdzOdczytGitHub(w: unknown): w is OdczytGitHub {
  return obiekt(w) && pola(w, ['tozsamosc', 'commity', 'galezie', 'ograniczoneGalezie']) && sprawdzTozsamoscGitHub(w.tozsamosc)
    && Array.isArray(w.commity) && w.commity.length > 0 && w.commity.length <= 20 && w.commity.every((c: unknown) => obiekt(c) && pola(c, ['sha', 'opis', 'czas']) && poprawnySha(c.sha) && typeof c.opis === 'string' && c.opis.length <= 2000 && czas(c.czas))
    && new Set(w.commity.map((c: CommitRepozytorium) => c.sha)).size === w.commity.length
    && Array.isArray(w.galezie) && w.galezie.length <= 100 && w.galezie.every((g: unknown) => obiekt(g) && pola(g, ['nazwa', 'sha']) && poprawnaGalaz(g.nazwa) && poprawnySha(g.sha))
    && new Set(w.galezie.map((g: { nazwa: string }) => g.nazwa)).size === w.galezie.length && typeof w.ograniczoneGalezie === 'boolean';
}
export function sprawdzStanGitHub(w: unknown): w is StanGitHub {
  return obiekt(w) && pola(w, ['tozsamosc', 'status', 'ostatniaProba', 'ostatniaObserwacja', 'komunikat', 'ponowPo'])
    && typeof w.status === 'string' && Object.hasOwn(statusyGitHub, w.status) && w.status !== 'SPRAWDZANIE'
    && czas(w.ostatniaProba) && (w.ostatniaObserwacja === undefined || (czas(w.ostatniaObserwacja) && w.ostatniaObserwacja <= String(w.ostatniaProba)))
    && typeof w.komunikat === 'string' && (w.ponowPo === undefined || czas(w.ponowPo)) && (w.tozsamosc === undefined || sprawdzTozsamoscGitHub(w.tozsamosc))
    && (w.status !== 'POLACZONE' || (!!w.tozsamosc && !!w.ostatniaObserwacja));
}
export function statusPolaczenia(repo: PolaczenieRepozytorium, teraz: number): StatusGitHub {
  if (!repo.adresZdalny || repo.dostawca !== 'GITHUB') return 'NIEPOLACZONE';
  if (!repo.github) return 'GOTOWE';
  if (repo.github.status === 'POLACZONE' && teraz - Date.parse(repo.github.ostatniaObserwacja ?? '') > 86400000) return 'NIEAKTUALNE';
  return repo.github.status;
}
