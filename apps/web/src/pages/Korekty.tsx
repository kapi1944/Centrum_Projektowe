import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { DaneKopii } from '../domain/kopieZapasowe';
import { polaKorekty, typyCelow, typyKorekt, wartoscCelu, type KorektaUzytkownika, type OperacjaKorekty } from '../domain/korekty';
import { etykietyReview } from '../domain/analizaWpisu';
import { priorytetyPracy } from '../domain/realizacja';
import { statusyDecyzji } from '../domain/ustalenia';
import { formatujDate } from '../shared/formatujDate';

function opisWartosci(wartosc: string | undefined, pole?: string) {
  return pole === 'priorytet' && wartosc && Object.hasOwn(priorytetyPracy, wartosc)
    ? priorytetyPracy[wartosc as keyof typeof priorytetyPracy] : wartosc;
}

export function Korekty({ dane, wykonaj, analizuj }: { dane: DaneKopii; wykonaj: (operacja: OperacjaKorekty) => Promise<void>; analizuj: (id: string) => Promise<void> }) {
  const { projektId } = useParams();
  const projekt = dane.projekty.find((projekt) => projekt.id === projektId);
  const [typ, ustawTyp] = useState<KorektaUzytkownika['typ']>('FACT_CORRECTION');
  const [typCelu, ustawTypCelu] = useState<KorektaUzytkownika['typCelu']>('PROJECT');
  const [wybranyCel, ustawCel] = useState('');
  const [pole, ustawPole] = useState('opis');
  const [nowaWartosc, ustawWartosc] = useState('');
  const [opis, ustawOpis] = useState('');
  const [powod, ustawPowod] = useState('');
  const [odniesienie, ustawOdniesienie] = useState('');
  const [edycja, ustawEdycje] = useState<string | null>(null);
  const [trescEdytowana, ustawTrescEdytowana] = useState('');
  const [blad, ustawBlad] = useState('');
  const [komunikat, ustawKomunikat] = useState('');
  const [zajety, ustawZajety] = useState(false);
  const blokada = useRef(false);
  if (!projekt) return <h1>Nie znaleziono projektu</h1>;
  const cele = typCelu === 'PROJECT' || typCelu === 'RESUME' ? [{ id: projekt.id, nazwa: projekt.nazwa }]
    : typCelu === 'DECISION' ? dane.decyzje.filter((decyzja) => decyzja.projektIds.includes(projekt.id) && !['SUPERSEDED', 'REJECTED', 'PROPOSED'].includes(decyzja.status)).map((decyzja) => ({ id: decyzja.id, nazwa: `${decyzja.czytelneId}: ${decyzja.tytul}` }))
    : typCelu === 'WORK_ITEM' ? dane.elementyPracy.filter((rekord) => rekord.projektId === projekt.id).map((rekord) => ({ id: rekord.id, nazwa: rekord.tytul }))
    : typCelu === 'QUESTION' ? dane.pytania.filter((rekord) => rekord.projektId === projekt.id).map((rekord) => ({ id: rekord.id, nazwa: rekord.pytanie }))
    : typCelu === 'BLOCKER' ? dane.blokady.filter((rekord) => rekord.projektId === projekt.id).map((rekord) => ({ id: rekord.id, nazwa: rekord.tytul }))
    : typCelu === 'CAPTURE' ? dane.wpisy.filter((rekord) => rekord.projektId === projekt.id).map((rekord) => ({ id: rekord.id, nazwa: rekord.trescOryginalna.slice(0, 100) }))
    : dane.przebiegiAnaliz.filter((przebieg) => dane.wpisy.some((wpis) => wpis.id === przebieg.sourceId && wpis.projektId === projekt.id)).map((przebieg) => ({ id: przebieg.id, nazwa: `${formatujDate(przebieg.createdAt)} — ${przebieg.preferred ? 'aktualna' : 'historyczna'}: ${przebieg.output?.podsumowanie ?? 'Brak wyniku'}` }));
  const celId = cele.some((cel) => cel.id === wybranyCel) ? wybranyCel : cele[0]?.id ?? '';
  const przed = celId ? wartoscCelu(dane, { typCelu, celId, pole: pole || undefined, projektId: projekt.id }) : '';
  async function obsluz(operacja: () => Promise<void>, powodzenie: string) {
    if (blokada.current) return;
    blokada.current = true; ustawZajety(true); ustawBlad(''); ustawKomunikat('');
    try { await operacja(); ustawKomunikat(powodzenie); }
    catch (blad) { ustawBlad(blad instanceof Error ? blad.message : 'Nie udało się zapisać korekty.'); }
    finally { blokada.current = false; ustawZajety(false); }
  }
  return <>
    <Link to={`/projekty/${projekt.id}`}>Wróć do projektu</Link>
    <h1>Korekty i rewizje planu</h1>
    <p>Korekta zachowuje historię. Projekt zmienia się dopiero po weryfikacji i zastosowaniu zestawu zmian.</p>
    {blad && <p role="alert">{blad}</p>}{komunikat && <p role="status">{komunikat}</p>}
    <form onSubmit={(zdarzenie) => {
      zdarzenie.preventDefault();
      void obsluz(async () => {
        await wykonaj({ rodzaj: 'utworz', dane: { id: crypto.randomUUID(), projektId: projekt.id, typCelu, celId, typ,
          pole: pole || undefined, nowaWartosc, opis, powod, odniesienieZrodla: odniesienie } });
        ustawWartosc(''); ustawOpis(''); ustawPowod(''); ustawOdniesienie('');
      }, 'Korekta zapisana. Zweryfikuj propozycje poniżej.');
    }}>
      <fieldset disabled={zajety || !!projekt.zarchiwizowano}>
        <legend>Zgłoś korektę</legend>
        <label>Typ korekty <select value={typ} onChange={(zdarzenie) => ustawTyp(zdarzenie.target.value as typeof typ)}>{Object.entries(typyKorekt).map(([wartosc, etykieta]) => <option key={wartosc} value={wartosc}>{etykieta}</option>)}</select></label>
        <label>Czego dotyczy? <select value={typCelu} onChange={(zdarzenie) => {
          const typ = zdarzenie.target.value as typeof typCelu;
          ustawTypCelu(typ); ustawCel(''); ustawPole(Object.keys(polaKorekty[typ])[0] ?? ''); ustawWartosc('');
        }}>{Object.entries(typyCelow).map(([wartosc, etykieta]) => <option key={wartosc} value={wartosc}>{etykieta}</option>)}</select></label>
        <label>Cel korekty <select value={celId} onChange={(zdarzenie) => ustawCel(zdarzenie.target.value)}>{cele.length ? cele.map((cel) => <option key={cel.id} value={cel.id}>{cel.nazwa}</option>) : <option value="">Brak dostępnych rekordów</option>}</select></label>
        {Object.keys(polaKorekty[typCelu]).length > 0 && <label>Pole <select value={pole} onChange={(zdarzenie) => { ustawPole(zdarzenie.target.value); ustawWartosc(''); }}>{Object.entries(polaKorekty[typCelu]).map(([wartosc, etykieta]) => <option key={wartosc} value={wartosc}>{etykieta}</option>)}</select></label>}
        <h2>PRZED</h2><p className="surowy-wpis">{opisWartosci(przed, pole) || 'Brak poprzedniej wartości.'}</p>
        <label>PO {pole === 'priorytet' ? <select required value={nowaWartosc} onChange={(zdarzenie) => ustawWartosc(zdarzenie.target.value)}><option value="">Wybierz priorytet</option>{Object.entries(priorytetyPracy).map(([wartosc, etykieta]) => <option key={wartosc} value={wartosc}>{etykieta}</option>)}</select>
          : <textarea required value={nowaWartosc} onChange={(zdarzenie) => ustawWartosc(zdarzenie.target.value)} />}</label>
        <label>Opis korekty <textarea required value={opis} onChange={(zdarzenie) => ustawOpis(zdarzenie.target.value)} /></label>
        <label>Powód <textarea value={powod} onChange={(zdarzenie) => ustawPowod(zdarzenie.target.value)} /></label>
        <label>Źródło / odniesienie <input value={odniesienie} onChange={(zdarzenie) => ustawOdniesienie(zdarzenie.target.value)} /></label>
        <button disabled={!celId} type="submit">Zgłoś korektę</button>
      </fieldset>
    </form>
    <h2>Zapisane korekty</h2>
    {!dane.korekty.some((korekta) => korekta.projektId === projekt.id) && <p>Brak korekt.</p>}
    {dane.korekty.filter((korekta) => korekta.projektId === projekt.id).map((korekta) => {
      const propozycja = dane.propozycjeZmian.find((propozycja) => propozycja.correctionId === korekta.id)!;
      const analiza = dane.analizyWplywu.find((analiza) => analiza.id === propozycja.impactAnalysisId)!;
      const zestaw = dane.zestawyZmian.find((zestaw) => zestaw.correctionId === korekta.id);
      return <section key={korekta.id} aria-label={`${typyKorekt[korekta.typ]}: ${korekta.opis}`}>
        <h3>{typyKorekt[korekta.typ]}</h3><p>{korekta.opis}</p>
        <p>Dotyczy: {typyCelow[korekta.typCelu]} · {korekta.celId}</p>
        <h4>PRZED</h4><p className="surowy-wpis">{opisWartosci(korekta.poprzedniaWartosc, korekta.pole) || 'Brak poprzedniej wartości.'}</p>
        <h4>PO</h4><p className="surowy-wpis">{opisWartosci(korekta.nowaWartosc, korekta.pole) ?? korekta.opis}</p>
        <p>Powód: {korekta.powod || 'Nie podano.'}</p><p>Źródło: {korekta.utworzyl} · {korekta.odniesienieZrodla || 'Korekta użytkownika'} · {formatujDate(korekta.utworzono)}</p>
        <p>{korekta.status === 'PROPOSED' ? 'Oczekuje na zastosowanie' : korekta.status === 'APPLIED' ? 'Zastosowana' : 'Odrzucona'}</p>
        <h4>Potencjalny wpływ i propozycje zmian</h4>
        <p>Kandydaci wynikają z relacji projektu. Weryfikacja powiązanego elementu zachowuje wskazówkę do przeglądu.</p>
        <ul>{propozycja.operations.map((zmiana) => {
          const wplyw = analiza.propozycje.find((wplyw) => wplyw.id === zmiana.propozycjaWplywuId);
          return <li key={zmiana.id}>
            <strong>{zmiana.rodzaj === 'KOREKTA' ? 'Zastosuj korektę' : zmiana.tresc}</strong>
            {wplyw && <p>{wplyw.uzasadnienie}</p>}
            {wplyw?.rodzaj === 'DECISION_STATUS' && <p>Zmiana statusu: {statusyDecyzji[wplyw.poprzedniStatus]} → {statusyDecyzji[wplyw.proponowanyStatus]}. Edycja zmienia uzasadnienie sprawdzenia.</p>}
            {wplyw?.rodzaj === 'RESUME' && <p>Następny krok: {wplyw.poprzednio.nastepnyKrok || 'Brak'} → {wplyw.proponowane.nastepnyKrok}</p>}
            <p>{etykietyReview[zmiana.status]}</p><p className="surowy-wpis">{opisWartosci(zmiana.trescEdytowana ?? zmiana.tresc, zmiana.rodzaj === 'KOREKTA' ? korekta.pole : undefined)}</p>
            {korekta.status === 'PROPOSED' && <fieldset disabled={zajety || !!projekt.zarchiwizowano}>
              <legend>Weryfikacja propozycji</legend>
              <button onClick={() => void obsluz(() => wykonaj({ rodzaj: 'review', id: korekta.id, wersja: propozycja.reviewRevision, operacjaId: zmiana.id, status: 'ACCEPTED' }), 'Zaakceptowano propozycję.')}>Zaakceptuj</button>
              <button onClick={() => { ustawEdycje(zmiana.id); ustawTrescEdytowana(zmiana.trescEdytowana ?? (wplyw?.rodzaj === 'RESUME' ? wplyw.proponowane.nastepnyKrok : wplyw?.uzasadnienie ?? zmiana.tresc)); }}>Edytuj</button>
              <button onClick={() => void obsluz(() => wykonaj({ rodzaj: 'review', id: korekta.id, wersja: propozycja.reviewRevision, operacjaId: zmiana.id, status: 'REJECTED' }), 'Odrzucono propozycję; historia została zachowana.')}>Odrzuć</button>
              {edycja === zmiana.id && <form onSubmit={(zdarzenie) => {
                zdarzenie.preventDefault(); void obsluz(async () => {
                  await wykonaj({ rodzaj: 'review', id: korekta.id, wersja: propozycja.reviewRevision, operacjaId: zmiana.id, status: 'EDITED', trescEdytowana }); ustawEdycje(null);
                }, 'Zapisano treść użytkownika.');
              }}><label>{wplyw && wplyw.rodzaj !== 'RESUME' ? 'Uzasadnienie sprawdzenia' : 'Treść po edycji'} <textarea required value={trescEdytowana} onChange={(zdarzenie) => ustawTrescEdytowana(zdarzenie.target.value)} /></label><button>Zapisz edycję</button><button type="button" onClick={() => ustawEdycje(null)}>Anuluj</button></form>}
            </fieldset>}
          </li>;
        })}</ul>
        {korekta.status === 'PROPOSED' && <button disabled={zajety || !!projekt.zarchiwizowano || propozycja.operations.some((zmiana) => zmiana.status === 'PENDING')} onClick={() => void obsluz(() => wykonaj({ rodzaj: 'zastosuj', id: korekta.id, wersja: propozycja.reviewRevision, idempotencyKey: `korekta:${korekta.id}` }), 'Review zastosowane atomowo.')}>Zastosuj zatwierdzone zmiany</button>}
        {zestaw && <p>Zestaw zmian: {zestaw.id} · {formatujDate(zestaw.appliedAt)} · Zastosowana treść: {opisWartosci(zestaw.operations.find((zmiana) => zmiana.rodzaj === 'KOREKTA')?.trescEdytowana ?? zestaw.operations.find((zmiana) => zmiana.rodzaj === 'KOREKTA')?.tresc, korekta.pole)}</p>}
        {zestaw?.operations.some((zmiana) => zmiana.rodzaj === 'KOREKTA') && korekta.pole && <button disabled={zajety || !!projekt.zarchiwizowano} onClick={() => void obsluz(() => wykonaj({ rodzaj: 'odwroc', id: korekta.id, noweId: crypto.randomUUID() }), 'Utworzono nową korektę odwracającą. Wymaga review.')}>Utwórz korektę odwracającą</button>}
        {zestaw?.operations.some((zmiana) => zmiana.rodzaj === 'KOREKTA') && ['CAPTURE', 'ANALYSIS_RUN'].includes(korekta.typCelu) && <>
          <button disabled={zajety || !!projekt.zarchiwizowano} onClick={() => void obsluz(() => analizuj(korekta.id), 'Nowy przebieg analizy zapisany jako aktualny. Wynik wymaga review.')}>Uruchom nową analizę i oznacz jako aktualną</button>
          <p>Analiza regułowa przetworzy zaakceptowaną treść korekty. Wyniki i review są dostępne w <Link to="/inbox">Skrzynce</Link>.</p>
        </>}
      </section>;
    })}
  </>;
}
