import { render, screen, within } from '@testing-library/react';
import osoba from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Aplikacja } from '../../app/Aplikacja';
import { utworzProjekt, utworzWpis } from '../../domain/operacje';
import { utworzRepozytoriumIndexedDb } from '../../infrastructure/repozytoriumIndexedDb';
import { RuleBasedAnalysisProvider } from '../../infrastructure/RuleBasedAnalysisProvider';

function kontekst() { return { idZdarzenia: crypto.randomUUID(), czas: '2026-10-08T10:00:00Z', zrodlo: { typ: 'USER', nazwa: 'Użytkownik' } as const }; }
async function przygotuj() {
  const nazwaBazy = crypto.randomUUID();
  const repozytorium = utworzRepozytoriumIndexedDb(nazwaBazy);
  await repozytorium.dodajProjekt({ ...utworzProjekt('Realizacja', 'p1', kontekst().czas), nastepnyKrok: 'Ręczny krok' }, kontekst());
  await repozytorium.wykonajOperacjeUstalen({ rodzaj: 'utworz', id: 'd1', dane: { tytul: 'Zapis lokalny', opis: 'Ustalenie', projektIds: ['p1'], typZrodla: 'USER', nazwaZrodla: 'Użytkownik', odniesienieZrodla: '', wpisZrodlowyId: null, notatki: '', powiazaneElementy: [] } }, kontekst());
  return { nazwaBazy, repozytorium, uzytkownik: osoba.setup() };
}

describe('Realizacja projektu w interfejsie', () => {
  it('tworzy hierarchię, powiązanie z decyzją, kończy pracę i odczytuje stan po ponownym otwarciu', async () => {
    const { nazwaBazy, repozytorium, uzytkownik } = await przygotuj();
    const widok = render(<MemoryRouter initialEntries={['/projekty/p1']}><Aplikacja repozytorium={repozytorium} /></MemoryRouter>);
    await uzytkownik.click(await screen.findByRole('button', { name: 'Nowy obszar' }));
    await uzytkownik.type(screen.getByLabelText('Nazwa obszaru'), 'Przechowywanie');
    await uzytkownik.click(screen.getByRole('button', { name: 'Zapisz dane realizacji' }));
    await screen.findByRole('region', { name: 'Obszar: Przechowywanie' });
    await uzytkownik.click(screen.getByRole('button', { name: 'Nowy etap' }));
    await uzytkownik.type(screen.getByLabelText('Nazwa etapu'), 'Próba trwałości');
    await uzytkownik.selectOptions(screen.getByLabelText('Obszar'), screen.getByRole('option', { name: 'Przechowywanie' }));
    await uzytkownik.click(screen.getByRole('button', { name: 'Zapisz dane realizacji' }));
    await screen.findByRole('region', { name: 'Etap: Próba trwałości' });
    await uzytkownik.click(screen.getByRole('button', { name: 'Nowy element pracy' }));
    await uzytkownik.type(screen.getByLabelText('Tytuł elementu pracy'), 'Sprawdzić odczyt');
    await uzytkownik.selectOptions(screen.getByLabelText('Rodzaj pracy'), 'EXPERIMENT');
    await uzytkownik.selectOptions(screen.getByLabelText('Obszar'), screen.getByRole('option', { name: 'Przechowywanie' }));
    await uzytkownik.selectOptions(screen.getByLabelText('Etap'), screen.getByRole('option', { name: 'Próba trwałości' }));
    await uzytkownik.click(screen.getByRole('checkbox', { name: 'DEC-0001: Zapis lokalny' }));
    await uzytkownik.click(screen.getByRole('button', { name: 'Zapisz dane realizacji' }));
    const etap = screen.getByRole('region', { name: 'Etap: Próba trwałości' });
    const karta = await within(etap).findByRole('article', { name: 'Element pracy: Sprawdzić odczyt' });
    expect(within(karta).getByText('Eksperyment · Do zrobienia')).toBeInTheDocument();
    await uzytkownik.click(within(karta).getByRole('link', { name: 'DEC-0001' }));
    const decyzja = await screen.findByRole('article', { name: 'DEC-0001: Zapis lokalny' });
    await uzytkownik.click(within(decyzja).getByRole('link', { name: 'Sprawdzić odczyt' }));
    await uzytkownik.click(await screen.findByRole('button', { name: 'Ukończ element pracy' }));
    await screen.findByText('Eksperyment · Zakończone');
    expect(screen.getByText('Ręczny krok')).toBeInTheDocument();
    widok.unmount();
    render(<MemoryRouter initialEntries={['/projekty/p1']}><Aplikacja repozytorium={utworzRepozytoriumIndexedDb(nazwaBazy)} /></MemoryRouter>);
    expect(await screen.findByText('Eksperyment · Zakończone')).toBeInTheDocument();
    expect(screen.getByText('Ukończono element pracy: Sprawdzić odczyt')).toBeInTheDocument();
  });

  it('pokazuje pytania i blokady w punkcie powrotu, pozwala odpowiedzieć i rozwiązać blokadę', async () => {
    const { repozytorium, uzytkownik } = await przygotuj();
    render(<MemoryRouter initialEntries={['/projekty/p1']}><Aplikacja repozytorium={repozytorium} /></MemoryRouter>);
    await uzytkownik.click(await screen.findByRole('button', { name: 'Nowe pytanie' }));
    await uzytkownik.type(screen.getByLabelText('Treść pytania'), 'Czy odczyt jest trwały?');
    await uzytkownik.click(screen.getByRole('button', { name: 'Zapisz dane realizacji' }));
    const pytanie = await screen.findByRole('article', { name: 'Pytanie: Czy odczyt jest trwały?' });
    const punkt = screen.getByRole('region', { name: 'Gdzie skończyłem?' });
    expect(within(punkt).getByRole('link', { name: 'Czy odczyt jest trwały?' })).toBeInTheDocument();
    await uzytkownik.click(within(pytanie).getByRole('button', { name: 'Odpowiedz' }));
    await uzytkownik.type(screen.getByLabelText('Odpowiedź'), 'Tak, sprawdzono');
    await uzytkownik.click(screen.getByRole('button', { name: 'Zapisz dane realizacji' }));
    await within(pytanie).findByText('Odpowiedź: Tak, sprawdzono');
    expect(within(punkt).getByText('Brak otwartych pytań.')).toBeInTheDocument();
    await uzytkownik.click(screen.getByRole('button', { name: 'Nowa blokada' }));
    await uzytkownik.type(screen.getByLabelText('Tytuł blokady'), 'Brak urządzenia');
    await uzytkownik.selectOptions(screen.getByLabelText('Waga blokady'), 'HIGH');
    await uzytkownik.click(screen.getByRole('button', { name: 'Zapisz dane realizacji' }));
    const blokada = await screen.findByRole('article', { name: 'Blokada: Brak urządzenia' });
    expect(within(punkt).getByRole('link', { name: 'Brak urządzenia' })).toBeInTheDocument();
    await uzytkownik.click(within(blokada).getByRole('button', { name: 'Rozwiąż blokadę' }));
    await within(blokada).findByText('Rozwiązana · Waga: Wysoka');
    expect(within(punkt).getByText('Brak aktywnych blokad.')).toBeInTheDocument();
    expect(screen.getByText('Ręczny krok')).toBeInTheDocument();
  });

  it('jawnie konwertuje dawną zastosowaną analizę, dopiero po potwierdzeniu, z odnośnikiem do źródła', async () => {
    const { repozytorium, uzytkownik, nazwaBazy } = await przygotuj();
    const wpis = utworzWpis('Trzeba sprawdzić zapis.\nCzy działa?', null, 'w1', kontekst().czas);
    await repozytorium.dodajWpis(wpis, kontekst());
    let wynik = await repozytorium.wykonajOperacjeAnalizyWpisu({ rodzaj: 'generuj', id: 'a1', wpisId: 'w1', wynik: await new RuleBasedAnalysisProvider().analizuj(wpis.trescOryginalna) }, kontekst());
    wynik = await repozytorium.wykonajOperacjeAnalizyWpisu({ rodzaj: 'rozpocznij', id: 'a1', wersja: wynik.analizaWpisu.wersja }, kontekst());
    for (const element of wynik.analizaWpisu.elementy) wynik = await repozytorium.wykonajOperacjeAnalizyWpisu({ rodzaj: 'review', id: 'a1', wersja: wynik.analizaWpisu.wersja, elementId: element.id, status: 'ACCEPTED' }, kontekst());
    wynik = await repozytorium.wykonajOperacjeAnalizyWpisu({ rodzaj: 'zakoncz', id: 'a1', wersja: wynik.analizaWpisu.wersja }, kontekst());
    await repozytorium.wykonajOperacjeAnalizyWpisu({ rodzaj: 'zastosuj', id: 'a1', wersja: wynik.analizaWpisu.wersja }, kontekst());
    const widok = render(<MemoryRouter initialEntries={['/inbox']}><Aplikacja repozytorium={repozytorium} /></MemoryRouter>);
    await uzytkownik.click(await screen.findByRole('button', { name: 'Utwórz element pracy' }));
    await uzytkownik.selectOptions(screen.getByLabelText('Projekt docelowy'), 'p1');
    await uzytkownik.selectOptions(screen.getByLabelText('Rodzaj pracy'), 'CONTACT');
    expect((await repozytorium.pobierzRealizacje()).elementyPracy).toEqual([]);
    await uzytkownik.click(screen.getByRole('button', { name: 'Potwierdź utworzenie' }));
    await screen.findByRole('link', { name: 'Otwórz element pracy' });
    await uzytkownik.click(screen.getByRole('button', { name: 'Utwórz otwarte pytanie' }));
    await uzytkownik.selectOptions(screen.getByLabelText('Projekt docelowy'), 'p1');
    await uzytkownik.click(screen.getByRole('button', { name: 'Potwierdź utworzenie' }));
    await uzytkownik.click(await screen.findByRole('link', { name: 'Otwórz pytanie' }));
    await screen.findByRole('article', { name: 'Pytanie: Czy działa?' });
    expect(screen.getAllByRole('link', { name: 'Wpis źródłowy w Skrzynce' })).toHaveLength(2);
    expect(screen.getByRole('article', { name: 'Element pracy: Trzeba sprawdzić zapis.' })).toHaveTextContent('Kontakt');
    widok.unmount();
    render(<MemoryRouter initialEntries={['/inbox']}><Aplikacja repozytorium={utworzRepozytoriumIndexedDb(nazwaBazy)} /></MemoryRouter>);
    expect(await screen.findByRole('link', { name: 'Otwórz element pracy' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Utwórz element pracy' })).not.toBeInTheDocument();
    expect((await repozytorium.pobierzWpisy())[0]).toEqual({ ...wpis, status: 'APPLIED', odlozonoDoAnalizy: null });
  });
});
