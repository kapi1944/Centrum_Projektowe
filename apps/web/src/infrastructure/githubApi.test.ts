import { describe, expect, it, vi } from 'vitest';
import { utworzCzytnikGitHub, wersjaApiGitHub } from './githubApi';
import { utworzSynchronizacjeRepozytorium } from '../application/synchronizujRepozytorium';
import { utworzRepozytoriumIndexedDb } from './repozytoriumIndexedDb';
import { pusteDaneKopii } from '../domain/kopieZapasowe';
import { utworzProjekt } from '../domain/operacje';
import { rozpoznajAdresGitHub, statusPolaczenia } from '../domain/synchronizacjaGitHub';
import type { PolaczenieRepozytorium } from '../domain/kontekstRepozytorium';
import { generujPakietKontekstu, eksportujJson } from '../domain/pakietKontekstu';
const czas = '2026-10-19T10:00:00.000Z';
const sha = 'a'.repeat(40);
const repo: PolaczenieRepozytorium = { id: 'r1', projektIds: ['p1', 'p2'], nazwa: 'Repo', rodzaj: 'APLIKACJA', dostawca: 'GITHUB', adresZdalny: 'https://github.com/owner/repo', weryfikacja: 'NIEZWERYFIKOWANE', utworzono: czas, zaktualizowano: czas, notatka: '', wersja: 1 };
function serwer() {
  const stan = { id: 123, name: 'repo', owner: { login: 'owner' }, html_url: 'https://github.com/owner/repo', default_branch: 'main', visibility: 'public', private: false, archived: false, sha, status: 200, etag: false, opis: 'Zmiana', pozostalo: '50', retry: '' };
  const http = vi.fn(async (adres: string, opcje: RequestInit) => {
    const naglowki = new Headers({ etag: '"test"', 'x-ratelimit-remaining': stan.pozostalo });
    if (stan.retry) naglowki.set('retry-after', stan.retry);
    if (stan.status !== 200) return new Response(null, { status: stan.status, headers: naglowki });
    if (stan.etag && new Headers(opcje.headers).has('If-None-Match')) return new Response(null, { status: 304, headers: naglowki });
    const commit = { sha: stan.sha, commit: { message: stan.opis, committer: { date: czas } } };
    const dane = adres.includes('/branches?') ? [{ name: stan.default_branch, commit: { sha: stan.sha } }] : adres.includes('/commits?') ? [commit] : stan;
    return new Response(adres.includes('/commits/') ? stan.sha : JSON.stringify(dane), { status: 200, headers: naglowki });
  });
  return { stan, http };
}
async function baza() {
  const dane = pusteDaneKopii();
  dane.projekty = [utworzProjekt('Projekt 1', 'p1', czas), utworzProjekt('Projekt 2', 'p2', czas)];
  dane.polaczeniaRepozytoriow = [repo, { ...repo, id: 'r2', projektIds: ['p1'], adresZdalny: 'https://github.com/owner/drugi' }];
  const baza = utworzRepozytoriumIndexedDb(crypto.randomUUID());
  await baza.importujKopie({ format: 'centrum-projektowe', schemaVersion: 4, appVersion: 'test', exportedAt: czas, data: dane }, 'zastap', true);
  return baza;
}
async function srodowisko() {
  const storage = await baza(); const api = serwer(); let moment = Date.parse(czas);
  const synchronizuj = utworzSynchronizacjeRepozytorium(utworzCzytnikGitHub(api.http), () => new Date(moment += 1000).toISOString());
  async function uruchom(id = 'r1') { const dane = await storage.pobierzRepozytoria(); await synchronizuj(dane.polaczeniaRepozytoriow.find((r) => r.id === id)!, dane, storage.wykonajOperacjeRepozytorium); return storage.pobierzRepozytoria(); }
  return { storage, ...api, uruchom, synchronizuj };
}
describe('Publiczny adapter GitHub', () => {
  it('odczytuje cztery endpointy, wersjonuje API, nie wysyła sekretów ani cookies i nie pobiera diffu', async () => {
    const { http } = serwer(); const wynik = await utworzCzytnikGitHub(http).odczytaj(repo);
    expect(wynik.tozsamosc.identyfikator).toBe(123); expect(wynik.commity[0]?.sha).toBe(sha); expect(http).toHaveBeenCalledTimes(4);
    for (const [adres, opcje] of http.mock.calls) {
      expect(adres.startsWith('https://api.github.com/')).toBe(true); expect(opcje.credentials).toBe('omit'); expect(opcje.method).toBe('GET');
      expect(new Headers(opcje.headers).get('X-GitHub-Api-Version')).toBe(wersjaApiGitHub); expect(new Headers(opcje.headers).has('Authorization')).toBe(false);
    }
    expect(new Headers(http.mock.calls[1]![1].headers).get('Accept')).toBe('application/vnd.github.sha');
  });
  it.each([401, 403, 404, 409, 429, 500, 503])('kontroluje HTTP %s bez ponowień', async (status) => {
    const { http, stan } = serwer(); stan.status = status;
    await expect(utworzCzytnikGitHub(http).odczytaj(repo)).rejects.toMatchObject({ status: status === 404 ? 'NIEZNALEZIONE' : status === 401 || status === 403 ? 'BRAK_DOSTEPU' : status === 429 ? 'LIMIT' : 'BLAD' });
    expect(http).toHaveBeenCalledTimes(1);
  });
  it('nie rozstrzyga czy 404 oznacza prywatne czy nieistniejące repozytorium', async () => {
    const { http, stan } = serwer(); stan.status = 404;
    await expect(utworzCzytnikGitHub(http).odczytaj(repo)).rejects.toThrow('prywatne');
  });
  it('odrzuca prywatną odpowiedź nawet po HTTP 200', async () => {
    const { http, stan } = serwer(); stan.private = true;
    await expect(utworzCzytnikGitHub(http).odczytaj(repo)).rejects.toMatchObject({ status: 'BRAK_DOSTEPU' });
  });
  it('wykorzystuje ETag i 304 wyłącznie we własnej anonimowej instancji cache', async () => {
    const { http, stan } = serwer(); const klient = utworzCzytnikGitHub(http);
    const wynik = await klient.odczytaj(repo); stan.etag = true;
    expect(await klient.odczytaj(repo)).toEqual(wynik);
    expect(http.mock.calls.slice(4).every(([, opcje]) => new Headers(opcje.headers).get('If-None-Match') === '"test"')).toBe(true);
    await utworzCzytnikGitHub(http).odczytaj(repo);
    expect(new Headers(http.mock.calls[8]![1].headers).has('If-None-Match')).toBe(false);
  });
  it('odrzuca 304 bez cache', async () => {
    const { http, stan } = serwer(); stan.status = 304;
    await expect(utworzCzytnikGitHub(http).odczytaj(repo)).rejects.toMatchObject({ status: 'BLAD' });
  });
  it('przestrzega Retry-After i limitu 403 między repozytoriami', async () => {
    const { http, stan } = serwer(); stan.status = 403; stan.retry = '120'; stan.pozostalo = '0';
    const klient = utworzCzytnikGitHub(http, 100, () => Date.parse(czas));
    await expect(klient.odczytaj(repo)).rejects.toMatchObject({ status: 'LIMIT', ponowPo: '2026-10-19T10:02:00.000Z' });
    await expect(klient.odczytaj({ ...repo, id: 'r2' })).rejects.toMatchObject({ status: 'LIMIT' }); expect(http).toHaveBeenCalledTimes(1);
  });
  it('obsługuje timeout i AbortController', async () => {
    const http = vi.fn((_adres: string, opcje: RequestInit) => new Promise<Response>((_rozwiaz, odrzuc) => {
      if (opcje.signal?.aborted) odrzuc(new Error('abort'));
      opcje.signal?.addEventListener('abort', () => odrzuc(new Error('abort')));
    }));
    await expect(utworzCzytnikGitHub(http, 5).odczytaj(repo)).rejects.toThrow('czas oczekiwania');
    const kontroler = new AbortController(); kontroler.abort();
    await expect(utworzCzytnikGitHub(http, 100).odczytaj(repo, kontroler.signal)).rejects.toThrow('Anulowano');
  });
  it('klasyfikuje błąd sieci i odrzuca niepoprawny DTO', async () => {
    await expect(utworzCzytnikGitHub(async () => { throw new TypeError('network'); }).odczytaj(repo)).rejects.toMatchObject({ status: 'OFFLINE' });
    await expect(utworzCzytnikGitHub(async () => new Response('{}')).odczytaj(repo)).rejects.toMatchObject({ status: 'BLAD' });
  });
  it.each(['https://evil.example/a/b', 'https://github.com/a/b?token=abc', 'https://user:pass@github.com/a/b', 'https://github.com/a/b/issues', 'https://github.com/a/%2e%2e', 'http://github.com/a/b'])('odrzuca adres %s przed siecią', (adres) => { expect(() => rozpoznajAdresGitHub(adres)).toThrow(); });
});
describe('Synchronizacja w istniejącej bazie i backupie', () => {
  it('pierwszy zapis zachowuje dwa repozytoria, wspólne projekty i spójny Evidence/SourceLink', async () => {
    const { uruchom } = await srodowisko(); const dane = await uruchom();
    expect(dane.polaczeniaRepozytoriow).toHaveLength(2); expect(dane.polaczeniaRepozytoriow[0]?.projektIds).toEqual(['p1', 'p2']);
    expect(dane.migawkiRepozytoriow).toHaveLength(1); expect(dane.dowody).toHaveLength(1);
    expect(dane.dowody[0]).toMatchObject({ zrodloId: dane.migawkiRepozytoriow[0]!.id, rewizja: sha, weryfikacja: 'GITHUB_API', polaczenieZrodla: { externalId: '123', externalRevision: sha } });
  });
  it('bez zmian aktualizuje datę obserwacji bez duplikatów, nowy HEAD zachowuje historię', async () => {
    const { uruchom, stan } = await srodowisko(); const pierwszy = await uruchom(); const drugi = await uruchom();
    expect(drugi.migawkiRepozytoriow).toEqual(pierwszy.migawkiRepozytoriow); expect(drugi.dowody).toEqual(pierwszy.dowody);
    expect(drugi.polaczeniaRepozytoriow[0]!.github!.ostatniaObserwacja).not.toBe(pierwszy.polaczeniaRepozytoriow[0]!.github!.ostatniaObserwacja);
    stan.sha = 'b'.repeat(40); const trzeci = await uruchom(); expect(trzeci.migawkiRepozytoriow).toHaveLength(2); expect(trzeci.migawkiRepozytoriow).toContainEqual(pierwszy.migawkiRepozytoriow[0]);
  });
  it('zmienia nazwę, właściciela i default branch po stabilnym ID bez utraty powiązań', async () => {
    const { uruchom, stan, http } = await srodowisko(); await uruchom();
    stan.owner.login = 'nowy'; stan.name = 'inna'; stan.html_url = 'https://github.com/nowy/inna'; stan.default_branch = 'trunk';
    const dane = await uruchom(); expect(http.mock.calls[4]![0]).toBe('https://api.github.com/repositories/123');
    expect(dane.polaczeniaRepozytoriow[0]).toMatchObject({ id: 'r1', projektIds: ['p1', 'p2'], domyslnaGalaz: 'trunk', adresZdalny: stan.html_url }); expect(dane.migawkiRepozytoriow).toHaveLength(2);
  });
  it('blokuje drugą tożsamość i podmianę identyfikatora', async () => {
    const { uruchom, stan } = await srodowisko(); await uruchom();
    const duplikat = await uruchom('r2'); expect(duplikat.polaczeniaRepozytoriow[1]!.github!.status).toBe('BLAD'); expect(duplikat.migawkiRepozytoriow).toHaveLength(1);
    stan.id = 456; const wynik = await uruchom(); expect(wynik.polaczeniaRepozytoriow[0]!.github!.tozsamosc!.identyfikator).toBe(123); expect(wynik.migawkiRepozytoriow).toHaveLength(1);
  });
  it('błąd i offline zachowują ostatni snapshot oraz datę poprawnego odczytu', async () => {
    const { uruchom, stan, http } = await srodowisko(); const przed = await uruchom(); stan.status = 500; const po = await uruchom();
    expect(po.migawkiRepozytoriow).toEqual(przed.migawkiRepozytoriow); expect(po.polaczeniaRepozytoriow[0]!.github!.ostatniaObserwacja).toBe(przed.polaczeniaRepozytoriow[0]!.github!.ostatniaObserwacja);
    http.mockRejectedValue(new TypeError('network')); const offline = await uruchom(); expect(offline.polaczeniaRepozytoriow[0]!.github!.status).toBe('OFFLINE'); expect(offline.migawkiRepozytoriow).toEqual(przed.migawkiRepozytoriow);
  });
  it('chroni przed równoległym uruchomieniem', async () => {
    const { storage, synchronizuj, http } = await srodowisko(); const dane = await storage.pobierzRepozytoria();
    const pierwszy = synchronizuj(repo, dane, storage.wykonajOperacjeRepozytorium); const drugi = synchronizuj(repo, dane, storage.wykonajOperacjeRepozytorium);
    expect(drugi).toBe(pierwszy); await pierwszy; expect(http).toHaveBeenCalledTimes(4); expect((await storage.pobierzRepozytoria()).migawkiRepozytoriow).toHaveLength(1);
  });
  it('nie zapisuje sekretu z opisu commita i nie publikuje częściowego stanu', async () => {
    const { uruchom, stan, storage } = await srodowisko(); stan.opis = 'token=' + 'tajny'; const dane = await uruchom();
    expect(dane.migawkiRepozytoriow).toHaveLength(0); expect(dane.dowody).toHaveLength(0); expect(JSON.stringify(await storage.eksportujKopie())).not.toContain('tajny');
  });
  it('odtwarza backup v5 i zachowuje pakiet kontekstu z dowodem oraz bez dowodu', async () => {
    const { storage, uruchom } = await srodowisko(); await uruchom(); const kopia = await storage.eksportujKopie(); expect(kopia.schemaVersion).toBe(5);
    const druga = await baza(); await druga.importujKopie(kopia, 'zastap', true); expect((await druga.eksportujKopie()).data).toEqual(kopia.data);
    const wybor = { projektId: 'p1', cel: 'Odczyt', aktualnyStan: true, repozytoriumId: 'r1', decyzjaIds: [], pracaIds: [], pytanieIds: [], blokerIds: [], ograniczenieIds: [], korektaIds: [], dowodIds: kopia.data.dowody.map((d) => d.id) };
    const pakiet = generujPakietKontekstu(kopia.data, wybor, czas); expect(pakiet.migawkaRepozytorium!.weryfikacja).toBe('GITHUB_API'); expect(() => eksportujJson(pakiet)).not.toThrow();
    const bez = generujPakietKontekstu(kopia.data, { ...wybor, dowodIds: [] }, czas); expect(bez.migawkaRepozytorium!.weryfikacja).toBe('NIEZWERYFIKOWANE'); expect(() => eksportujJson(bez)).not.toThrow();
  });
  it('wylicza status nieaktualności z czasu ostatniej obserwacji', async () => {
    const { uruchom } = await srodowisko(); const dane = await uruchom(); expect(statusPolaczenia(repo, Date.parse(czas))).toBe('GOTOWE');
    expect(statusPolaczenia(dane.polaczeniaRepozytoriow[0]!, Date.parse(czas) + 2 * 86400000)).toBe('NIEAKTUALNE');
  });
});
