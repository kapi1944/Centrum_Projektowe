import { BladGitHub, poprawnaGalaz, poprawnySha, rozpoznajAdresGitHub, sprawdzOdczytGitHub, sprawdzTozsamoscGitHub, sprawdzInteligencjeGitHub, licznikGitHub, type CzytnikRepozytorium, type TozsamoscGitHub, type CommitRepozytorium, type InteligencjaGitHub, type PlikZmiany, type UruchomienieWorkflow } from '../domain/synchronizacjaGitHub';
import { sprawdzBrakSekretow } from '../domain/kontekstRepozytorium';

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
function pliki(wartosc: unknown): PlikZmiany[] {
  if (!Array.isArray(wartosc) || wartosc.length > 300) return niepoprawna();
  return wartosc.map((plik: unknown) => {
    if (!rekord(plik)) return niepoprawna();
    return { nazwa: plik.filename, status: plik.status, dodano: plik.additions, usunieto: plik.deletions,
      ...(plik.previous_filename === undefined ? {} : { poprzedniaNazwa: plik.previous_filename }) } as PlikZmiany;
  });
}
function inteligencja(wartosc: InteligencjaGitHub): InteligencjaGitHub {
  if (!sprawdzInteligencjeGitHub(wartosc)) return niepoprawna();
  return wartosc;
}
function uruchomienia(wartosc: unknown): UruchomienieWorkflow[] {
  if (!rekord(wartosc) || !licznikGitHub(wartosc.total_count) || !Array.isArray(wartosc.workflow_runs) || wartosc.workflow_runs.length > 20 || wartosc.total_count < wartosc.workflow_runs.length) return niepoprawna();
  return wartosc.workflow_runs.map((przebieg: unknown) => {
    if (!rekord(przebieg) || typeof przebieg.status !== 'string' || (przebieg.conclusion !== null && typeof przebieg.conclusion !== 'string')
      || typeof przebieg.created_at !== 'string' || (przebieg.run_started_at !== null && typeof przebieg.run_started_at !== 'string') || typeof przebieg.updated_at !== 'string') return niepoprawna();
    const rozpoczeto = przebieg.run_started_at ?? przebieg.created_at;
    const status = przebieg.status === 'completed'
      ? przebieg.conclusion === 'success' ? 'SUKCES' : ['failure', 'timed_out', 'startup_failure', 'action_required'].includes(String(przebieg.conclusion)) ? 'BLAD' : 'NIEZNANY'
      : ['queued', 'in_progress', 'waiting', 'requested', 'pending'].includes(przebieg.status) ? 'W_TOKU' : 'NIEZNANY';
    return { id: przebieg.id, workflowId: przebieg.workflow_id, nazwa: przebieg.name, sha: przebieg.head_sha, status, wynik: przebieg.conclusion, rozpoczeto, zaktualizowano: przebieg.updated_at,
      czasSekundy: przebieg.status === 'completed' && przebieg.run_started_at !== null ? Math.floor((Date.parse(przebieg.updated_at) - Date.parse(rozpoczeto)) / 1000) : null } as UruchomienieWorkflow;
  }).sort((lewy, prawy) => Date.parse(prawy.rozpoczeto) - Date.parse(lewy.rozpoczeto) || prawy.id - lewy.id);
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
      try { sprawdzBrakSekretow(dane); } catch { throw new BladGitHub('BLAD', 'Odpowiedź zawiera możliwy sekret. Nie zapisano danych ani cache.'); }
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
  return { async rozszerz(repo, poprzedni, zakres, sygnal) {
    if (!sprawdzOdczytGitHub(poprzedni) || repo.dostawca !== 'GITHUB' || repo.github?.tozsamosc?.identyfikator !== poprzedni.tozsamosc.identyfikator) return niepoprawna();
    if (zakres.rodzaj === 'COMMIT' && (!poprawnySha(zakres.sha) || !poprzedni.commity.some((commit) => commit.sha === zakres.sha))) return niepoprawna();
    if (zakres.rodzaj === 'POROWNANIE' && (![zakres.podstawa, zakres.cel].every((sha) => poprawnySha(sha) && poprzedni.commity.some((commit) => commit.sha === sha)) || zakres.podstawa === zakres.cel)) return niepoprawna();
    // Potwierdzenie tożsamości zapobiega odczytowi nowego repozytorium pod zwolnionym adresem.
    const tozsamosc = (await pobierz(`/repositories/${poprzedni.tozsamosc.identyfikator}`, metadane, sygnal)).dane;
    if (tozsamosc.identyfikator !== poprzedni.tozsamosc.identyfikator || tozsamosc.adres !== poprzedni.tozsamosc.adres) throw new BladGitHub('BLAD', 'Zmienił się adres repozytorium. Najpierw synchronizuj metadane.');
    const baza = `/repos/${encodeURIComponent(tozsamosc.wlasciciel)}/${encodeURIComponent(tozsamosc.nazwa)}`;
    const pobrano = new Date(zegar()).toISOString();
    const wynik = structuredClone(poprzedni);
    const zakresDanych: InteligencjaGitHub = wynik.inteligencja ?? { szczegoly: [] };
    if (zakres.rodzaj === 'COMMIT') {
      const odpowiedz = await pobierz(`${baza}/commits/${zakres.sha}?per_page=100&page=1`, (wartosc) => {
        if (!rekord(wartosc) || !rekord(wartosc.stats) || !Array.isArray(wartosc.files) || wartosc.files.length > 100) return niepoprawna();
        const commit = odczytajCommit(wartosc);
        if (commit.sha !== zakres.sha || !licznikGitHub(wartosc.stats.total) || wartosc.stats.total !== Number(wartosc.stats.additions) + Number(wartosc.stats.deletions)) return niepoprawna();
        return inteligencja({ szczegoly: [{ ...commit, dodano: wartosc.stats.additions as number, usunieto: wartosc.stats.deletions as number, pliki: pliki(wartosc.files), ograniczone: false, pobrano }] }).szczegoly[0]!;
      }, sygnal);
      zakresDanych.szczegoly = [...zakresDanych.szczegoly.filter((commit) => commit.sha !== zakres.sha), { ...odpowiedz.dane, pobrano, ograniczone: odpowiedz.nastepna || odpowiedz.dane.pliki.length === 100 }].slice(-20);
    } else if (zakres.rodzaj === 'POROWNANIE') {
      const odpowiedz = await pobierz(`${baza}/compare/${zakres.podstawa}...${zakres.cel}?per_page=1&page=1`, (wartosc) => {
        if (!rekord(wartosc) || !rekord(wartosc.base_commit) || wartosc.base_commit.sha !== zakres.podstawa) return niepoprawna();
        return inteligencja({ szczegoly: [], porownanie: { podstawa: zakres.podstawa, cel: zakres.cel, status: wartosc.status as 'ahead', liczbaCommitow: wartosc.total_commits as number, pliki: pliki(wartosc.files), ograniczone: true, pobrano } }).porownanie!;
      }, sygnal);
      // GitHub zwraca najwyżej 300 plików porównania; brak kolejnej strony nie dowodzi kompletności plików.
      zakresDanych.porownanie = { ...odpowiedz.dane, pobrano, ograniczone: odpowiedz.dane.pliki.length === 300 };
    } else if (zakres.rodzaj === 'PR') {
      const odpowiedz = await pobierz(`${baza}/pulls?state=all&sort=updated&direction=desc&per_page=20&page=1`, (wartosc) => {
        if (!Array.isArray(wartosc) || wartosc.length > 20) return niepoprawna();
        const rekordy = wartosc.map((pr: unknown) => {
          if (!rekord(pr) || !rekord(pr.head)) return niepoprawna();
          return { numer: pr.number as number, tytul: pr.title as string, stan: pr.state as 'open', szkic: pr.draft as boolean, sha: pr.head.sha as string, zaktualizowano: pr.updated_at as string };
        });
        return inteligencja({ szczegoly: [], pullRequesty: { rekordy, ograniczone: false, pobrano } }).pullRequesty!;
      }, sygnal);
      zakresDanych.pullRequesty = { ...odpowiedz.dane, pobrano, ograniczone: odpowiedz.nastepna };
    } else if (zakres.rodzaj === 'WORKFLOW') {
      const odpowiedz = await pobierz(`${baza}/actions/runs?per_page=20&page=1`, (wartosc) => {
        const rekordy = uruchomienia(wartosc);
        return inteligencja({ szczegoly: [], workflow: { rekordy, ograniczone: (wartosc as { total_count: number }).total_count > rekordy.length, pobrano } }).workflow!;
      }, sygnal);
      zakresDanych.workflow = { ...odpowiedz.dane, pobrano, ograniczone: odpowiedz.nastepna || odpowiedz.dane.ograniczone };
    } else return niepoprawna();
    wynik.inteligencja = inteligencja(zakresDanych);
    return wynik;
  }, async odczytaj(repo, sygnal) {
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
