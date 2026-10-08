import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { statusyProjektu, type Projekt as ModelProjektu, type ZdarzenieAktywnosci, type ZmianaProjektu } from '../domain/modele';
import { FormularzProjektu } from '../features/projekty/FormularzProjektu';
import { formatujDate } from '../shared/formatujDate';

export function Projekt({ projekty, zdarzenia, zmienProjekt }: {
  projekty: ModelProjektu[];
  zdarzenia: ZdarzenieAktywnosci[];
  zmienProjekt: (id: string, zmiana: ZmianaProjektu) => Promise<void>;
}) {
  const { projektId } = useParams();
  const projekt = projekty.find((projekt) => projekt.id === projektId);
  const [blad, ustawBlad] = useState('');
  const [archiwizowanie, ustawArchiwizowanie] = useState(false);
  const [edycja, ustawEdycje] = useState(false);
  if (!projekt) return <><h1>Nie znaleziono projektu</h1><Link to="/projekty">Wróć do projektów</Link></>;

  async function archiwizuj() {
    if (!projekt) return;
    ustawBlad('');
    ustawArchiwizowanie(true);
    try { await zmienProjekt(projekt.id, { rodzaj: 'archiwizacja' }); }
    catch { ustawBlad('Nie udało się zarchiwizować projektu. Spróbuj ponownie.'); }
    finally { ustawArchiwizowanie(false); }
  }

  const historia = zdarzenia.filter((zdarzenie) => zdarzenie.projektId === projekt.id)
    .sort((lewe, prawe) => prawe.utworzono.localeCompare(lewe.utworzono)).slice(0, 20);

  return <>
    <Link to="/projekty">Wszystkie projekty</Link>
    <h1>{projekt.nazwa}</h1>
    <p>{statusyProjektu[projekt.status]}</p>
    {projekt.zarchiwizowano && <p role="status">Projekt archiwalny od {formatujDate(projekt.zarchiwizowano)}. Dane i historia zostały zachowane.</p>}
    <p className="surowy-wpis">{projekt.opis || 'Brak opisu.'}</p>
    <p>Ostatnia aktywność: {formatujDate(projekt.ostatniaAktywnosc)}</p>
    <small>Utworzono: {formatujDate(projekt.utworzono)} · Zaktualizowano: {formatujDate(projekt.zaktualizowano)}</small>
    <section aria-labelledby="pamiec-projektu">
      <h2 id="pamiec-projektu">Pamięć projektu</h2>
      <h3>Podsumowanie aktualnego stanu</h3><p className="surowy-wpis">{projekt.podsumowanieAktualnegoStanu || 'Nie uzupełniono.'}</p>
      <h3>Ostatnio pracowano nad</h3><p className="surowy-wpis">{projekt.ostatnioPracowanoNad || 'Nie uzupełniono.'}</p>
      <h3>Następny krok</h3><p className="surowy-wpis">{projekt.nastepnyKrok || 'Nie uzupełniono.'}</p>
    </section>
    {!projekt.zarchiwizowano && <>
      <button onClick={() => ustawEdycje(!edycja)} disabled={archiwizowanie}>{edycja ? 'Zamknij edycję' : 'Edytuj projekt'}</button>
      {edycja && <FormularzProjektu key={projekt.id} poczatkoweDane={projekt} etykietaPrzycisku="Zapisz zmiany" zapiszDane={async (dane) => {
        await zmienProjekt(projekt.id, { rodzaj: 'edycja', dane });
        ustawEdycje(false);
      }} />}
      {!edycja && <p><button onClick={archiwizuj} disabled={archiwizowanie}>{archiwizowanie ? 'Archiwizowanie…' : 'Archiwizuj projekt'}</button></p>}
    </>}
    {blad && <p role="alert">{blad}</p>}
    <section aria-labelledby="historia-projektu">
      <h2 id="historia-projektu">Historia projektu</h2>
      <p>Ostatnie 20 zdarzeń. Historia jest rejestrowana od Etapu 1.</p>
      {historia.length === 0 ? <p>Brak zarejestrowanych zdarzeń.</p> : <ol className="lista-rekordow">{historia.map((zdarzenie) => <li key={zdarzenie.id}>
        <strong>{zdarzenie.tytul}</strong>
        <p>{formatujDate(zdarzenie.utworzono)} · {zdarzenie.typEncji === 'PROJECT' ? 'Projekt' : 'Wpis'} · {zdarzenie.zrodlo.nazwa} ({zdarzenie.zrodlo.typ})</p>
        {zdarzenie.opis && <p className="surowy-wpis">{zdarzenie.opis}</p>}
      </li>)}</ol>}
    </section>
  </>;
}
