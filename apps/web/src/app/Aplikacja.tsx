import { KopieZapasowe } from '../pages/KopieZapasowe';
import { useEffect } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import type { RepozytoriumProjektowe } from '../domain/repozytorium';
import { useRejestrProjektowy } from '../features/rejestr/useRejestrProjektowy';
import { Inbox } from '../pages/Inbox';
import { Projekty } from '../pages/Projekty';
import { Projekt } from '../pages/Projekt';
import { Start } from '../pages/Start';
import { Ustalenia } from '../pages/Ustalenia';
import { Korekty } from '../pages/Korekty';
import { WymagaUwagi } from '../pages/WymagaUwagi';
import { RepozytoriaKontekst } from '../pages/RepozytoriaKontekst';
import { PowlokaAplikacji } from './PowlokaAplikacji';

export function Aplikacja({ repozytorium }: { repozytorium: RepozytoriumProjektowe }) {
  const rejestr = useRejestrProjektowy(repozytorium);
  const lokalizacja = useLocation();
  useEffect(() => {
    if (rejestr.stan !== 'gotowy' || !lokalizacja.hash) return;
    let identyfikator: string;
    try { identyfikator = decodeURIComponent(lokalizacja.hash.slice(1)); }
    catch { return; }
    const cel = document.getElementById(identyfikator);
    if (cel) {
      cel.scrollIntoView?.({ block: 'start' });
      if (!cel.hasAttribute('tabindex')) cel.tabIndex = -1;
      cel.focus({ preventScroll: true });
    }
  }, [rejestr.stan, lokalizacja.pathname, lokalizacja.hash]);
  return <PowlokaAplikacji>
      {rejestr.stan === 'ladowanie' && <p role="status">Odczytywanie danych lokalnych…</p>}
      {rejestr.stan === 'blad' && <p role="alert">{rejestr.blad}</p>}
      {rejestr.stan === 'gotowy' && <Routes>
        <Route path="/projekty/:projektId/repozytoria" element={<RepozytoriaKontekst key={lokalizacja.pathname} dane={rejestr.daneKorekt} wykonaj={rejestr.wykonajRepozytorium} />} />
        <Route path="/uwaga" element={<WymagaUwagi projekty={rejestr.projekty} elementy={rejestr.obrazyProjektow.flatMap((obraz) => obraz.uwaga)} />} />
        <Route path="/projekty/:projektId/korekty" element={<Korekty key={lokalizacja.pathname} dane={rejestr.daneKorekt} wykonaj={rejestr.wykonajKorekte} analizuj={rejestr.analizujKorekte} />} />
        <Route path="/" element={<Start projekty={rejestr.projekty} wpisy={rejestr.wpisy} obrazyProjektow={rejestr.obrazyProjektow} zdarzenia={rejestr.zdarzenia} />} />
        <Route path="/projekty" element={<Projekty projekty={rejestr.projekty} dodajProjekt={rejestr.dodajProjekt} />} />
        <Route path="/projekty/:projektId" element={<Projekt key={lokalizacja.pathname} obrazyProjektow={rejestr.obrazyProjektow} projekty={rejestr.projekty} zdarzenia={rejestr.zdarzenia} zmienProjekt={rejestr.zmienProjekt} realizacja={rejestr.realizacja} decyzje={rejestr.decyzje} wykonajRealizacje={rejestr.wykonajRealizacje} />} />
        <Route path="/projekty/:projektId/ustalenia" element={<Ustalenia key={lokalizacja.pathname} projekty={rejestr.projekty} wpisy={rejestr.wpisy} decyzje={rejestr.decyzje} analizy={rejestr.analizy} wykonaj={rejestr.wykonajUstalenie} elementyPracy={rejestr.realizacja.elementyPracy} />} />
        <Route path="/inbox" element={<Inbox projekty={rejestr.projekty} wpisy={rejestr.wpisy} dodajWpis={rejestr.dodajWpis} wykonajAkcjeWpisu={rejestr.wykonajAkcjeWpisu} analizy={rejestr.analizy} wykonajUstalenie={rejestr.wykonajUstalenie} analizyWpisow={rejestr.analizyWpisow} przebiegiAnaliz={rejestr.przebiegiAnaliz} preferujAnalize={rejestr.preferujAnalize} analizujWpis={rejestr.analizujWpis} wykonajAnalizeWpisu={rejestr.wykonajAnalizeWpisu} realizacja={rejestr.realizacja} wykonajRealizacje={rejestr.wykonajRealizacje} />} />
        <Route path="/dane" element={<KopieZapasowe repozytorium={repozytorium} odswiez={rejestr.odswiez} />} />
        <Route path="*" element={<><h1>Nie znaleziono strony</h1><NavLink to="/">Wróć na start</NavLink></>} />
      </Routes>}
  </PowlokaAplikacji>;
}
