import { Link } from 'react-router-dom';
import { useState } from 'react';
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

export function Start({ projekty, wpisy, obrazyProjektow, zdarzenia }: {
  projekty: Projekt[]; wpisy: Wpis[]; obrazyProjektow: ObrazProjektu[]; zdarzenia: ZdarzenieAktywnosci[];
}) {
  const [filtr, ustawFiltr] = useState('ACTIVE');
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
  const widoczneProjekty = projekty.filter((projekt) => filtr === 'wszystkie' || (!projekt.zarchiwizowano && projekt.status === filtr))
    .sort((lewy, prawy) => (sortowanie === 'status' ? statusyProjektu[lewy.status].localeCompare(statusyProjektu[prawy.status], 'pl') : 0)
      || prawy.ostatniaAktywnosc.localeCompare(lewy.ostatniaAktywnosc) || lewy.id.localeCompare(prawy.id));
  const historia = [...zdarzenia].filter((zdarzenie) => filtrZdarzen === 'wszystkie' || zdarzenie.typEncji === filtrZdarzen)
    .sort((lewe, prawe) => prawe.utworzono.localeCompare(lewe.utworzono) || lewe.id.localeCompare(prawe.id));
  const ostatniWpis = [...wpisy].sort((lewy, prawy) => prawy.utworzono.localeCompare(lewy.utworzono))[0];

  return <div className="pulpit">
    <NaglowekSekcji poziom={1} tytul="Centrum Projektowe" opis="Twój pulpit pracy. Stan projektów, ważne sprawy i miejsce, do którego warto wrócić." />
    <div className="siatka-metryk metryki-pulpitu" aria-label="Stan bieżących projektów">
      <KafelekMetryki etykieta="Aktywne projekty" wartosc={biezaceProjekty.filter((projekt) => projekt.status === 'ACTIVE').length} opis="Projekty w statusie Aktywny" />
      <KafelekMetryki etykieta="Otwarte zadania" wartosc={obrazy.flatMap((obraz) => obraz.migawka.aktualnaPraca).filter((praca) => praca.typ === 'TASK').length} opis="Bez zakończonych i porzuconych" />
      <KafelekMetryki etykieta="Aktywne blokady" wartosc={obrazy.flatMap((obraz) => obraz.migawka.blokery).length} opis="Blokady wymagające rozwiązania" />
      <KafelekMetryki etykieta="Wymaga uwagi" wartosc={uwagi.length} opis="Sprawy z Attention Engine" />
    </div>
    <p className="opis-zakresu">Metryki zadań, blokad i uwag obejmują bieżące projekty: bez archiwum, zakończonych i porzuconych.</p>
    <Panel aria-labelledby="szybkie-dzialania">
      <NaglowekSekcji id="szybkie-dzialania" tytul="Szybkie działania" />
      <div className="odnosniki"><Link to="/projekty#nazwa-projektu">Nowy projekt</Link><Link to="/inbox#tresc-wpisu">Nowy wpis</Link><Link to="/inbox">Otwórz Skrzynkę</Link><Link to="/uwaga">Wymaga uwagi</Link></div>
      <div className="wybor-repozytorium"><label htmlFor="repozytorium-pulpitu">Projekt repozytorium</label>
        <select id="repozytorium-pulpitu" value={repozytoriumId ?? ''} disabled={!biezaceProjekty.length} onChange={(zdarzenie) => ustawProjektRepozytorium(zdarzenie.target.value)}>
          {!biezaceProjekty.length && <option value="">Brak bieżących projektów</option>}
          {biezaceProjekty.map((projekt) => <option key={projekt.id} value={projekt.id}>{projekt.nazwa}</option>)}
        </select>
        {repozytoriumId ? <Link to={`/projekty/${repozytoriumId}/repozytoria`}>Repozytoria</Link> : <small>Dodaj projekt, aby otworzyć jego repozytoria.</small>}
      </div>
    </Panel>
    <div className="kolumny-pulpitu">
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
      <Panel aria-labelledby="uwaga-pulpitu">
        <NaglowekSekcji id="uwaga-pulpitu" tytul="Wymaga uwagi" opis="Najpierw najwyższa waga, następnie najnowsze zgłoszenia." />
        {uwagi.length ? <ul className="lista-rekordow lista-uwag-pulpitu">{uwagi.slice(0, 5).map((uwaga) => <li key={uwaga.id}>
          <EtykietaStatusu ton={['CRITICAL', 'HIGH'].includes(uwaga.waga) ? 'blad' : uwaga.waga === 'MEDIUM' ? 'ostrzezenie' : 'neutralny'}>Priorytet: {wagiUwagi[uwaga.waga]}</EtykietaStatusu>
          <h3>{uwaga.tytul}</h3><Link to={`/projekty/${uwaga.projektId}`}>{projekty.find((projekt) => projekt.id === uwaga.projektId)?.nazwa}</Link>
          <p>{uwaga.powod}</p>
          <div className="odnosniki">{uwaga.odnosnikiZrodel.map((zrodlo) => <Link key={`${zrodlo.id}:${zrodlo.adres}`} to={zrodlo.adres}>{zrodlo.tytul}</Link>)}</div>
        </li>)}</ul> : <PustyStan>Brak spraw wymagających uwagi w bieżących projektach.</PustyStan>}
        <div className="odnosniki"><Link to="/uwaga">Wszystkie sprawy ({uwagi.length})</Link></div>
      </Panel>
    </div>
    <Panel aria-labelledby="tytul-projektow">
      <NaglowekSekcji id="tytul-projektow" tytul="Twoje projekty" opis="Wróć do projektu z pełnym kontekstem ostatniej pracy." />
      <div className="filtry-pulpitu">
        <label htmlFor="filtr-projektow">Filtr projektów</label><select id="filtr-projektow" value={filtr} onChange={(zdarzenie) => ustawFiltr(zdarzenie.target.value)}>
          {Object.entries(statusyProjektu).map(([status, etykieta]) => <option key={status} value={status}>{etykieta}</option>)}<option value="wszystkie">Wszystkie (z archiwum)</option>
        </select>
        <label htmlFor="sortowanie-projektow">Sortuj projekty</label><select id="sortowanie-projektow" value={sortowanie} onChange={(zdarzenie) => ustawSortowanie(zdarzenie.target.value)}>
          <option value="aktywnosc">Ostatnia aktywność</option><option value="status">Status (A–Z)</option>
        </select>
      </div>
      {widoczneProjekty.length ? <ul className="lista-rekordow karty-projektow">{widoczneProjekty.map((projekt) => <li key={projekt.id}>
        <h3><Link to={`/projekty/${projekt.id}`}>{projekt.nazwa}</Link></h3>
        <EtykietaStatusu ton={projekt.zarchiwizowano ? 'neutralny' : projekt.status === 'ACTIVE' ? 'sukces' : ['PAUSED', 'BLOCKED'].includes(projekt.status) ? 'ostrzezenie' : 'akcent'}>{statusyProjektu[projekt.status]}{projekt.zarchiwizowano ? ' · Archiwalny' : ''}</EtykietaStatusu>
        <p><small>Ostatnia aktywność: {formatujDate(projekt.ostatniaAktywnosc)}</small></p>
        <h4>Aktualny stan</h4><p>{skroc(projekt.podsumowanieAktualnegoStanu) || 'Nie uzupełniono.'}</p>
        <h4>Ostatnio wykonywana praca</h4><p>{skroc(projekt.ostatnioPracowanoNad) || 'Nie uzupełniono.'}</p>
        <h4>Następny krok</h4><p>{skroc(projekt.nastepnyKrok) || 'Nie uzupełniono.'}</p>
        <p>Aktywne blokady: {obrazyProjektow.find((obraz) => obraz.migawka.projektId === projekt.id)?.migawka.blokery.length ?? 0}</p>
        <Link to={`/projekty/${projekt.id}`}>Otwórz projekt</Link>
      </li>)}</ul> : <PustyStan>Brak projektów dla wybranego filtra.</PustyStan>}
    </Panel>
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
    <Panel aria-labelledby="tytul-ostatniego-wpisu">
      <NaglowekSekcji id="tytul-ostatniego-wpisu" tytul="Ostatnio zapisany wpis" />
      {ostatniWpis ? <><p className="surowy-wpis">{ostatniWpis.trescOryginalna}</p><small>{formatujDate(ostatniWpis.utworzono)}</small></> : <PustyStan>Nie masz jeszcze wpisów. Zacznij od zapisania myśli w Skrzynce.</PustyStan>}
      <p>W Skrzynce możesz analizować wpisy, weryfikować propozycje i stosować zatwierdzone elementy.</p>
    </Panel>
  </div>;
}
