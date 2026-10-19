import { sprawdzStanGitHub, sprawdzOdczytGitHub, type StanGitHub, type OdczytGitHub } from './synchronizacjaGitHub';
import type { PolaczenieZrodla } from '@centrum-projektowe/integration-sdk';
import { uporzadkuj, type DaneKopii } from './kopieZapasowe';

export const rodzajeRepozytorium = { APLIKACJA: 'Aplikacja', DOKUMENTACJA: 'Dokumentacja', ZASOBY: 'Zasoby', NARZEDZIA: 'Narzędzia', INNE: 'Inne' } as const;
export const dostawcyRepozytorium = { GITHUB: 'GitHub', GITLAB: 'GitLab', LOKALNE: 'Lokalne', INNY: 'Inny' } as const;
export const stanyWeryfikacji = { GITHUB_API: 'Potwierdzone odczytem GitHub API', NIEZWERYFIKOWANE: 'Niezweryfikowane', POTWIERDZONE_LOKALNIE: 'Potwierdzone lokalnie przez użytkownika' } as const;
export const zrodlaObserwacji = { GITHUB_API: 'GitHub REST API', RECZNE: 'Wpis ręczny', RAPORT: 'Import pliku / raportu' } as const;
export const pochodzeniaDowodu = { GITHUB_API: 'GitHub REST API', UZYTKOWNIK: 'Deklaracja użytkownika', NARZEDZIE: 'Deklaracja narzędzia', TEST: 'Wynik testu', ODCZYT_REPOZYTORIUM: 'Odczyt repozytorium' } as const;
export const magazynyZrodel = { SOURCE_RECORD: 'wpisy', ANALYSIS_RUN: 'przebiegiAnaliz', CORRECTION: 'korekty', CHANGE_SET: 'zestawyZmian', DOMAIN_EVENT: 'zdarzeniaDomenowe', DECISION: 'decyzje', WORK_ITEM: 'elementyPracy', QUESTION: 'pytania', BLOCKER: 'blokady', REPOSITORY: 'polaczeniaRepozytoriow', REPOSITORY_SNAPSHOT: 'migawkiRepozytoriow' } as const;
export const typyZrodelDowodu = { SOURCE_RECORD: 'Oryginalny wpis', ANALYSIS_RUN: 'Przebieg analizy', CORRECTION: 'Korekta', CHANGE_SET: 'Zestaw zmian', DOMAIN_EVENT: 'Zdarzenie domenowe', DECISION: 'Decyzja', WORK_ITEM: 'Element pracy', QUESTION: 'Pytanie', BLOCKER: 'Bloker', REPOSITORY: 'Repozytorium', REPOSITORY_SNAPSHOT: 'Obserwacja repozytorium' } as const;

export interface PolaczenieRepozytorium {
  github?: StanGitHub;
  id: string; projektIds: string[]; nazwa: string; rodzaj: keyof typeof rodzajeRepozytorium;
  dostawca: keyof typeof dostawcyRepozytorium; adresZdalny?: string; sciezkaLokalna?: string; domyslnaGalaz?: string;
  weryfikacja: keyof typeof stanyWeryfikacji; utworzono: string; zaktualizowano: string; notatka: string; wersja: number;
}
export interface MigawkaRepozytorium {
  github?: OdczytGitHub;
  id: string; repoConnectionId: string; galaz: string; commitSha?: string; zaobserwowano: string;
  zrodlo: keyof typeof zrodlaObserwacji; opisZrodla: string; opis: string; ostrzezenia: string[]; dowodIds: string[];
  weryfikacja: keyof typeof stanyWeryfikacji;
}
export interface Dowod {
  id: string; projektIds: string[]; typZrodla: keyof typeof magazynyZrodel; zrodloId: string;
  pochodzenie: keyof typeof pochodzeniaDowodu; opis: string; weryfikacja: keyof typeof stanyWeryfikacji;
  rewizja?: string; zaobserwowano: string; polaczenieZrodla?: PolaczenieZrodla;
}
export interface StanRepozytoriow {
  polaczeniaRepozytoriow: PolaczenieRepozytorium[]; migawkiRepozytoriow: MigawkaRepozytorium[]; dowody: Dowod[];
}
export function pusteRepozytoria(): StanRepozytoriow { return { polaczeniaRepozytoriow: [], migawkiRepozytoriow: [], dowody: [] }; }
export type OperacjaRepozytorium =
  | { rodzaj: 'zapisz'; rekord: PolaczenieRepozytorium; oczekiwanaWersja: number | null }
  | { rodzaj: 'obserwuj'; rekord: MigawkaRepozytorium }
  | { rodzaj: 'dowod'; rekord: Dowod }
  | { rodzaj: 'synchronizuj'; rekord: PolaczenieRepozytorium; oczekiwanaWersja: number; migawka?: MigawkaRepozytorium; dowod?: Dowod };

// Rozpoznane dane uwierzytelniające blokują zapis/eksport, bez cichej zmiany oryginałów.
export function sprawdzBrakSekretow(wartosc: unknown): void {
  if (typeof wartosc === 'string' && /(?:gh[pousr]_[a-z0-9]{15,}|github_pat_[a-z0-9_]{15,}|sk-[a-z0-9_-]{16,}|AIza[a-z0-9_-]{20,}|Bearer\s+\S+|-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:password|hasło|haslo|token|secret|api[_ -]?key|klucz[_ -]?api)\s*[=:]\s*\S+|[a-z]+:\/\/[^\s/]+:[^\s/]+@|[?&](?:token|access_token|api_key|password)=)/i.test(wartosc)) throw new Error('Wykryto możliwy sekret. Usuń go z zakresu eksportu lub metadanych.');
  if (Array.isArray(wartosc)) wartosc.forEach(sprawdzBrakSekretow);
  else if (wartosc && typeof wartosc === 'object') for (const [klucz, tresc] of Object.entries(wartosc)) {
    if (/^(?:token|accessToken|access_token|password|haslo|hasło|secret|apiKey|api_key|credentials)$/i.test(klucz)) throw new Error('Dane uwierzytelniające nie należą do zapisanych danych.');
    sprawdzBrakSekretow(tresc);
  }
}
function rekord(wartosc: unknown): wartosc is Record<string, unknown> { return !!wartosc && typeof wartosc === 'object' && !Array.isArray(wartosc); }
function tekst(wartosc: unknown): wartosc is string { return typeof wartosc === 'string'; }
function id(wartosc: unknown): boolean { return tekst(wartosc) && !!wartosc.trim(); }
function czas(wartosc: unknown): boolean { return tekst(wartosc) && Number.isFinite(Date.parse(wartosc)); }
function listaId(wartosc: unknown): wartosc is string[] { return Array.isArray(wartosc) && wartosc.every(id) && new Set(wartosc).size === wartosc.length; }
function opcjonalnyTekst(wartosc: unknown): boolean { return wartosc === undefined || tekst(wartosc); }
function pola(wartosc: Record<string, unknown>, dozwolone: string[]): boolean { return Object.keys(wartosc).every((pole) => dozwolone.includes(pole)); }
function bezpiecznyAdres(wartosc: unknown): boolean {
  if (!tekst(wartosc)) return false;
  try { const adres = new URL(wartosc); return ['http:', 'https:'].includes(adres.protocol) && !adres.username && !adres.password && !/\s/.test(wartosc); }
  catch { return false; }
}
export function sprawdzPolaczenie(wartosc: unknown): boolean {
  return rekord(wartosc) && pola(wartosc, ['github', 'id', 'projektIds', 'nazwa', 'rodzaj', 'dostawca', 'adresZdalny', 'sciezkaLokalna', 'domyslnaGalaz', 'weryfikacja', 'utworzono', 'zaktualizowano', 'notatka', 'wersja'])
    && (wartosc.github === undefined || (sprawdzStanGitHub(wartosc.github) && wartosc.dostawca === 'GITHUB'
      && (!wartosc.github.tozsamosc || (wartosc.adresZdalny === wartosc.github.tozsamosc.adres && wartosc.domyslnaGalaz === wartosc.github.tozsamosc.domyslnaGalaz))))
    && (wartosc.weryfikacja !== 'GITHUB_API' || (rekord(wartosc.github) && wartosc.github.tozsamosc !== undefined))
    && id(wartosc.id) && id(wartosc.nazwa) && listaId(wartosc.projektIds) && wartosc.projektIds.length > 0
    && tekst(wartosc.rodzaj) && Object.hasOwn(rodzajeRepozytorium, wartosc.rodzaj)
    && tekst(wartosc.dostawca) && Object.hasOwn(dostawcyRepozytorium, wartosc.dostawca)
    && tekst(wartosc.weryfikacja) && Object.hasOwn(stanyWeryfikacji, wartosc.weryfikacja)
    && czas(wartosc.utworzono) && czas(wartosc.zaktualizowano) && Date.parse(String(wartosc.zaktualizowano)) >= Date.parse(String(wartosc.utworzono))
    && Number.isSafeInteger(wartosc.wersja) && Number(wartosc.wersja) > 0 && tekst(wartosc.notatka)
    && opcjonalnyTekst(wartosc.sciezkaLokalna) && opcjonalnyTekst(wartosc.domyslnaGalaz)
    && (wartosc.adresZdalny === undefined || bezpiecznyAdres(wartosc.adresZdalny));
}
export function sprawdzMigawkeRepozytorium(wartosc: unknown): boolean {
  return rekord(wartosc) && pola(wartosc, ['github', 'id', 'repoConnectionId', 'galaz', 'commitSha', 'zaobserwowano', 'zrodlo', 'opisZrodla', 'opis', 'ostrzezenia', 'dowodIds', 'weryfikacja'])
    && (wartosc.github === undefined || sprawdzOdczytGitHub(wartosc.github))
    && (wartosc.zrodlo !== 'GITHUB_API' || wartosc.github !== undefined)
    && (wartosc.weryfikacja !== 'GITHUB_API' || wartosc.zrodlo === 'GITHUB_API')
    && id(wartosc.id) && id(wartosc.repoConnectionId) && id(wartosc.galaz) && czas(wartosc.zaobserwowano)
    && tekst(wartosc.zrodlo) && Object.hasOwn(zrodlaObserwacji, wartosc.zrodlo) && id(wartosc.opisZrodla) && tekst(wartosc.opis)
    && Array.isArray(wartosc.ostrzezenia) && wartosc.ostrzezenia.every(tekst) && listaId(wartosc.dowodIds)
    && (wartosc.commitSha === undefined || (tekst(wartosc.commitSha) && /^[a-f0-9]{7,64}$/i.test(wartosc.commitSha)))
    && tekst(wartosc.weryfikacja) && Object.hasOwn(stanyWeryfikacji, wartosc.weryfikacja)
    && (wartosc.zrodlo !== 'RECZNE' || wartosc.weryfikacja === 'NIEZWERYFIKOWANE');
}
export function sprawdzDowod(wartosc: unknown): boolean {
  if (!rekord(wartosc) || !pola(wartosc, ['id', 'projektIds', 'typZrodla', 'zrodloId', 'pochodzenie', 'opis', 'weryfikacja', 'rewizja', 'zaobserwowano', 'polaczenieZrodla'])
    || !id(wartosc.id) || !listaId(wartosc.projektIds) || !wartosc.projektIds.length || !id(wartosc.zrodloId)
    || !tekst(wartosc.typZrodla) || !Object.hasOwn(magazynyZrodel, wartosc.typZrodla)
    || !tekst(wartosc.pochodzenie) || !Object.hasOwn(pochodzeniaDowodu, wartosc.pochodzenie)
    || !tekst(wartosc.opis) || !opcjonalnyTekst(wartosc.rewizja) || !czas(wartosc.zaobserwowano)
    || !tekst(wartosc.weryfikacja) || !Object.hasOwn(stanyWeryfikacji, wartosc.weryfikacja)) return false;
  if (wartosc.weryfikacja === 'POTWIERDZONE_LOKALNIE' && (!['TEST', 'ODCZYT_REPOZYTORIUM'].includes(wartosc.pochodzenie) || !id(wartosc.opis) || !id(wartosc.rewizja))) return false;
  if (wartosc.weryfikacja === 'GITHUB_API' && (wartosc.pochodzenie !== 'GITHUB_API' || !wartosc.polaczenieZrodla || !id(wartosc.rewizja))) return false;
  const zrodlo = wartosc.polaczenieZrodla;
  return zrodlo === undefined || (rekord(zrodlo) && pola(zrodlo, ['contractVersion', 'idempotencyKey', 'providerId', 'connectionId', 'resourceType', 'externalId', 'url', 'externalRevision', 'sourceId'])
    && zrodlo.contractVersion === 1 && ['idempotencyKey', 'providerId', 'connectionId', 'resourceType', 'externalId'].every((pole) => id(zrodlo[pole]))
    && ['externalRevision', 'sourceId'].every((pole) => opcjonalnyTekst(zrodlo[pole])) && (zrodlo.url === undefined || bezpiecznyAdres(zrodlo.url)));
}
export function projektyZrodla(dane: DaneKopii, typ: Dowod['typZrodla'], zrodloId: string): string[] {
  const zrodlo = dane[magazynyZrodel[typ]].find((zrodlo) => zrodlo.id === zrodloId);
  if (!zrodlo) throw new Error('Dowód wskazuje nieistniejące źródło.');
  if (typ === 'CORRECTION') return [...new Set([
    ...dane.korekty.filter((rekord) => rekord.id === zrodloId).map((rekord) => rekord.projektId),
    ...dane.zdarzeniaDomenowe.filter((rekord) => rekord.payload.correctionId === zrodloId).flatMap((rekord) => [...rekord.projectIds]),
  ])];
  if ('projektIds' in zrodlo) return zrodlo.projektIds;
  if ('projectIds' in zrodlo) return [...zrodlo.projectIds];
  if ('projektId' in zrodlo) return zrodlo.projektId ? [zrodlo.projektId] : [];
  if ('sourceId' in zrodlo) return projektyZrodla(dane, 'SOURCE_RECORD', zrodlo.sourceId);
  if ('correctionId' in zrodlo) return projektyZrodla(dane, 'CORRECTION', zrodlo.correctionId);
  if ('repoConnectionId' in zrodlo) return projektyZrodla(dane, 'REPOSITORY', zrodlo.repoConnectionId);
  return [];
}
export function sprawdzRelacjeRepozytoriow(dane: DaneKopii): void {
  const tozsamosci = new Set<string>();
  for (const repo of dane.polaczeniaRepozytoriow) {
    if (repo.projektIds.some((id) => !dane.projekty.some((projekt) => projekt.id === id))) throw new Error('Repozytorium wskazuje nieistniejący projekt.');
    // URL lub podana ścieżka chronią przed drugim rekordem tej samej tożsamości.
    for (const klucz of kluczeTozsamosci(repo)) { if (tozsamosci.has(klucz)) throw new Error('Repozytorium ma już powiązanie. Edytuj istniejący rekord.'); tozsamosci.add(klucz); }
  }
  for (const dowod of dane.dowody) {
    if (dowod.projektIds.some((id) => !projektyZrodla(dane, dowod.typZrodla, dowod.zrodloId).includes(id))) throw new Error('Dowód wskazuje źródło spoza projektu.');
    const link = dowod.polaczenieZrodla;
    if (link && (!dane.polaczeniaRepozytoriow.some((repo) => repo.id === link.connectionId && repo.dostawca === link.providerId && dowod.projektIds.every((id) => repo.projektIds.includes(id)))
      || (link.sourceId && !dane.wpisy.some((wpis) => wpis.id === link.sourceId && dowod.projektIds.includes(wpis.projektId ?? ''))))) throw new Error('Niepoprawne powiązanie SourceLink.');
  }
  for (const migawka of dane.migawkiRepozytoriow) {
    const repo = dane.polaczeniaRepozytoriow.find((repo) => repo.id === migawka.repoConnectionId);
    if (!repo || migawka.dowodIds.some((id) => !dane.dowody.some((dowod) => dowod.id === id && dowod.projektIds.every((projektId) => repo.projektIds.includes(projektId))))) throw new Error('Niepoprawne odniesienie obserwacji repozytorium.');
    if (migawka.weryfikacja === 'GITHUB_API' && (!repo.github?.tozsamosc || repo.github.tozsamosc.identyfikator !== migawka.github?.tozsamosc.identyfikator || !migawka.github || migawka.commitSha !== migawka.github.commity[0]?.sha
      || migawka.galaz !== migawka.github.tozsamosc.domyslnaGalaz
      || !dane.dowody.some((dowod) => migawka.dowodIds.includes(dowod.id) && dowod.weryfikacja === 'GITHUB_API'
        && dowod.typZrodla === 'REPOSITORY_SNAPSHOT' && dowod.zrodloId === migawka.id && dowod.rewizja === migawka.commitSha
        && dowod.polaczenieZrodla?.externalId === String(migawka.github?.tozsamosc.identyfikator)
        && dowod.polaczenieZrodla.connectionId === repo.id
        && dowod.polaczenieZrodla.externalRevision === migawka.commitSha
        && dowod.polaczenieZrodla.providerId === 'GITHUB'
        && dowod.polaczenieZrodla.url === `${migawka.github?.tozsamosc.adres}/commit/${migawka.commitSha}`))) throw new Error('Obserwacja GitHub wymaga zgodnego dowodu API.');
    if (migawka.weryfikacja === 'POTWIERDZONE_LOKALNIE' && !dane.dowody.some((dowod) => migawka.dowodIds.includes(dowod.id)
      && dowod.weryfikacja === 'POTWIERDZONE_LOKALNIE' && dowod.rewizja === migawka.commitSha
      && ((dowod.typZrodla === 'REPOSITORY' && dowod.zrodloId === repo.id) || (dowod.typZrodla === 'REPOSITORY_SNAPSHOT' && dowod.zrodloId === migawka.id)))) throw new Error('Potwierdzony commit wymaga dowodu odczytu lub testu tej rewizji.');
  }
}
function kluczeTozsamosci(repo: PolaczenieRepozytorium): string[] {
  return [repo.github?.tozsamosc ? `github:${repo.github.tozsamosc.identyfikator}` : '', repo.adresZdalny ? `url:${repo.adresZdalny.replace(/\/$/, '').replace(/\.git$/, '').toLowerCase()}` : '',
    repo.sciezkaLokalna ? `sciezka:${repo.sciezkaLokalna.replace(/\\/g, '/').replace(/\/$/, '').toLowerCase()}` : ''].filter(Boolean);
}
export function wykonajOperacjeRepozytorium(przed: DaneKopii, operacja: OperacjaRepozytorium): DaneKopii {
  if (operacja.rodzaj === 'synchronizuj') {
    let wynik = wykonajOperacjeRepozytorium(przed, { rodzaj: 'zapisz', rekord: operacja.rekord, oczekiwanaWersja: operacja.oczekiwanaWersja });
    if (operacja.dowod) wynik = wykonajOperacjeRepozytorium(wynik, { rodzaj: 'dowod', rekord: operacja.dowod });
    if (operacja.migawka) wynik = wykonajOperacjeRepozytorium(wynik, { rodzaj: 'obserwuj', rekord: operacja.migawka });
    return wynik;
  }
  const dane = structuredClone(przed);
  const magazyn = operacja.rodzaj === 'zapisz' ? 'polaczeniaRepozytoriow' : operacja.rodzaj === 'obserwuj' ? 'migawkiRepozytoriow' : 'dowody';
  const poprzedni = dane[magazyn].find((rekord) => rekord.id === operacja.rekord.id);
  if (JSON.stringify(uporzadkuj(poprzedni)) === JSON.stringify(uporzadkuj(operacja.rekord))) return dane;
  if (operacja.rodzaj === 'zapisz') {
    const repo = poprzedni as PolaczenieRepozytorium | undefined;
    if (repo?.github?.tozsamosc && (repo.github.tozsamosc.identyfikator !== operacja.rekord.github?.tozsamosc?.identyfikator || operacja.rekord.dostawca !== 'GITHUB')) throw new Error('Nie można zmienić potwierdzonej tożsamości GitHub.');
    if ((repo?.wersja ?? null) !== operacja.oczekiwanaWersja || operacja.rekord.wersja !== (repo?.wersja ?? 0) + 1
      || (repo && operacja.rekord.utworzono !== repo.utworzono)) throw new Error('Metadane repozytorium zmieniły się. Odczytaj aktualną wersję.');
  } else if (poprzedni) throw new Error('Historia obserwacji i dowodów jest niezmienna. Utwórz nowy rekord.');
  (dane[magazyn] as { id: string }[]) = [...dane[magazyn].filter((rekord) => rekord.id !== operacja.rekord.id), structuredClone(operacja.rekord)];
  return dane;
}
export function ostatniaMigawka(dane: StanRepozytoriow, repoId: string): MigawkaRepozytorium | undefined {
  return dane.migawkiRepozytoriow.filter((rekord) => rekord.repoConnectionId === repoId).sort((lewy, prawy) => Date.parse(prawy.zaobserwowano) - Date.parse(lewy.zaobserwowano) || lewy.id.localeCompare(prawy.id))[0];
}
