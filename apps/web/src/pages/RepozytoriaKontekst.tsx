import { useEffect } from 'react';
import { utworzCzytnikGitHub } from '../infrastructure/githubApi';
import { utworzSynchronizacjeRepozytorium } from '../application/synchronizujRepozytorium';
import { statusPolaczenia, statusyGitHub } from '../domain/synchronizacjaGitHub';
import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { DaneKopii } from '../domain/kopieZapasowe';
import { rodzajeRepozytorium, dostawcyRepozytorium, stanyWeryfikacji, zrodlaObserwacji, ostatniaMigawka, typyZrodelDowodu, magazynyZrodel, projektyZrodla, pochodzeniaDowodu, type PolaczenieRepozytorium, type MigawkaRepozytorium, type Dowod, type OperacjaRepozytorium } from '../domain/kontekstRepozytorium';
import { generujPakietKontekstu, dostepneKorekty, eksportujMarkdown, eksportujJson, type PakietKontekstu, type WyborKontekstu } from '../domain/pakietKontekstu';
import { wyliczStanProjektu } from '../domain/stanProjektu';
import { formatujDate } from '../shared/formatujDate';

const synchronizuj = utworzSynchronizacjeRepozytorium(utworzCzytnikGitHub());

type Zapisz = (operacja: OperacjaRepozytorium) => Promise<void>;
export function RepozytoriaKontekst({ dane, wykonaj }: { dane: DaneKopii; wykonaj: Zapisz }) {
  const { projektId } = useParams();
  const nawiguj = useNavigate();
  const [edycja, ustawEdycje] = useState<PolaczenieRepozytorium | null>(null);
  const [nowy, ustawNowy] = useState(false);
  const projekt = dane.projekty.find((projekt) => projekt.id === projektId);
  if (!projekt) return <h1>Nie znaleziono projektu</h1>;
  const repozytoria = dane.polaczeniaRepozytoriow.filter((repo) => repo.projektIds.includes(projekt.id));
  return <>
    <Link to={`/projekty/${projekt.id}`}>Wróć do projektu</Link>
    <h1>Repozytoria i generator kontekstu</h1>
    <label>Projekt <select value={projekt.id} onChange={(zdarzenie) => nawiguj(`/projekty/${zdarzenie.target.value}/repozytoria`)}>{dane.projekty.map((projekt) => <option key={projekt.id} value={projekt.id}>{projekt.nazwa}</option>)}</select></label>
    <p>Dane pozostają lokalne. Ścieżka jest metadanymi; przeglądarka nie odczytuje repozytorium. Nie zapisuj sekretów.</p>
    <section aria-label="Repozytoria projektu"><h2>Repozytoria projektu</h2>
      <button onClick={() => { ustawNowy(true); ustawEdycje(null); }}>Dodaj repozytorium</button>
      {(nowy || edycja) && <FormularzRepozytorium key={edycja?.id ?? 'nowy'} dane={dane} projektId={projekt.id} poczatkowy={edycja} wykonaj={wykonaj} zamknij={() => { ustawNowy(false); ustawEdycje(null); }} />}
      {!repozytoria.length && <p>Brak powiązanych repozytoriów.</p>}
      {repozytoria.map((repo) => {
        const ostatnia = ostatniaMigawka(dane, repo.id);
        const historia = dane.migawkiRepozytoriow.filter((rekord) => rekord.repoConnectionId === repo.id).sort((lewy, prawy) => Date.parse(prawy.zaobserwowano) - Date.parse(lewy.zaobserwowano) || lewy.id.localeCompare(prawy.id));
        return <article key={repo.id}><h3>{repo.nazwa}</h3>
          <p>{rodzajeRepozytorium[repo.rodzaj]} · {dostawcyRepozytorium[repo.dostawca]} · {stanyWeryfikacji[repo.weryfikacja]}</p>
          <p>{repo.adresZdalny || 'Brak zdalnego URL'} · {repo.sciezkaLokalna || 'Brak lokalnej ścieżki'}</p>
          <p>Projekty: {repo.projektIds.map((id) => dane.projekty.find((projekt) => projekt.id === id)?.nazwa).join(', ')}</p>
          <p className="surowy-wpis">{repo.notatka}</p>
          <button onClick={() => { ustawNowy(false); ustawEdycje(repo); }}>Edytuj metadane: {repo.nazwa}</button>
          <SynchronizacjaGitHub repo={repo} dane={dane} wykonaj={wykonaj} />
          <h4>Aktualna obserwacja</h4>{ostatnia ? <OpisObserwacji rekord={ostatnia} /> : <p>Brak zarejestrowanej obserwacji.</p>}
          <details><summary>Historia obserwacji ({historia.length})</summary>{historia.map((rekord) => <div key={rekord.id}><OpisObserwacji rekord={rekord} /></div>)}</details>
          <details><summary>Dodaj obserwację: {repo.nazwa}</summary><FormularzObserwacji repo={repo} dane={dane} wykonaj={wykonaj} /></details>
        </article>;
      })}
      <details><summary>Powiąż istniejące repozytorium</summary><PowiazRepozytorium dane={dane} projektId={projekt.id} wykonaj={wykonaj} /></details>
    </section>
    <details><summary>Dowody i źródła ({dane.dowody.filter((dowod) => dowod.projektIds.includes(projekt.id)).length})</summary>
      <FormularzDowodu dane={dane} projektId={projekt.id} wykonaj={wykonaj} />
      {dane.dowody.filter((dowod) => dowod.projektIds.includes(projekt.id)).map((dowod) => <article key={dowod.id}><p>{dowod.opis}</p><p>{pochodzeniaDowodu[dowod.pochodzenie]} · {stanyWeryfikacji[dowod.weryfikacja]} · {formatujDate(dowod.zaobserwowano)}</p><small>Źródło: {typyZrodelDowodu[dowod.typZrodla]} · {dowod.zrodloId} · rewizja {dowod.rewizja || 'nieznana'}</small></article>)}
    </details>
    <GeneratorKontekstu dane={dane} projektId={projekt.id} />
  </>;
}
function SynchronizacjaGitHub({ repo, dane, wykonaj }: { repo: PolaczenieRepozytorium; dane: DaneKopii; wykonaj: Zapisz }) {
  const zapis = useZapis(wykonaj);
  const kontroler = useRef<AbortController | null>(null);
  const [teraz, ustawTeraz] = useState(() => Date.now());
  useEffect(() => () => kontroler.current?.abort(), []);
  const status = zapis.zajety ? 'SPRAWDZANIE' : statusPolaczenia(repo, teraz);
  function uruchom() {
    void zapis.zapisz(async () => {
      kontroler.current = new AbortController();
      await synchronizuj(repo, dane, wykonaj, kontroler.current.signal);
      ustawTeraz(Date.now());
    });
  }
  return <section aria-label={`Synchronizacja ${repo.nazwa}`}>
    <p role="status">Status: {statusyGitHub[status]}</p>
    <p>Ostatnia synchronizacja (próba): {repo.github ? formatujDate(repo.github.ostatniaProba) : 'Brak'}</p>
    <p>Ostatnia poprawna obserwacja: {repo.github?.ostatniaObserwacja ? formatujDate(repo.github.ostatniaObserwacja) : 'Brak'}</p>
    <p>Domyślna gałąź: {repo.domyslnaGalaz ?? 'Nieznana'}</p>
    {repo.github?.tozsamosc && <p>Publiczne · {repo.github.tozsamosc.archiwalne ? 'Archiwalne' : 'Aktywne'}</p>}
    <p>{repo.github?.komunikat}</p>
    {repo.github?.ponowPo && <p>Można ponowić po: {formatujDate(repo.github.ponowPo)}</p>}
    <button disabled={zapis.zajety || status === 'NIEPOLACZONE'} onClick={uruchom}>Sprawdź połączenie</button>
    <button disabled={zapis.zajety || status === 'NIEPOLACZONE'} onClick={uruchom}>Synchronizuj</button>
    {zapis.zajety && <button onClick={() => kontroler.current?.abort()}>Anuluj sprawdzanie</button>}
    <p role="status">{zapis.komunikat}</p>
  </section>;
}
function OpisObserwacji({ rekord }: { rekord: MigawkaRepozytorium }) {
  return <><p>Gałąź: {rekord.galaz} · Commit: {rekord.commitSha ? <span title={rekord.commitSha}>{rekord.commitSha.slice(0, 8)}<details><summary>Pełny SHA</summary><code>{rekord.commitSha}</code></details></span> : 'Nieznany'} · {stanyWeryfikacji[rekord.weryfikacja]}</p>
    <p>{formatujDate(rekord.zaobserwowano)} · {zrodlaObserwacji[rekord.zrodlo]} · {rekord.opisZrodla}</p><p className="surowy-wpis">{rekord.opis}</p>
    {rekord.github && <><a href={`${rekord.github.tozsamosc.adres}/commit/${rekord.commitSha}`} target="_blank" rel="noreferrer">Commit na GitHub</a><details><summary>Commity ({rekord.github.commity.length}) i gałęzie ({rekord.github.galezie.length})</summary>{rekord.github.commity.map((commit) => <p key={commit.sha}><a title={commit.sha} href={`${rekord.github!.tozsamosc.adres}/commit/${commit.sha}`} target="_blank" rel="noreferrer">{commit.sha.slice(0, 8)}</a> {commit.opis}</p>)}{rekord.github.galezie.map((galaz) => <p key={galaz.nazwa}>{galaz.nazwa} · <span title={galaz.sha}>{galaz.sha.slice(0, 8)}</span></p>)}</details></>}
    {rekord.ostrzezenia.map((tekst, numer) => <p key={numer}>Ostrzeżenie: {tekst}</p>)}</>;
}
function useZapis(wykonaj: Zapisz) {
  const blokada = useRef(false);
  const [zajety, ustawZajety] = useState(false);
  const [komunikat, ustawKomunikat] = useState('');
  async function zapisz(operacja: () => Promise<void>) {
    if (blokada.current) return;
    blokada.current = true; ustawZajety(true); ustawKomunikat('');
    try { await operacja(); ustawKomunikat('Zapisano lokalnie.'); }
    catch (blad) { ustawKomunikat(blad instanceof Error ? blad.message : 'Nie udało się zapisać.'); }
    finally { blokada.current = false; ustawZajety(false); }
  }
  return { zajety, komunikat, zapisz, wykonaj };
}
function FormularzRepozytorium({ dane, projektId, poczatkowy, wykonaj, zamknij }: { dane: DaneKopii; projektId: string; poczatkowy: PolaczenieRepozytorium | null; wykonaj: Zapisz; zamknij: () => void }) {
  const [id] = useState(() => poczatkowy?.id ?? crypto.randomUUID());
  const [wybraneProjekty, ustawProjekty] = useState(poczatkowy?.projektIds ?? [projektId]);
  const zapis = useZapis(wykonaj);
  function wyslij(zdarzenie: FormEvent<HTMLFormElement>) {
    zdarzenie.preventDefault();
    const formularz = new FormData(zdarzenie.currentTarget);
    const tekst = (pole: string) => String(formularz.get(pole) ?? '').trim();
    const czas = new Date().toISOString();
    const rekord: PolaczenieRepozytorium = { ...(poczatkowy?.github ? { github: poczatkowy.github } : {}), id, projektIds: [...wybraneProjekty].sort(), nazwa: tekst('nazwa'), rodzaj: tekst('rodzaj') as PolaczenieRepozytorium['rodzaj'], dostawca: tekst('dostawca') as PolaczenieRepozytorium['dostawca'],
      ...(tekst('adres') ? { adresZdalny: tekst('adres') } : {}), ...(tekst('sciezka') ? { sciezkaLokalna: tekst('sciezka') } : {}), ...(tekst('galaz') ? { domyslnaGalaz: tekst('galaz') } : {}),
      weryfikacja: tekst('weryfikacja') as PolaczenieRepozytorium['weryfikacja'], notatka: tekst('notatka'), utworzono: poczatkowy?.utworzono ?? czas, zaktualizowano: czas, wersja: (poczatkowy?.wersja ?? 0) + 1 };
    void zapis.zapisz(async () => { await wykonaj({ rodzaj: 'zapisz', rekord, oczekiwanaWersja: poczatkowy?.wersja ?? null }); zamknij(); });
  }
  return <form className="formularz-realizacji" onSubmit={wyslij}><fieldset disabled={zapis.zajety}>
    <legend>{poczatkowy ? 'Edytuj repozytorium' : 'Nowe repozytorium'}</legend>
    <label>Nazwa repozytorium <input name="nazwa" required defaultValue={poczatkowy?.nazwa} /></label>
    <label>Rodzaj repozytorium <select name="rodzaj" defaultValue={poczatkowy?.rodzaj}>{Object.entries(rodzajeRepozytorium).map(([klucz, tekst]) => <option key={klucz} value={klucz}>{tekst}</option>)}</select></label>
    <label>Dostawca <select name="dostawca" defaultValue={poczatkowy?.dostawca}>{Object.entries(dostawcyRepozytorium).map(([klucz, tekst]) => <option key={klucz} value={klucz}>{tekst}</option>)}</select></label>
    <label>Zdalny URL <input name="adres" type="url" defaultValue={poczatkowy?.adresZdalny} /></label>
    <label>Lokalna ścieżka <input name="sciezka" defaultValue={poczatkowy?.sciezkaLokalna} /></label>
    <label>Domyślna gałąź <input name="galaz" defaultValue={poczatkowy?.domyslnaGalaz} /></label>
    <label>Weryfikacja metadanych <select name="weryfikacja" defaultValue={poczatkowy?.weryfikacja}>{Object.entries(stanyWeryfikacji).filter(([klucz]) => klucz !== 'GITHUB_API').map(([klucz, tekst]) => <option key={klucz} value={klucz}>{tekst}</option>)}</select></label>
    <label>Notatka <textarea name="notatka" defaultValue={poczatkowy?.notatka} /></label>
    <p>Wybierz projekty korzystające z tej samej tożsamości repozytorium:</p>
    {dane.projekty.map((projekt) => <label key={projekt.id}><input type="checkbox" checked={wybraneProjekty.includes(projekt.id)} onChange={(zdarzenie) => ustawProjekty(zdarzenie.target.checked ? [...wybraneProjekty, projekt.id] : wybraneProjekty.filter((id) => id !== projekt.id))} />{projekt.nazwa}</label>)}
    <button type="submit">Zapisz repozytorium</button><button type="button" onClick={zamknij}>Anuluj</button>
  </fieldset><p role="status">{zapis.komunikat}</p></form>;
}
function PowiazRepozytorium({ dane, projektId, wykonaj }: { dane: DaneKopii; projektId: string; wykonaj: Zapisz }) {
  const zapis = useZapis(wykonaj);
  const dostepne = dane.polaczeniaRepozytoriow.filter((repo) => !repo.projektIds.includes(projektId));
  return <form onSubmit={(zdarzenie) => { zdarzenie.preventDefault(); const id = String(new FormData(zdarzenie.currentTarget).get('repo')); const repo = dostepne.find((repo) => repo.id === id);
    if (repo) void zapis.zapisz(() => wykonaj({ rodzaj: 'zapisz', oczekiwanaWersja: repo.wersja, rekord: { ...repo, projektIds: [...repo.projektIds, projektId].sort(), wersja: repo.wersja + 1, zaktualizowano: new Date().toISOString() } }));
  }}><label>Istniejące repozytorium <select name="repo" required disabled={!dostepne.length || zapis.zajety}>{dostepne.map((repo) => <option key={repo.id} value={repo.id}>{repo.nazwa}</option>)}</select></label><button disabled={!dostepne.length || zapis.zajety}>Powiąż z projektem</button><p role="status">{zapis.komunikat}</p></form>;
}
function FormularzObserwacji({ repo, dane, wykonaj }: { repo: PolaczenieRepozytorium; dane: DaneKopii; wykonaj: Zapisz }) {
  const zapis = useZapis(wykonaj);
  const [id, ustawId] = useState(() => crypto.randomUUID());
  const [czas, ustawCzas] = useState(() => new Date().toISOString());
  const [zrodlo, ustawZrodlo] = useState<MigawkaRepozytorium['zrodlo']>('RECZNE');
  const [raport, ustawRaport] = useState('');
  const [dowodIds, ustawDowody] = useState<string[]>([]);
  const dostepne = dane.dowody.filter((dowod) => dowod.typZrodla === 'REPOSITORY' && dowod.zrodloId === repo.id);
  function wyslij(zdarzenie: FormEvent<HTMLFormElement>) {
    zdarzenie.preventDefault(); const formularz = new FormData(zdarzenie.currentTarget);
    void zapis.zapisz(async () => {
      const wartosc = zrodlo === 'RAPORT' ? JSON.parse(raport) as Record<string, unknown> : {};
      if (Object.keys(wartosc).some((pole) => !['galaz', 'commitSha', 'zaobserwowano', 'opis', 'ostrzezenia'].includes(pole))) throw new Error('Raport zawiera nieobsługiwane pola.');
      const sha = String(zrodlo === 'RAPORT' ? wartosc.commitSha ?? '' : formularz.get('sha') ?? '').trim();
      const potwierdzone = zrodlo === 'RAPORT' && dostepne.some((dowod) => dowodIds.includes(dowod.id) && dowod.rewizja === sha && dowod.weryfikacja === 'POTWIERDZONE_LOKALNIE');
      const rekord: MigawkaRepozytorium = { id, repoConnectionId: repo.id, galaz: zrodlo === 'RAPORT' ? wartosc.galaz as string : String(formularz.get('galaz')), ...(sha ? { commitSha: sha } : {}),
        zaobserwowano: zrodlo === 'RAPORT' ? wartosc.zaobserwowano as string : czas, zrodlo, opisZrodla: String(formularz.get('zrodlo')), opis: zrodlo === 'RAPORT' ? wartosc.opis as string : String(formularz.get('opis')),
        ostrzezenia: zrodlo === 'RAPORT' ? (wartosc.ostrzezenia ?? []) as string[] : String(formularz.get('ostrzezenia')).split('\n').filter(Boolean), dowodIds,
        weryfikacja: potwierdzone ? 'POTWIERDZONE_LOKALNIE' : 'NIEZWERYFIKOWANE' };
      await wykonaj({ rodzaj: 'obserwuj', rekord }); ustawId(crypto.randomUUID());
    });
  }
  return <form className="formularz-realizacji" onSubmit={wyslij}><fieldset disabled={zapis.zajety}>
    <legend>Nowa obserwacja</legend><label>Źródło obserwacji <select value={zrodlo} onChange={(zdarzenie) => ustawZrodlo(zdarzenie.target.value as typeof zrodlo)}>{Object.entries(zrodlaObserwacji).filter(([klucz]) => klucz !== 'GITHUB_API').map(([klucz, tekst]) => <option key={klucz} value={klucz}>{tekst}</option>)}</select></label>
    <label>Opis źródła / nazwa raportu <input name="zrodlo" required /></label>
    {zrodlo === 'RECZNE' ? <><label>Gałąź <input name="galaz" required defaultValue={repo.domyslnaGalaz} /></label><label>Commit SHA (niezweryfikowany) <input name="sha" pattern="[a-fA-F0-9]{7,64}" /></label>
      <label>Czas obserwacji (ISO) <input value={czas} onChange={(zdarzenie) => ustawCzas(zdarzenie.target.value)} required /></label><label>Opis stanu <textarea name="opis" /></label><label>Ostrzeżenia (po jednym w wierszu) <textarea name="ostrzezenia" /></label></> : <>
      <p>Raport JSON: gałąź (galaz), opcjonalny commitSha, zaobserwowano (ISO), opis, opcjonalna lista ostrzezenia. Deklaracja narzędzia nie potwierdza commitu.</p>
      <label>Plik raportu JSON <input type="file" accept=".json,application/json" onChange={(zdarzenie) => { const plik = zdarzenie.target.files?.[0]; if (plik) void zapis.zapisz(async () => ustawRaport(await plik.text())); }} /></label>
      <label>Treść raportu JSON <textarea required value={raport} onChange={(zdarzenie) => ustawRaport(zdarzenie.target.value)} /></label></>}
    <p>Powiązane dowody:</p>{dostepne.map((dowod) => <label key={dowod.id}><input type="checkbox" checked={dowodIds.includes(dowod.id)} onChange={(zdarzenie) => ustawDowody(zdarzenie.target.checked ? [...dowodIds, dowod.id] : dowodIds.filter((id) => id !== dowod.id))} />{dowod.opis} · {stanyWeryfikacji[dowod.weryfikacja]}</label>)}
    <button>Zapisz nową obserwację</button></fieldset><p role="status">{zapis.komunikat}</p></form>;
}
function FormularzDowodu({ dane, projektId, wykonaj }: { dane: DaneKopii; projektId: string; wykonaj: Zapisz }) {
  const zapis = useZapis(wykonaj);
  const [id, ustawId] = useState(() => crypto.randomUUID());
  const [typ, ustawTyp] = useState<Dowod['typZrodla']>('REPOSITORY');
  const [pochodzenie, ustawPochodzenie] = useState<Dowod['pochodzenie']>('NARZEDZIE');
  const zrodla = dane[magazynyZrodel[typ]].filter((rekord) => projektyZrodla(dane, typ, rekord.id).includes(projektId));
  return <form className="formularz-realizacji" onSubmit={(zdarzenie) => {
    zdarzenie.preventDefault(); const formularz = new FormData(zdarzenie.currentTarget); const zrodloId = String(formularz.get('zrodlo'));
    const repo = typ === 'REPOSITORY' ? dane.polaczeniaRepozytoriow.find((repo) => repo.id === zrodloId) : typ === 'REPOSITORY_SNAPSHOT' ? dane.polaczeniaRepozytoriow.find((repo) => repo.id === dane.migawkiRepozytoriow.find((rekord) => rekord.id === zrodloId)?.repoConnectionId) : undefined;
    const rewizja = String(formularz.get('rewizja')).trim();
    const rekord: Dowod = { id, projektIds: [projektId], typZrodla: typ, zrodloId, pochodzenie, opis: String(formularz.get('opis')), zaobserwowano: String(formularz.get('czas')),
      weryfikacja: String(formularz.get('weryfikacja')) as Dowod['weryfikacja'], ...(rewizja ? { rewizja } : {}),
      ...(repo?.adresZdalny ? { polaczenieZrodla: { contractVersion: 1 as const, idempotencyKey: `${repo.id}:${typ}:${zrodloId}`, providerId: repo.dostawca, connectionId: repo.id, resourceType: typ, externalId: repo.adresZdalny, url: repo.adresZdalny, ...(rewizja ? { externalRevision: rewizja } : {}) } } : {}) };
    void zapis.zapisz(async () => { await wykonaj({ rodzaj: 'dowod', rekord }); ustawId(crypto.randomUUID()); });
  }}><fieldset disabled={zapis.zajety}><legend>Nowy dowód / odniesienie</legend>
    <label>Typ źródła <select value={typ} onChange={(zdarzenie) => ustawTyp(zdarzenie.target.value as typeof typ)}>{Object.entries(typyZrodelDowodu).map(([klucz, tekst]) => <option key={klucz} value={klucz}>{tekst}</option>)}</select></label>
    <label>Rekord źródłowy <select name="zrodlo" required key={typ}>{zrodla.map((rekord) => <option key={rekord.id} value={rekord.id}>{'nazwa' in rekord ? rekord.nazwa : 'tytul' in rekord ? rekord.tytul : 'opis' in rekord ? rekord.opis : rekord.id}</option>)}</select></label>
    <label>Pochodzenie <select value={pochodzenie} onChange={(zdarzenie) => ustawPochodzenie(zdarzenie.target.value as typeof pochodzenie)}>{Object.entries(pochodzeniaDowodu).filter(([klucz]) => klucz !== 'GITHUB_API').map(([klucz, tekst]) => <option key={klucz} value={klucz}>{tekst}</option>)}</select></label>
    <label key={pochodzenie}>Weryfikacja dowodu <select name="weryfikacja"><option value="NIEZWERYFIKOWANE">Niezweryfikowane</option>{['TEST', 'ODCZYT_REPOZYTORIUM'].includes(pochodzenie) && <option value="POTWIERDZONE_LOKALNIE">Potwierdzone lokalnie przez użytkownika</option>}</select></label>
    <label>Opis wyniku / sposobu sprawdzenia <textarea name="opis" required /></label><label>Znana rewizja <input name="rewizja" /></label><label>Czas dowodu (ISO) <input name="czas" defaultValue={new Date().toISOString()} required /></label>
    <button disabled={!zrodla.length}>Zapisz dowód</button></fieldset><p role="status">{zapis.komunikat}</p></form>;
}
function GeneratorKontekstu({ dane, projektId }: { dane: DaneKopii; projektId: string }) {
  const projekt = dane.projekty.find((projekt) => projekt.id === projektId)!;
  const { migawka } = wyliczStanProjektu(dane, projekt);
  const [wybor, ustawWybor] = useState<WyborKontekstu>(() => ({ projektId, cel: '', aktualnyStan: true, decyzjaIds: migawka.aktywneDecyzje.map((rekord) => rekord.id), ograniczenieIds: migawka.aktywneOgraniczenia.map((rekord) => rekord.id), pracaIds: [], pytanieIds: [], blokerIds: [], korektaIds: [], dowodIds: [] }));
  const [pakiet, ustawPakiet] = useState<PakietKontekstu | null>(null);
  const [komunikat, ustawKomunikat] = useState('');
  const [danePodgladu, ustawDanePodgladu] = useState<DaneKopii | null>(null);
  const aktualny = pakiet && danePodgladu === dane;
  function zmien(zmiana: Partial<WyborKontekstu>) { ustawWybor({ ...wybor, ...zmiana }); ustawPakiet(null); ustawKomunikat(''); }
  function zakres(pole: 'decyzjaIds' | 'ograniczenieIds' | 'pracaIds' | 'pytanieIds' | 'blokerIds' | 'korektaIds' | 'dowodIds', tytul: string, rekordy: { id: string; tytul: string }[]) {
    return <fieldset><legend>{tytul}</legend>{rekordy.length ? rekordy.map((rekord) => <label key={rekord.id}><input type="checkbox" checked={wybor[pole].includes(rekord.id)} onChange={(zdarzenie) => zmien({ [pole]: zdarzenie.target.checked ? [...wybor[pole], rekord.id] : wybor[pole].filter((id) => id !== rekord.id) })} />{rekord.tytul}</label>) : <p>Brak aktualnych rekordów.</p>}</fieldset>;
  }
  function eksportuj(format: 'md' | 'json') {
    if (!aktualny) return;
    try {
      const tresc = format === 'md' ? eksportujMarkdown(pakiet) : eksportujJson(pakiet);
      const adres = URL.createObjectURL(new Blob([tresc], { type: format === 'md' ? 'text/markdown;charset=utf-8' : 'application/json' }));
      const odnosnik = document.createElement('a'); odnosnik.href = adres; odnosnik.download = `kontekst-${projekt.id}.${format}`; document.body.append(odnosnik); odnosnik.click(); odnosnik.remove(); setTimeout(() => URL.revokeObjectURL(adres), 1000);
      ustawKomunikat('Przygotowano wybrany pakiet do pobrania.');
    } catch (blad) { ustawKomunikat(blad instanceof Error ? blad.message : 'Eksport nie powiódł się.'); }
  }
  return <section aria-label="Generator kontekstu"><h2>Generator kontekstu</h2>
    <p>Pakiet jest informacją do przejrzenia. Wygenerowanie podglądu nie oznacza zgody na wysłanie danych. Kopiowanie i pliki zawierają wyłącznie zakres pokazany poniżej.</p>
    <form className="formularz-realizacji" onSubmit={(zdarzenie) => { zdarzenie.preventDefault(); ustawKomunikat(''); ustawPakiet(null);
      try { ustawPakiet(generujPakietKontekstu(dane, wybor, new Date().toISOString())); ustawDanePodgladu(dane); }
      catch (blad) { ustawKomunikat(blad instanceof Error ? blad.message : 'Nie udało się wygenerować pakietu.'); }
    }}>
      <label>Cel zadania <textarea required value={wybor.cel} onChange={(zdarzenie) => zmien({ cel: zdarzenie.target.value })} /></label>
      <label>Repozytorium do pakietu <select value={wybor.repozytoriumId ?? ''} onChange={(zdarzenie) => zmien({ repozytoriumId: zdarzenie.target.value || undefined })}><option value="">Bez repozytorium</option>{dane.polaczeniaRepozytoriow.filter((repo) => repo.projektIds.includes(projektId)).map((repo) => <option key={repo.id} value={repo.id}>{repo.nazwa}</option>)}</select></label>
      <label><input type="checkbox" checked={wybor.aktualnyStan} onChange={(zdarzenie) => zmien({ aktualnyStan: zdarzenie.target.checked })} />Aktualny stan i cel projektu</label>
      {zakres('decyzjaIds', 'Obowiązujące decyzje', migawka.aktywneDecyzje)}
      {zakres('ograniczenieIds', 'Obowiązujące ograniczenia', migawka.aktywneOgraniczenia)}
      {zakres('pracaIds', 'Aktualne prace', migawka.aktualnaPraca)}
      {zakres('pytanieIds', 'Otwarte pytania', migawka.otwartePytania.map((rekord) => ({ id: rekord.id, tytul: rekord.pytanie })))}
      {zakres('blokerIds', 'Aktywne blokery', migawka.blokery)}
      {zakres('korektaIds', 'Zastosowane korekty (wybierz istotne)', dostepneKorekty(dane, projektId).map((rekord) => ({ id: rekord.id, tytul: rekord.opis })))}
      {zakres('dowodIds', 'Dowody (bez treści rekordów źródłowych)', dane.dowody.filter((dowod) => dowod.projektIds.includes(projektId)).map((rekord) => ({ id: rekord.id, tytul: `${rekord.opis} · ${stanyWeryfikacji[rekord.weryfikacja]}` })))}
      <p>Dokumenty: brak kanonicznego modelu. Historia repozytorium nie jest eksportowana; tylko ostatnia obserwacja wybranego repozytorium.</p>
      <button>Wygeneruj podgląd</button>
    </form>
    {pakiet && <><h3>Dokładny zakres eksportu</h3>{!aktualny && <p>Dane zmieniły się. Wygeneruj podgląd ponownie przed eksportem.</p>}
      <label>Podgląd Markdown <textarea className="podglad-kontekstu" readOnly value={eksportujMarkdown(pakiet)} /></label>
      <details><summary>Dokładny podgląd JSON</summary><pre className="podglad-json">{eksportujJson(pakiet)}</pre></details>
      <div className="akcje-wpisu"><button disabled={!aktualny} onClick={async () => {
        if (!aktualny) return;
        try { await navigator.clipboard.writeText(eksportujMarkdown(pakiet)); ustawKomunikat('Skopiowano Markdown.'); }
        catch { ustawKomunikat('Schowek jest niedostępny. Zaznacz podgląd lub pobierz Markdown.'); }
      }}>Kopiuj Markdown</button><button disabled={!aktualny} onClick={() => eksportuj('md')}>Eksportuj Markdown</button><button disabled={!aktualny} onClick={() => eksportuj('json')}>Eksportuj JSON</button></div></>}
    <p role="status">{komunikat}</p>
  </section>;
}
