import { Link } from 'react-router-dom';
import { useState } from 'react';
import { ArrowUpRight as StrzalkaOtwierania, Plus as IkonaDodawania, Search as IkonaSzukania, GitBranch as IkonaGitHub, ArrowRight as StrzalkaKroku, Layers3 as IkonaEtapu, CircleAlert as IkonaUwagi } from 'lucide-react';
import type { Etap } from '../domain/realizacja';
import type { PolaczenieRepozytorium } from '../domain/kontekstRepozytorium';
import { statusPolaczenia, statusyGitHub } from '../domain/synchronizacjaGitHub';
import { etykietyZrodel, statusyProjektu, type Projekt, type Wpis, type ZdarzenieAktywnosci } from '../domain/modele';
import { wagiUwagi, type ObrazProjektu, type OdnosnikStanu } from '../domain/stanProjektu';
import { formatujDate } from '../shared/formatujDate';
import { EtykietaStatusu, KafelekMetryki, NaglowekSekcji, Panel, PustyStan } from '../shared/Komponenty';

function skroc(tresc: string) {
  return tresc.length > 160 ? `${tresc.slice(0, 160)}…` : tresc;
}

function ListaPowrotu({ tytul, elementy }: { tytul: string; elementy: OdnosnikStanu[] }) {
  return <div className="grupa-powrotu"><h4>{tytul} <small>({elementy.length})</small></h4>
    {elementy.length ? <ul>{elementy.slice(0, 5).map((element) => <li key={element.id}><Link to={element.adres}>{element.tytul}</Link></li>)}</ul> : <p>Brak.</p>}
    {elementy.length > 5 && <small>Pokazano 5 z {elementy.length}. Pełna lista w projekcie.</small>}
  </div>;
}

function adresZdarzenia(zdarzenie: ZdarzenieAktywnosci, projektId: string) {
  const adres = `/projekty/${projektId}`;
  const id = encodeURIComponent(zdarzenie.encjaId ?? '');
  switch (zdarzenie.typEncji) {
    case 'DECISION': return `${adres}/ustalenia?decyzja=${id}`;
    case 'CORRECTION': return `${adres}/korekty`;
    case 'CAPTURE': return `/inbox?wpis=${id}`;
    case 'WORK_ITEM': return `${adres}#praca-${id}`;
    case 'QUESTION': return `${adres}#pytanie-${id}`;
    case 'BLOCKER': return `${adres}#blokada-${id}`;
    case 'IMPACT': return `${adres}/ustalenia`;
    default: return adres;
  }
}

export function Start({ projekty, wpisy, obrazyProjektow, zdarzenia, etapy = [], repozytoria = [] }: {
  projekty: Projekt[]; wpisy: Wpis[]; obrazyProjektow: ObrazProjektu[]; zdarzenia: ZdarzenieAktywnosci[];
  etapy?: Etap[]; repozytoria?: PolaczenieRepozytorium[];
}) {
  const [filtr, ustawFiltr] = useState('wszystkie');
  const [szukanaFraza, ustawFraze] = useState('');
  const [czasOdczytu] = useState(Date.now);
  const [sortowanie, ustawSortowanie] = useState('aktywnosc');
  const [projektRepozytorium, ustawProjektRepozytorium] = useState('');
  const [filtrZdarzen, ustawFiltrZdarzen] = useState('wszystkie');
  const biezaceProjekty = projekty.filter((projekt) => !projekt.zarchiwizowano && !['COMPLETED', 'ABANDONED'].includes(projekt.status))
    .sort((lewy, prawy) => prawy.ostatniaAktywnosc.localeCompare(lewy.ostatniaAktywnosc) || lewy.id.localeCompare(prawy.id));
  const biezaceId = new Set(biezaceProjekty.map((projekt) => projekt.id));
  const obrazy = obrazyProjektow.filter((obraz) => biezaceId.has(obraz.migawka.projektId));
  const uwagi = obrazy.flatMap((obraz) => obraz.uwaga).filter((uwaga) => !uwaga.rozwiazano)
    .sort((lewa, prawa) => ({ CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }[lewa.waga] - { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }[prawa.waga])
      || prawa.utworzono.localeCompare(lewa.utworzono) || lewa.id.localeCompare(prawa.id));
  const ostatniProjekt = biezaceProjekty[0];
  const ostatniObraz = obrazy.find((obraz) => obraz.migawka.projektId === ostatniProjekt?.id)?.migawka;
  const repozytoriumId = biezaceId.has(projektRepozytorium) ? projektRepozytorium : ostatniProjekt?.id;
  const widoczneProjekty = projekty.filter((projekt) => (filtr === 'wszystkie' || (!projekt.zarchiwizowano && projekt.status === filtr))
    && `${projekt.nazwa} ${projekt.opis} ${projekt.nastepnyKrok}`.toLocaleLowerCase('pl').includes(szukanaFraza.trim().toLocaleLowerCase('pl')))
    .sort((lewy, prawy) => (sortowanie === 'status' ? statusyProjektu[lewy.status].localeCompare(statusyProjektu[prawy.status], 'pl') : 0)
      || prawy.ostatniaAktywnosc.localeCompare(lewy.ostatniaAktywnosc) || lewy.id.localeCompare(prawy.id));
  const historia = [...zdarzenia].filter((zdarzenie) => filtrZdarzen === 'wszystkie' || zdarzenie.typEncji === filtrZdarzen)
    .sort((lewe, prawe) => prawe.utworzono.localeCompare(lewe.utworzono) || lewe.id.localeCompare(prawe.id));
  const ostatniWpis = [...wpisy].sort((lewy, prawy) => prawy.utworzono.localeCompare(lewy.utworzono))[0];

  return <div className="pulpit pulpit-premium">
    <header className="naglowek-pulpitu"><div><span className="nadtytul">TWÓJ WARSZTAT · PRZEGLĄD</span>
      <NaglowekSekcji poziom={1} tytul="Centrum Projektowe" opis="Wszystko, nad czym pracujesz. Z jasnym następnym krokiem." /></div>
      <Link className="glowna-akcja" to="/projekty#nazwa-projektu"><IkonaDodawania size={18} aria-hidden="true" />Nowy projekt</Link>
    </header>
    <div className="siatka-metryk metryki-pulpitu" aria-label="Stan bieżących projektów">
      <KafelekMetryki etykieta="Aktywne projekty" wartosc={biezaceProjekty.filter((projekt) => projekt.status === 'ACTIVE').length} opis="Projekty w statusie Aktywny" />
      <KafelekMetryki etykieta="Otwarte zadania" wartosc={obrazy.flatMap((obraz) => obraz.migawka.aktualnaPraca).filter((praca) => praca.typ === 'TASK').length} opis="Bez zakończonych i porzuconych" />
      <KafelekMetryki etykieta="Aktywne blokady" wartosc={obrazy.flatMap((obraz) => obraz.migawka.blokery).length} opis="Blokady wymagające rozwiązania" />
      <KafelekMetryki etykieta="Wymaga uwagi" wartosc={uwagi.length} opis="Sprawy do przejrzenia" />
    </div>
    <p className="opis-zakresu">Metryki bieżącej pracy · bez archiwum, zakończonych i porzuconych projektów.</p>
    <div className="obszar-pulpitu">
    <Panel className="panel-projektow" aria-labelledby="tytul-projektow">
      <NaglowekSekcji id="tytul-projektow" tytul="Twoje projekty" opis={`${widoczneProjekty.length} z ${projekty.length} projektów w Twojej przestrzeni`} />
      <div className="filtry-pulpitu">
        <label className="pole-szukania"><IkonaSzukania size={17} aria-hidden="true" /><input aria-label="Szukaj projektu" placeholder="Szukaj projektu lub następnego kroku…" value={szukanaFraza} onChange={(zdarzenie) => ustawFraze(zdarzenie.target.value)} /></label>
        <label className="tylko-czytnik" htmlFor="filtr-projektow">Filtr projektów</label><select id="filtr-projektow" value={filtr} onChange={(zdarzenie) => ustawFiltr(zdarzenie.target.value)}>
          <option value="wszystkie">Wszystkie (z archiwum)</option>{Object.entries(statusyProjektu).map(([status, etykieta]) => <option key={status} value={status}>{etykieta}</option>)}
        </select>
        <label className="tylko-czytnik" htmlFor="sortowanie-projektow">Sortuj projekty</label><select id="sortowanie-projektow" value={sortowanie} onChange={(zdarzenie) => ustawSortowanie(zdarzenie.target.value)}>
          <option value="aktywnosc">Ostatnia aktywność</option><option value="status">Status (A–Z)</option>
        </select>
      </div>
      {widoczneProjekty.length ? <ul className="lista-rekordow karty-projektow">{widoczneProjekty.map((projekt) => {
        const obraz = obrazyProjektow.find((obraz) => obraz.migawka.projektId === projekt.id)?.migawka;
        const etap = etapy.filter((etap) => etap.projektId === projekt.id && etap.status === 'IN_PROGRESS').sort((lewy, prawy) => lewy.kolejnosc - prawy.kolejnosc || lewy.id.localeCompare(prawy.id));
        const polaczenia = repozytoria.filter((repo) => repo.projektIds.includes(projekt.id));
        return <li key={projekt.id} className={`kafelek-projektu projekt-${projekt.status.toLowerCase()} ${projekt.zarchiwizowano ? 'projekt-archiwalny' : ''}`}>
          <div className="gora-kafelka"><span className="monogram-projektu" aria-hidden="true">{projekt.nazwa.trim().slice(0, 2).toLocaleUpperCase('pl')}</span>
            <EtykietaStatusu ton={projekt.zarchiwizowano ? 'neutralny' : projekt.status === 'ACTIVE' ? 'sukces' : ['PAUSED', 'BLOCKED'].includes(projekt.status) ? 'ostrzezenie' : 'akcent'}>{statusyProjektu[projekt.status]}{projekt.zarchiwizowano ? ' · Archiwalny' : ''}</EtykietaStatusu></div>
          <h3><Link className="tytul-kafelka" to={`/projekty/${projekt.id}`}>{projekt.nazwa}<StrzalkaOtwierania size={18} aria-hidden="true" /></Link></h3>
          <p className="data-kafelka">Ostatnia aktywność: {formatujDate(projekt.ostatniaAktywnosc)}</p>
          <p className="etap-kafelka"><IkonaEtapu size={15} aria-hidden="true" />{etap.length ? <Link to={`/projekty/${projekt.id}#etap-${etap[0].id}`}>{etap[0].nazwa}{etap.length > 1 ? ` (+${etap.length - 1} w toku)` : ''}</Link> : 'Brak etapu w toku'}</p>
          <div className="nastepny-krok-kafelka"><span>Następny krok</span><p>{skroc(projekt.nastepnyKrok) || 'Ustal, od czego chcesz zacząć.'}</p></div>
          <details className="szczegoly-kafelka"><summary>Stan i ostatnia praca</summary><h4>Aktualny stan</h4><p>{skroc(projekt.podsumowanieAktualnegoStanu) || 'Nie uzupełniono.'}</p><h4>Ostatnio wykonywana praca</h4><p>{skroc(projekt.ostatnioPracowanoNad) || 'Nie uzupełniono.'}</p></details>
          <div className="fakty-kafelka"><span>{obraz?.aktualnaPraca.filter((praca) => praca.typ === 'TASK').length ?? 0} otwartych zadań</span><span className={obraz?.blokery.length ? 'ma-blokady' : ''}>Aktywne blokady: {obraz?.blokery.length ?? 0}</span></div>
          <div className="dol-kafelka"><Link className="otworz-projekt" to={`/projekty/${projekt.id}`}>Otwórz projekt<StrzalkaKroku size={16} aria-hidden="true" /></Link><Link className="skrot-github" to={`/projekty/${projekt.id}/repozytoria`} aria-label={`GitHub i repozytoria: ${projekt.nazwa}`} title={polaczenia.length ? polaczenia.map((repo) => `${repo.nazwa}: ${statusyGitHub[statusPolaczenia(repo, czasOdczytu)]}`).join('\n') : 'Powiąż repozytorium projektu'}><IkonaGitHub size={16} aria-hidden="true" />GitHub{polaczenia.length > 0 && <small>{polaczenia.length}</small>}</Link></div>
        </li>;
      })}</ul> : <PustyStan>{projekty.length ? <>Nie znaleziono projektu. <button className="przycisk-drugorzedny" onClick={() => { ustawFraze(''); ustawFiltr('wszystkie'); }}>Wyczyść filtry</button></> : <>Twoja przestrzeń jest gotowa. <Link to="/projekty#nazwa-projektu">Utwórz pierwszy projekt</Link> i zapisz pierwszy krok.</>}</PustyStan>}
    </Panel>
    <aside className="bok-pulpitu">
      <Panel className="panel-uwag" aria-labelledby="uwaga-pulpitu">
        <NaglowekSekcji id="uwaga-pulpitu" tytul="Wymaga uwagi"><span className="licznik-uwag"><IkonaUwagi size={15} aria-hidden="true" />{uwagi.length}</span></NaglowekSekcji>
        {uwagi.length ? <ul className="lista-rekordow lista-uwag-pulpitu">{uwagi.slice(0, 4).map((uwaga) => <li key={uwaga.id}>
          <EtykietaStatusu ton={['CRITICAL', 'HIGH'].includes(uwaga.waga) ? 'blad' : uwaga.waga === 'MEDIUM' ? 'ostrzezenie' : 'neutralny'}>Priorytet: {wagiUwagi[uwaga.waga]}</EtykietaStatusu>
          <h3>{uwaga.tytul}</h3><Link to={`/projekty/${uwaga.projektId}`}>{projekty.find((projekt) => projekt.id === uwaga.projektId)?.nazwa}</Link><p>{uwaga.powod}</p>
          <div className="odnosniki">{uwaga.odnosnikiZrodel.map((zrodlo) => <Link key={`${zrodlo.id}:${zrodlo.adres}`} to={zrodlo.adres}>{zrodlo.tytul}</Link>)}</div>
        </li>)}</ul> : <PustyStan>Brak spraw wymagających uwagi w bieżących projektach.</PustyStan>}
        <Link className="link-panelu" to="/uwaga">Wszystkie sprawy ({uwagi.length})<StrzalkaKroku size={16} aria-hidden="true" /></Link>
      </Panel>
      <Panel className="panel-skrotow" aria-labelledby="szybkie-dzialania"><NaglowekSekcji id="szybkie-dzialania" tytul="Szybkie działania" />
        <div className="skroty-pulpitu"><Link to="/inbox#tresc-wpisu">Nowy wpis<StrzalkaOtwierania size={16} aria-hidden="true" /></Link><Link to="/inbox">Otwórz Skrzynkę<StrzalkaOtwierania size={16} aria-hidden="true" /></Link><Link to="/uwaga">Wymaga uwagi<StrzalkaOtwierania size={16} aria-hidden="true" /></Link></div>
        <div className="wybor-repozytorium"><label htmlFor="repozytorium-pulpitu">Projekt repozytorium</label><select id="repozytorium-pulpitu" value={repozytoriumId ?? ''} disabled={!biezaceProjekty.length} onChange={(zdarzenie) => ustawProjektRepozytorium(zdarzenie.target.value)}>{!biezaceProjekty.length && <option value="">Brak bieżących projektów</option>}{biezaceProjekty.map((projekt) => <option key={projekt.id} value={projekt.id}>{projekt.nazwa}</option>)}</select>{repozytoriumId ? <Link to={`/projekty/${repozytoriumId}/repozytoria`}><IkonaGitHub size={15} aria-hidden="true" /> Repozytoria</Link> : <small>Dodaj projekt, aby otworzyć jego repozytoria.</small>}</div>
      </Panel>
    </aside>
    </div>
    <div className="kolumny-pulpitu drugorzedne-panele">
      <Panel aria-labelledby="kontynuuj-prace">
        <NaglowekSekcji id="kontynuuj-prace" tytul="Kontynuuj pracę" opis="Ostatnio aktywny spośród bieżących projektów." />
        {ostatniProjekt ? <>
          <h3><Link to={`/projekty/${ostatniProjekt.id}`}>{ostatniProjekt.nazwa}</Link></h3>
          <small>Ostatnia aktywność: {formatujDate(ostatniProjekt.ostatniaAktywnosc)}</small>
          <div className="punkt-powrotu powrot-pulpitu"><h4>Zapisany punkt powrotu</h4>
            <dl><dt>Aktualny stan</dt><dd>{ostatniProjekt.podsumowanieAktualnegoStanu || 'Nie uzupełniono.'}</dd>
              <dt>Ostatnio wykonywana praca</dt><dd>{ostatniProjekt.ostatnioPracowanoNad || 'Nie uzupełniono.'}</dd>
              <dt>Następny krok</dt><dd>{ostatniProjekt.nastepnyKrok || 'Nie uzupełniono.'}</dd></dl>
            <Link to={`/projekty/${ostatniProjekt.id}#pamiec-projektu`}>Otwórz punkt powrotu</Link>
          </div>
          <ListaPowrotu tytul="Niezakończone zadania" elementy={(ostatniObraz?.aktualnaPraca ?? []).filter((praca) => praca.typ === 'TASK').map((praca) => ({id: praca.id, tytul: praca.tytul, adres: `/projekty/${ostatniProjekt.id}#praca-${praca.id}`}))} />
          <ListaPowrotu tytul="Otwarte pytania" elementy={(ostatniObraz?.otwartePytania ?? []).map((pytanie) => ({id: pytanie.id, tytul: pytanie.pytanie, adres: `/projekty/${ostatniProjekt.id}#pytanie-${pytanie.id}`}))} />
          <ListaPowrotu tytul="Aktywne blokady" elementy={(ostatniObraz?.blokery ?? []).map((blokada) => ({id: blokada.id, tytul: blokada.tytul, adres: `/projekty/${ostatniProjekt.id}#blokada-${blokada.id}`}))} />
          <div className="odnosniki"><Link to={`/projekty/${ostatniProjekt.id}#realizacja-projektu`}>Pełna realizacja projektu</Link></div>
        </> : <PustyStan>Nie ma bieżącego projektu, do którego można wrócić. Dodaj projekt lub otwórz istniejący w sekcji Projekty.</PustyStan>}
      </Panel>
      <Panel aria-labelledby="tytul-ostatniego-wpisu"><NaglowekSekcji id="tytul-ostatniego-wpisu" tytul="Ostatnio zapisany wpis" />
        {ostatniWpis ? <><p className="surowy-wpis">{ostatniWpis.trescOryginalna}</p><small>{formatujDate(ostatniWpis.utworzono)}</small></> : <PustyStan>Nie masz jeszcze wpisów. Zacznij od zapisania myśli w Skrzynce.</PustyStan>}
        <p>W Skrzynce możesz analizować wpisy, weryfikować propozycje i stosować zatwierdzone elementy.</p>
      </Panel>
    </div>
    <Panel aria-labelledby="aktywnosc-pulpitu">
      <NaglowekSekcji id="aktywnosc-pulpitu" tytul="Ostatnia aktywność" opis="Do 12 ostatnich zapisanych zdarzeń. Bieżący stan nie zastępuje historii." />
      <label htmlFor="filtr-aktywnosci">Rodzaj aktywności</label>{' '}<select id="filtr-aktywnosci" value={filtrZdarzen} onChange={(zdarzenie) => ustawFiltrZdarzen(zdarzenie.target.value)}>
        <option value="wszystkie">Wszystkie zdarzenia</option><option value="PROJECT">Projekty i statusy</option><option value="DECISION">Decyzje</option><option value="CORRECTION">Korekty</option><option value="WORK_ITEM">Elementy pracy</option>
      </select>
      {historia.length ? <ol className="os-czasu">{historia.slice(0, 12).map((zdarzenie) => <li key={zdarzenie.id}>
        <time dateTime={zdarzenie.utworzono}>{formatujDate(zdarzenie.utworzono)}</time><h3>{zdarzenie.tytul}</h3>
        {zdarzenie.opis && <p className="surowy-wpis">{zdarzenie.opis}</p>}
        <small>Źródło: {zdarzenie.zrodlo.nazwa} ({etykietyZrodel[zdarzenie.zrodlo.typ]})</small>
        <div className="odnosniki">{projekty.filter((projekt) => projekt.id === zdarzenie.projektId || zdarzenie.projektIds?.includes(projekt.id)).map((projekt) => <Link key={projekt.id} to={adresZdarzenia(zdarzenie, projekt.id)}>{projekt.nazwa}</Link>)}
          {zdarzenie.typEncji === 'CAPTURE' && !zdarzenie.projektId && !zdarzenie.projektIds?.length && <Link to={`/inbox?wpis=${encodeURIComponent(zdarzenie.encjaId ?? '')}`}>Otwórz wpis</Link>}
        </div>
      </li>)}</ol> : <PustyStan>Brak zapisanych zdarzeń dla tego widoku.</PustyStan>}
    </Panel>
  </div>;
}
