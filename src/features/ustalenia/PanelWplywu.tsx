import { useRef, useState } from 'react';
import { statusyDecyzji, type AnalizaWplywu, type OperacjaUstalen, type ZrodloWplywu } from '../../domain/ustalenia';
import { formatujDate } from '../../shared/formatujDate';

export function PanelWplywu({ zrodlo, analizy, wykonaj }: {
  zrodlo: ZrodloWplywu;
  analizy: AnalizaWplywu[];
  wykonaj: (operacja: OperacjaUstalen) => Promise<void>;
}) {
  const [blad, ustawBlad] = useState('');
  const [zapisywanie, ustawZapisywanie] = useState(false);
  const blokada = useRef(false);
  async function zapisz(operacja: OperacjaUstalen) {
    if (blokada.current) return;
    blokada.current = true;
    ustawZapisywanie(true);
    ustawBlad('');
    try { await wykonaj(operacja); }
    catch (blad) { ustawBlad(blad instanceof Error ? blad.message : 'Nie udało się zapisać rozstrzygnięcia.'); }
    finally { blokada.current = false; ustawZapisywanie(false); }
  }
  const widoczne = analizy.filter((analiza) => analiza.zrodlo.id === zrodlo.id && analiza.zrodlo.typ === zrodlo.typ)
    .sort((lewa, prawa) => prawa.utworzono.localeCompare(lewa.utworzono));
  return <details>
    <summary>Analiza wpływu</summary>
    <p>Sprawdzenie wspólnych projektów i jawnych powiązań. Nie analizuje znaczenia tekstu. Każda propozycja wymaga osobnego zatwierdzenia.</p>
    <button disabled={zapisywanie} onClick={() => void zapisz({ rodzaj: 'analizuj', zrodlo })}>Sprawdź wpływ na podstawie relacji</button>
    {blad && <p role="alert">{blad}</p>}
    {widoczne.map((analiza) => <section key={analiza.id} aria-label="Wynik analizy wpływu">
      <p>{formatujDate(analiza.utworzono)}</p>
      {analiza.zrodloAnalizyWpisu && <p className="surowy-wpis">Zatwierdzony kandydat z analizy {analiza.zrodloAnalizyWpisu.analizaWpisuId}, element {analiza.zrodloAnalizyWpisu.elementAnalizyId}: {analiza.zrodloAnalizyWpisu.tresc}</p>}
      <p>Ta informacja może zmieniać {analiza.propozycje.length} istniejące elementy projektu.</p>
      {!analiza.propozycje.length && <p>Brak kandydatów wynikających z relacji. Dla wpisu bez projektu najpierw wybierz projekt.</p>}
      <ul className="lista-rekordow">{analiza.propozycje.map((propozycja) => <li key={propozycja.id}>
        <h4>{propozycja.tytul}</h4>
        <p>{propozycja.uzasadnienie}</p>
        {propozycja.rodzaj === 'DECISION_STATUS' && <p>Proponowana zmiana statusu: {statusyDecyzji[propozycja.poprzedniStatus]} → {statusyDecyzji[propozycja.proponowanyStatus]}. Ustalenie wróci do propozycji do ponownego rozpatrzenia.</p>}
        {propozycja.rodzaj === 'RESUME' && <><p>Zmiana następnego kroku:</p><p className="surowy-wpis">{propozycja.poprzednio.nastepnyKrok || '(brak)'} → {propozycja.proponowane.nastepnyKrok}</p><p>Ostatnia praca i aktualny stan pozostaną zachowane.</p></>}
        {propozycja.rodzaj === 'REVIEW' && <p>Zatwierdzenie zapisze potrzebę sprawdzenia odnośnika „{propozycja.element.id}”. Nie zmieni zadania, blokera ani dokumentu.</p>}
        {propozycja.stan === 'PENDING' ? <div className="akcje-wpisu">
          <button disabled={zapisywanie} onClick={() => void zapisz({ rodzaj: 'rozstrzygnij', analizaId: analiza.id, propozycjaId: propozycja.id, zatwierdz: true })}>Zatwierdź tę zmianę</button>
          <button disabled={zapisywanie} onClick={() => void zapisz({ rodzaj: 'rozstrzygnij', analizaId: analiza.id, propozycjaId: propozycja.id, zatwierdz: false })}>Odrzuć tę zmianę</button>
        </div> : <p role="status">{propozycja.stan === 'APPROVED' ? 'Zatwierdzono' : 'Odrzucono'} · {propozycja.rozstrzygnieto && formatujDate(propozycja.rozstrzygnieto)}</p>}
      </li>)}</ul>
    </section>)}
  </details>;
}
