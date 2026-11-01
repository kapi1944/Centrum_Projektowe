import { useState } from 'react';
import { Link } from 'react-router-dom';
import { statusyProjektu, type DaneProjektu, type Projekt } from '../domain/modele';
import { FormularzProjektu } from '../features/projekty/FormularzProjektu';
import { formatujDate } from '../shared/formatujDate';
import { EtykietaStatusu, NaglowekSekcji, PustyStan } from '../shared/Komponenty';

const pusteDane: DaneProjektu = {
  nazwa: '', opis: '', status: 'IDEA', podsumowanieAktualnegoStanu: '', ostatnioPracowanoNad: '', nastepnyKrok: '',
};

export function Projekty({ projekty, dodajProjekt }: {
  projekty: Projekt[];
  dodajProjekt: (dane: DaneProjektu) => Promise<void>;
}) {
  const [numerFormularza, ustawNumerFormularza] = useState(0);
  return <>
    <NaglowekSekcji poziom={1} tytul="Projekty" opis="Twoje prywatne projekty i miejsce na ich dalszy rozwój." />
    <FormularzProjektu key={numerFormularza} poczatkoweDane={pusteDane} etykietaPrzycisku="Dodaj projekt" zapiszDane={async (dane) => {
      await dodajProjekt(dane);
      ustawNumerFormularza((poprzedni) => poprzedni + 1);
    }} />
    {projekty.length === 0 ? <PustyStan>Brak projektów. Dodaj pierwszy projekt powyżej.</PustyStan> : <ul className="lista-rekordow karty-projektow">{projekty.map((projekt) => <li key={projekt.id}>
      <h2><Link to={`/projekty/${projekt.id}`}>{projekt.nazwa}</Link></h2>
      <p><EtykietaStatusu ton={projekt.zarchiwizowano ? 'neutralny' : projekt.status === 'ACTIVE' ? 'sukces' : projekt.status === 'PAUSED' ? 'ostrzezenie' : 'akcent'}>{statusyProjektu[projekt.status]}{projekt.zarchiwizowano ? ' · Archiwalny' : ''}</EtykietaStatusu></p>
      <p>{projekt.opis || 'Brak opisu.'}</p>
      <small>Ostatnia aktywność: {formatujDate(projekt.ostatniaAktywnosc)}</small>
    </li>)}</ul>}
  </>;
}
