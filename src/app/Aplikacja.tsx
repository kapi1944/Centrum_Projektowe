import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import type { RepozytoriumProjektowe } from '../domain/repozytorium';
import { useRejestrProjektowy } from '../features/rejestr/useRejestrProjektowy';
import { Inbox } from '../pages/Inbox';
import { Projekty } from '../pages/Projekty';
import { Projekt } from '../pages/Projekt';
import { Start } from '../pages/Start';
import { Ustalenia } from '../pages/Ustalenia';

export function Aplikacja({ repozytorium }: { repozytorium: RepozytoriumProjektowe }) {
  const rejestr = useRejestrProjektowy(repozytorium);
  const lokalizacja = useLocation();
  return <>
    <a className="pomin-nawigacje" href="#tresc">Przejdź do treści</a>
    <header>
      <strong>Centrum Projektowe</strong>
      <nav aria-label="Główna nawigacja">
        <NavLink to="/" end>Start</NavLink>
        <NavLink to="/projekty">Projekty</NavLink>
        <NavLink to="/inbox">Skrzynka</NavLink>
      </nav>
    </header>
    <main id="tresc" tabIndex={-1}>
      {rejestr.stan === 'ladowanie' && <p role="status">Odczytywanie danych lokalnych…</p>}
      {rejestr.stan === 'blad' && <p role="alert">{rejestr.blad}</p>}
      {rejestr.stan === 'gotowy' && <Routes>
        <Route path="/" element={<Start projekty={rejestr.projekty} wpisy={rejestr.wpisy} />} />
        <Route path="/projekty" element={<Projekty projekty={rejestr.projekty} dodajProjekt={rejestr.dodajProjekt} />} />
        <Route path="/projekty/:projektId" element={<Projekt key={lokalizacja.pathname} projekty={rejestr.projekty} zdarzenia={rejestr.zdarzenia} zmienProjekt={rejestr.zmienProjekt} realizacja={rejestr.realizacja} decyzje={rejestr.decyzje} wykonajRealizacje={rejestr.wykonajRealizacje} />} />
        <Route path="/projekty/:projektId/ustalenia" element={<Ustalenia key={lokalizacja.pathname} projekty={rejestr.projekty} wpisy={rejestr.wpisy} decyzje={rejestr.decyzje} analizy={rejestr.analizy} wykonaj={rejestr.wykonajUstalenie} elementyPracy={rejestr.realizacja.elementyPracy} />} />
        <Route path="/inbox" element={<Inbox projekty={rejestr.projekty} wpisy={rejestr.wpisy} dodajWpis={rejestr.dodajWpis} wykonajAkcjeWpisu={rejestr.wykonajAkcjeWpisu} analizy={rejestr.analizy} wykonajUstalenie={rejestr.wykonajUstalenie} analizyWpisow={rejestr.analizyWpisow} analizujWpis={rejestr.analizujWpis} wykonajAnalizeWpisu={rejestr.wykonajAnalizeWpisu} realizacja={rejestr.realizacja} wykonajRealizacje={rejestr.wykonajRealizacje} />} />
        <Route path="*" element={<><h1>Nie znaleziono strony</h1><NavLink to="/">Wróć na start</NavLink></>} />
      </Routes>}
    </main>
    <footer>Dane są przechowywane w tej przeglądarce. Usunięcie danych witryny usuwa także zapisane projekty, wpisy i historię. Aplikacja nie ma kopii zapasowej ani synchronizacji.</footer>
  </>;
}
