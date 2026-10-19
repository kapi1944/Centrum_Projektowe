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
  const stan = { id: 123, name: 'repo', owner: { login: 'owner' }, html_url: 'https://github.com/owner/repo', default_branch: 'main', visibility: 'public', private: false, archived: false, sha, status: 200, etag: false, opis: 'Zmiana', pozostalo: '50', ponowienie: '' };
  const klientHttp = vi.fn(async (adres: string, opcje: RequestInit) => {
    const naglowki = new Headers({ etag: '"test"', 'x-ratelimit-remaining': stan.pozostalo });
    if (stan.ponowienie) naglowki.set('retry-after', stan.ponowienie);
    if (stan.status !== 200) return new Response(null, { status: stan.status, headers: naglowki });
    if (stan.etag && new Headers(opcje.headers).has('If-None-Match')) return new Response(null, { status: 304, headers: naglowki });
    const commit = { sha: stan.sha, commit: { message: stan.opis, committer: { date: czas } } };
    const dane = adres.includes('/branches?') ? [{ name: stan.default_branch, commit: { sha: stan.sha } }] : adres.includes('/commits?') ? [commit] : stan;
    return new Response(adres.includes('/commits/') ? stan.sha : JSON.stringify(dane), { status: 200, headers: naglowki });
  });
  return { stan, klientHttp };
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
  const repozytoriumDanych = await baza(); const api = serwer(); let moment = Date.parse(czas);
  const synchronizuj = utworzSynchronizacjeRepozytorium(utworzCzytnikGitHub(api.klientHttp), () => new Date(moment += 1000).toISOString());
  async function uruchom(id = 'r1') { const dane = await repozytoriumDanych.pobierzRepozytoria(); await synchronizuj(dane.polaczeniaRepozytoriow.find((r) => r.id === id)!, dane, repozytoriumDanych.wykonajOperacjeRepozytorium); return repozytoriumDanych.pobierzRepozytoria(); }
  return { repozytoriumDanych, ...api, uruchom, synchronizuj };
}
describe('Publiczny adapter GitHub', () => {
  it('odczytuje cztery endpointy, wersjonuje API, nie wysyła sekretów ani cookies i nie pobiera diffu', async () => {
    const { klientHttp } = serwer(); const wynik = await utworzCzytnikGitHub(klientHttp).odczytaj(repo);
    expect(wynik.tozsamosc.identyfikator).toBe(123); expect(wynik.commity[0]?.sha).toBe(sha); expect(klientHttp).toHaveBeenCalledTimes(4);
    for (const [adres, opcje] of klientHttp.mock.calls) {
      expect(adres.startsWith('https://api.github.com/')).toBe(true); expect(opcje.credentials).toBe('omit'); expect(opcje.method).toBe('GET');
      expect(new Headers(opcje.headers).get('X-GitHub-Api-Version')).toBe(wersjaApiGitHub); expect(new Headers(opcje.headers).has('Authorization')).toBe(false);
    }
    expect(new Headers(klientHttp.mock.calls[1]![1].headers).get('Accept')).toBe('application/vnd.github.sha');
  });
  it.each([401, 403, 404, 409, 429, 500, 503])('kontroluje HTTP %s bez ponowień', async (status) => {
    const { klientHttp, stan } = serwer(); stan.status = status;
    await expect(utworzCzytnikGitHub(klientHttp).odczytaj(repo)).rejects.toMatchObject({ status: status === 404 ? 'NIEZNALEZIONE' : status === 401 || status === 403 ? 'BRAK_DOSTEPU' : status === 429 ? 'LIMIT' : 'BLAD' });
    expect(klientHttp).toHaveBeenCalledTimes(1);
  });
  it('nie rozstrzyga czy 404 oznacza prywatne czy nieistniejące repozytorium', async () => {
    const { klientHttp, stan } = serwer(); stan.status = 404;
    await expect(utworzCzytnikGitHub(klientHttp).odczytaj(repo)).rejects.toThrow('prywatne');
  });
  it('odrzuca prywatną odpowiedź nawet po HTTP 200', async () => {
    const { klientHttp, stan } = serwer(); stan.private = true;
    await expect(utworzCzytnikGitHub(klientHttp).odczytaj(repo)).rejects.toMatchObject({ status: 'BRAK_DOSTEPU' });
  });
  it('wykorzystuje ETag i 304 wyłącznie we własnej anonimowej instancji cache', async () => {
    const { klientHttp, stan } = serwer(); const klient = utworzCzytnikGitHub(klientHttp);
    const wynik = await klient.odczytaj(repo); stan.etag = true;
    expect(await klient.odczytaj(repo)).toEqual(wynik);
    expect(klientHttp.mock.calls.slice(4).every(([, opcje]) => new Headers(opcje.headers).get('If-None-Match') === '"test"')).toBe(true);
    await utworzCzytnikGitHub(klientHttp).odczytaj(repo);
    expect(new Headers(klientHttp.mock.calls[8]![1].headers).has('If-None-Match')).toBe(false);
  });
  it('odrzuca 304 bez cache', async () => {
    const { klientHttp, stan } = serwer(); stan.status = 304;
    await expect(utworzCzytnikGitHub(klientHttp).odczytaj(repo)).rejects.toMatchObject({ status: 'BLAD' });
  });
  it('przestrzega Retry-After i limitu 403 między repozytoriami', async () => {
    const { klientHttp, stan } = serwer(); stan.status = 403; stan.ponowienie = '120'; stan.pozostalo = '0';
    const klient = utworzCzytnikGitHub(klientHttp, 100, () => Date.parse(czas));
    await expect(klient.odczytaj(repo)).rejects.toMatchObject({ status: 'LIMIT', ponowPo: '2026-10-19T10:02:00.000Z' });
    await expect(klient.odczytaj({ ...repo, id: 'r2' })).rejects.toMatchObject({ status: 'LIMIT' }); expect(klientHttp).toHaveBeenCalledTimes(1);
  });
  it('respektuje dodatkowy limit 403 bez nagłówka Retry-After', async () => {
    const klientHttp = vi.fn(async () => new Response(JSON.stringify({ message: 'You have exceeded a secondary rate limit.' }), { status: 403 }));
    const czytnik = utworzCzytnikGitHub(klientHttp, 100, () => Date.parse(czas));
    await expect(czytnik.odczytaj(repo)).rejects.toMatchObject({ status: 'LIMIT', ponowPo: '2026-10-19T10:01:00.000Z' });
    await expect(czytnik.odczytaj(repo)).rejects.toMatchObject({ status: 'LIMIT' });
    expect(klientHttp).toHaveBeenCalledTimes(1);
  });
  it('obsługuje timeout i AbortController', async () => {
    const klientHttp = vi.fn((_adres: string, opcje: RequestInit) => new Promise<Response>((_rozwiaz, odrzuc) => {
      if (opcje.signal?.aborted) odrzuc(new Error('abort'));
      opcje.signal?.addEventListener('abort', () => odrzuc(new Error('abort')));
    }));
    await expect(utworzCzytnikGitHub(klientHttp, 5).odczytaj(repo)).rejects.toThrow('czas oczekiwania');
    const kontroler = new AbortController(); kontroler.abort();
    await expect(utworzCzytnikGitHub(klientHttp, 100).odczytaj(repo, kontroler.signal)).rejects.toThrow('Anulowano');
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
  it('synchronizuje dwa różne repozytoria jednego projektu niezależnie', async () => {
    const { uruchom, stan } = await srodowisko();
    await uruchom(); stan.id = 456; stan.name = 'drugi'; stan.html_url = 'https://github.com/owner/drugi';
    const wynik = await uruchom('r2');
    expect(wynik.migawkiRepozytoriow.map((migawka) => migawka.repoConnectionId).sort()).toEqual(['r1', 'r2']);
    expect(wynik.polaczeniaRepozytoriow.every((polaczenie) => polaczenie.github?.status === 'POLACZONE')).toBe(true);
    expect(wynik.polaczeniaRepozytoriow.map((polaczenie) => polaczenie.github?.tozsamosc?.identyfikator).sort()).toEqual([123, 456]);
  });
  it('bez zmian aktualizuje datę obserwacji bez duplikatów, nowy HEAD zachowuje historię', async () => {
    const { uruchom, stan } = await srodowisko(); const pierwszy = await uruchom(); const drugi = await uruchom();
    expect(drugi.migawkiRepozytoriow).toEqual(pierwszy.migawkiRepozytoriow); expect(drugi.dowody).toEqual(pierwszy.dowody);
    expect(drugi.polaczeniaRepozytoriow[0]!.github!.ostatniaObserwacja).not.toBe(pierwszy.polaczeniaRepozytoriow[0]!.github!.ostatniaObserwacja);
    stan.sha = 'b'.repeat(40); const trzeci = await uruchom(); expect(trzeci.migawkiRepozytoriow).toHaveLength(2); expect(trzeci.migawkiRepozytoriow).toContainEqual(pierwszy.migawkiRepozytoriow[0]);
    expect(trzeci.dowody[1]!.polaczenieZrodla!.idempotencyKey).toBe(pierwszy.dowody[0]!.polaczenieZrodla!.idempotencyKey);
  });
  it('zmienia nazwę, właściciela i default branch po stabilnym ID bez utraty powiązań', async () => {
    const { uruchom, stan, klientHttp } = await srodowisko(); await uruchom();
    stan.owner.login = 'nowy'; stan.name = 'inna'; stan.html_url = 'https://github.com/nowy/inna'; stan.default_branch = 'trunk';
    const dane = await uruchom(); expect(klientHttp.mock.calls[4]![0]).toBe('https://api.github.com/repositories/123');
    expect(dane.polaczeniaRepozytoriow[0]).toMatchObject({ id: 'r1', projektIds: ['p1', 'p2'], domyslnaGalaz: 'trunk', adresZdalny: stan.html_url }); expect(dane.migawkiRepozytoriow).toHaveLength(2);
  });
  it('blokuje drugą tożsamość i podmianę identyfikatora', async () => {
    const { uruchom, stan } = await srodowisko(); await uruchom();
    const duplikat = await uruchom('r2'); expect(duplikat.polaczeniaRepozytoriow[1]!.github!.status).toBe('BLAD'); expect(duplikat.migawkiRepozytoriow).toHaveLength(1);
    stan.id = 456; const wynik = await uruchom(); expect(wynik.polaczeniaRepozytoriow[0]!.github!.tozsamosc!.identyfikator).toBe(123); expect(wynik.migawkiRepozytoriow).toHaveLength(1);
  });
  it('błąd i offline zachowują ostatni snapshot oraz datę poprawnego odczytu', async () => {
    const { uruchom, stan, klientHttp } = await srodowisko(); const przed = await uruchom(); stan.status = 500; const po = await uruchom();
    expect(po.migawkiRepozytoriow).toEqual(przed.migawkiRepozytoriow); expect(po.polaczeniaRepozytoriow[0]!.github!.ostatniaObserwacja).toBe(przed.polaczeniaRepozytoriow[0]!.github!.ostatniaObserwacja);
    klientHttp.mockRejectedValue(new TypeError('network')); const offline = await uruchom(); expect(offline.polaczeniaRepozytoriow[0]!.github!.status).toBe('OFFLINE'); expect(offline.migawkiRepozytoriow).toEqual(przed.migawkiRepozytoriow);
  });
  it('chroni przed równoległym uruchomieniem', async () => {
    const { repozytoriumDanych, synchronizuj, klientHttp } = await srodowisko(); const dane = await repozytoriumDanych.pobierzRepozytoria();
    const pierwszy = synchronizuj(repo, dane, repozytoriumDanych.wykonajOperacjeRepozytorium); const drugi = synchronizuj(repo, dane, repozytoriumDanych.wykonajOperacjeRepozytorium);
    expect(drugi).toBe(pierwszy); await pierwszy; expect(klientHttp).toHaveBeenCalledTimes(4); expect((await repozytoriumDanych.pobierzRepozytoria()).migawkiRepozytoriow).toHaveLength(1);
  });
  it('nie zapisuje sekretu z opisu commita i nie publikuje częściowego stanu', async () => {
    const { uruchom, stan, repozytoriumDanych } = await srodowisko(); stan.opis = 'token=' + 'tajny'; const dane = await uruchom();
    expect(dane.migawkiRepozytoriow).toHaveLength(0); expect(dane.dowody).toHaveLength(0); expect(JSON.stringify(await repozytoriumDanych.eksportujKopie())).not.toContain('tajny');
  });
  it('odtwarza backup v5 i zachowuje pakiet kontekstu z dowodem oraz bez dowodu', async () => {
    const { repozytoriumDanych, uruchom } = await srodowisko(); await uruchom(); const kopia = await repozytoriumDanych.eksportujKopie(); expect(kopia.schemaVersion).toBe(5);
    const druga = await baza(); await druga.importujKopie(kopia, 'zastap', true); expect((await druga.eksportujKopie()).data).toEqual(kopia.data);
    const wybor = { projektId: 'p1', cel: 'Odczyt', aktualnyStan: true, repozytoriumId: 'r1', decyzjaIds: [], pracaIds: [], pytanieIds: [], blokerIds: [], ograniczenieIds: [], korektaIds: [], dowodIds: kopia.data.dowody.map((d) => d.id) };
    const pakiet = generujPakietKontekstu(kopia.data, wybor, czas); expect(pakiet.migawkaRepozytorium!.weryfikacja).toBe('GITHUB_API'); expect(() => eksportujJson(pakiet)).not.toThrow();
    const bez = generujPakietKontekstu(kopia.data, { ...wybor, dowodIds: [] }, czas); expect(bez.migawkaRepozytorium!.weryfikacja).toBe('NIEZWERYFIKOWANE'); expect(() => eksportujJson(bez)).not.toThrow();
  });
  it('wycofuje całą synchronizację po awarii zapisu Evidence i konflikcie wersji', async () => {
    const { repozytoriumDanych, uruchom, synchronizuj } = await srodowisko();
    const przed = await repozytoriumDanych.eksportujKopie();
    const dodaj = IDBObjectStore.prototype.add;
    const szpieg = vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(function (this: IDBObjectStore, ...argumenty) {
      if (this.name === 'dowody') throw new Error('Awaria zapisu dowodu');
      return dodaj.apply(this, argumenty);
    });
    try { await expect(uruchom()).rejects.toThrow('Awaria zapisu dowodu'); } finally { szpieg.mockRestore(); }
    expect((await repozytoriumDanych.eksportujKopie()).data).toEqual(przed.data);
    await repozytoriumDanych.wykonajOperacjeRepozytorium({ rodzaj: 'zapisz', oczekiwanaWersja: 1, rekord: { ...repo, wersja: 2, notatka: 'Równoległa edycja' } });
    await expect(synchronizuj(repo, przed.data, repozytoriumDanych.wykonajOperacjeRepozytorium)).rejects.toThrow('wersję');
    const po = await repozytoriumDanych.pobierzRepozytoria(); expect(po.migawkiRepozytoriow).toHaveLength(0); expect(po.dowody).toHaveLength(0);
    expect(po.polaczeniaRepozytoriow.find((rekord) => rekord.id === repo.id)?.notatka).toBe('Równoległa edycja');
  });
  it('odrzuca niespójne odpowiedzi i sfałszowane relacje w backupie bez częściowego zapisu', async () => {
    const { repozytoriumDanych, uruchom } = await srodowisko(); await uruchom(); const kopia = await repozytoriumDanych.eksportujKopie();
    for (const zmien of [
      (kopiaTestowa: typeof kopia) => { kopiaTestowa.data.migawkiRepozytoriow[0]!.github!.galezie[0]!.sha = 'f'.repeat(40); },
      (kopiaTestowa: typeof kopia) => { kopiaTestowa.data.dowody[0]!.polaczenieZrodla!.externalId = '456'; },
      (kopiaTestowa: typeof kopia) => { kopiaTestowa.data.dowody[0]!.polaczenieZrodla!.externalRevision = 'f'.repeat(40); },
      (kopiaTestowa: typeof kopia) => { kopiaTestowa.data.polaczeniaRepozytoriow[1]!.github = structuredClone(kopiaTestowa.data.polaczeniaRepozytoriow[0]!.github); },
    ]) {
      const uszkodzona = structuredClone(kopia); zmien(uszkodzona);
      await expect(repozytoriumDanych.importujKopie(uszkodzona, 'zastap', true)).rejects.toThrow();
      expect((await repozytoriumDanych.eksportujKopie()).data).toEqual(kopia.data);
    }
  });
  it('wylicza status nieaktualności z czasu ostatniej obserwacji', async () => {
    const { uruchom } = await srodowisko(); const dane = await uruchom(); expect(statusPolaczenia(repo, Date.parse(czas))).toBe('GOTOWE');
    expect(statusPolaczenia(dane.polaczeniaRepozytoriow[0]!, Date.parse(czas) + 2 * 86400000)).toBe('NIEAKTUALNE');
  });
});
