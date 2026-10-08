import { Link } from 'react-router-dom';
import { useState } from 'react';
import { statusyProjektu, type Projekt, type Wpis } from '../domain/modele';
import { formatujDate } from '../shared/formatujDate';

export function Start({ projekty, wpisy }: { projekty: Projekt[]; wpisy: Wpis[] }) {
  const ostatniWpis = [...wpisy].sort((lewy, prawy) => prawy.utworzono.localeCompare(lewy.utworzono))[0];
  const [filtr, ustawFiltr] = useState('wszystkie');
  const widoczneProjekty = projekty.filter((projekt) => filtr === 'wszystkie'
    || (!projekt.zarchiwizowano && projekt.status === filtr))
    .sort((lewy, prawy) => prawy.ostatniaAktywnosc.localeCompare(lewy.ostatniaAktywnosc));
  function skroc(tresc: string): string {
    return tresc.length > 160 ? `${tresc.slice(0, 160)}…` : tresc;
  }
  return (
    <>
      <h1>Centrum Projektowe</h1>
      <p>Prywatna pamięć projektowa. Zapisuj pomysły i wracaj do swoich projektów.</p>
      <section aria-labelledby="tytul-podsumowania">
        <h2 id="tytul-podsumowania">Twój punkt startowy</h2>
        <p>Projekty: {projekty.length} · Surowe wpisy: {wpisy.length}</p>
        <div className="odnosniki"><Link to="/projekty">Otwórz projekty</Link><Link to="/inbox">Zapisz wpis w Inbox</Link></div>
      </section>
      <section aria-labelledby="tytul-projektow">
        <h2 id="tytul-projektow">Twoje projekty</h2>
        <label htmlFor="filtr-projektow">Filtr projektów</label>
        <select id="filtr-projektow" value={filtr} onChange={(zdarzenie) => ustawFiltr(zdarzenie.target.value)}>
          <option value="ACTIVE">Aktywne</option>
          <option value="IDEA">Pomysły</option>
          <option value="PAUSED">Wstrzymane</option>
          <option value="wszystkie">Wszystkie</option>
        </select>
        <p>Filtry odpowiadają statusom projektów. „Wszystkie” obejmuje także archiwum.</p>
        {widoczneProjekty.length === 0 ? <p>Brak projektów dla wybranego filtra.</p> : <ul className="lista-rekordow karty-projektow">{widoczneProjekty.map((projekt) => <li key={projekt.id}>
          <h3><Link to={`/projekty/${projekt.id}`}>{projekt.nazwa}</Link></h3>
          <p>{statusyProjektu[projekt.status]}{projekt.zarchiwizowano ? ' · Archiwalny' : ''}</p>
          <small>Ostatnia aktywność: {formatujDate(projekt.ostatniaAktywnosc)}</small>
          <h4>Aktualny stan</h4><p>{skroc(projekt.podsumowanieAktualnegoStanu) || 'Nie uzupełniono.'}</p>
          <h4>Następny krok</h4><p>{skroc(projekt.nastepnyKrok) || 'Nie uzupełniono.'}</p>
        </li>)}</ul>}
      </section>
      <section aria-labelledby="tytul-ostatniego-wpisu">
        <h2 id="tytul-ostatniego-wpisu">Ostatnio zapisany wpis</h2>
        {ostatniWpis ? <><p className="surowy-wpis">{ostatniWpis.trescOryginalna}</p><small>{formatujDate(ostatniWpis.utworzono)}</small></> : <p>Nie masz jeszcze wpisów. Zacznij od zapisania myśli w Inbox.</p>}
        <p>Punkt powrotu uzupełnisz na stronie projektu. Analiza wpisów będzie dostępna w kolejnym etapie.</p>
      </section>
    </>
  );
}
