import { render, screen, waitFor, within } from '@testing-library/react';
import uzytkownik from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Aplikacja } from '../app/Aplikacja';
import { utworzRepozytoriumIndexedDb } from '../infrastructure/repozytoriumIndexedDb';
import { utworzProjekt, utworzWpis } from '../domain/operacje';
import { uruchomAnalizeWpisu } from '../application/przypadkiUzycia';
import { RuleBasedAnalysisProvider } from '../infrastructure/RuleBasedAnalysisProvider';

function kontekst() { return { idZdarzenia: crypto.randomUUID(), czas: '2026-10-09T12:00:00Z', zrodlo: { typ: 'USER' as const, nazwa: 'Użytkownik' } }; }
async function przygotuj() {
  const nazwaBazy = crypto.randomUUID(); const repozytorium = utworzRepozytoriumIndexedDb(nazwaBazy);
  await repozytorium.dodajProjekt({ ...utworzProjekt('Projekt', 'p1', kontekst().czas), opis: 'Manager projektów' }, kontekst());
  return { repozytorium, nazwaBazy };
}
function pokaz(repozytorium: ReturnType<typeof utworzRepozytoriumIndexedDb>) {
  return render(<MemoryRouter initialEntries={['/projekty/p1/korekty']}><Aplikacja repozytorium={repozytorium} /></MemoryRouter>);
}
afterEach(() => vi.restoreAllMocks());

describe('UI korekt', () => {
  it('pokazuje Delta, stosuje EDITED po częściowym review, zachowuje historię po ponownym otwarciu', async () => {
    const { repozytorium, nazwaBazy } = await przygotuj(); const osoba = uzytkownik.setup(); const widok = pokaz(repozytorium);
    await osoba.selectOptions(await screen.findByLabelText('Typ korekty'), 'GOAL_CHANGE');
    await osoba.type(screen.getByLabelText('PO'), 'Asystent projektowy');
    await osoba.type(screen.getByLabelText('Opis korekty'), 'Nowy cel');
    await osoba.type(screen.getByLabelText('Powód'), 'Zmieniam kierunek projektu');
    await osoba.click(screen.getByRole('button', { name: 'Zgłoś korektę' }));
    const sekcja = await screen.findByRole('region', { name: 'Zmiana celu: Nowy cel' });
    expect(sekcja).toHaveTextContent('Manager projektów'); expect(sekcja).toHaveTextContent('Asystent projektowy');
    expect(sekcja).toHaveTextContent('Zmieniam kierunek projektu');
    expect((await repozytorium.pobierzProjekty())[0].opis).toBe('Manager projektów');
    expect(within(sekcja).getByRole('button', { name: 'Zastosuj zatwierdzone zmiany' })).toBeDisabled();
    await osoba.click(within(sekcja).getAllByRole('button', { name: 'Edytuj' })[0]);
    await osoba.clear(within(sekcja).getByLabelText('Treść po edycji'));
    await osoba.type(within(sekcja).getByLabelText('Treść po edycji'), 'Asystent z kontrolą użytkownika');
    await osoba.click(within(sekcja).getByRole('button', { name: 'Zapisz edycję' }));
    await waitFor(() => expect(sekcja).toHaveTextContent('Zaakceptowano po edycji'));
    await osoba.click(within(sekcja).getAllByRole('button', { name: 'Odrzuć' })[1]);
    await waitFor(() => expect(within(sekcja).getByRole('button', { name: 'Zastosuj zatwierdzone zmiany' })).toBeEnabled());
    await osoba.click(within(sekcja).getByRole('button', { name: 'Zastosuj zatwierdzone zmiany' }));
    await within(sekcja).findByText('Zastosowana');
    expect((await repozytorium.pobierzProjekty())[0].opis).toBe('Asystent z kontrolą użytkownika');
    widok.unmount(); pokaz(utworzRepozytoriumIndexedDb(nazwaBazy));
    const zapisane = await screen.findByRole('region', { name: 'Zmiana celu: Nowy cel' });
    expect(zapisane).toHaveTextContent('Manager projektów'); expect(zapisane).toHaveTextContent('Asystent projektowy');
    expect(zapisane).toHaveTextContent('Asystent z kontrolą użytkownika');
    await osoba.click(within(zapisane).getByRole('button', { name: 'Utwórz korektę odwracającą' }));
    await screen.findByRole('region', { name: 'Zmiana celu: Odwrócenie korekty: Nowy cel' });
    expect((await repozytorium.pobierzProjekty())[0].opis).toBe('Asystent z kontrolą użytkownika');
  });
  it('błąd zapisu zachowuje formularz i nie pokazuje sukcesu ani fikcyjnej korekty', async () => {
    const { repozytorium } = await przygotuj(); const osoba = uzytkownik.setup();
    vi.spyOn(repozytorium, 'wykonajOperacjeKorekty').mockRejectedValue(new Error('Brak miejsca na zapis'));
    pokaz(repozytorium);
    await osoba.type(await screen.findByLabelText('PO'), 'Praca local-first');
    await osoba.type(screen.getByLabelText('Opis korekty'), 'Zmiana ograniczenia');
    await osoba.click(screen.getByRole('button', { name: 'Zgłoś korektę' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Brak miejsca na zapis');
    expect(screen.getByLabelText('PO')).toHaveValue('Praca local-first');
    expect(screen.getByLabelText('Opis korekty')).toHaveValue('Zmiana ograniczenia');
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect((await repozytorium.pobierzKorekty()).korekty).toHaveLength(0);
  });
  it('powiązana korekta odrzucenia uruchamia nową aktualną analizę, stary wynik pozostaje', async () => {
    const { repozytorium } = await przygotuj(); const osoba = uzytkownik.setup();
    const wpis = utworzWpis('Proponuję Google Drive.', 'p1', 'w1', kontekst().czas);
    await repozytorium.dodajWpis(wpis, kontekst());
    const stara = await uruchomAnalizeWpisu(repozytorium, wpis, new RuleBasedAnalysisProvider(), kontekst);
    pokaz(repozytorium);
    await osoba.selectOptions(await screen.findByLabelText('Typ korekty'), 'REJECTION');
    await osoba.selectOptions(screen.getByLabelText('Czego dotyczy?'), 'ANALYSIS_RUN');
    await osoba.type(screen.getByLabelText('PO'), 'Nie chcę Google Drive.');
    await osoba.type(screen.getByLabelText('Opis korekty'), 'Odrzucam sugestię');
    await osoba.click(screen.getByRole('button', { name: 'Zgłoś korektę' }));
    const sekcja = await screen.findByRole('region', { name: 'Odrzucenie: Odrzucam sugestię' });
    await osoba.click(within(sekcja).getAllByRole('button', { name: 'Zaakceptuj' })[0]);
    await waitFor(() => expect(within(sekcja).getByText('Zaakceptowano')).toBeInTheDocument());
    const przyciski = within(sekcja).getAllByRole('button', { name: 'Odrzuć' });
    for (let indeks = 1; indeks < przyciski.length; indeks++) {
      await osoba.click(przyciski[indeks]);
      await waitFor(() => expect(within(sekcja).getAllByText('Odrzucono')).toHaveLength(indeks));
    }
    await osoba.click(within(sekcja).getByRole('button', { name: 'Zastosuj zatwierdzone zmiany' }));
    await within(sekcja).findByText('Zastosowana');
    await osoba.click(within(sekcja).getByRole('button', { name: 'Uruchom nową analizę i oznacz jako aktualną' }));
    await screen.findByText('Nowy przebieg analizy zapisany jako aktualny. Wynik wymaga review.');
    const runy = await repozytorium.pobierzPrzebiegiAnaliz(); expect(runy).toHaveLength(2);
    expect(runy.filter((run) => run.preferred)).toHaveLength(1);
    expect(runy.find((run) => run.id === stara.analizaWpisu.id)?.preferred).toBe(false);
    expect((await repozytorium.pobierzAnalizyWpisow()).find((analiza) => analiza.id === stara.analizaWpisu.id)).toEqual(stara.analizaWpisu);
  });
});
