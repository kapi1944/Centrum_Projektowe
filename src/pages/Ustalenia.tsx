import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import type { Projekt, Wpis } from '../domain/modele';
import { etykietyFiltrowDecyzji, type AnalizaWplywu, type DaneDecyzji, type Decyzja, type OperacjaUstalen } from '../domain/ustalenia';
import { FormularzDecyzji } from '../features/ustalenia/FormularzDecyzji';
import { KartaDecyzji } from '../features/ustalenia/KartaDecyzji';

export function Ustalenia({ projekty, wpisy, decyzje, analizy, wykonaj }: {
  projekty: Projekt[]; wpisy: Wpis[]; decyzje: Decyzja[]; analizy: AnalizaWplywu[];
  wykonaj: (operacja: OperacjaUstalen) => Promise<void>;
}) {
  const { projektId } = useParams();
  const [parametry, ustawParametry] = useSearchParams();
  const [filtr, ustawFiltr] = useState('wszystkie');
  const [tworzenie, ustawTworzenie] = useState(false);
  const projekt = projekty.find((projekt) => projekt.id === projektId);
  if (!projekt) return <><h1>Nie znaleziono projektu</h1><Link to="/projekty">Projekty</Link></>;
  const poczatkowe: DaneDecyzji = { tytul: '', opis: '', projektIds: [projekt.id], typZrodla: 'USER', nazwaZrodla: 'Wpis ręczny', odniesienieZrodla: '', wpisZrodlowyId: null, notatki: '', powiazaneElementy: [] };
  const widoczne = decyzje.filter((decyzja) => decyzja.projektIds.includes(projekt.id)
    && (decyzja.id === parametry.get('decyzja') || filtr === 'wszystkie' || decyzja.status === filtr));
  return <>
    <Link to={`/projekty/${projekt.id}`}>Wróć do projektu</Link>
    <h1>Ustalenia — {projekt.nazwa}</h1>
    <p>Decyzja jest ustaleniem, a jej status wdrożenia nie tworzy zadania.</p>
    {!projekt.zarchiwizowano && <button onClick={() => ustawTworzenie(!tworzenie)}>{tworzenie ? 'Zamknij nową decyzję' : 'Nowa decyzja'}</button>}
    {tworzenie && <FormularzDecyzji poczatkowe={poczatkowe} projekty={projekty} wpisy={wpisy} prefiks="nowa" etykieta="Zapisz propozycję decyzji" zapisz={async (dane) => {
      await wykonaj({ rodzaj: 'utworz', id: crypto.randomUUID(), dane });
      ustawTworzenie(false);
      ustawFiltr('PROPOSED');
    }} />}
    <p><label htmlFor="filtr-ustalen">Widok ustaleń</label>{' '}<select id="filtr-ustalen" value={filtr} onChange={(zdarzenie) => { ustawFiltr(zdarzenie.target.value); ustawParametry({}); }}>
      <option value="wszystkie">Wszystkie</option>
      {Object.entries(etykietyFiltrowDecyzji).map(([status, nazwa]) => <option key={status} value={status}>{nazwa}</option>)}
    </select></p>
    {!widoczne.length && <p>Brak ustaleń w tym widoku.</p>}
    {widoczne.map((decyzja) => <KartaDecyzji key={`${decyzja.id}-${decyzja.wersja}`} decyzja={decyzja} decyzje={decyzje} projekty={projekty} wpisy={wpisy} analizy={analizy} projektId={projekt.id} wykonaj={wykonaj} />)}
  </>;
}
