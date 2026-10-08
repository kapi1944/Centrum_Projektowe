import { NavLink, Route, Routes } from 'react-router-dom';
import type { RepozytoriumProjektowe } from '../domain/repozytorium';
import { useRejestrProjektowy } from '../features/rejestr/useRejestrProjektowy';
import { Inbox } from '../pages/Inbox';
import { Projekty } from '../pages/Projekty';
import { Start } from '../pages/Start';

export function Aplikacja({ repozytorium }: { repozytorium: RepozytoriumProjektowe }) {
  const rejestr = useRejestrProjektowy(repozytorium);
  return <>
    <a className="pomin-nawigacje" href="#tresc">Przejdź do treści</a>
    <header>
      <strong>Centrum Projektowe</strong>
      <nav aria-label="Główna nawigacja">
        <NavLink to="/" end>Start</NavLink>
        <NavLink to="/projekty">Projekty</NavLink>
        <NavLink to="/inbox">Inbox</NavLink>
      </nav>
    </header>
    <main id="tresc" tabIndex={-1}>
      {rejestr.stan === 'ladowanie' && <p role="status">Odczytywanie danych lokalnych…</p>}
      {rejestr.stan === 'blad' && <p role="alert">{rejestr.blad}</p>}
      {rejestr.stan === 'gotowy' && <Routes>
        <Route path="/" element={<Start projekty={rejestr.projekty} wpisy={rejestr.wpisy} />} />
        <Route path="/projekty" element={<Projekty projekty={rejestr.projekty} dodajProjekt={rejestr.dodajProjekt} />} />
        <Route path="/inbox" element={<Inbox projekty={rejestr.projekty} wpisy={rejestr.wpisy} dodajWpis={rejestr.dodajWpis} />} />
        <Route path="*" element={<><h1>Nie znaleziono strony</h1><NavLink to="/">Wróć na start</NavLink></>} />
      </Routes>}
    </main>
    <footer>Dane są przechowywane w tej przeglądarce. Usunięcie danych witryny usuwa także zapisane projekty i wpisy. Etap 0 nie ma kopii zapasowej ani synchronizacji.</footer>
  </>;
}
