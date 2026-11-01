import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import osobaTestowa from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { utworzCzytnikGitHub } from './githubApi';
import { utworzSynchronizacjeRepozytorium } from '../application/synchronizujRepozytorium';
import { utworzRepozytoriumIndexedDb } from './repozytoriumIndexedDb';
import { utworzProjekt } from '../domain/operacje';
import { ostatniOdczytGitHub, utworzPowiazanieGitHub, uzgodnijProjektGitHub, type WyborPowiazaniaGitHub } from '../domain/inteligencjaGitHub';
import { generujPakietKontekstu, eksportujJson, odczytajPakietJson } from '../domain/pakietKontekstu';
import { sprawdzInteligencjeGitHub, type ZakresGitHub, type OdczytGitHub } from '../domain/synchronizacjaGitHub';
import type { PolaczenieRepozytorium } from '../domain/kontekstRepozytorium';
import { PanelInteligencjiGitHub } from '../pages/PanelInteligencjiGitHub';

const czas = '2026-11-01T10:00:00.000Z';
const sha = 'a'.repeat(40); const starszy = 'b'.repeat(40);
const polaczenie: PolaczenieRepozytorium = { id: 'repo', projektIds: ['p1'], nazwa: 'Kod', rodzaj: 'APLIKACJA', dostawca: 'GITHUB', adresZdalny: 'https://github.com/owner/repo', weryfikacja: 'NIEZWERYFIKOWANE', utworzono: czas, zaktualizowano: czas, notatka: '', wersja: 1 };
const commit = (rewizja = sha) => ({ sha: rewizja, commit: { message: 'Zmiana kodu', committer: { date: czas } } });
const plik = { filename: 'src/polskie.ts', status: 'modified', additions: 2, deletions: 1 };
function serwer() {
  const stan = {
    glowny: sha, status: 200, offline: false, etag304: false, link: false,
    szczegoly: { ...commit(), stats: { additions: 2, deletions: 1, total: 3 }, files: [plik] } as unknown,
    porownanie: { base_commit: { sha: starszy }, status: 'ahead', total_commits: 1, files: [plik] } as unknown,
    pr: [{ number: 7, title: 'Poprawa', state: 'open', draft: false, head: { sha }, updated_at: czas }] as unknown,
    workflow: { total_count: 1, workflow_runs: [{ id: 42, workflow_id: 9, name: 'Kontrola', head_sha: sha, status: 'completed', conclusion: 'failure', created_at: czas, run_started_at: czas, updated_at: '2026-11-01T10:01:00.000Z' }] } as unknown,
  };
  const klient = vi.fn(async (adres: string, opcje: RequestInit) => {
    if (stan.offline) throw new TypeError('network');
    const naglowki = new Headers({ etag: '"r3"' });
    if (stan.link) naglowki.set('link', '<https://api.github.com/nie-pobieraj>; rel="next"');
    if (stan.status === 429) naglowki.set('retry-after', '120');
    if (stan.status !== 200) return new Response(null, { status: stan.status, headers: naglowki });
    if (stan.etag304 && new Headers(opcje.headers).has('If-None-Match')) return new Response(null, { status: 304, headers: naglowki });
    const metadane = { id: 123, name: 'repo', owner: { login: 'owner' }, html_url: polaczenie.adresZdalny, default_branch: 'main', visibility: 'public', private: false, archived: false };
    const dane = adres.includes('/compare/') ? stan.porownanie : adres.includes('/pulls?') ? stan.pr : adres.includes('/actions/runs?') ? stan.workflow
      : adres.includes('/branches?') ? [{ name: 'main', commit: { sha: stan.glowny } }]
        : adres.includes('/commits?') ? [commit(stan.glowny), commit(starszy)]
          : adres.includes('/commits/') ? stan.szczegoly : metadane;
    return new Response(new Headers(opcje.headers).get('Accept') === 'application/vnd.github.sha' ? stan.glowny : JSON.stringify(dane), { headers: naglowki });
  });
  return { stan, klient };
}
async function adapter() {
  const api = serwer();
  const czytnik = utworzCzytnikGitHub(api.klient, 15000, () => Date.parse(czas));
  const bazowy = await czytnik.odczytaj(polaczenie);
  const repo = { ...polaczenie, github: { tozsamosc: bazowy.tozsamosc, status: 'POLACZONE' as const, ostatniaProba: czas, ostatniaObserwacja: czas, komunikat: '' } };
  const rozszerz = (zakres: ZakresGitHub, odczyt: OdczytGitHub = bazowy) => czytnik.rozszerz!(repo, odczyt, zakres);
  return { ...api, czytnik, bazowy, repo, rozszerz };
}
async function srodowisko() {
  const api = serwer(); let moment = Date.parse(czas);
  const nazwa = crypto.randomUUID(); const baza = utworzRepozytoriumIndexedDb(nazwa);
  const kontekst = () => ({ czas, idZdarzenia: crypto.randomUUID(), zrodlo: { typ: 'USER' as const, nazwa: 'Użytkownik' } });
  for (const id of ['p1', 'p2']) await baza.dodajProjekt(utworzProjekt(id, id, czas), kontekst());
  await baza.wykonajOperacjeRepozytorium({ rodzaj: 'zapisz', rekord: polaczenie, oczekiwanaWersja: null });
  for (const projektId of ['p1', 'p2']) await baza.wykonajOperacjeRealizacji({ rodzaj: 'praca', id: `praca-${projektId}`, dane: { projektId, typ: 'TASK', tytul: `Zadanie ${projektId}`, opis: '', status: 'DONE', decyzjaIds: [] } }, kontekst());
  await baza.wykonajOperacjeRealizacji({ rodzaj: 'etap', id: 'etap', dane: { projektId: 'p1', nazwa: 'Etap', opis: '', status: 'COMPLETED', kolejnosc: 1 } }, kontekst());
  await baza.wykonajOperacjeUstalen({ rodzaj: 'utworz', id: 'decyzja', dane: { tytul: 'Decyzja', opis: 'Uzasadnienie decyzji', projektIds: ['p1'], typZrodla: 'USER', nazwaZrodla: 'Użytkownik', odniesienieZrodla: '', wpisZrodlowyId: null, notatki: '', powiazaneElementy: [] } }, kontekst());
  const synchronizuj = utworzSynchronizacjeRepozytorium(utworzCzytnikGitHub(api.klient, 15000, () => moment), () => new Date(moment += 1000).toISOString());
  async function uruchom(zakres?: ZakresGitHub) {
    const dane = await baza.pobierzRepozytoria();
    await synchronizuj(dane.polaczeniaRepozytoriow[0], dane, baza.wykonajOperacjeRepozytorium, undefined, zakres);
    return (await baza.eksportujKopie()).data;
  }
  await uruchom();
  const wybor: WyborPowiazaniaGitHub = { projektId: 'p1', typZrodla: 'WORK_ITEM', zrodloId: 'praca-p1', rodzaj: 'commit', identyfikator: sha, rola: 'ZMIANA', opis: 'Sprawdzona zmiana' };
  async function powiaz(zmiana: Partial<WyborPowiazaniaGitHub> = {}) {
    const dane = (await baza.eksportujKopie()).data;
    const dowod = utworzPowiazanieGitHub(dane, dane.polaczeniaRepozytoriow[0], { ...wybor, ...zmiana }, crypto.randomUUID(), new Date(moment).toISOString());
    await baza.wykonajOperacjeRepozytorium({ rodzaj: 'dowod', rekord: dowod });
    return dowod;
  }
  return { ...api, baza, nazwa, uruchom, powiaz, wybor };
}

describe('R3: ograniczone odczyty GitHub przez istniejący adapter', () => {
  it('pobiera szczegóły commita na żądanie, statystyki i pliki bez patcha ani kolejnych stron', async () => {
    const { bazowy, rozszerz, klient, stan } = await adapter(); stan.link = true;
    const wynik = await rozszerz({ rodzaj: 'COMMIT', sha });
    expect(wynik.inteligencja?.szczegoly[0]).toMatchObject({ sha, dodano: 2, usunieto: 1, ograniczone: true, pliki: [{ nazwa: 'src/polskie.ts', dodano: 2, usunieto: 1 }] });
    expect(bazowy.inteligencja).toBeUndefined(); expect(klient).toHaveBeenCalledTimes(6);
    expect(klient.mock.calls.at(-1)![0]).toBe(`https://api.github.com/repos/owner/repo/commits/${sha}?per_page=100&page=1`);
    expect(JSON.stringify(wynik)).not.toContain('patch');
  });
  it('porównuje dwa wybrane SHA, zachowuje kierunek i jawnie ogranicza 300 plików', async () => {
    const { rozszerz, stan, klient } = await adapter();
    stan.porownanie = { base_commit: { sha: starszy }, status: 'diverged', total_commits: 800, files: Array.from({ length: 300 }, (_, numer) => ({ ...plik, filename: `plik-${numer}.ts` })) };
    const wynik = await rozszerz({ rodzaj: 'POROWNANIE', podstawa: starszy, cel: sha });
    expect(wynik.inteligencja?.porownanie).toMatchObject({ podstawa: starszy, cel: sha, status: 'diverged', liczbaCommitow: 800, ograniczone: true });
    expect(klient).toHaveBeenCalledTimes(6);
    expect(klient.mock.calls.at(-1)![0]).toContain(`/compare/${starszy}...${sha}?per_page=1&page=1`);
  });
  it('pobiera PR wszystkich stanów i ostatnie workflow osobnymi akcjami', async () => {
    const { rozszerz, klient } = await adapter();
    const pr = await rozszerz({ rodzaj: 'PR' });
    const wynik = await rozszerz({ rodzaj: 'WORKFLOW' }, pr);
    expect(wynik.inteligencja?.pullRequesty?.rekordy[0]).toMatchObject({ numer: 7, sha, stan: 'open' });
    expect(wynik.inteligencja?.workflow?.rekordy[0]).toMatchObject({ nazwa: 'Kontrola', workflowId: 9, status: 'BLAD', czasSekundy: 60, sha });
    expect(klient).toHaveBeenCalledTimes(8);
    for (const [, opcje] of klient.mock.calls) { expect(opcje.method).toBe('GET'); expect(opcje.credentials).toBe('omit'); expect(new Headers(opcje.headers).has('Authorization')).toBe(false); }
  });
  it.each([['completed', 'success', 'SUKCES'], ['in_progress', null, 'W_TOKU'], ['queued', null, 'W_TOKU'], ['completed', 'cancelled', 'NIEZNANY'], ['completed', 'skipped', 'NIEZNANY']])('klasyfikuje workflow %s/%s jako %s', async (status, wynik, oczekiwany) => {
    const { rozszerz, stan } = await adapter();
    stan.workflow = { total_count: 1, workflow_runs: [{ id: 42, workflow_id: 9, name: 'Kontrola', head_sha: sha, status, conclusion: wynik, created_at: czas, run_started_at: czas, updated_at: czas }] };
    expect((await rozszerz({ rodzaj: 'WORKFLOW' })).inteligencja?.workflow?.rekordy[0].status).toBe(oczekiwany);
  });
  it('obsługuje ETag/304 także dla szczegółów i izoluje zwracane kopie', async () => {
    const { rozszerz, stan, klient } = await adapter(); const pierwszy = await rozszerz({ rodzaj: 'COMMIT', sha });
    pierwszy.inteligencja!.szczegoly[0].pliki[0].nazwa = 'zmienione'; stan.etag304 = true;
    const drugi = await rozszerz({ rodzaj: 'COMMIT', sha });
    expect(drugi.inteligencja!.szczegoly[0].pliki[0].nazwa).toBe('src/polskie.ts');
    expect(new Headers(klient.mock.calls.at(-1)![1].headers).get('If-None-Match')).toBe('"r3"');
  });
  it('współdzieli blokadę limitu API między nowymi zakresami', async () => {
    const { rozszerz, stan, klient } = await adapter(); stan.status = 429;
    await expect(rozszerz({ rodzaj: 'PR' })).rejects.toMatchObject({ status: 'LIMIT', ponowPo: '2026-11-01T10:02:00.000Z' });
    const liczba = klient.mock.calls.length;
    await expect(rozszerz({ rodzaj: 'WORKFLOW' })).rejects.toMatchObject({ status: 'LIMIT' }); expect(klient).toHaveBeenCalledTimes(liczba);
  });
  it('blokuje możliwy sekret przed zapisaniem odpowiedzi w cache ETag', async () => {
    const { rozszerz, stan, klient } = await adapter();
    stan.szczegoly = { ...commit(), commit: { message: 'token=tajne', committer: { date: czas } }, stats: { additions: 2, deletions: 1, total: 3 }, files: [plik] };
    await expect(rozszerz({ rodzaj: 'COMMIT', sha })).rejects.toMatchObject({ status: 'BLAD' });
    stan.szczegoly = { ...commit(), stats: { additions: 2, deletions: 1, total: 3 }, files: [plik] };
    await rozszerz({ rodzaj: 'COMMIT', sha });
    expect(new Headers(klient.mock.calls.at(-1)![1].headers).has('If-None-Match')).toBe(false);
  });
  it.each([{ rodzaj: 'COMMIT', sha: '../sekret' }, { rodzaj: 'COMMIT', sha: 'c'.repeat(40) }, { rodzaj: 'POROWNANIE', podstawa: sha, cel: sha }])('odrzuca niepoprawny lub niepobrany zakres przed siecią', async (zakres) => {
    const { rozszerz, klient } = await adapter(); await expect(rozszerz(zakres as ZakresGitHub)).rejects.toThrow(); expect(klient).toHaveBeenCalledTimes(4);
  });
  it.each([
    { ...commit(), stats: { additions: -1, deletions: 1, total: 0 }, files: [plik] },
    { ...commit(), stats: { additions: 2, deletions: 1, total: 99 }, files: [plik] },
    { ...commit(starszy), stats: { additions: 2, deletions: 1, total: 3 }, files: [plik] },
    { ...commit(), stats: { additions: 2, deletions: 1, total: 3 }, files: [{ ...plik, status: 'wykonaj' }] },
    { ...commit(), stats: { additions: 2, deletions: 1, total: 3 }, files: [plik, plik] },
  ])('odrzuca błędne szczegóły z API', async (dane) => {
    const { rozszerz, stan } = await adapter(); stan.szczegoly = dane; await expect(rozszerz({ rodzaj: 'COMMIT', sha })).rejects.toMatchObject({ status: 'BLAD' });
  });
  it('odrzuca niepoprawne porównania, PR i workflow oraz nieznane pola w zapisie', async () => {
    const { rozszerz, stan } = await adapter();
    stan.porownanie = { base_commit: { sha }, status: 'ahead', total_commits: 1, files: [] };
    await expect(rozszerz({ rodzaj: 'POROWNANIE', podstawa: starszy, cel: sha })).rejects.toThrow();
    stan.pr = [{ number: -1 }]; await expect(rozszerz({ rodzaj: 'PR' })).rejects.toThrow();
    stan.workflow = { total_count: 1, workflow_runs: [{ id: 42, head_sha: 'bad' }] }; await expect(rozszerz({ rodzaj: 'WORKFLOW' })).rejects.toThrow();
    expect(sprawdzInteligencjeGitHub({ szczegoly: [], sekret: 'x' })).toBe(false);
  });
});

describe('R3: niezmienne obserwacje, Evidence, ContextPack i uzgodnienia', () => {
  it('zapisuje rozszerzenia jako nowe obserwacje i odtwarza je z backupu v5', async () => {
    const { uruchom, baza } = await srodowisko(); const przed = (await baza.eksportujKopie()).data;
    await uruchom({ rodzaj: 'COMMIT', sha }); await uruchom({ rodzaj: 'PR' }); const po = await uruchom({ rodzaj: 'WORKFLOW' });
    expect(po.migawkiRepozytoriow).toHaveLength(4); expect(po.migawkiRepozytoriow).toContainEqual(przed.migawkiRepozytoriow[0]);
    expect(ostatniOdczytGitHub(po, 'repo')!.github!.inteligencja!.szczegoly).toHaveLength(1);
    const kopia = await baza.eksportujKopie(); const odtworzona = utworzRepozytoriumIndexedDb(crypto.randomUUID());
    await odtworzona.importujKopie(kopia, 'zastap', true); expect((await odtworzona.eksportujKopie()).data).toEqual(po);
    const pakiet = generujPakietKontekstu(po, { projektId: 'p1', cel: 'Przegląd', aktualnyStan: true, repozytoriumId: 'repo', decyzjaIds: [], pracaIds: [], pytanieIds: [], blokerIds: [], korektaIds: [], ograniczenieIds: [], dowodIds: po.dowody.map((dowod) => dowod.id) }, czas);
    expect(odczytajPakietJson(eksportujJson(pakiet))).toEqual(pakiet);
  });
  it.each(['offline', 'limit', 'walidacja', 'sekret'] as const)('błąd %s zachowuje poprzednie obserwacje i dowody', async (rodzaj) => {
    const { baza, stan, uruchom } = await srodowisko(); await uruchom({ rodzaj: 'COMMIT', sha }); const przed = (await baza.eksportujKopie()).data;
    if (rodzaj === 'offline') stan.offline = true;
    if (rodzaj === 'limit') stan.status = 429;
    if (rodzaj === 'walidacja') stan.szczegoly = {};
    if (rodzaj === 'sekret') stan.szczegoly = { ...commit(), commit: { message: 'token=tajne', committer: { date: czas } }, stats: { additions: 2, deletions: 1, total: 3 }, files: [plik] };
    const po = await uruchom({ rodzaj: 'COMMIT', sha });
    expect(po.migawkiRepozytoriow).toEqual(przed.migawkiRepozytoriow); expect(po.dowody).toEqual(przed.dowody);
    expect(po.polaczeniaRepozytoriow[0].github?.ostatniaObserwacja).toBe(przed.polaczeniaRepozytoriow[0].github?.ostatniaObserwacja);
    expect(JSON.stringify(po)).not.toContain('tajne');
  });
  it('zachowuje wcześniej pobrane zakresy przy odświeżeniu historii i wykrywa commit poza oknem', async () => {
    const { baza, uruchom, stan, powiaz } = await srodowisko(); await uruchom({ rodzaj: 'PR' }); await powiaz();
    stan.glowny = 'c'.repeat(40); const po = await uruchom();
    expect(ostatniOdczytGitHub(po, 'repo')!.github!.inteligencja!.pullRequesty!.rekordy).toHaveLength(1);
    expect(uzgodnijProjektGitHub(po, po.polaczeniaRepozytoriow[0], 'p1').some((propozycja) => propozycja.rodzaj === 'POZA_HISTORIA')).toBe(true);
    expect((await baza.eksportujKopie()).data.elementyPracy[0].status).toBe('DONE');
  });
  it('zapisuje powiązania commita z pracą, etapem i decyzją oraz PR z pracą; retry jest idempotentny', async () => {
    const { powiaz, uruchom, baza, nazwa } = await srodowisko(); const przed = (await baza.eksportujKopie()).data;
    const pierwszy = await powiaz(); expect(await powiaz()).toEqual(pierwszy);
    await powiaz({ typZrodla: 'STAGE', zrodloId: 'etap' }); await powiaz({ typZrodla: 'DECISION', zrodloId: 'decyzja' });
    await uruchom({ rodzaj: 'PR' }); await powiaz({ rodzaj: 'pull_request', identyfikator: '7' });
    const po = (await utworzRepozytoriumIndexedDb(nazwa).eksportujKopie()).data;
    expect(po.dowody.filter((dowod) => dowod.pochodzenie === 'UZYTKOWNIK')).toHaveLength(4);
    expect(po.elementyPracy).toEqual(przed.elementyPracy); expect(po.etapy).toEqual(przed.etapy); expect(po.decyzje).toEqual(przed.decyzje);
    const pakiet = generujPakietKontekstu(po, { projektId: 'p1', cel: 'Dowody', aktualnyStan: false, decyzjaIds: [], pracaIds: [], pytanieIds: [], blokerIds: [], korektaIds: [], ograniczenieIds: [], dowodIds: po.dowody.map((dowod) => dowod.id) }, czas);
    expect(odczytajPakietJson(eksportujJson(pakiet)).zrodla).toContainEqual(expect.objectContaining({ typ: 'STAGE', id: 'etap', adres: '/projekty/p1#etap-etap' }));
  });
  it('odrzuca obcy projekt, niepobrane zasoby i niedozwolony cel PR bez zapisu', async () => {
    const { powiaz, baza } = await srodowisko(); const przed = await baza.eksportujKopie();
    await expect(powiaz({ zrodloId: 'praca-p2' })).rejects.toThrow(); await expect(powiaz({ identyfikator: 'c'.repeat(40) })).rejects.toThrow();
    await expect(powiaz({ rodzaj: 'pull_request', identyfikator: '7', typZrodla: 'STAGE', zrodloId: 'etap' })).rejects.toThrow();
    expect((await baza.eksportujKopie()).data).toEqual(przed.data);
  });
  it('walidacja zapisu i importu odrzuca spreparowany SourceLink', async () => {
    const { powiaz, baza } = await srodowisko(); const dowod = await powiaz(); const przed = await baza.eksportujKopie();
    const bledny = { ...dowod, id: 'falszywy', polaczenieZrodla: { ...dowod.polaczenieZrodla!, externalId: starszy, externalRevision: starszy, url: 'https://evil.example' } };
    await expect(baza.wykonajOperacjeRepozytorium({ rodzaj: 'dowod', rekord: bledny })).rejects.toThrow();
    const kopia = structuredClone(przed); kopia.data.dowody.push(bledny); await expect(baza.importujKopie(kopia, 'zastap', true)).rejects.toThrow();
    expect((await baza.eksportujKopie()).data).toEqual(przed.data);
  });
  it('awaria późnego zapisu dowodu wycofuje całą obserwację R3', async () => {
    const { baza, uruchom } = await srodowisko(); const przed = (await baza.eksportujKopie()).data;
    const dodaj = IDBObjectStore.prototype.add;
    const szpieg = vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(function (this: IDBObjectStore, ...argumenty) {
      if (this.name === 'dowody') throw new Error('Awaria zapisu dowodu R3');
      return dodaj.apply(this, argumenty);
    });
    try { await expect(uruchom({ rodzaj: 'COMMIT', sha })).rejects.toThrow('Awaria zapisu dowodu R3'); } finally { szpieg.mockRestore(); }
    expect((await baza.eksportujKopie()).data).toEqual(przed);
  });
  it('dowód wdrożenia poprzedniej wersji zadania nie potwierdza nowej wersji', async () => {
    const { baza, powiaz } = await srodowisko(); await powiaz({ rola: 'WDROZENIE' });
    const przed = (await baza.eksportujKopie()).data;
    const praca = przed.elementyPracy.find((praca) => praca.id === 'praca-p1')!;
    await baza.wykonajOperacjeRealizacji({ rodzaj: 'praca', id: praca.id, wersja: praca.wersja, dane: { projektId: 'p1', tytul: praca.tytul, opis: 'Nowy zakres zadania', typ: 'TASK', status: 'DONE', decyzjaIds: [] } }, { czas, idZdarzenia: crypto.randomUUID(), zrodlo: { typ: 'USER', nazwa: 'Użytkownik' } });
    const po = (await baza.eksportujKopie()).data;
    expect(uzgodnijProjektGitHub(po, po.polaczeniaRepozytoriow[0], 'p1').some((rekord) => rekord.rodzaj === 'BRAK_DOWODU')).toBe(true);
    expect(po.dowody).toEqual(przed.dowody);
  });
  it('rozróżnia zmianę i dowód wdrożenia; zgłasza CI i wymaga ręcznego przeglądu bez modyfikacji danych', async () => {
    const { baza, powiaz, uruchom } = await srodowisko(); await powiaz(); const dane = await uruchom({ rodzaj: 'WORKFLOW' }); const przed = structuredClone(dane);
    const propozycje = uzgodnijProjektGitHub(dane, dane.polaczeniaRepozytoriow[0], 'p1');
    expect(propozycje.map((rekord) => rekord.rodzaj)).toEqual(expect.arrayContaining(['BRAK_DOWODU', 'BLAD_CI', 'PRZEGLAD'])); expect(dane).toEqual(przed);
    await powiaz({ rola: 'WDROZENIE', opis: 'Ręcznie sprawdzono wydanie na środowisku testowym.' });
    await powiaz({ typZrodla: 'REPOSITORY', zrodloId: 'repo', rola: 'PRZEGLAD' });
    const po = (await baza.eksportujKopie()).data;
    expect(uzgodnijProjektGitHub(po, po.polaczeniaRepozytoriow[0], 'p1').map((rekord) => rekord.rodzaj)).toEqual(['BLAD_CI']);
    expect(po.elementyPracy).toEqual(przed.elementyPracy); expect(po.decyzje).toEqual(przed.decyzje);
    expect(uzgodnijProjektGitHub(po, po.polaczeniaRepozytoriow[0], 'p2')).toEqual([]);
  });
  it('sukces innego workflow nie ukrywa błędu powiązanego commita', async () => {
    const { powiaz, stan, uruchom } = await srodowisko(); await powiaz();
    stan.workflow = { total_count: 2, workflow_runs: [
      { id: 43, workflow_id: 10, name: 'Kontrola', head_sha: sha, status: 'completed', conclusion: 'success', created_at: czas, run_started_at: czas, updated_at: '2026-11-01T10:02:00.000Z' },
      { id: 42, workflow_id: 9, name: 'Kontrola', head_sha: sha, status: 'completed', conclusion: 'failure', created_at: czas, run_started_at: czas, updated_at: '2026-11-01T10:01:00.000Z' },
    ] };
    const dane = await uruchom({ rodzaj: 'WORKFLOW' }); expect(uzgodnijProjektGitHub(dane, dane.polaczeniaRepozytoriow[0], 'p1').filter((rekord) => rekord.rodzaj === 'BLAD_CI')).toHaveLength(1);
  });
});

describe('R3: świadome akcje w interfejsie', () => {
  it('nie pobiera nic przy otwarciu, zleca wybrany zakres i zapisuje powiązanie dopiero po potwierdzeniu', async () => {
    const { baza } = await srodowisko(); const dane = (await baza.eksportujKopie()).data;
    const odczytaj = vi.fn(); const wykonaj = vi.fn(async () => undefined); const osoba = osobaTestowa.setup();
    render(<MemoryRouter><PanelInteligencjiGitHub repo={dane.polaczeniaRepozytoriow[0]} dane={dane} projektId="p1" zajety={false} odczytaj={odczytaj} wykonaj={wykonaj} /></MemoryRouter>);
    expect(odczytaj).not.toHaveBeenCalled(); expect(wykonaj).not.toHaveBeenCalled();
    await osoba.click(screen.getByRole('button', { name: 'Pobierz pliki aaaaaaaa' })); expect(odczytaj).toHaveBeenLastCalledWith({ rodzaj: 'COMMIT', sha });
    await osoba.click(screen.getByRole('button', { name: 'Porównaj commity' })); expect(odczytaj).toHaveBeenLastCalledWith({ rodzaj: 'POROWNANIE', podstawa: starszy, cel: sha });
    await osoba.click(screen.getByRole('button', { name: 'Pobierz status Actions' })); expect(odczytaj).toHaveBeenLastCalledWith({ rodzaj: 'WORKFLOW' });
    await osoba.click(screen.getByRole('button', { name: 'Powiąż commit aaaaaaaa' })); expect(wykonaj).not.toHaveBeenCalled();
    await osoba.type(screen.getByLabelText('Uzasadnienie i źródło potwierdzenia'), 'Sprawdziłem zmianę kodu');
    await osoba.click(screen.getByRole('button', { name: 'Potwierdź i zapisz powiązanie' }));
    expect(wykonaj).toHaveBeenCalledWith(expect.objectContaining({ rodzaj: 'dowod', rekord: expect.objectContaining({ typZrodla: 'WORK_ITEM', zrodloId: 'praca-p1', rola: 'ZMIANA', pochodzenie: 'UZYTKOWNIK' }) }));
  });
  it('pokazuje osobne daty, pliki, wynik CI, PR oraz ostrzeżenie o ograniczeniach', async () => {
    const { baza, uruchom } = await srodowisko(); await uruchom({ rodzaj: 'COMMIT', sha }); await uruchom({ rodzaj: 'PR' }); const dane = await uruchom({ rodzaj: 'WORKFLOW' });
    render(<MemoryRouter><PanelInteligencjiGitHub repo={dane.polaczeniaRepozytoriow[0]} dane={dane} projektId="p1" zajety={false} odczytaj={vi.fn()} wykonaj={baza.wykonajOperacjeRepozytorium} /></MemoryRouter>);
    expect(screen.getByText('src/polskie.ts')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'CI/CD Kod' })).getByText('Ostatni status: Błąd')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '#7 Poprawa' })).toHaveAttribute('href', 'https://github.com/owner/repo/pull/7');
    expect(screen.getByText(/Sukces nie gwarantuje poprawności/)).toBeInTheDocument(); expect(screen.getByText(/Bez kolejnych stron/)).toBeInTheDocument();
  });
});
