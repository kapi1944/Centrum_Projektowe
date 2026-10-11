import { Link } from 'react-router-dom';
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
  return <><h1>Wymaga uwagi</h1><p>Sprawy wynikające z aktualnych danych projektu. Rozstrzygaj je w miejscu źródłowym.</p>
    {elementy.length === 0 && <p>Brak spraw wymagających uwagi.</p>}
    {projekty.filter((projekt) => elementy.some((element) => element.projektId === projekt.id)).map((projekt) => <section key={projekt.id}>
      <h2><Link to={`/projekty/${projekt.id}`}>{projekt.nazwa}</Link></h2>
      <ListaUwagi elementy={elementy.filter((element) => element.projektId === projekt.id)} />
    </section>)}
  </>;
}

export function StanTeraz({ migawka, uwaga }: { migawka: MigawkaProjektu; uwaga: ElementUwagi[] }) {
  const grupy = [
    { tytul: 'Aktualne cele', tresci: migawka.aktualneCele },
    { tytul: 'Aktywne ograniczenia', tresci: migawka.aktywneOgraniczenia.map((element) => element.tytul) },
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
      ? <ul>{grupa.tresci.map((tresc, numer) => <li className="surowy-wpis" key={numer}>{tresc}</li>)}</ul> : <p>Brak.</p>}</div>)}
    <h3>Wymaga uwagi</h3><ListaUwagi elementy={uwaga} />
  </section>;
}
