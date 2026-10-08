import { useRef, useState, type FormEvent } from 'react';
import {
  priorytetyPracy, statusyBlokady, statusyEtapu, statusyObszaru, statusyPracy, statusyPytania, typyPracy, wagiBlokady,
  type OperacjaRealizacji, type StanRealizacji, type DaneElementuPracy, type DanePytania, type DaneBlokady,
} from '../../domain/realizacja';
import type { Decyzja } from '../../domain/ustalenia';

export type EdycjaRealizacji = Exclude<OperacjaRealizacji, { rodzaj: 'konwertuj' }>;
const nazwyFormularzy = { obszar: 'Dane obszaru', etap: 'Dane etapu', praca: 'Dane elementu pracy', pytanie: 'Dane pytania', blokada: 'Dane blokady' };

export function FormularzRealizacji({ poczatkowa, realizacja, decyzje, wykonaj, anuluj }: {
  poczatkowa: EdycjaRealizacji; realizacja: StanRealizacji; decyzje: Decyzja[];
  wykonaj: (operacja: OperacjaRealizacji) => Promise<void>; anuluj: () => void;
}) {
  const { rodzaj, dane } = poczatkowa;
  const [obszarId, ustawObszarId] = useState('obszarId' in dane ? dane.obszarId ?? '' : '');
  const [etapId, ustawEtapId] = useState('etapId' in dane ? dane.etapId ?? '' : '');
  const [status, ustawStatus] = useState<string>(dane.status);
  const [blad, ustawBlad] = useState('');
  const [zapisywanie, ustawZapisywanie] = useState(false);
  const blokada = useRef(false);
  function opcje(mapa: Record<string, string>) {
    return Object.entries(mapa).map(([wartosc, nazwa]) => <option key={wartosc} value={wartosc}>{nazwa}</option>);
  }
  async function zapisz(zdarzenie: FormEvent<HTMLFormElement>) {
    zdarzenie.preventDefault();
    if (blokada.current) return;
    const pola = new FormData(zdarzenie.currentTarget);
    const tekst = (nazwa: string) => String(pola.get(nazwa) ?? '');
    const polozenie = { projektId: dane.projektId, obszarId: obszarId || undefined, etapId: etapId || undefined };
    const podstawa = { id: poczatkowa.id, wersja: poczatkowa.wersja };
    let operacja: EdycjaRealizacji;
    switch (rodzaj) {
      case 'obszar': operacja = { ...podstawa, rodzaj, dane: { projektId: dane.projektId, nazwa: tekst('nazwa'), opis: tekst('opis'), status: status as keyof typeof statusyObszaru } }; break;
      case 'etap': operacja = { ...podstawa, rodzaj, dane: { projektId: dane.projektId, obszarId: obszarId || undefined, nazwa: tekst('nazwa'), opis: tekst('opis'), status: status as keyof typeof statusyEtapu, kolejnosc: Number(tekst('kolejnosc')) } }; break;
      case 'praca': operacja = { ...podstawa, rodzaj, dane: { ...polozenie, tytul: tekst('tytul'), opis: tekst('opis'), status: status as DaneElementuPracy['status'], typ: tekst('typ') as DaneElementuPracy['typ'], priorytet: (tekst('priorytet') || undefined) as DaneElementuPracy['priorytet'], decyzjaIds: pola.getAll('decyzje').map(String) } }; break;
      case 'pytanie': operacja = { ...podstawa, rodzaj, dane: { ...polozenie, pytanie: tekst('pytanie'), kontekst: tekst('kontekst'), status: status as DanePytania['status'], odpowiedz: tekst('odpowiedz') || undefined } }; break;
      case 'blokada': operacja = { ...podstawa, rodzaj, dane: { ...polozenie, tytul: tekst('tytul'), opis: tekst('opis'), status: status as DaneBlokady['status'], waga: tekst('waga') as DaneBlokady['waga'] } }; break;
    }
    blokada.current = true; ustawZapisywanie(true); ustawBlad('');
    try { await wykonaj(operacja); anuluj(); }
    catch (blad) { ustawBlad(blad instanceof Error ? blad.message : 'Nie udało się zapisać danych realizacji.'); }
    finally { blokada.current = false; ustawZapisywanie(false); }
  }
  const mapaStatusow = { obszar: statusyObszaru, etap: statusyEtapu, praca: statusyPracy, pytanie: statusyPytania, blokada: statusyBlokady }[rodzaj];
  return <form className="formularz-realizacji" onSubmit={zapisz}>
    <fieldset disabled={zapisywanie}>
      <legend>{nazwyFormularzy[rodzaj]}</legend>
      {(rodzaj === 'obszar' || rodzaj === 'etap') && <label>Nazwa {rodzaj === 'obszar' ? 'obszaru' : 'etapu'}<input name="nazwa" defaultValue={'nazwa' in dane ? dane.nazwa : ''} required /></label>}
      {(rodzaj === 'praca' || rodzaj === 'blokada') && <label>Tytuł {rodzaj === 'praca' ? 'elementu pracy' : 'blokady'}<input name="tytul" defaultValue={'tytul' in dane ? dane.tytul : ''} required /></label>}
      {rodzaj === 'pytanie' ? <>
        <label>Treść pytania<textarea name="pytanie" defaultValue={'pytanie' in dane ? dane.pytanie : ''} required /></label>
        <label>Kontekst pytania<textarea name="kontekst" defaultValue={'kontekst' in dane ? dane.kontekst : ''} /></label>
      </> : <label>Opis<textarea name="opis" defaultValue={'opis' in dane ? dane.opis : ''} /></label>}
      {rodzaj !== 'obszar' && <label>Obszar<select value={obszarId} onChange={(zdarzenie) => { ustawObszarId(zdarzenie.target.value); ustawEtapId(''); }}>
        <option value="">Bez obszaru</option>{realizacja.obszary.filter((obszar) => obszar.projektId === dane.projektId).map((obszar) => <option key={obszar.id} value={obszar.id}>{obszar.nazwa}</option>)}
      </select></label>}
      {rodzaj !== 'obszar' && rodzaj !== 'etap' && <label>Etap<select value={etapId} onChange={(zdarzenie) => ustawEtapId(zdarzenie.target.value)}>
        <option value="">Bez etapu</option>{realizacja.etapy.filter((etap) => etap.projektId === dane.projektId && (etap.obszarId ?? '') === obszarId).map((etap) => <option key={etap.id} value={etap.id}>{etap.nazwa}</option>)}
      </select></label>}
      {rodzaj === 'etap' && <label>Kolejność etapu<input type="number" min={0} step={1} name="kolejnosc" defaultValue={'kolejnosc' in dane ? dane.kolejnosc : 0} required /></label>}
      {rodzaj === 'praca' && <>
        <label>Rodzaj pracy<select name="typ" defaultValue={'typ' in dane ? dane.typ : 'TASK'}>{opcje(typyPracy)}</select></label>
        <label>Priorytet<select name="priorytet" defaultValue={'priorytet' in dane ? dane.priorytet ?? '' : ''}><option value="">Bez priorytetu</option>{opcje(priorytetyPracy)}</select></label>
        <fieldset><legend>Powiązane decyzje</legend>
          <p>Możesz powiązać wiele decyzji. Ich status wdrożenia pozostaje niezależny.</p>
          {decyzje.filter((decyzja) => decyzja.projektIds.includes(dane.projektId)).map((decyzja) => <label key={decyzja.id}><input type="checkbox" name="decyzje" value={decyzja.id} defaultChecked={'decyzjaIds' in dane && dane.decyzjaIds.includes(decyzja.id)} /> {decyzja.czytelneId}: {decyzja.tytul}</label>)}
        </fieldset>
      </>}
      <label>Status<select value={status} onChange={(zdarzenie) => ustawStatus(zdarzenie.target.value)}>{opcje(mapaStatusow)}</select></label>
      {rodzaj === 'pytanie' && status === 'ANSWERED' && <label>Odpowiedź<textarea name="odpowiedz" defaultValue={'odpowiedz' in dane ? dane.odpowiedz ?? '' : ''} required /></label>}
      {rodzaj === 'blokada' && <label>Waga blokady<select name="waga" defaultValue={'waga' in dane ? dane.waga : 'MEDIUM'}>{opcje(wagiBlokady)}</select></label>}
      <div className="akcje-wpisu"><button>{zapisywanie ? 'Zapisywanie…' : 'Zapisz dane realizacji'}</button><button type="button" onClick={anuluj}>Anuluj</button></div>
    </fieldset>
    {blad && <p role="alert">{blad}</p>}
  </form>;
}
