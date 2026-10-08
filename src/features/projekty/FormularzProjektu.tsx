import { useState, type FormEvent } from 'react';
import { statusyProjektu, type DaneProjektu } from '../../domain/modele';

export function FormularzProjektu({ poczatkoweDane, zapiszDane, etykietaPrzycisku }: {
  poczatkoweDane: DaneProjektu;
  zapiszDane: (dane: DaneProjektu) => Promise<void>;
  etykietaPrzycisku: string;
}) {
  const [dane, ustawDane] = useState(poczatkoweDane);
  const [zapisywanie, ustawZapisywanie] = useState(false);
  const [blad, ustawBlad] = useState('');
  const [komunikat, ustawKomunikat] = useState('');

  async function zapisz(zdarzenie: FormEvent<HTMLFormElement>) {
    zdarzenie.preventDefault();
    ustawBlad('');
    ustawKomunikat('');
    ustawZapisywanie(true);
    try {
      await zapiszDane(dane);
      ustawKomunikat('Projekt zapisany lokalnie.');
    } catch (blad) {
      ustawBlad(blad instanceof Error ? blad.message : 'Nie udało się zapisać projektu.');
    } finally { ustawZapisywanie(false); }
  }

  return <form onSubmit={zapisz}>
    <fieldset disabled={zapisywanie}>
      <legend>Dane projektu</legend>
      <label htmlFor="nazwa-projektu">Nazwa projektu</label>
      <input id="nazwa-projektu" value={dane.nazwa} onChange={(zdarzenie) => ustawDane({ ...dane, nazwa: zdarzenie.target.value })} required />
      <label htmlFor="opis-projektu">Opis</label>
      <textarea id="opis-projektu" value={dane.opis} onChange={(zdarzenie) => ustawDane({ ...dane, opis: zdarzenie.target.value })} rows={3} />
      <label htmlFor="status-projektu">Status projektu</label>
      <select id="status-projektu" value={dane.status} onChange={(zdarzenie) => ustawDane({ ...dane, status: zdarzenie.target.value as DaneProjektu['status'] })}>
        {Object.entries(statusyProjektu).map(([status, etykieta]) => <option key={status} value={status}>{etykieta}</option>)}
      </select>
      <label htmlFor="stan-projektu">Podsumowanie aktualnego stanu</label>
      <textarea id="stan-projektu" value={dane.podsumowanieAktualnegoStanu} onChange={(zdarzenie) => ustawDane({ ...dane, podsumowanieAktualnegoStanu: zdarzenie.target.value })} rows={3} />
      <label htmlFor="ostatnia-praca">Ostatnio pracowano nad</label>
      <textarea id="ostatnia-praca" value={dane.ostatnioPracowanoNad} onChange={(zdarzenie) => ustawDane({ ...dane, ostatnioPracowanoNad: zdarzenie.target.value })} rows={2} />
      <label htmlFor="nastepny-krok">Następny krok</label>
      <textarea id="nastepny-krok" value={dane.nastepnyKrok} onChange={(zdarzenie) => ustawDane({ ...dane, nastepnyKrok: zdarzenie.target.value })} rows={2} />
    </fieldset>
    <button disabled={zapisywanie || !dane.nazwa.trim()}>{zapisywanie ? 'Zapisywanie…' : etykietaPrzycisku}</button>
    {blad && <p role="alert">{blad}</p>}
    <p role="status">{komunikat}</p>
  </form>;
}
