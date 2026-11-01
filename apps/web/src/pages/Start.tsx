import { Link } from 'react-router-dom';
import { useState } from 'react';
import { statusyProjektu, type Projekt, type Wpis } from '../domain/modele';
import { formatujDate } from '../shared/formatujDate';
import { EtykietaStatusu, KafelekMetryki, NaglowekSekcji, Panel, PustyStan } from '../shared/Komponenty';

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
      <NaglowekSekcji poziom={1} tytul="Centrum Projektowe" opis="Prywatna pamięć projektowa. Zapisuj pomysły i wracaj do swoich projektów." />
      <div className="siatka-metryk">
        <KafelekMetryki etykieta="Wszystkie projekty" wartosc={projekty.length} opis="Łącznie z archiwum" />
        <KafelekMetryki etykieta="Aktywne projekty" wartosc={projekty.filter((projekt) => !projekt.zarchiwizowano && projekt.status === 'ACTIVE').length} opis="Przestrzeń na bieżącą pracę" />
        <KafelekMetryki etykieta="Surowe wpisy" wartosc={wpisy.length} opis="Oryginały zachowane w Skrzynce" />
      </div>
      <Panel aria-labelledby="tytul-podsumowania">
        <NaglowekSekcji id="tytul-podsumowania" tytul="Twój punkt startowy" opis="Wróć do pracy lub zachowaj nową myśl." />
        <div className="odnosniki"><Link to="/projekty">Otwórz projekty</Link><Link to="/inbox">Zapisz nowy wpis</Link></div>
      </Panel>
      <Panel aria-labelledby="tytul-projektow">
        <NaglowekSekcji id="tytul-projektow" tytul="Twoje projekty" opis="Ostatnia aktywność, aktualny stan i następny krok." />
        <label htmlFor="filtr-projektow">Filtr projektów</label>
        <select id="filtr-projektow" value={filtr} onChange={(zdarzenie) => ustawFiltr(zdarzenie.target.value)}>
          <option value="ACTIVE">Aktywne</option>
          <option value="IDEA">Pomysły</option>
          <option value="PAUSED">Wstrzymane</option>
          <option value="wszystkie">Wszystkie</option>
        </select>
        <p>Filtry odpowiadają statusom projektów. „Wszystkie” obejmuje także archiwum.</p>
        {widoczneProjekty.length === 0 ? <PustyStan>Brak projektów dla wybranego filtra.</PustyStan> : <ul className="lista-rekordow karty-projektow">{widoczneProjekty.map((projekt) => <li key={projekt.id}>
          <h3><Link to={`/projekty/${projekt.id}`}>{projekt.nazwa}</Link></h3>
          <p><EtykietaStatusu ton={projekt.zarchiwizowano ? 'neutralny' : projekt.status === 'ACTIVE' ? 'sukces' : projekt.status === 'PAUSED' ? 'ostrzezenie' : 'akcent'}>{statusyProjektu[projekt.status]}{projekt.zarchiwizowano ? ' · Archiwalny' : ''}</EtykietaStatusu></p>
          <small>Ostatnia aktywność: {formatujDate(projekt.ostatniaAktywnosc)}</small>
          <h4>Aktualny stan</h4><p>{skroc(projekt.podsumowanieAktualnegoStanu) || 'Nie uzupełniono.'}</p>
          <h4>Następny krok</h4><p>{skroc(projekt.nastepnyKrok) || 'Nie uzupełniono.'}</p>
        </li>)}</ul>}
      </Panel>
      <Panel aria-labelledby="tytul-ostatniego-wpisu">
        <NaglowekSekcji id="tytul-ostatniego-wpisu" tytul="Ostatnio zapisany wpis" />
        {ostatniWpis ? <><p className="surowy-wpis">{ostatniWpis.trescOryginalna}</p><small>{formatujDate(ostatniWpis.utworzono)}</small></> : <PustyStan>Nie masz jeszcze wpisów. Zacznij od zapisania myśli w Skrzynce.</PustyStan>}
        <p>Punkt powrotu uzupełnisz na stronie projektu. W Skrzynce możesz analizować wpisy, weryfikować propozycje i stosować zatwierdzone elementy.</p>
      </Panel>
    </>
  );
}
