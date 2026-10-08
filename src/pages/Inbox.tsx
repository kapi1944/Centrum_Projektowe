import { useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { etykietyStatusowWpisu, type AkcjaWpisu, type Projekt, type Wpis } from '../domain/modele';
import { AkcjeWpisu } from '../features/inbox/AkcjeWpisu';
import { formatujDate } from '../shared/formatujDate';
import type { AnalizaWplywu, OperacjaUstalen } from '../domain/ustalenia';
import { PanelWplywu } from '../features/ustalenia/PanelWplywu';

export function Inbox({ projekty, wpisy, dodajWpis, wykonajAkcjeWpisu, analizy, wykonajUstalenie }: {
  projekty: Projekt[];
  wpisy: Wpis[];
  dodajWpis: (tresc: string, projektId: string | null) => Promise<void>;
  wykonajAkcjeWpisu: (id: string, akcja: AkcjaWpisu) => Promise<void>;
  analizy: AnalizaWplywu[];
  wykonajUstalenie: (operacja: OperacjaUstalen) => Promise<void>;
}) {
  const [tresc, ustawTresc] = useState('');
  const [projektId, ustawProjektId] = useState('');
  const [zapisywanie, ustawZapisywanie] = useState(false);
  const [blad, ustawBlad] = useState('');
  const [komunikat, ustawKomunikat] = useState('');
  const [pokazOdrzucone, ustawPokazOdrzucone] = useState(false);
  const poleWpisu = useRef<HTMLTextAreaElement>(null);
  const blokadaZapisu = useRef(false);
  const [parametry] = useSearchParams();
  const widoczneWpisy = wpisy.filter((wpis) => pokazOdrzucone || wpis.status !== 'DISMISSED' || wpis.id === parametry.get('wpis'));

  async function zapisz(zdarzenie: FormEvent<HTMLFormElement>) {
    zdarzenie.preventDefault();
    if (blokadaZapisu.current || !tresc.trim()) return;
    blokadaZapisu.current = true;
    ustawBlad('');
    ustawKomunikat('');
    ustawZapisywanie(true);
    try {
      await dodajWpis(tresc, projektId || null);
      ustawTresc('');
      ustawKomunikat('Oryginalny wpis zapisany lokalnie.');
    } catch {
      ustawBlad('Nie udało się zapisać wpisu. Treść pozostaje w formularzu. Spróbuj ponownie.');
    } finally {
      blokadaZapisu.current = false;
      ustawZapisywanie(false);
      requestAnimationFrame(() => poleWpisu.current?.focus());
    }
  }

  return <>
    <h1>Inbox</h1>
    <p>Zachowaj surową myśl. Oryginał zostanie zapisany bez zmian.</p>
    <form onSubmit={zapisz}>
      <label htmlFor="tresc-wpisu">Co chcesz zapisać?</label>
      <textarea ref={poleWpisu} id="tresc-wpisu" rows={7} value={tresc} onChange={(zdarzenie) => ustawTresc(zdarzenie.target.value)} required disabled={zapisywanie} aria-describedby="skrot-zapisu" onKeyDown={(zdarzenie) => {
        if ((zdarzenie.ctrlKey || zdarzenie.metaKey) && zdarzenie.key === 'Enter') {
          zdarzenie.preventDefault();
          if (!zdarzenie.repeat && !zdarzenie.nativeEvent.isComposing && !blokadaZapisu.current) zdarzenie.currentTarget.form?.requestSubmit();
        }
      }} />
      <small id="skrot-zapisu">Ctrl+Enter (na Macu ⌘+Enter) zapisuje. Enter dodaje nową linię.</small>
      <label htmlFor="projekt-wpisu">Projekt</label>
      <select id="projekt-wpisu" value={projektId} onChange={(zdarzenie) => ustawProjektId(zdarzenie.target.value)} disabled={zapisywanie}>
        <option value="">Bez przypisania</option>
        {projekty.filter((projekt) => !projekt.zarchiwizowano).map((projekt) => <option key={projekt.id} value={projekt.id}>{projekt.nazwa}</option>)}
      </select>
      <button disabled={zapisywanie || !tresc.trim()}>{zapisywanie ? 'Zapisywanie…' : 'Zapisz'}</button>
      {blad && <p role="alert">{blad}</p>}
      <p role="status">{komunikat}</p>
    </form>
    <h2>Zapisane wpisy</h2>
    <label><input type="checkbox" checked={pokazOdrzucone} onChange={(zdarzenie) => ustawPokazOdrzucone(zdarzenie.target.checked)} /> Pokaż odrzucone</label>
    {widoczneWpisy.length === 0 ? <p>Brak wpisów w tym widoku.</p> : <ul className="lista-rekordow">{[...widoczneWpisy].sort((lewy, prawy) => prawy.utworzono.localeCompare(lewy.utworzono)).map((wpis) => <li key={wpis.id} id={`wpis-${wpis.id}`}>
      <p className="surowy-wpis">{wpis.trescOryginalna}</p>
      <small>{wpis.projektId ? <Link to={`/projekty/${wpis.projektId}`}>{projekty.find((projekt) => projekt.id === wpis.projektId)?.nazwa ?? 'Nieznany projekt'}</Link> : 'Bez przypisania'} · {formatujDate(wpis.utworzono)} · {etykietyStatusowWpisu[wpis.status]}{wpis.odlozonoDoAnalizy ? ' · Do analizy później' : ''}</small>
      <AkcjeWpisu wpis={wpis} projekty={projekty} wykonajAkcje={wykonajAkcjeWpisu} />
      <PanelWplywu zrodlo={{ typ: 'CAPTURE', id: wpis.id }} analizy={analizy} wykonaj={wykonajUstalenie} />
    </li>)}</ul>}
  </>;
}
