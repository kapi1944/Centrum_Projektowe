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
function obiekt(wartosc: unknown): wartosc is Record<string, unknown> { return !!wartosc && typeof wartosc === 'object' && !Array.isArray(wartosc); }
function pola(wartosc: Record<string, unknown>, lista: string[]) { return Object.keys(wartosc).every((klucz) => lista.includes(klucz)); }
function czas(wartosc: unknown): wartosc is string { return typeof wartosc === 'string' && Number.isFinite(Date.parse(wartosc)); }
export function poprawnySha(wartosc: unknown): wartosc is string { return typeof wartosc === 'string' && /^[a-f0-9]{40}$/.test(wartosc); }
export function poprawnaGalaz(wartosc: unknown): wartosc is string {
  return typeof wartosc === 'string' && wartosc.length > 0 && wartosc.length <= 255
    && ![...wartosc].some((znak) => znak.charCodeAt(0) <= 32 || znak.charCodeAt(0) === 127 || '~^:?*[\\'.includes(znak))
    && !wartosc.includes('..') && !wartosc.includes('@{') && !wartosc.includes('//')
    && !wartosc.startsWith('/') && !wartosc.endsWith('/') && !wartosc.endsWith('.')
    && !wartosc.split('/').some((czesc) => czesc.startsWith('.') || czesc.endsWith('.lock'));
}
export function sprawdzTozsamoscGitHub(wartosc: unknown): wartosc is TozsamoscGitHub {
  if (!obiekt(wartosc) || !pola(wartosc, ['identyfikator', 'wlasciciel', 'nazwa', 'adres', 'domyslnaGalaz', 'widocznosc', 'archiwalne']) || !Number.isSafeInteger(wartosc.identyfikator) || Number(wartosc.identyfikator) <= 0
    || typeof wartosc.adres !== 'string' || wartosc.widocznosc !== 'public' || typeof wartosc.archiwalne !== 'boolean' || !poprawnaGalaz(wartosc.domyslnaGalaz)) return false;
  try { const adres = rozpoznajAdresGitHub(wartosc.adres); return adres.wlasciciel === wartosc.wlasciciel && adres.nazwa === wartosc.nazwa && wartosc.adres === `https://github.com/${adres.wlasciciel}/${adres.nazwa}`; } catch { return false; }
}
export function sprawdzOdczytGitHub(wartosc: unknown): wartosc is OdczytGitHub {
  return obiekt(wartosc) && pola(wartosc, ['tozsamosc', 'commity', 'galezie', 'ograniczoneGalezie']) && sprawdzTozsamoscGitHub(wartosc.tozsamosc)
    && Array.isArray(wartosc.commity) && wartosc.commity.length > 0 && wartosc.commity.length <= 20 && wartosc.commity.every((zmiana: unknown) => obiekt(zmiana) && pola(zmiana, ['sha', 'opis', 'czas']) && poprawnySha(zmiana.sha) && typeof zmiana.opis === 'string' && zmiana.opis.length <= 2000 && czas(zmiana.czas))
    && new Set(wartosc.commity.map((zmiana: CommitRepozytorium) => zmiana.sha)).size === wartosc.commity.length
    && Array.isArray(wartosc.galezie) && wartosc.galezie.length <= 100 && wartosc.galezie.every((galaz: unknown) => obiekt(galaz) && pola(galaz, ['nazwa', 'sha']) && poprawnaGalaz(galaz.nazwa) && poprawnySha(galaz.sha))
    && new Set(wartosc.galezie.map((galaz: { nazwa: string }) => galaz.nazwa)).size === wartosc.galezie.length && typeof wartosc.ograniczoneGalezie === 'boolean'
    && (wartosc.ograniczoneGalezie || wartosc.galezie.some((galaz: { nazwa: string; sha: string }) => galaz.nazwa === (wartosc.tozsamosc as TozsamoscGitHub).domyslnaGalaz))
    && wartosc.galezie.every((galaz: { nazwa: string; sha: string }) => galaz.nazwa !== (wartosc.tozsamosc as TozsamoscGitHub).domyslnaGalaz || galaz.sha === (wartosc.commity as CommitRepozytorium[])[0]!.sha);
}
export function sprawdzStanGitHub(wartosc: unknown): wartosc is StanGitHub {
  return obiekt(wartosc) && pola(wartosc, ['tozsamosc', 'status', 'ostatniaProba', 'ostatniaObserwacja', 'komunikat', 'ponowPo'])
    && typeof wartosc.status === 'string' && Object.hasOwn(statusyGitHub, wartosc.status) && wartosc.status !== 'SPRAWDZANIE'
    && czas(wartosc.ostatniaProba) && (wartosc.ostatniaObserwacja === undefined || (czas(wartosc.ostatniaObserwacja) && Date.parse(wartosc.ostatniaObserwacja) <= Date.parse(wartosc.ostatniaProba)))
    && typeof wartosc.komunikat === 'string' && (wartosc.ponowPo === undefined || czas(wartosc.ponowPo)) && (wartosc.tozsamosc === undefined || sprawdzTozsamoscGitHub(wartosc.tozsamosc))
    && (wartosc.status !== 'POLACZONE' || (!!wartosc.tozsamosc && !!wartosc.ostatniaObserwacja));
}
export function statusPolaczenia(repo: PolaczenieRepozytorium, teraz: number): StatusGitHub {
  if (!repo.adresZdalny || repo.dostawca !== 'GITHUB') return 'NIEPOLACZONE';
  if (!repo.github) return 'GOTOWE';
  if (repo.github.status === 'POLACZONE' && teraz - Date.parse(repo.github.ostatniaObserwacja ?? '') > 86400000) return 'NIEAKTUALNE';
  return repo.github.status;
}
