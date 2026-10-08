import { useRef, useState, type FormEvent } from 'react';
import { etykietyZrodel, type Projekt, type Wpis } from '../../domain/modele';
import { typyElementow, type DaneDecyzji, type PowiazanyElement } from '../../domain/ustalenia';

export function FormularzDecyzji({ poczatkowe, projekty, wpisy, prefiks, etykieta, zapisz }: {
  poczatkowe: DaneDecyzji;
  projekty: Projekt[];
  wpisy: Wpis[];
  prefiks: string;
  etykieta: string;
  zapisz: (dane: DaneDecyzji) => Promise<void>;
}) {
  const [dane, ustawDane] = useState(poczatkowe);
  const [zapisywanie, ustawZapisywanie] = useState(false);
  const blokada = useRef(false);
  const [blad, ustawBlad] = useState('');
  async function wyslij(zdarzenie: FormEvent<HTMLFormElement>) {
    zdarzenie.preventDefault();
    if (blokada.current) return;
    blokada.current = true;
    ustawZapisywanie(true);
    ustawBlad('');
    try { await zapisz(dane); }
    catch (blad) { ustawBlad(blad instanceof Error ? blad.message : 'Nie udało się zapisać decyzji.'); }
    finally { blokada.current = false; ustawZapisywanie(false); }
  }
  function zmienElement(numer: number, zmiana: Partial<PowiazanyElement>) {
    ustawDane({ ...dane, powiazaneElementy: dane.powiazaneElementy.map((element, indeks) => indeks === numer ? { ...element, ...zmiana } : element) });
  }
  return <form onSubmit={wyslij}>
    <fieldset disabled={zapisywanie}>
      <legend>Treść i źródło ustalenia</legend>
      <label htmlFor={`${prefiks}-tytul`}>Tytuł decyzji</label>
      <input id={`${prefiks}-tytul`} value={dane.tytul} onChange={(zdarzenie) => ustawDane({ ...dane, tytul: zdarzenie.target.value })} required />
      <label htmlFor={`${prefiks}-opis`}>Opis decyzji</label>
      <textarea id={`${prefiks}-opis`} rows={4} value={dane.opis} onChange={(zdarzenie) => ustawDane({ ...dane, opis: zdarzenie.target.value })} required />
      <fieldset><legend>Projekty decyzji (możesz wybrać wiele)</legend>
        {projekty.filter((projekt) => !projekt.zarchiwizowano).map((projekt) => <label key={projekt.id}>
          <input type="checkbox" checked={dane.projektIds.includes(projekt.id)} onChange={(zdarzenie) => ustawDane({ ...dane, projektIds: zdarzenie.target.checked ? [...dane.projektIds, projekt.id] : dane.projektIds.filter((id) => id !== projekt.id) })} /> {projekt.nazwa}
        </label>)}
      </fieldset>
      <label htmlFor={`${prefiks}-typ`}>Autor źródła</label>
      <select id={`${prefiks}-typ`} value={dane.typZrodla} onChange={(zdarzenie) => ustawDane({ ...dane, typZrodla: zdarzenie.target.value as DaneDecyzji['typZrodla'] })}>
        {Object.entries(etykietyZrodel).map(([typ, nazwa]) => <option key={typ} value={typ}>{nazwa}</option>)}
      </select>
      <label htmlFor={`${prefiks}-zrodlo`}>Nazwa źródła</label>
      <input id={`${prefiks}-zrodlo`} value={dane.nazwaZrodla} onChange={(zdarzenie) => ustawDane({ ...dane, nazwaZrodla: zdarzenie.target.value })} required />
      <label htmlFor={`${prefiks}-odniesienie`}>Odniesienie do źródła (opcjonalne)</label>
      <input id={`${prefiks}-odniesienie`} value={dane.odniesienieZrodla} onChange={(zdarzenie) => ustawDane({ ...dane, odniesienieZrodla: zdarzenie.target.value })} />
      <label htmlFor={`${prefiks}-wpis`}>Źródłowy wpis</label>
      <select id={`${prefiks}-wpis`} value={dane.wpisZrodlowyId ?? ''} onChange={(zdarzenie) => ustawDane({ ...dane, wpisZrodlowyId: zdarzenie.target.value || null })}>
        <option value="">Bez wpisu źródłowego</option>
        {wpisy.map((wpis) => <option key={wpis.id} value={wpis.id}>{wpis.trescOryginalna.slice(0, 100)}</option>)}
      </select>
      <label htmlFor={`${prefiks}-notatki`}>Notatki</label>
      <textarea id={`${prefiks}-notatki`} value={dane.notatki} onChange={(zdarzenie) => ustawDane({ ...dane, notatki: zdarzenie.target.value })} rows={2} />
      <fieldset><legend>Powiązane elementy — ręczne odnośniki</legend>
        <p>Wskaż znane identyfikatory. Nie tworzy to zadań, blokerów ani dokumentów.</p>
        {dane.powiazaneElementy.map((element, numer) => <fieldset key={numer}>
          <legend>Odnośnik {numer + 1}</legend>
          <label htmlFor={`${prefiks}-element-typ-${numer}`}>Rodzaj elementu</label>
          <select id={`${prefiks}-element-typ-${numer}`} value={element.typ} onChange={(zdarzenie) => zmienElement(numer, { typ: zdarzenie.target.value as PowiazanyElement['typ'] })}>
            {Object.entries(typyElementow).map(([typ, nazwa]) => <option key={typ} value={typ}>{nazwa}</option>)}
          </select>
          <label htmlFor={`${prefiks}-element-id-${numer}`}>Identyfikator elementu</label>
          <input id={`${prefiks}-element-id-${numer}`} required value={element.id} onChange={(zdarzenie) => zmienElement(numer, { id: zdarzenie.target.value })} />
          <label htmlFor={`${prefiks}-element-nazwa-${numer}`}>Nazwa elementu</label>
          <input id={`${prefiks}-element-nazwa-${numer}`} required value={element.tytul} onChange={(zdarzenie) => zmienElement(numer, { tytul: zdarzenie.target.value })} />
          <button type="button" onClick={() => ustawDane({ ...dane, powiazaneElementy: dane.powiazaneElementy.filter((_, indeks) => indeks !== numer) })}>Usuń odnośnik {numer + 1}</button>
        </fieldset>)}
        <button type="button" onClick={() => ustawDane({ ...dane, powiazaneElementy: [...dane.powiazaneElementy, { typ: 'PROJECT_ELEMENT', id: '', tytul: '' }] })}>Dodaj odnośnik</button>
      </fieldset>
      <button disabled={!dane.tytul.trim() || !dane.opis.trim() || !dane.projektIds.length}>{zapisywanie ? 'Zapisywanie…' : etykieta}</button>
    </fieldset>
    {blad && <p role="alert">{blad}</p>}
  </form>;
}
