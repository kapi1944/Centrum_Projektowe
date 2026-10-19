import { BladGitHub, poprawnaGalaz, poprawnySha, rozpoznajAdresGitHub, sprawdzOdczytGitHub, sprawdzTozsamoscGitHub, type CzytnikRepozytorium, type TozsamoscGitHub, type CommitRepozytorium } from '../domain/synchronizacjaGitHub';

export const wersjaApiGitHub = '2026-03-10';
type KlientHttp = (adres: string, opcje: RequestInit) => Promise<Response>;
interface RepozytoriumDto { id: number; name: string; owner: { login: string }; html_url: string; default_branch: string; visibility: string; private: boolean; archived: boolean }
interface CommitDto { sha: string; commit: { message: string; committer: { date: string } } }
interface GalazDto { name: string; commit: { sha: string } }
function rekord(w: unknown): w is Record<string, unknown> { return !!w && typeof w === 'object' && !Array.isArray(w); }
function niepoprawna(): never { throw new BladGitHub('BLAD', 'GitHub zwrócił niepoprawną lub niespójną odpowiedź. Nie zapisano obserwacji.'); }
function metadane(w: unknown): TozsamoscGitHub {
  if (!rekord(w) || !rekord(w.owner) || typeof w.id !== 'number' || typeof w.name !== 'string' || typeof w.owner.login !== 'string' || typeof w.html_url !== 'string' || typeof w.default_branch !== 'string' || typeof w.visibility !== 'string' || typeof w.private !== 'boolean' || typeof w.archived !== 'boolean') return niepoprawna();
  const dto = w as unknown as RepozytoriumDto;
  if (dto.private || dto.visibility !== 'public') throw new BladGitHub('BRAK_DOSTEPU', 'Ten adapter odczytuje tylko publiczne repozytoria.');
  const wynik = { identyfikator: dto.id, wlasciciel: dto.owner.login, nazwa: dto.name, adres: dto.html_url, domyslnaGalaz: dto.default_branch, widocznosc: 'public' as const, archiwalne: dto.archived };
  if (!sprawdzTozsamoscGitHub(wynik)) return niepoprawna();
  return wynik;
}
function commit(w: unknown): CommitRepozytorium {
  if (!rekord(w) || !poprawnySha(w.sha) || !rekord(w.commit) || typeof w.commit.message !== 'string' || !rekord(w.commit.committer) || typeof w.commit.committer.date !== 'string' || !Number.isFinite(Date.parse(w.commit.committer.date))) return niepoprawna();
  const dto = w as unknown as CommitDto;
  return { sha: dto.sha, opis: dto.commit.message.slice(0, 2000), czas: dto.commit.committer.date };
}
function galezie(w: unknown): { nazwa: string; sha: string }[] {
  if (!Array.isArray(w) || w.length > 100) return niepoprawna();
  return w.map((g: unknown) => {
    if (!rekord(g) || !poprawnaGalaz(g.name) || !rekord(g.commit) || !poprawnySha(g.commit.sha)) return niepoprawna();
    const dto = g as unknown as GalazDto;
    return { nazwa: dto.name, sha: dto.commit.sha };
  }).sort((a, b) => a.nazwa.localeCompare(b.nazwa));
}
// Instancja obsługuje wyłącznie publiczny, anonimowy zakres. Nie przyjmuje tokenu ani hosta.
export function utworzCzytnikGitHub(http: KlientHttp = (adres, opcje) => fetch(adres, opcje), timeout = 15000, zegar = Date.now): CzytnikRepozytorium {
  const pamiec = new Map<string, { etag: string; dane: unknown; nastepna: boolean }>();
  let blokadaDo = 0;
  async function pobierz<T>(sciezka: string, waliduj: (w: unknown) => T, sygnal?: AbortSignal, tylkoSha = false): Promise<{ dane: T; nastepna: boolean }> {
    if (zegar() < blokadaDo) throw new BladGitHub('LIMIT', 'Poczekaj na odnowienie limitu GitHub.', new Date(blokadaDo).toISOString());
    const klucz = `public:anonymous:${wersjaApiGitHub}:${sciezka}`;
    const zapis = pamiec.get(klucz);
    const kontroler = new AbortController();
    const przerwij = () => kontroler.abort();
    sygnal?.addEventListener('abort', przerwij, { once: true });
    if (sygnal?.aborted) kontroler.abort();
    let przekroczono = false;
    const licznik = setTimeout(() => { przekroczono = true; kontroler.abort(); }, timeout);
    try {
      const odpowiedz = await http(`https://api.github.com${sciezka}`, { method: 'GET', credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error', signal: kontroler.signal,
        headers: { Accept: tylkoSha ? 'application/vnd.github.sha' : 'application/vnd.github+json', 'X-GitHub-Api-Version': wersjaApiGitHub, ...(zapis ? { 'If-None-Match': zapis.etag } : {}) } });
      const retry = odpowiedz.headers.get('retry-after');
      const reset = Number(odpowiedz.headers.get('x-ratelimit-reset')) * 1000;
      const odczekaj = retry ? (/^\d+$/.test(retry) ? zegar() + Number(retry) * 1000 : Date.parse(retry)) : 0;
      const limit = odpowiedz.headers.get('x-ratelimit-remaining') === '0';
      if (Number.isFinite(odczekaj) && odczekaj > zegar()) blokadaDo = Math.max(blokadaDo, odczekaj);
      if (limit) blokadaDo = Math.max(blokadaDo, reset > zegar() ? reset : zegar() + 60000);
      if (odpowiedz.status === 429 || (odpowiedz.status === 403 && (limit || retry))) {
        blokadaDo = Math.max(blokadaDo, zegar() + 60000);
        throw new BladGitHub('LIMIT', 'GitHub ograniczył liczbę zapytań. Spróbuj po wskazanym czasie.', new Date(blokadaDo).toISOString());
      }
      if (odpowiedz.status === 401 || odpowiedz.status === 403) throw new BladGitHub('BRAK_DOSTEPU', 'GitHub odmówił dostępu do repozytorium.');
      if (odpowiedz.status === 404) throw new BladGitHub('NIEZNALEZIONE', 'Nie znaleziono repozytorium lub zasobu. Repozytorium może być prywatne albo niedostępne.');
      if (odpowiedz.status === 409) throw new BladGitHub('BLAD', 'Repozytorium jest puste lub jego stan nie pozwala odczytać commitów.');
      if (odpowiedz.status === 304) {
        if (!zapis) return niepoprawna();
        return { dane: structuredClone(zapis.dane) as T, nastepna: zapis.nastepna };
      }
      if (odpowiedz.status !== 200) throw new BladGitHub('BLAD', odpowiedz.status >= 500 ? 'GitHub jest chwilowo niedostępny.' : 'Nieobsługiwana odpowiedź GitHub.');
      const dane = waliduj(tylkoSha ? (await odpowiedz.text()).trim() : await odpowiedz.json());
      const nastepna = /rel="next"/.test(odpowiedz.headers.get('link') ?? '');
      const etag = odpowiedz.headers.get('etag');
      if (etag) {
        if (pamiec.size >= 100) pamiec.delete(pamiec.keys().next().value!);
        pamiec.set(klucz, { etag, dane: structuredClone(dane), nastepna });
      } else pamiec.delete(klucz);
      return { dane, nastepna };
    } catch (blad) {
      if (blad instanceof BladGitHub) throw blad;
      if (przekroczono) throw new BladGitHub('BLAD', 'Przekroczono czas oczekiwania na GitHub.');
      if (sygnal?.aborted) throw new BladGitHub('BLAD', 'Anulowano sprawdzanie GitHub.');
      if (blad instanceof SyntaxError) return niepoprawna();
      throw new BladGitHub('OFFLINE', 'Nie udało się połączyć z GitHub. Sprawdź połączenie z Internetem; ostatnie dane pozostają dostępne.');
    } finally { clearTimeout(licznik); sygnal?.removeEventListener('abort', przerwij); }
  }
  return { async odczytaj(repo, sygnal) {
    const adres = rozpoznajAdresGitHub(repo.adresZdalny ?? '');
    const znaneId = repo.github?.tozsamosc?.identyfikator;
    if (znaneId !== undefined && (!Number.isSafeInteger(znaneId) || znaneId <= 0)) return niepoprawna();
    const baza = znaneId ? `/repositories/${znaneId}` : `/repos/${encodeURIComponent(adres.wlasciciel)}/${encodeURIComponent(adres.nazwa)}`;
    const tozsamosc = (await pobierz(baza, metadane, sygnal)).dane;
    if (repo.github?.tozsamosc && repo.github.tozsamosc.identyfikator !== tozsamosc.identyfikator) throw new BladGitHub('BLAD', 'Adres wskazuje inną tożsamość GitHub. Zachowano poprzednie powiązanie.');
    const kanoniczna = `/repos/${encodeURIComponent(tozsamosc.wlasciciel)}/${encodeURIComponent(tozsamosc.nazwa)}`;
    const glowny = (await pobierz(`${kanoniczna}/commits/${encodeURIComponent(tozsamosc.domyslnaGalaz)}`, (w) => { if (!poprawnySha(w)) return niepoprawna(); return w; }, sygnal, true)).dane;
    const historia = (await pobierz(`${kanoniczna}/commits?sha=${glowny}&per_page=20&page=1`, (w) => {
      if (!Array.isArray(w) || w.length === 0 || w.length > 20) return niepoprawna();
      return w.map(commit);
    }, sygnal)).dane;
    const lista = await pobierz(`${kanoniczna}/branches?per_page=100&page=1`, galezie, sygnal);
    const wynik = { tozsamosc, commity: historia, galezie: lista.dane, ograniczoneGalezie: lista.nastepna };
    if (!sprawdzOdczytGitHub(wynik) || historia[0]?.sha !== glowny) return niepoprawna();
    const domyslna = lista.dane.find((g) => g.nazwa === tozsamosc.domyslnaGalaz);
    if ((domyslna && domyslna.sha !== glowny) || (!domyslna && !lista.nastepna)) return niepoprawna();
    return wynik;
  } };
}
