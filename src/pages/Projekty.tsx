import { useState, type FormEvent } from 'react';
import type { Projekt } from '../domain/modele';
import { formatujDate } from '../shared/formatujDate';

export function Projekty({ projekty, dodajProjekt }: {
  projekty: Projekt[];
  dodajProjekt: (nazwa: string) => Promise<void>;
}) {
  const [nazwa, ustawNazwe] = useState('');
  const [zapisywanie, ustawZapisywanie] = useState(false);
  const [blad, ustawBlad] = useState('');
  const [komunikat, ustawKomunikat] = useState('');

  async function zapisz(zdarzenie: FormEvent<HTMLFormElement>) {
    zdarzenie.preventDefault();
    ustawBlad('');
    ustawKomunikat('');
    ustawZapisywanie(true);
    try {
      await dodajProjekt(nazwa);
      ustawNazwe('');
      ustawKomunikat('Projekt zapisany lokalnie.');
    } catch {
      ustawBlad('Nie udało się zapisać projektu. Sprawdź nazwę i dostępność pamięci przeglądarki.');
    } finally { ustawZapisywanie(false); }
  }

  return <>
    <h1>Projekty</h1>
    <p>Twoje prywatne projekty i miejsce na ich dalszy rozwój.</p>
    <form onSubmit={zapisz}>
      <label htmlFor="nazwa-projektu">Nazwa projektu</label>
      <input id="nazwa-projektu" value={nazwa} onChange={(zdarzenie) => ustawNazwe(zdarzenie.target.value)} required disabled={zapisywanie} />
      <button disabled={zapisywanie || !nazwa.trim()}>{zapisywanie ? 'Zapisywanie…' : 'Dodaj projekt'}</button>
      {blad && <p role="alert">{blad}</p>}
      <p role="status">{komunikat}</p>
    </form>
    {projekty.length === 0 ? <p>Brak projektów. Dodaj pierwszy projekt powyżej.</p> : <ul className="lista-rekordow">{projekty.map((projekt) => <li key={projekt.id}><h2>{projekt.nazwa}</h2><small>Utworzono: {formatujDate(projekt.utworzono)}</small></li>)}</ul>}
  </>;
}
