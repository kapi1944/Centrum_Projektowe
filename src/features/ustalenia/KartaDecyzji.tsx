import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { etykietyZrodel, type Projekt, type Wpis } from '../../domain/modele';
import { statusyDecyzji, typyElementow, type Decyzja, type OperacjaUstalen, type AnalizaWplywu, type StatusDecyzji } from '../../domain/ustalenia';
import { formatujDate } from '../../shared/formatujDate';
import { typyPracy, statusyPracy, type ElementPracy } from '../../domain/realizacja';
import { FormularzDecyzji } from './FormularzDecyzji';
import { PanelWplywu } from './PanelWplywu';

export function KartaDecyzji({ decyzja, decyzje, projekty, wpisy, analizy, projektId, wykonaj, elementyPracy }: {
  elementyPracy: ElementPracy[];
  decyzja: Decyzja; decyzje: Decyzja[]; projekty: Projekt[]; wpisy: Wpis[];
  analizy: AnalizaWplywu[]; projektId: string; wykonaj: (operacja: OperacjaUstalen) => Promise<void>;
}) {
  const [status, ustawStatus] = useState<Exclude<StatusDecyzji, 'SUPERSEDED'>>(decyzja.status === 'SUPERSEDED' ? 'ACCEPTED' : decyzja.status);
  const [zastepowanie, ustawZastepowanie] = useState(false);
  const [zapisywanie, ustawZapisywanie] = useState(false);
  const blokada = useRef(false);
  const [blad, ustawBlad] = useState('');
  async function zmienStatus() {
    if (blokada.current) return;
    blokada.current = true;
    ustawZapisywanie(true);
    ustawBlad('');
    try { await wykonaj({ rodzaj: 'status', id: decyzja.id, status, wersja: decyzja.wersja }); }
    catch (blad) { ustawBlad(blad instanceof Error ? blad.message : 'Nie udało się zmienić statusu.'); }
    finally { blokada.current = false; ustawZapisywanie(false); }
  }
  function odnosnik(id: string) {
    return <Link to={`/projekty/${projektId}/ustalenia?decyzja=${encodeURIComponent(id)}`}>{decyzje.find((decyzja) => decyzja.id === id)?.czytelneId ?? id}</Link>;
  }
  const wpis = wpisy.find((wpis) => wpis.id === decyzja.wpisZrodlowyId);
  const zastapione = decyzje.filter((poprzednia) => poprzednia.zastapionaPrzezId === decyzja.id);
  return <article id={`decyzja-${decyzja.id}`} aria-label={`${decyzja.czytelneId}: ${decyzja.tytul}`}>
    <h2>{decyzja.czytelneId} · {decyzja.tytul}</h2>
    <p className="surowy-wpis">{decyzja.opis}</p>
    <p>Status: {statusyDecyzji[decyzja.status]}</p>
    <p>Projekty: {decyzja.projektIds.map((id) => <Link key={id} to={`/projekty/${id}/ustalenia`}>{projekty.find((projekt) => projekt.id === id)?.nazwa ?? id}{' '}</Link>)}</p>
    <p>Źródło: {decyzja.analizaWpisuId ? etykietyZrodel[decyzja.typZrodla] : <>{decyzja.nazwaZrodla} ({etykietyZrodel[decyzja.typZrodla]})</>} {!decyzja.analizaWpisuId && decyzja.odniesienieZrodla}</p>
    {decyzja.analizaWpisuId && <>
      <p>Analiza źródłowa: zatwierdzony element analizy. Przyjęcie decyzji wymaga osobnego zatwierdzenia.</p>
      <details><summary>Szczegóły techniczne</summary><p>Nazwa dostawcy: {decyzja.nazwaZrodla} · Identyfikator analizy: {decyzja.analizaWpisuId} · Identyfikator elementu: {decyzja.elementAnalizyId}</p></details>
    </>}
    {wpis && <details><summary>Powiązany wpis — oryginał</summary><p className="surowy-wpis">{wpis.trescOryginalna}</p><Link to={`/inbox?wpis=${encodeURIComponent(wpis.id)}`}>Otwórz wpis w Skrzynce</Link></details>}
    <h3>Powiązane elementy pracy</h3>
    {elementyPracy.some((praca) => praca.decyzjaIds.includes(decyzja.id)) ? <ul>{elementyPracy.filter((praca) => praca.decyzjaIds.includes(decyzja.id)).map((praca) => <li key={praca.id}><Link to={`/projekty/${praca.projektId}#praca-${praca.id}`}>{praca.tytul}</Link> · {typyPracy[praca.typ]} · {statusyPracy[praca.status]}</li>)}</ul> : <p>Brak powiązanych elementów pracy. Możesz powiązać decyzje podczas tworzenia lub edycji pracy w projekcie.</p>}
    {decyzja.notatki && <p className="surowy-wpis">Notatki: {decyzja.notatki}</p>}
    <ul>{decyzja.powiazaneElementy.map((element, numer) => <li key={numer}>{typyElementow[element.typ]}: {element.tytul} ({element.id}) — odnośnik ręczny</li>)}</ul>
    {decyzja.zastapionaPrzezId && <p>Zastąpione przez {odnosnik(decyzja.zastapionaPrzezId)}</p>}
    {zastapione.map((poprzednia) => <p key={poprzednia.id}>Zastępuje {odnosnik(poprzednia.id)}</p>)}
    <small>Utworzono: {formatujDate(decyzja.utworzono)} · Aktualizacja: {formatujDate(decyzja.zaktualizowano)}</small>
    {decyzja.status !== 'SUPERSEDED' && <>
      <label htmlFor={`status-${decyzja.id}`}>Nowy status {decyzja.czytelneId}</label>
      <select id={`status-${decyzja.id}`} value={status} onChange={(zdarzenie) => ustawStatus(zdarzenie.target.value as Exclude<StatusDecyzji, 'SUPERSEDED'>)} disabled={zapisywanie}>
        {Object.entries(statusyDecyzji).filter(([status]) => status !== 'SUPERSEDED').map(([status, nazwa]) => <option key={status} value={status}>{nazwa}</option>)}
      </select>
      <button disabled={zapisywanie || status === decyzja.status} onClick={() => void zmienStatus()}>Zmień status</button>
    </>}
    {!['SUPERSEDED', 'REJECTED', 'PROPOSED'].includes(decyzja.status) && <button disabled={zapisywanie} onClick={() => ustawZastepowanie(!zastepowanie)}>{zastepowanie ? 'Zamknij formularz zastąpienia' : 'Zastąp nową decyzją'}</button>}
    {zastepowanie && <><p>Nowa decyzja zostanie zaakceptowana i zastąpi dotychczasową. Musi obejmować wszystkie jej projekty.</p><FormularzDecyzji poczatkowe={decyzja} projekty={projekty} wpisy={wpisy} prefiks={decyzja.id} etykieta="Zatwierdź zastąpienie decyzji" zapisz={async (dane) => {
      await wykonaj({ rodzaj: 'zastap', id: decyzja.id, wersja: decyzja.wersja, noweId: crypto.randomUUID(), dane });
      ustawZastepowanie(false);
    }} /></>}
    {blad && <p role="alert">{blad}</p>}
    <PanelWplywu zrodlo={{ typ: 'DECISION', id: decyzja.id }} analizy={analizy} wykonaj={wykonaj} />
  </article>;
}
