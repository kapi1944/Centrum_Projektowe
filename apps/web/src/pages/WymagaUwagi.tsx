import { Link } from 'react-router-dom';
import { useState } from 'react';
import { typyUwagi, wagiUwagi, type ElementUwagi, type MigawkaProjektu } from '../domain/stanProjektu';
import type { Projekt } from '../domain/modele';
import { formatujDate } from '../shared/formatujDate';

export function ListaUwagi({ elementy }: { elementy: ElementUwagi[] }) {
  return elementy.length === 0 ? <p>Brak spraw wymagających uwagi.</p> : <ul className="lista-rekordow">{elementy.map((element) => <li key={element.id}>
    <h3>{element.tytul}</h3>
    <p>{typyUwagi[element.typ]} · Waga: {wagiUwagi[element.waga]}</p>
    <p className="surowy-wpis">{element.opis}</p>
    <strong>Dlaczego to widzę?</strong><p>{element.powod}</p>
    <p>{element.odnosnikiZrodel.map((zrodlo) => <span key={`${zrodlo.id}:${zrodlo.adres}`}><Link to={zrodlo.adres}>{zrodlo.tytul}</Link>{' '}</span>)}</p>
  </li>)}</ul>;
}

export function WymagaUwagi({ projekty, elementy }: { projekty: Projekt[]; elementy: ElementUwagi[] }) {
  const [projektId, ustawProjekt] = useState('');
  const [typ, ustawTyp] = useState('');
  const [waga, ustawWage] = useState('');
  const widoczne = elementy.filter((element) => (!projektId || element.projektId === projektId)
    && (!typ || element.typ === typ) && (!waga || element.waga === waga));
  return <><h1>Wymaga uwagi</h1><p>Sprawy wynikające z aktualnych danych projektu. Rozstrzygaj je w miejscu źródłowym.</p>
    <div className="formularz-realizacji">
      <label htmlFor="uwaga-projekt">Projekt</label><select id="uwaga-projekt" value={projektId} onChange={(zdarzenie) => ustawProjekt(zdarzenie.target.value)}>
        <option value="">Wszystkie projekty</option>{projekty.map((projekt) => <option key={projekt.id} value={projekt.id}>{projekt.nazwa}</option>)}
      </select>
      <label htmlFor="uwaga-typ">Typ uwagi</label><select id="uwaga-typ" value={typ} onChange={(zdarzenie) => ustawTyp(zdarzenie.target.value)}>
        <option value="">Wszystkie typy</option>{Object.entries(typyUwagi).map(([id, tytul]) => <option key={id} value={id}>{tytul}</option>)}
      </select>
      <label htmlFor="uwaga-waga">Waga</label><select id="uwaga-waga" value={waga} onChange={(zdarzenie) => ustawWage(zdarzenie.target.value)}>
        <option value="">Wszystkie wagi</option>{Object.entries(wagiUwagi).map(([id, tytul]) => <option key={id} value={id}>{tytul}</option>)}
      </select>
    </div>
    {widoczne.length === 0 && <p>{elementy.length ? 'Brak spraw dla wybranych filtrów.' : 'Brak spraw wymagających uwagi.'}</p>}
    {projekty.filter((projekt) => widoczne.some((element) => element.projektId === projekt.id)).map((projekt) => <section key={projekt.id}>
      <h2><Link to={`/projekty/${projekt.id}`}>{projekt.nazwa}</Link></h2>
      <ListaUwagi elementy={widoczne.filter((element) => element.projektId === projekt.id)} />
    </section>)}
  </>;
}

export function StanTeraz({ migawka, uwaga }: { migawka: MigawkaProjektu; uwaga: ElementUwagi[] }) {
  const grupy = [
    { tytul: 'Aktualne cele', tresci: migawka.aktualneCele },
    { tytul: 'Aktywne ograniczenia', tresci: migawka.aktywneOgraniczenia.map((element) => element.tytul), odnosniki: migawka.aktywneOgraniczenia },
    { tytul: 'Obowiązujące decyzje', tresci: migawka.aktywneDecyzje.map((element) => `${element.tytul}: ${element.opis}`) },
    { tytul: 'Otwarte pytania', tresci: migawka.otwartePytania.map((element) => element.pytanie) },
    { tytul: 'Blokery', tresci: migawka.blokery.map((element) => element.tytul) },
    { tytul: 'Aktualna praca', tresci: migawka.aktualnaPraca.map((element) => element.tytul) },
    { tytul: 'Następny sensowny krok', tresci: migawka.sugerowaneDzialania.map((element) => element.tytul) },
    { tytul: 'Nieaktualne powiązania', tresci: migawka.nieaktualneElementy.map((element) => element.tytul) },
  ];
  return <section aria-labelledby="stan-teraz"><h2 id="stan-teraz">Stan teraz</h2>
    <p>Projekcja danych domenowych. Cel pochodzi z opisu projektu, a podsumowanie z zapisanego punktu powrotu.</p>
    <p className="surowy-wpis">{migawka.podsumowanie || 'Brak zapisanego podsumowania.'}</p>
    <p>Stan danych na: {formatujDate(migawka.wygenerowano)}</p>
    <h3>Ostatnio zaakceptowane zmiany</h3>
    {migawka.ostatnieZmiany.length ? <ul>{migawka.ostatnieZmiany.map((zmiana) => <li key={zmiana.id}><Link to={zmiana.adres}>{zmiana.tytul}</Link></li>)}</ul> : <p>Brak zastosowanych zestawów zmian.</p>}
    {grupy.map((grupa) => <div key={grupa.tytul}><h3>{grupa.tytul}</h3>{grupa.tresci.length
      ? <ul>{grupa.tresci.map((tresc, numer) => <li className="surowy-wpis" key={numer}>{grupa.odnosniki?.[numer]
        ? <Link to={grupa.odnosniki[numer].adres}>{tresc}</Link> : tresc}</li>)}</ul> : <p>Brak.</p>}</div>)}
    <h3>Wymaga uwagi</h3><ListaUwagi elementy={uwaga} />
  </section>;
}
