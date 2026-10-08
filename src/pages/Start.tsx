import { Link } from 'react-router-dom';
import type { Projekt, Wpis } from '../domain/modele';
import { formatujDate } from '../shared/formatujDate';

export function Start({ projekty, wpisy }: { projekty: Projekt[]; wpisy: Wpis[] }) {
  const ostatniWpis = [...wpisy].sort((lewy, prawy) => prawy.utworzono.localeCompare(lewy.utworzono))[0];
  return (
    <>
      <h1>Centrum Projektowe</h1>
      <p>Prywatna pamięć projektowa. Zapisuj pomysły i wracaj do swoich projektów.</p>
      <section aria-labelledby="tytul-podsumowania">
        <h2 id="tytul-podsumowania">Twój punkt startowy</h2>
        <p>Projekty: {projekty.length} · Surowe wpisy: {wpisy.length}</p>
        <div className="odnosniki"><Link to="/projekty">Otwórz projekty</Link><Link to="/inbox">Zapisz wpis w Inbox</Link></div>
      </section>
      <section aria-labelledby="tytul-ostatniego-wpisu">
        <h2 id="tytul-ostatniego-wpisu">Ostatnio zapisany wpis</h2>
        {ostatniWpis ? <><p className="surowy-wpis">{ostatniWpis.trescOryginalna}</p><small>{formatujDate(ostatniWpis.utworzono)}</small></> : <p>Nie masz jeszcze wpisów. Zacznij od zapisania myśli w Inbox.</p>}
        <p>Widok „Gdzie skończyłem?” powstanie w etapie 2. Analiza i propozycje zmian pojawią się w kolejnych etapach.</p>
      </section>
    </>
  );
}
