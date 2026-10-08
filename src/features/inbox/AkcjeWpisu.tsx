import { useRef, useState, type FormEvent } from 'react';
import type { AkcjaWpisu, Projekt, Wpis } from '../../domain/modele';

export function AkcjeWpisu({ wpis, projekty, wykonajAkcje }: {
  wpis: Wpis;
  projekty: Projekt[];
  wykonajAkcje: (id: string, akcja: AkcjaWpisu) => Promise<void>;
}) {
  const [formularz, ustawFormularz] = useState<'projekt' | 'przypisanie' | null>(null);
  const [nazwa, ustawNazwe] = useState('');
  const [opis, ustawOpis] = useState('');
  const [projektId, ustawProjektId] = useState('');
  const [zapisywanie, ustawZapisywanie] = useState(false);
  const blokada = useRef(false);
  const [blad, ustawBlad] = useState('');
  const [komunikat, ustawKomunikat] = useState('');

  async function wykonaj(akcja: AkcjaWpisu) {
    if (blokada.current) return;
    blokada.current = true;
    ustawZapisywanie(true);
    ustawBlad('');
    ustawKomunikat('');
    try {
      await wykonajAkcje(wpis.id, akcja);
      ustawFormularz(null);
      ustawKomunikat('Zapisano zmianę wpisu. Oryginał zachowany.');
    } catch (blad) {
      ustawBlad(blad instanceof Error ? blad.message : 'Nie udało się zapisać zmiany. Spróbuj ponownie.');
    } finally {
      blokada.current = false;
      ustawZapisywanie(false);
    }
  }

  function zapiszProjekt(zdarzenie: FormEvent<HTMLFormElement>) {
    zdarzenie.preventDefault();
    void wykonaj({ rodzaj: 'nowyProjekt', nazwa, opis, idProjektu: crypto.randomUUID(), idZdarzeniaProjektu: crypto.randomUUID() });
  }

  return <>
    {wpis.status === 'UNPROCESSED' && <>
      <div className="akcje-wpisu">
        {!wpis.projektId && <>
          <button type="button" disabled={zapisywanie} onClick={() => ustawFormularz('projekt')}>Utwórz projekt</button>
          <button type="button" disabled={zapisywanie} onClick={() => ustawFormularz('przypisanie')}>Dołącz do projektu</button>
        </>}
        <button type="button" disabled={zapisywanie || !!wpis.odlozonoDoAnalizy} onClick={() => void wykonaj({ rodzaj: 'odlozenie' })}>Analizuj później</button>
        <button type="button" disabled={zapisywanie} onClick={() => void wykonaj({ rodzaj: 'odrzucenie' })}>Odrzuć</button>
      </div>
      {formularz === 'projekt' && <form onSubmit={zapiszProjekt}>
        <fieldset disabled={zapisywanie}>
          <legend>Nowy projekt z wpisu</legend>
          <label htmlFor={`nazwa-${wpis.id}`}>Nazwa nowego projektu</label>
          <input id={`nazwa-${wpis.id}`} value={nazwa} onChange={(zdarzenie) => ustawNazwe(zdarzenie.target.value)} required />
          <label htmlFor={`opis-${wpis.id}`}>Opis nowego projektu (opcjonalny)</label>
          <textarea id={`opis-${wpis.id}`} value={opis} onChange={(zdarzenie) => ustawOpis(zdarzenie.target.value)} rows={3} />
          <button disabled={!nazwa.trim()}>Utwórz i przypnij wpis</button>
          <button type="button" onClick={() => ustawFormularz(null)}>Anuluj</button>
        </fieldset>
      </form>}
      {formularz === 'przypisanie' && <form onSubmit={(zdarzenie) => {
        zdarzenie.preventDefault();
        void wykonaj({ rodzaj: 'przypisanie', projektId });
      }}>
        <fieldset disabled={zapisywanie}>
          <legend>Dołączenie wpisu</legend>
          <label htmlFor={`projekt-${wpis.id}`}>Projekt docelowy</label>
          <select id={`projekt-${wpis.id}`} value={projektId} onChange={(zdarzenie) => ustawProjektId(zdarzenie.target.value)} required>
            <option value="">Wybierz projekt</option>
            {projekty.filter((projekt) => !projekt.zarchiwizowano).map((projekt) => <option key={projekt.id} value={projekt.id}>{projekt.nazwa}</option>)}
          </select>
          {!projekty.some((projekt) => !projekt.zarchiwizowano) && <p>Brak dostępnych projektów. Możesz utworzyć projekt z tego wpisu.</p>}
          <button disabled={!projektId}>Dołącz wpis</button>
          <button type="button" onClick={() => ustawFormularz(null)}>Anuluj</button>
        </fieldset>
      </form>}
    </>}
    {blad && <p role="alert">{blad}</p>}
    <p role="status">{komunikat}</p>
  </>;
}
