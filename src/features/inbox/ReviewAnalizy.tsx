import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { etykietyDostawcowAnalizy, etykietyStatusowAnalizy, etykietyReview, typyAnalizy, type AnalizaWpisu, type OperacjaAnalizyWpisu, type TypElementuAnalizy } from '../../domain/analizaWpisu';
import { etykietyZrodel, type Projekt, type Wpis } from '../../domain/modele';
import { formatujDate } from '../../shared/formatujDate';

export function ReviewAnalizy({ wpis, analiza, projekty, analizuj, wykonaj }: {
  wpis: Wpis; analiza?: AnalizaWpisu; projekty: Projekt[];
  analizuj: (wpisId: string) => Promise<void>;
  wykonaj: (operacja: OperacjaAnalizyWpisu) => Promise<void>;
}) {
  const [blad, ustawBlad] = useState('');
  const [zapisywanie, ustawZapisywanie] = useState(false);
  const blokada = useRef(false);
  const [edytowanyId, ustawEdytowanyId] = useState<string | null>(null);
  const [tresc, ustawTresc] = useState('');
  const [projektId, ustawProjektId] = useState('');
  async function zapisz(operacja: () => Promise<void>) {
    if (blokada.current) return;
    blokada.current = true;
    ustawZapisywanie(true);
    ustawBlad('');
    try { await operacja(); ustawEdytowanyId(null); }
    catch (blad) { ustawBlad(blad instanceof Error ? blad.message : 'Nie udało się zapisać analizy.'); }
    finally { blokada.current = false; ustawZapisywanie(false); }
  }
  const zatwierdzone = analiza?.elementy.filter((element) => element.statusReview === 'ACCEPTED' || element.statusReview === 'EDITED') ?? [];
  const wymagaProjektu = zatwierdzone.some((element) => element.typ === 'POSSIBLE_DECISION' || element.typ === 'IMPACT_CANDIDATE');
  return <section aria-label="Analiza wpisu i weryfikacja">
    {!analiza && wpis.status === 'UNPROCESSED' && <button disabled={zapisywanie} onClick={() => void zapisz(() => analizuj(wpis.id))}>Analizuj</button>}
    {analiza && <>
      <h3>Analiza wpisu</h3>
      <p>ORYGINAŁ ≠ ANALIZA ≠ DECYZJA. Akceptacja założenia zachowuje założenie, nie potwierdza faktu.</p>
      <p>{formatujDate(analiza.utworzono)}</p>
      <details><summary>Szczegóły techniczne</summary>
        <p>Typ dostawcy: {etykietyDostawcowAnalizy[analiza.typDostawcy]}</p>
        <p>Nazwa dostawcy: {analiza.nazwaDostawcy ?? 'Nie podano'} · Wersja dostawcy: {analiza.wersjaDostawcy ?? 'Nie podano'}</p>
        <p>Wersja analizy: {analiza.wersjaAnalizy} · Wersja zapisu: {analiza.wersja} · Identyfikator analizy: {analiza.id}</p>
      </details>
      <p>{analiza.klasyfikacja} · {etykietyStatusowAnalizy[analiza.status]}</p>
      <p className="surowy-wpis">{analiza.podsumowanie}</p>
      <p>Reguły rozpoznają tylko jawne zwroty i pytania. Nie ustalają prawdziwości faktów, zależności ani intencji. Puste sekcje oznaczają brak rozpoznania.</p>
      {analiza.status === 'GENERATED' && <button disabled={zapisywanie} onClick={() => void zapisz(() => wykonaj({ rodzaj: 'rozpocznij', id: analiza.id, wersja: analiza.wersja }))}>Rozpocznij weryfikację</button>}
      {(Object.keys(typyAnalizy) as TypElementuAnalizy[]).map((typ) => <section key={typ} aria-label={typyAnalizy[typ]}>
        <h4>{typyAnalizy[typ]}</h4>
        {!analiza.elementy.some((element) => element.typ === typ) && <p>Brak rozpoznanych elementów.</p>}
        {analiza.elementy.filter((element) => element.typ === typ).map((element) => <article key={element.id} aria-label={`${typyAnalizy[typ]}: ${element.trescOryginalna}`}>
          <p className="surowy-wpis">{element.trescEdytowana ?? element.trescOryginalna}</p>
          <p>{etykietyReview[element.statusReview]} · źródło: {etykietyZrodel[element.zrodlo]}</p>
          {element.trescEdytowana !== undefined && <p className="surowy-wpis">Oryginalna propozycja systemu: {element.trescOryginalna}</p>}
          {analiza.status === 'IN_REVIEW' && <fieldset disabled={zapisywanie}>
            <legend>Ocena elementu</legend>
            <button onClick={() => void zapisz(() => wykonaj({ rodzaj: 'review', id: analiza.id, wersja: analiza.wersja, elementId: element.id, status: element.trescEdytowana !== undefined ? 'EDITED' : 'ACCEPTED', trescEdytowana: element.trescEdytowana }))}>Akceptuj</button>
            <button onClick={() => { ustawEdytowanyId(element.id); ustawTresc(element.trescEdytowana ?? element.trescOryginalna); }}>Edytuj</button>
            <button onClick={() => void zapisz(() => wykonaj({ rodzaj: 'review', id: analiza.id, wersja: analiza.wersja, elementId: element.id, status: 'REJECTED' }))}>Odrzuć</button>
            {edytowanyId === element.id && <>
              <label htmlFor={`edycja-${element.id}`}>Treść po edycji</label>
              <textarea id={`edycja-${element.id}`} value={tresc} onChange={(zdarzenie) => ustawTresc(zdarzenie.target.value)} />
              <button disabled={!tresc.trim()} onClick={() => void zapisz(() => wykonaj({ rodzaj: 'review', id: analiza.id, wersja: analiza.wersja, elementId: element.id, status: 'EDITED', trescEdytowana: tresc }))}>Zatwierdź edycję</button>
              <button onClick={() => ustawEdytowanyId(null)}>Anuluj edycję</button>
            </>}
          </fieldset>}
          {!!element.historiaReview.length && <details><summary>Historia weryfikacji</summary><ol>{element.historiaReview.map((zmiana, numer) => <li key={numer}>
            {etykietyReview[zmiana.status]} · {formatujDate(zmiana.czas)} · {zmiana.zrodlo.nazwa} ({etykietyZrodel[zmiana.zrodlo.typ]})
            {zmiana.trescEdytowana !== undefined && <p className="surowy-wpis">{zmiana.trescEdytowana}</p>}
          </li>)}</ol></details>}
          {element.zastosowanie && <p>Zastosowano: {element.zastosowanie.rodzaj === 'RETAINED' ? 'zachowano zatwierdzony element analizy' : element.zastosowanie.rodzaj === 'DECISION' ? 'utworzono propozycję decyzji' : 'uruchomiono analizę wpływu — wymaga osobnego zatwierdzenia'} · {formatujDate(element.zastosowanie.czas)}
            {element.zastosowanie.rodzaj === 'DECISION' && <>{' '}<Link to={`/projekty/${element.zastosowanie.projektId}/ustalenia?decyzja=${encodeURIComponent(element.zastosowanie.encjaId!)}`}>Otwórz decyzję</Link></>}
          </p>}
        </article>)}
      </section>)}
      {analiza.status === 'IN_REVIEW' && <button disabled={zapisywanie || edytowanyId !== null || analiza.elementy.some((element) => element.statusReview === 'PENDING')}
        onClick={() => void zapisz(() => wykonaj({ rodzaj: 'zakoncz', id: analiza.id, wersja: analiza.wersja }))}>Zakończ weryfikację</button>}
      {analiza.status === 'REVIEWED' && <>
        {!wpis.projektId && wymagaProjektu && <>
          <label htmlFor={`cel-${analiza.id}`}>Projekt dla zatwierdzonych decyzji i wpływu</label>
          <select id={`cel-${analiza.id}`} value={projektId} onChange={(zdarzenie) => ustawProjektId(zdarzenie.target.value)} disabled={zapisywanie}>
            <option value="">Wybierz projekt</option>
            {projekty.filter((projekt) => !projekt.zarchiwizowano).map((projekt) => <option key={projekt.id} value={projekt.id}>{projekt.nazwa}</option>)}
          </select>
        </>}
        <p>Potencjalne decyzje trafią do propozycji. Wpływ wymaga osobnego zatwierdzenia. Pozostałe elementy zostaną zachowane ze swoim typem; działania i pytania czekają na Etap 5.</p>
        <button disabled={zapisywanie || !zatwierdzone.length || (wymagaProjektu && !wpis.projektId && !projektId)}
          onClick={() => void zapisz(() => wykonaj({ rodzaj: 'zastosuj', id: analiza.id, wersja: analiza.wersja, projektId: projektId || undefined }))}>Zastosuj zatwierdzone</button>
        {!zatwierdzone.length && <p>Brak zatwierdzonych elementów. Analiza pozostaje zweryfikowana bez zastosowania.</p>}
      </>}
    </>}
    {blad && <p role="alert">{blad}</p>}
    {zapisywanie && <p role="status">Zapisywanie analizy…</p>}
  </section>;
}
