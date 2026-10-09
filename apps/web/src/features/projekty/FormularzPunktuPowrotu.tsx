import { useState, type FormEvent } from 'react';
import type { PunktPowrotu } from '../../domain/modele';

export function FormularzPunktuPowrotu({ poczatkoweDane, zapiszDane, anuluj }: {
  poczatkoweDane: PunktPowrotu;
  zapiszDane: (dane: PunktPowrotu) => Promise<void>;
  anuluj: () => void;
}) {
  const [dane, ustawDane] = useState(poczatkoweDane);
  const [zapisywanie, ustawZapisywanie] = useState(false);
  const [blad, ustawBlad] = useState('');

  async function zapisz(zdarzenie: FormEvent<HTMLFormElement>) {
    zdarzenie.preventDefault();
    ustawBlad('');
    ustawZapisywanie(true);
    try { await zapiszDane(dane); }
    catch (blad) { ustawBlad(blad instanceof Error ? blad.message : 'Nie udało się zapisać punktu powrotu.'); }
    finally { ustawZapisywanie(false); }
  }

  return <form onSubmit={zapisz}>
    <fieldset disabled={zapisywanie}>
      <legend>Punkt powrotu</legend>
      <label htmlFor="powrot-ostatnio">Ostatnio robiłem</label>
      <textarea id="powrot-ostatnio" rows={3} value={dane.ostatnioPracowanoNad} onChange={(zdarzenie) => ustawDane({ ...dane, ostatnioPracowanoNad: zdarzenie.target.value })} />
      <label htmlFor="powrot-stan">Aktualny stan</label>
      <textarea id="powrot-stan" rows={3} value={dane.podsumowanieAktualnegoStanu} onChange={(zdarzenie) => ustawDane({ ...dane, podsumowanieAktualnegoStanu: zdarzenie.target.value })} />
      <label htmlFor="powrot-krok">Następny krok</label>
      <textarea id="powrot-krok" rows={3} value={dane.nastepnyKrok} onChange={(zdarzenie) => ustawDane({ ...dane, nastepnyKrok: zdarzenie.target.value })} />
      <div className="akcje-wpisu">
        <button>{zapisywanie ? 'Zapisywanie…' : 'Zapisz punkt powrotu'}</button>
        <button type="button" onClick={anuluj}>Anuluj</button>
      </div>
    </fieldset>
    {blad && <p role="alert">{blad}</p>}
  </form>;
}
