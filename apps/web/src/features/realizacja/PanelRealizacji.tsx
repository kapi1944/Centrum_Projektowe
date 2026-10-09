import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Projekt } from '../../domain/modele';
import {
  priorytetyPracy, statusyBlokady, statusyEtapu, statusyObszaru, statusyPracy, statusyPytania, typyPracy, wagiBlokady,
  type ElementPracy, type OperacjaRealizacji, type StanRealizacji, type PochodzenieAnalizy,
} from '../../domain/realizacja';
import type { Decyzja } from '../../domain/ustalenia';
import { FormularzRealizacji, type EdycjaRealizacji } from './FormularzRealizacji';

export function PunktRealizacji({ projektId, realizacja }: { projektId: string; realizacja: StanRealizacji }) {
  const blokady = realizacja.blokady.filter((blokada) => blokada.projektId === projektId && blokada.status === 'ACTIVE');
  const pytania = realizacja.pytania.filter((pytanie) => pytanie.projektId === projektId && pytanie.status === 'OPEN');
  const kolejnoscPriorytetow = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  const prace = realizacja.elementyPracy.filter((praca) => praca.projektId === projektId && !['DONE', 'ABANDONED'].includes(praca.status))
    .sort((lewa, prawa) => (kolejnoscPriorytetow[lewa.priorytet ?? 'LOW'] - kolejnoscPriorytetow[prawa.priorytet ?? 'LOW']) || lewa.utworzono.localeCompare(prawa.utworzono)).slice(0, 5);
  return <>
    <h3>Aktywne blokady</h3>
    {blokady.length ? <ul>{blokady.map((blokada) => <li key={blokada.id}><a href={`#blokada-${blokada.id}`}>{blokada.tytul}</a> · {wagiBlokady[blokada.waga]}</li>)}</ul> : <p>Brak aktywnych blokad.</p>}
    <h3>Otwarte pytania</h3>
    {pytania.length ? <ul>{pytania.map((pytanie) => <li key={pytanie.id}><a href={`#pytanie-${pytanie.id}`}>{pytanie.pytanie}</a></li>)}</ul> : <p>Brak otwartych pytań.</p>}
    <h3>Najbliższe elementy pracy</h3>
    <p>Do pięciu niezakończonych elementów, według priorytetu, następnie daty utworzenia.</p>
    {prace.length ? <ul>{prace.map((praca) => <li key={praca.id}><a href={`#praca-${praca.id}`}>{praca.tytul}</a> · {typyPracy[praca.typ]} · {statusyPracy[praca.status]}</li>)}</ul> : <p>Brak najbliższych elementów pracy.</p>}
  </>;
}

export function PanelRealizacji({ projekt, realizacja, decyzje, wykonaj }: {
  projekt: Projekt; realizacja: StanRealizacji; decyzje: Decyzja[]; wykonaj: (operacja: OperacjaRealizacji) => Promise<void>;
}) {
  const [edycja, ustawEdycje] = useState<EdycjaRealizacji | null>(null);
  const [blad, ustawBlad] = useState('');
  const [zapisywanie, ustawZapisywanie] = useState(false);
  const blokada = useRef(false);
  const obszary = realizacja.obszary.filter((obszar) => obszar.projektId === projekt.id);
  const etapy = realizacja.etapy.filter((etap) => etap.projektId === projekt.id).sort((lewy, prawy) => lewy.kolejnosc - prawy.kolejnosc || lewy.id.localeCompare(prawy.id));
  const prace = realizacja.elementyPracy.filter((praca) => praca.projektId === projekt.id);
  const pytania = realizacja.pytania.filter((pytanie) => pytanie.projektId === projekt.id);
  const blokady = realizacja.blokady.filter((blokada) => blokada.projektId === projekt.id);
  async function zapisz(operacja: OperacjaRealizacji) {
    if (blokada.current) return;
    blokada.current = true; ustawZapisywanie(true); ustawBlad('');
    try { await wykonaj(operacja); }
    catch (blad) { ustawBlad(blad instanceof Error ? blad.message : 'Nie udało się zapisać danych realizacji.'); }
    finally { blokada.current = false; ustawZapisywanie(false); }
  }
  function nowe(rodzaj: EdycjaRealizacji['rodzaj']) {
    const id = crypto.randomUUID(); const projektId = projekt.id;
    switch (rodzaj) {
      case 'obszar': ustawEdycje({ rodzaj, id, dane: { projektId, nazwa: '', opis: '', status: 'ACTIVE' } }); break;
      case 'etap': ustawEdycje({ rodzaj, id, dane: { projektId, nazwa: '', opis: '', status: 'PLANNED', kolejnosc: etapy.length + 1 } }); break;
      case 'praca': ustawEdycje({ rodzaj, id, dane: { projektId, tytul: '', opis: '', typ: 'TASK', status: 'TODO', decyzjaIds: [] } }); break;
      case 'pytanie': ustawEdycje({ rodzaj, id, dane: { projektId, pytanie: '', kontekst: '', status: 'OPEN' } }); break;
      case 'blokada': ustawEdycje({ rodzaj, id, dane: { projektId, tytul: '', opis: '', status: 'ACTIVE', waga: 'MEDIUM' } }); break;
    }
  }
  function pochodzenie(dane?: PochodzenieAnalizy) {
    return dane && <>
      <Link to={`/inbox?wpis=${encodeURIComponent(dane.wpisId)}`}>Wpis źródłowy w Skrzynce</Link>
      <details><summary>Pochodzenie — szczegóły techniczne</summary><p>Analiza: {dane.analizaWpisuId} · Element: {dane.elementAnalizyId} · Wpis: {dane.wpisId}</p></details>
    </>;
  }
  function polozenie(dane: { obszarId?: string; etapId?: string }) {
    return <p>Obszar: {obszary.find((obszar) => obszar.id === dane.obszarId)?.nazwa ?? 'Bez obszaru'} · Etap: {etapy.find((etap) => etap.id === dane.etapId)?.nazwa ?? 'Bez etapu'}</p>;
  }
  function kartaPracy(praca: ElementPracy) {
    return <article key={praca.id} id={`praca-${praca.id}`} aria-label={`Element pracy: ${praca.tytul}`}>
      <h5>{praca.tytul}</h5><p>{typyPracy[praca.typ]} · {statusyPracy[praca.status]}{praca.priorytet ? ` · Priorytet: ${priorytetyPracy[praca.priorytet]}` : ''}</p>
      {praca.opis && <p className="surowy-wpis">{praca.opis}</p>}
      <p>Powiązane decyzje: {praca.decyzjaIds.length === 0 ? 'Brak' : praca.decyzjaIds.map((id) => <Link key={id} to={`/projekty/${projekt.id}/ustalenia?decyzja=${encodeURIComponent(id)}`}>{decyzje.find((decyzja) => decyzja.id === id)?.czytelneId ?? 'Decyzja'}{' '}</Link>)}</p>
      {pochodzenie(praca.pochodzenie)}
      {!projekt.zarchiwizowano && <div className="akcje-wpisu">
        <button disabled={zapisywanie} onClick={() => ustawEdycje({ rodzaj: 'praca', id: praca.id, wersja: praca.wersja, dane: praca })}>Edytuj element pracy</button>
        {!['DONE', 'ABANDONED'].includes(praca.status) && <button disabled={zapisywanie} onClick={() => void zapisz({ rodzaj: 'praca', id: praca.id, wersja: praca.wersja, dane: { ...praca, status: 'DONE' } })}>Ukończ element pracy</button>}
      </div>}
    </article>;
  }
  function strukturaObszaru(obszarId?: string) {
    const etapyObszaru = etapy.filter((etap) => etap.obszarId === obszarId);
    return <>
      {prace.filter((praca) => praca.obszarId === obszarId && !praca.etapId).map(kartaPracy)}
      {etapyObszaru.map((etap) => <section key={etap.id} aria-label={`Etap: ${etap.nazwa}`}>
        <h4>{etap.kolejnosc}. {etap.nazwa}</h4><p>{statusyEtapu[etap.status]}</p><p className="surowy-wpis">{etap.opis}</p>
        {!projekt.zarchiwizowano && <button disabled={zapisywanie} onClick={() => ustawEdycje({ rodzaj: 'etap', id: etap.id, wersja: etap.wersja, dane: etap })}>Edytuj etap</button>}
        {prace.filter((praca) => praca.etapId === etap.id).map(kartaPracy)}
        {!prace.some((praca) => praca.etapId === etap.id) && <p>Brak elementów pracy w tym etapie.</p>}
      </section>)}
    </>;
  }
  return <section aria-labelledby="realizacja-projektu">
    <h2 id="realizacja-projektu">Realizacja projektu</h2>
    <p>Obszary i etapy porządkują pracę. Pytania oraz blokady mają własne rozstrzygnięcia. Ukończenie pracy nie zmienia automatycznie decyzji ani następnego kroku.</p>
    {!projekt.zarchiwizowano && <div className="akcje-wpisu">
      <button disabled={zapisywanie} onClick={() => nowe('obszar')}>Nowy obszar</button><button disabled={zapisywanie} onClick={() => nowe('etap')}>Nowy etap</button>
      <button disabled={zapisywanie} onClick={() => nowe('praca')}>Nowy element pracy</button><button disabled={zapisywanie} onClick={() => nowe('pytanie')}>Nowe pytanie</button><button disabled={zapisywanie} onClick={() => nowe('blokada')}>Nowa blokada</button>
    </div>}
    {edycja && !projekt.zarchiwizowano && <FormularzRealizacji key={`${edycja.id}-${edycja.wersja ?? 0}-${edycja.dane.status}`} poczatkowa={edycja} realizacja={realizacja} decyzje={decyzje} wykonaj={wykonaj} anuluj={() => ustawEdycje(null)} />}
    {blad && <p role="alert">{blad}</p>}
    <h3>Obszary projektu</h3>
    {!obszary.length && <p>Brak obszarów projektu.</p>}
    {obszary.map((obszar) => <section key={obszar.id} aria-label={`Obszar: ${obszar.nazwa}`}>
      <h3>{obszar.nazwa}</h3><p>{statusyObszaru[obszar.status]}</p><p className="surowy-wpis">{obszar.opis}</p>
      {!projekt.zarchiwizowano && <button disabled={zapisywanie} onClick={() => ustawEdycje({ rodzaj: 'obszar', id: obszar.id, wersja: obszar.wersja, dane: obszar })}>Edytuj obszar</button>}
      {strukturaObszaru(obszar.id)}
    </section>)}
    <section aria-label="Praca bez obszaru"><h3>Bez obszaru</h3>{strukturaObszaru()}
      {!etapy.some((etap) => !etap.obszarId) && !prace.some((praca) => !praca.obszarId) && <p>Brak etapów i elementów pracy bez obszaru.</p>}
    </section>
    <section aria-label="Pytania projektu"><h3>Pytania projektu</h3>
      {!pytania.length && <p>Brak pytań projektu.</p>}
      {pytania.map((pytanie) => <article key={pytanie.id} id={`pytanie-${pytanie.id}`} aria-label={`Pytanie: ${pytanie.pytanie}`}>
        <h4>{pytanie.pytanie}</h4><p>{statusyPytania[pytanie.status]}</p>{polozenie(pytanie)}<p className="surowy-wpis">{pytanie.kontekst}</p>
        {pytanie.odpowiedz && <p className="surowy-wpis">Odpowiedź: {pytanie.odpowiedz}</p>}{pochodzenie(pytanie.pochodzenie)}
        {!projekt.zarchiwizowano && <div className="akcje-wpisu">
          <button disabled={zapisywanie} onClick={() => ustawEdycje({ rodzaj: 'pytanie', id: pytanie.id, wersja: pytanie.wersja, dane: { ...pytanie, status: pytanie.status === 'OPEN' ? 'ANSWERED' : pytanie.status } })}>{pytanie.status === 'OPEN' ? 'Odpowiedz' : 'Edytuj pytanie'}</button>
          {pytanie.status === 'OPEN' && <button disabled={zapisywanie} onClick={() => void zapisz({ rodzaj: 'pytanie', id: pytanie.id, wersja: pytanie.wersja, dane: { ...pytanie, status: 'DISMISSED' } })}>Odrzuć pytanie</button>}
        </div>}
      </article>)}
    </section>
    <section aria-label="Blokady projektu"><h3>Blokady projektu</h3>
      {!blokady.length && <p>Brak blokad projektu.</p>}
      {blokady.map((blokada) => <article key={blokada.id} id={`blokada-${blokada.id}`} aria-label={`Blokada: ${blokada.tytul}`}>
        <h4>{blokada.tytul}</h4><p>{statusyBlokady[blokada.status]} · Waga: {wagiBlokady[blokada.waga]}</p>{polozenie(blokada)}<p className="surowy-wpis">{blokada.opis}</p>
        {!projekt.zarchiwizowano && <div className="akcje-wpisu">
          <button disabled={zapisywanie} onClick={() => ustawEdycje({ rodzaj: 'blokada', id: blokada.id, wersja: blokada.wersja, dane: blokada })}>Edytuj blokadę</button>
          {blokada.status === 'ACTIVE' && <button disabled={zapisywanie} onClick={() => void zapisz({ rodzaj: 'blokada', id: blokada.id, wersja: blokada.wersja, dane: { ...blokada, status: 'RESOLVED' } })}>Rozwiąż blokadę</button>}
        </div>}
      </article>)}
    </section>
  </section>;
}
