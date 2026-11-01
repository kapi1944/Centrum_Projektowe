import type { PolaczenieRepozytorium } from './kontekstRepozytorium';

export const statusyGitHub = { NIEPOLACZONE: 'Niepołączone', GOTOWE: 'Gotowe do sprawdzenia', SPRAWDZANIE: 'Sprawdzanie', POLACZONE: 'Połączone', NIEAKTUALNE: 'Dane nieaktualne', OFFLINE: 'Offline', BRAK_DOSTEPU: 'Brak dostępu', NIEZNALEZIONE: 'Nie znaleziono', LIMIT: 'Limit API', BLAD: 'Błąd synchronizacji' } as const;
export type StatusGitHub = keyof typeof statusyGitHub;
export interface TozsamoscGitHub {
  identyfikator: number; wlasciciel: string; nazwa: string; adres: string;
  domyslnaGalaz: string; widocznosc: 'public'; archiwalne: boolean;
}
export interface CommitRepozytorium { sha: string; opis: string; czas: string }
export interface PlikZmiany { nazwa: string; poprzedniaNazwa?: string; status: string; dodano: number; usunieto: number }
export interface SzczegolyCommitu extends CommitRepozytorium { dodano: number; usunieto: number; pliki: PlikZmiany[]; ograniczone: boolean; pobrano: string }
export interface PorownanieCommitow { podstawa: string; cel: string; status: 'ahead' | 'behind' | 'identical' | 'diverged'; liczbaCommitow: number; pliki: PlikZmiany[]; ograniczone: boolean; pobrano: string }
export interface PullRequestGitHub { numer: number; tytul: string; stan: 'open' | 'closed'; szkic: boolean; sha: string; zaktualizowano: string }
export const statusyWorkflow = { SUKCES: 'Sukces', BLAD: 'Błąd', W_TOKU: 'W toku', NIEZNANY: 'Nieznany' } as const;
export interface UruchomienieWorkflow { id: number; workflowId: number; nazwa: string; sha: string; status: keyof typeof statusyWorkflow; wynik: string | null; rozpoczeto: string; zaktualizowano: string; czasSekundy: number | null }
export interface InteligencjaGitHub {
  szczegoly: SzczegolyCommitu[]; porownanie?: PorownanieCommitow;
  pullRequesty?: { rekordy: PullRequestGitHub[]; ograniczone: boolean; pobrano: string };
  workflow?: { rekordy: UruchomienieWorkflow[]; ograniczone: boolean; pobrano: string };
}
export type ZakresGitHub = { rodzaj: 'COMMIT'; sha: string } | { rodzaj: 'POROWNANIE'; podstawa: string; cel: string } | { rodzaj: 'PR' } | { rodzaj: 'WORKFLOW' };
export interface OdczytGitHub {
  inteligencja?: InteligencjaGitHub;
  historiaPobrana?: string;
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
  rozszerz?(repo: PolaczenieRepozytorium, poprzedni: OdczytGitHub, zakres: ZakresGitHub, sygnal?: AbortSignal): Promise<OdczytGitHub>;
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
export function licznikGitHub(wartosc: unknown): wartosc is number { return Number.isSafeInteger(wartosc) && Number(wartosc) >= 0; }
export function sprawdzPlikiGitHub(wartosc: unknown): wartosc is PlikZmiany[] {
  return Array.isArray(wartosc) && wartosc.length <= 300 && wartosc.every((plik: unknown) => obiekt(plik)
    && pola(plik, ['nazwa', 'poprzedniaNazwa', 'status', 'dodano', 'usunieto'])
    && typeof plik.nazwa === 'string' && plik.nazwa.length > 0 && plik.nazwa.length <= 4096
    && (plik.poprzedniaNazwa === undefined || (typeof plik.poprzedniaNazwa === 'string' && plik.poprzedniaNazwa.length > 0 && plik.poprzedniaNazwa.length <= 4096))
    && typeof plik.status === 'string' && ['added', 'removed', 'modified', 'renamed', 'copied', 'changed', 'unchanged'].includes(plik.status)
    && licznikGitHub(plik.dodano) && licznikGitHub(plik.usunieto))
    && new Set(wartosc.map((plik: PlikZmiany) => plik.nazwa)).size === wartosc.length;
}
export function sprawdzInteligencjeGitHub(wartosc: unknown): wartosc is InteligencjaGitHub {
  if (!obiekt(wartosc) || !pola(wartosc, ['szczegoly', 'porownanie', 'pullRequesty', 'workflow'])
    || !Array.isArray(wartosc.szczegoly) || wartosc.szczegoly.length > 20
    || !wartosc.szczegoly.every((commit: unknown) => obiekt(commit) && pola(commit, ['sha', 'opis', 'czas', 'dodano', 'usunieto', 'pliki', 'ograniczone', 'pobrano'])
      && poprawnySha(commit.sha) && typeof commit.opis === 'string' && commit.opis.length <= 2000 && czas(commit.czas) && czas(commit.pobrano)
      && licznikGitHub(commit.dodano) && licznikGitHub(commit.usunieto) && sprawdzPlikiGitHub(commit.pliki) && commit.pliki.length <= 100 && typeof commit.ograniczone === 'boolean')
    || new Set(wartosc.szczegoly.map((commit: SzczegolyCommitu) => commit.sha)).size !== wartosc.szczegoly.length) return false;
  const porownanie = wartosc.porownanie;
  if (porownanie !== undefined && (!obiekt(porownanie) || !pola(porownanie, ['podstawa', 'cel', 'status', 'liczbaCommitow', 'pliki', 'ograniczone', 'pobrano'])
    || !poprawnySha(porownanie.podstawa) || !poprawnySha(porownanie.cel) || typeof porownanie.status !== 'string' || !['ahead', 'behind', 'identical', 'diverged'].includes(porownanie.status)
    || !licznikGitHub(porownanie.liczbaCommitow) || !sprawdzPlikiGitHub(porownanie.pliki) || typeof porownanie.ograniczone !== 'boolean' || !czas(porownanie.pobrano))) return false;
  for (const rodzaj of ['pullRequesty', 'workflow'] as const) {
    const lista = wartosc[rodzaj];
    if (lista === undefined) continue;
    if (!obiekt(lista) || !pola(lista, ['rekordy', 'ograniczone', 'pobrano']) || typeof lista.ograniczone !== 'boolean' || !czas(lista.pobrano) || !Array.isArray(lista.rekordy) || lista.rekordy.length > 20) return false;
    if (rodzaj === 'pullRequesty') {
      if (!lista.rekordy.every((pr: unknown) => obiekt(pr) && pola(pr, ['numer', 'tytul', 'stan', 'szkic', 'sha', 'zaktualizowano'])
        && licznikGitHub(pr.numer) && pr.numer > 0 && typeof pr.tytul === 'string' && pr.tytul.length > 0 && pr.tytul.length <= 2000
        && ['open', 'closed'].includes(String(pr.stan)) && typeof pr.szkic === 'boolean' && poprawnySha(pr.sha) && czas(pr.zaktualizowano))
        || new Set(lista.rekordy.map((pr: PullRequestGitHub) => pr.numer)).size !== lista.rekordy.length) return false;
    } else if (!lista.rekordy.every((uruchomienie: unknown) => obiekt(uruchomienie) && pola(uruchomienie, ['id', 'workflowId', 'nazwa', 'sha', 'status', 'wynik', 'rozpoczeto', 'zaktualizowano', 'czasSekundy'])
      && licznikGitHub(uruchomienie.id) && uruchomienie.id > 0 && licznikGitHub(uruchomienie.workflowId) && uruchomienie.workflowId > 0 && typeof uruchomienie.nazwa === 'string' && uruchomienie.nazwa.length > 0 && uruchomienie.nazwa.length <= 2000
      && poprawnySha(uruchomienie.sha) && typeof uruchomienie.status === 'string' && Object.hasOwn(statusyWorkflow, uruchomienie.status)
      && (uruchomienie.wynik === null || (typeof uruchomienie.wynik === 'string' && uruchomienie.wynik.length <= 100))
      && czas(uruchomienie.rozpoczeto) && czas(uruchomienie.zaktualizowano) && Date.parse(uruchomienie.zaktualizowano) >= Date.parse(uruchomienie.rozpoczeto)
      && (uruchomienie.czasSekundy === null || licznikGitHub(uruchomienie.czasSekundy)))
      || new Set(lista.rekordy.map((uruchomienie: UruchomienieWorkflow) => uruchomienie.id)).size !== lista.rekordy.length) return false;
  }
  return true;
}
export function sprawdzOdczytGitHub(wartosc: unknown): wartosc is OdczytGitHub {
  return obiekt(wartosc) && pola(wartosc, ['tozsamosc', 'commity', 'galezie', 'ograniczoneGalezie', 'inteligencja', 'historiaPobrana']) && sprawdzTozsamoscGitHub(wartosc.tozsamosc)
    && (wartosc.historiaPobrana === undefined || czas(wartosc.historiaPobrana))
    && (wartosc.inteligencja === undefined || sprawdzInteligencjeGitHub(wartosc.inteligencja))
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
