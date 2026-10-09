import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AnalizaWpisu, ElementAnalizy } from '../../domain/analizaWpisu';
import type { Projekt, Wpis } from '../../domain/modele';
import { typyPracy, type OperacjaRealizacji, type StanRealizacji } from '../../domain/realizacja';

export function KonwersjaAnalizy({ analiza, element, wpis, projekty, realizacja, wykonaj }: {
  analiza: AnalizaWpisu; element: ElementAnalizy; wpis: Wpis; projekty: Projekt[]; realizacja: StanRealizacji;
  wykonaj: (operacja: OperacjaRealizacji) => Promise<void>;
}) {
  const [otwarta, ustawOtwarta] = useState(false);
  const [projektId, ustawProjektId] = useState(wpis.projektId ?? '');
  const [typ, ustawTyp] = useState<keyof typeof typyPracy>('TASK');
  const [blad, ustawBlad] = useState('');
  const [zapisywanie, ustawZapisywanie] = useState(false);
  const blokada = useRef(false);
  if (analiza.status !== 'APPLIED' || element.zastosowanie?.rodzaj !== 'RETAINED'
    || !['ACCEPTED', 'EDITED'].includes(element.statusReview) || !['RECOMMENDED_ACTION', 'OPEN_QUESTION'].includes(element.typ)) return null;
  const praca = realizacja.elementyPracy.find((praca) => praca.pochodzenie?.analizaWpisuId === analiza.id && praca.pochodzenie.elementAnalizyId === element.id);
  const pytanie = realizacja.pytania.find((pytanie) => pytanie.pochodzenie?.analizaWpisuId === analiza.id && pytanie.pochodzenie.elementAnalizyId === element.id);
  const utworzony = praca ?? pytanie;
  if (utworzony) return <p>Przekształcono: <Link to={`/projekty/${utworzony.projektId}#${praca ? 'praca' : 'pytanie'}-${utworzony.id}`}>{praca ? 'Otwórz element pracy' : 'Otwórz pytanie'}</Link></p>;
  const dostepneProjekty = projekty.filter((projekt) => !projekt.zarchiwizowano && (!wpis.projektId || wpis.projektId === projekt.id));
  async function utworz() {
    if (blokada.current) return;
    blokada.current = true; ustawZapisywanie(true); ustawBlad('');
    try { await wykonaj({ rodzaj: 'konwertuj', id: crypto.randomUUID(), projektId, analizaWpisuId: analiza.id, elementAnalizyId: element.id, typPracy: typ }); ustawOtwarta(false); }
    catch (blad) { ustawBlad(blad instanceof Error ? blad.message : 'Nie udało się przekształcić elementu analizy.'); }
    finally { blokada.current = false; ustawZapisywanie(false); }
  }
  return <>
    <button disabled={zapisywanie} onClick={() => ustawOtwarta(!otwarta)}>{element.typ === 'RECOMMENDED_ACTION' ? 'Utwórz element pracy' : 'Utwórz otwarte pytanie'}</button>
    {otwarta && <fieldset disabled={zapisywanie}>
      <legend>Potwierdź przekształcenie</legend>
      <p>Powstanie osobny rekord z zatwierdzonej treści. Oryginał wpisu i analiza pozostaną zachowane.</p>
      <label>Projekt docelowy<select value={projektId} onChange={(zdarzenie) => ustawProjektId(zdarzenie.target.value)}><option value="">Wybierz projekt</option>{dostepneProjekty.map((projekt) => <option key={projekt.id} value={projekt.id}>{projekt.nazwa}</option>)}</select></label>
      {element.typ === 'RECOMMENDED_ACTION' && <label>Rodzaj pracy<select value={typ} onChange={(zdarzenie) => ustawTyp(zdarzenie.target.value as keyof typeof typyPracy)}>{Object.entries(typyPracy).map(([typ, nazwa]) => <option key={typ} value={typ}>{nazwa}</option>)}</select></label>}
      {!dostepneProjekty.length && <p>Dodaj niearchiwalny projekt, aby kontynuować.</p>}
      <button disabled={!dostepneProjekty.some((projekt) => projekt.id === projektId)} onClick={() => void utworz()}>{zapisywanie ? 'Zapisywanie…' : 'Potwierdź utworzenie'}</button>
    </fieldset>}
    {blad && <p role="alert">{blad}</p>}
  </>;
}
