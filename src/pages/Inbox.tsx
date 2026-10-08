import { useState, type FormEvent } from 'react';
import type { Projekt, Wpis } from '../domain/modele';
import { formatujDate } from '../shared/formatujDate';

export function Inbox({ projekty, wpisy, dodajWpis }: {
  projekty: Projekt[];
  wpisy: Wpis[];
  dodajWpis: (tresc: string, projektId: string | null) => Promise<void>;
}) {
  const [tresc, ustawTresc] = useState('');
  const [projektId, ustawProjektId] = useState('');
  const [zapisywanie, ustawZapisywanie] = useState(false);
  const [blad, ustawBlad] = useState('');
  const [komunikat, ustawKomunikat] = useState('');

  async function zapisz(zdarzenie: FormEvent<HTMLFormElement>) {
    zdarzenie.preventDefault();
    ustawBlad('');
    ustawKomunikat('');
    ustawZapisywanie(true);
    try {
      await dodajWpis(tresc, projektId || null);
      ustawTresc('');
      ustawKomunikat('Oryginalny wpis zapisany lokalnie.');
    } catch {
      ustawBlad('Nie udało się zapisać wpisu. Treść pozostaje w formularzu. Spróbuj ponownie.');
    } finally { ustawZapisywanie(false); }
  }

  return <>
    <h1>Inbox</h1>
    <p>Zachowaj surową myśl. Oryginał zostanie zapisany bez zmian.</p>
    <form onSubmit={zapisz}>
      <label htmlFor="tresc-wpisu">Treść wpisu</label>
      <textarea id="tresc-wpisu" rows={6} value={tresc} onChange={(zdarzenie) => ustawTresc(zdarzenie.target.value)} required disabled={zapisywanie} />
      <label htmlFor="projekt-wpisu">Projekt</label>
      <select id="projekt-wpisu" value={projektId} onChange={(zdarzenie) => ustawProjektId(zdarzenie.target.value)} disabled={zapisywanie}>
        <option value="">Bez przypisania</option>
        {projekty.filter((projekt) => !projekt.zarchiwizowano).map((projekt) => <option key={projekt.id} value={projekt.id}>{projekt.nazwa}</option>)}
      </select>
      <button disabled={zapisywanie || !tresc.trim()}>{zapisywanie ? 'Zapisywanie…' : 'Zapisz wpis'}</button>
      {blad && <p role="alert">{blad}</p>}
      <p role="status">{komunikat}</p>
    </form>
    <h2>Zapisane wpisy</h2>
    {wpisy.length === 0 ? <p>Inbox jest pusty.</p> : <ul className="lista-rekordow">{[...wpisy].sort((lewy, prawy) => prawy.utworzono.localeCompare(lewy.utworzono)).map((wpis) => <li key={wpis.id}>
      <p className="surowy-wpis">{wpis.trescOryginalna}</p>
      <small>{wpis.projektId ? projekty.find((projekt) => projekt.id === wpis.projektId)?.nazwa ?? 'Nieznany projekt' : 'Bez przypisania'} · {formatujDate(wpis.utworzono)} · Nowy</small>
    </li>)}</ul>}
  </>;
}
