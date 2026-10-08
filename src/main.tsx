import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Aplikacja } from './app/Aplikacja';
import { utworzRepozytoriumIndexedDb } from './infrastructure/repozytoriumIndexedDb';
import './shared/style.css';

const repozytorium = utworzRepozytoriumIndexedDb();

createRoot(document.getElementById('root')!).render(
  <StrictMode><BrowserRouter><Aplikacja repozytorium={repozytorium} /></BrowserRouter></StrictMode>,
);
