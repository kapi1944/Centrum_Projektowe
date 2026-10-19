import { BladGitHub, poprawnaGalaz, poprawnySha, rozpoznajAdresGitHub, sprawdzOdczytGitHub, sprawdzTozsamoscGitHub, type CzytnikRepozytorium, type TozsamoscGitHub, type CommitRepozytorium } from '../domain/synchronizacjaGitHub';

export const wersjaApiGitHub = '2026-03-10';
type KlientHttp = (adres: string, opcje: RequestInit) => Promise<Response>;
interface RepozytoriumDto { id: number; name: string; owner: { login: string }; html_url: string; default_branch: string; visibility: string; private: boolean; archived: boolean }
interface CommitDto { sha: string; commit: { message: string; committer: { date: string } } }
interface GalazDto { name: string; commit: { sha: string } }
function rekord(wartosc: unknown): wartosc is Record<string, unknown> { return !!wartosc && typeof wartosc === 'object' && !Array.isArray(wartosc); }
function niepoprawna(): never { throw new BladGitHub('BLAD', 'GitHub zwrócił niepoprawną lub niespójną odpowiedź. Nie zapisano obserwacji.'); }
function metadane(wartosc: unknown): TozsamoscGitHub {
  if (!rekord(wartosc) || !rekord(wartosc.owner) || typeof wartosc.id !== 'number' || typeof wartosc.name !== 'string' || typeof wartosc.owner.login !== 'string' || typeof wartosc.html_url !== 'string' || typeof wartosc.default_branch !== 'string' || typeof wartosc.visibility !== 'string' || typeof wartosc.private !== 'boolean' || typeof wartosc.archived !== 'boolean') return niepoprawna();
  const dto = wartosc as unknown as RepozytoriumDto;
  if (dto.private || dto.visibility !== 'public') throw new BladGitHub('BRAK_DOSTEPU', 'Ten adapter odczytuje tylko publiczne repozytoria.');
  const wynik = { identyfikator: dto.id, wlasciciel: dto.owner.login, nazwa: dto.name, adres: dto.html_url, domyslnaGalaz: dto.default_branch, widocznosc: 'public' as const, archiwalne: dto.archived };
  if (!sprawdzTozsamoscGitHub(wynik)) return niepoprawna();
  return wynik;
}
function odczytajCommit(wartosc: unknown): CommitRepozytorium {
  if (!rekord(wartosc) || !poprawnySha(wartosc.sha) || !rekord(wartosc.commit) || typeof wartosc.commit.message !== 'string' || !rekord(wartosc.commit.committer) || typeof wartosc.commit.committer.date !== 'string' || !Number.isFinite(Date.parse(wartosc.commit.committer.date))) return niepoprawna();
  const dto = wartosc as unknown as CommitDto;
  return { sha: dto.sha, opis: dto.commit.message.slice(0, 2000), czas: dto.commit.committer.date };
}
function galezie(wartosc: unknown): { nazwa: string; sha: string }[] {
  if (!Array.isArray(wartosc) || wartosc.length > 100) return niepoprawna();
  return wartosc.map((galaz: unknown) => {
    if (!rekord(galaz) || !poprawnaGalaz(galaz.name) || !rekord(galaz.commit) || !poprawnySha(galaz.commit.sha)) return niepoprawna();
    const dto = galaz as unknown as GalazDto;
    return { nazwa: dto.name, sha: dto.commit.sha };
  }).sort((lewy, prawy) => lewy.nazwa.localeCompare(prawy.nazwa));
}
// Instancja obsługuje wyłącznie publiczny, anonimowy zakres. Nie przyjmuje tokenu ani hosta.
export function utworzCzytnikGitHub(klientHttp: KlientHttp = (adres, opcje) => fetch(adres, opcje), limitCzasu = 15000, zegar = Date.now): CzytnikRepozytorium {
  const pamiec = new Map<string, { etag: string; dane: unknown; nastepna: boolean }>();
  let blokadaDo = 0;
  async function pobierz<T>(sciezka: string, waliduj: (wartosc: unknown) => T, sygnal?: AbortSignal, tylkoSha = false): Promise<{ dane: T; nastepna: boolean }> {
    if (zegar() < blokadaDo) throw new BladGitHub('LIMIT', 'Poczekaj na odnowienie limitu GitHub.', new Date(blokadaDo).toISOString());
    const klucz = `public:anonymous:${wersjaApiGitHub}:${sciezka}`;
    const zapis = pamiec.get(klucz);
    const kontroler = new AbortController();
    const przerwij = () => kontroler.abort();
    sygnal?.addEventListener('abort', przerwij, { once: true });
    if (sygnal?.aborted) kontroler.abort();
    let przekroczono = false;
    const licznik = setTimeout(() => { przekroczono = true; kontroler.abort(); }, limitCzasu);
    try {
      const odpowiedz = await klientHttp(`https://api.github.com${sciezka}`, { method: 'GET', credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error', signal: kontroler.signal,
        headers: { Accept: tylkoSha ? 'application/vnd.github.sha' : 'application/vnd.github+json', 'X-GitHub-Api-Version': wersjaApiGitHub, ...(zapis ? { 'If-None-Match': zapis.etag } : {}) } });
      const ponowienie = odpowiedz.headers.get('retry-after');
      const odnowienie = Number(odpowiedz.headers.get('x-ratelimit-reset')) * 1000;
      const odczekaj = ponowienie ? (/^\d+$/.test(ponowienie) ? zegar() + Number(ponowienie) * 1000 : Date.parse(ponowienie)) : 0;
      const limit = odpowiedz.headers.get('x-ratelimit-remaining') === '0';
      if (Number.isFinite(odczekaj) && odczekaj > zegar()) blokadaDo = Math.max(blokadaDo, odczekaj);
      if (limit) blokadaDo = Math.max(blokadaDo, odnowienie > zegar() ? odnowienie : zegar() + 60000);
      let dodatkowyLimit = false;
      if (odpowiedz.status === 403 && !limit && !ponowienie) {
        try {
          const blad = await odpowiedz.json() as unknown;
          dodatkowyLimit = rekord(blad) && typeof blad.message === 'string' && /secondary rate limit|abuse detection/i.test(blad.message);
        } catch { dodatkowyLimit = false; }
      }
      if (odpowiedz.status === 429 || (odpowiedz.status === 403 && (limit || ponowienie || dodatkowyLimit))) {
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
    const glowny = (await pobierz(`${kanoniczna}/commits/${encodeURIComponent(tozsamosc.domyslnaGalaz)}`, (wartosc) => { if (!poprawnySha(wartosc)) return niepoprawna(); return wartosc; }, sygnal, true)).dane;
    const historia = (await pobierz(`${kanoniczna}/commits?sha=${glowny}&per_page=20&page=1`, (wartosc) => {
      if (!Array.isArray(wartosc) || wartosc.length === 0 || wartosc.length > 20) return niepoprawna();
      return wartosc.map(odczytajCommit);
    }, sygnal)).dane;
    const lista = await pobierz(`${kanoniczna}/branches?per_page=100&page=1`, galezie, sygnal);
    const wynik = { tozsamosc, commity: historia, galezie: lista.dane, ograniczoneGalezie: lista.nastepna };
    if (!sprawdzOdczytGitHub(wynik) || historia[0]?.sha !== glowny) return niepoprawna();
    const domyslna = lista.dane.find((g) => g.nazwa === tozsamosc.domyslnaGalaz);
    if ((domyslna && domyslna.sha !== glowny) || (!domyslna && !lista.nastepna)) return niepoprawna();
    return wynik;
  } };
}
