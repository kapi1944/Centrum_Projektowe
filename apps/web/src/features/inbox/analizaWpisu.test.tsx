import { render, screen, waitFor, within } from '@testing-library/react';
import osoba from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { Aplikacja } from '../../app/Aplikacja';
import { utworzProjekt, utworzWpis } from '../../domain/operacje';
import { utworzRepozytoriumIndexedDb } from '../../infrastructure/repozytoriumIndexedDb';

async function kliknij(uzytkownik: ReturnType<typeof osoba.setup>, element: HTMLElement) {
  await waitFor(() => expect(element).toBeEnabled());
  await uzytkownik.click(element);
  await waitFor(() => expect(screen.queryByText('Zapisywanie analizy…')).not.toBeInTheDocument());
}

async function przygotuj(tresc = '  Decyduję: zapis lokalny.\nWpływ: zmiana zakresu.\nTrzeba sprawdzić zapis.\nCo dalej?  ') {
  const nazwaBazy = crypto.randomUUID();
  const repozytorium = utworzRepozytoriumIndexedDb(nazwaBazy);
  function kontekst() { return { idZdarzenia: crypto.randomUUID(), czas: new Date().toISOString(), zrodlo: { typ: 'USER', nazwa: 'Użytkownik' } as const }; }
  await repozytorium.dodajProjekt(utworzProjekt('Projekt testowy', 'p1', '2026-10-08T10:00:00Z'), kontekst());
  await repozytorium.dodajWpis(utworzWpis(tresc, 'p1', 'w1', '2026-10-08T10:00:00Z'), kontekst());
  const uzytkownik = osoba.setup();
  const widok = render(<MemoryRouter initialEntries={['/inbox']}><Aplikacja repozytorium={repozytorium} /></MemoryRouter>);
  await kliknij(uzytkownik, await screen.findByRole('button', { name: 'Analizuj' }));
  await screen.findByRole('button', { name: 'Rozpocznij weryfikację' });
  return { nazwaBazy, repozytorium, uzytkownik, widok, tresc };
}

describe('Review CaptureAnalysis w Inbox', () => {
  it('ponawia analizę, zachowuje dawne review i jawnie wybiera aktualny run po ponownym otwarciu', async () => {
    const { nazwaBazy, repozytorium, uzytkownik, widok, tresc } = await przygotuj('Zakładam zgodność.');
    await kliknij(uzytkownik, screen.getByRole('button', { name: 'Rozpocznij weryfikację' }));
    await kliknij(uzytkownik, screen.getByRole('button', { name: 'Edytuj' }));
    await uzytkownik.clear(screen.getByLabelText('Treść po edycji'));
    await uzytkownik.type(screen.getByLabelText('Treść po edycji'), 'Dawna korekta');
    await kliknij(uzytkownik, screen.getByRole('button', { name: 'Zatwierdź edycję' }));
    await screen.findByText('Dawna korekta', { selector: 'article > p' });
    const dawna = (await repozytorium.pobierzAnalizyWpisow())[0];
    await kliknij(uzytkownik, screen.getByRole('button', { name: 'Uruchom ponownie analizę' }));
    await screen.findByRole('button', { name: 'Analiza 2' });
    expect((await repozytorium.pobierzPrzebiegiAnaliz()).filter((przebieg) => przebieg.preferred).map((przebieg) => przebieg.id)).toEqual([dawna.id]);
    await kliknij(uzytkownik, screen.getByRole('button', { name: 'Ustaw jako aktualną' }));
    const aktualny = (await repozytorium.pobierzPrzebiegiAnaliz()).find((przebieg) => przebieg.preferred)!;
    expect(aktualny.id).not.toBe(dawna.id);
    widok.unmount();
    render(<MemoryRouter initialEntries={['/inbox']}><Aplikacja repozytorium={utworzRepozytoriumIndexedDb(nazwaBazy)} /></MemoryRouter>);
    await screen.findByRole('button', { name: 'Rozpocznij weryfikację' });
    expect(screen.getByRole('button', { name: 'Analiza 2' })).toHaveAttribute('aria-pressed', 'true');
    await kliknij(uzytkownik, screen.getByRole('button', { name: 'Analiza 1' }));
    expect(await screen.findByText('Dawna korekta', { selector: 'article > p' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Oryginalny wpis' }).nextElementSibling?.textContent).toBe(tresc);
    expect((await repozytorium.pobierzAnalizyWpisow()).find((analiza) => analiza.id === dawna.id)).toEqual(dawna);
  });
  it('prowadzi od oryginału przez edycję i odrzucenie do propozycji Decision oraz osobnego zatwierdzenia Impact', async () => {
    const { repozytorium, uzytkownik, tresc } = await przygotuj();
    expect(screen.getByRole('heading', { name: 'Oryginalny wpis' }).nextElementSibling?.textContent).toBe(tresc);
    expect((await repozytorium.pobierzWpisy())[0].status).toBe('ANALYZED');
    const panel = screen.getByRole('region', { name: 'Analiza wpisu i weryfikacja' });
    expect(panel).not.toHaveTextContent(/review|GENERATED|RULE_BASED|SYSTEM/);
    expect(within(panel).getByText(/Wygenerowana/)).toBeInTheDocument();
    expect(within(panel).getAllByText(/źródło: System/).length).toBeGreaterThan(0);
    expect(within(panel).getByRole('heading', { name: 'Twierdzenia do potwierdzenia' })).toBeInTheDocument();
    await kliknij(uzytkownik, within(panel).getByText('Szczegóły techniczne'));
    expect(within(panel).getByText('Typ dostawcy: Analiza regułowa')).toBeVisible();
    await kliknij(uzytkownik, screen.getByRole('button', { name: 'Rozpocznij weryfikację' }));
    expect(await within(panel).findByText(/W trakcie weryfikacji/)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Zakończ weryfikację' })).toBeDisabled();
    const decyzje = screen.getByRole('region', { name: 'Potencjalne decyzje' });
    await kliknij(uzytkownik, within(decyzje).getByRole('button', { name: 'Edytuj' }));
    await uzytkownik.clear(screen.getByLabelText('Treść po edycji'));
    await uzytkownik.type(screen.getByLabelText('Treść po edycji'), 'Zapis lokalny po korekcie');
    await kliknij(uzytkownik, screen.getByRole('button', { name: 'Zatwierdź edycję' }));
    await within(decyzje).findByText(/Zaakceptowano po edycji/, { selector: 'article > p' });
    await kliknij(uzytkownik, within(screen.getByRole('region', { name: 'Możliwy wpływ' })).getByRole('button', { name: 'Akceptuj' }));
    await kliknij(uzytkownik, within(screen.getByRole('region', { name: 'Proponowane działania' })).getByRole('button', { name: 'Akceptuj' }));
    await kliknij(uzytkownik, within(screen.getByRole('region', { name: 'Pytania' })).getByRole('button', { name: 'Odrzuć' }));
    await kliknij(uzytkownik, screen.getByRole('button', { name: 'Zakończ weryfikację' }));
    expect(await screen.findByRole('button', { name: 'Zastosuj zatwierdzone' })).toBeEnabled();
    expect(await repozytorium.pobierzDecyzje()).toEqual([]);
    expect((await repozytorium.pobierzWpisy())[0].status).toBe('REVIEWED');
    expect(await within(panel).findByText(/· Zweryfikowana/)).toBeInTheDocument();
    await kliknij(uzytkownik, screen.getByRole('button', { name: 'Zastosuj zatwierdzone' }));
    const odnosnik = await screen.findByRole('link', { name: 'Otwórz decyzję' });
    expect((await repozytorium.pobierzDecyzje())[0]).toMatchObject({ tytul: 'Zapis lokalny po korekcie', status: 'PROPOSED', wpisZrodlowyId: 'w1' });
    expect(screen.getByRole('heading', { name: 'Oryginalny wpis' }).nextElementSibling?.textContent).toBe(tresc);
    const analiza = (await repozytorium.pobierzAnalizyWpisow())[0];
    expect(analiza.elementy.find((element) => element.typ === 'OPEN_QUESTION')).toMatchObject({ statusReview: 'REJECTED' });
    expect((await repozytorium.pobierzAnalizyWplywu())[0].propozycje[0].stan).toBe('PENDING');
    await kliknij(uzytkownik, screen.getByText('Analiza wpływu'));
    await kliknij(uzytkownik, screen.getByRole('button', { name: 'Zatwierdź tę zmianę' }));
    await screen.findByText(/Zatwierdzono ·/);
    expect((await repozytorium.pobierzProjekty())[0].nastepnyKrok).toBe('Sprawdź wpływ nowej informacji na ustalenia projektu.');
    await kliknij(uzytkownik, odnosnik);
    const karta = await screen.findByRole('article', { name: 'DEC-0001: Zapis lokalny po korekcie' });
    expect(within(karta).getByText('Status: Propozycja')).toBeInTheDocument();
    expect(within(karta).getByText('Źródło: System')).toBeInTheDocument();
    expect(within(karta).getByText(/Analiza źródłowa:/)).toBeInTheDocument();
    expect(within(karta).getByRole('link', { name: 'Otwórz wpis w Skrzynce', hidden: true })).toBeInTheDocument();
  });

  it('po ponownym otwarciu pokazuje częściowe review, edycję, oryginał i historię', async () => {
    const { nazwaBazy, uzytkownik, widok, tresc } = await przygotuj('  Zakładam zgodność.\nCzy sprawdzono?  ');
    await kliknij(uzytkownik, screen.getByRole('button', { name: 'Rozpocznij weryfikację' }));
    await kliknij(uzytkownik, within(screen.getByRole('region', { name: 'Założenia' })).getByRole('button', { name: 'Edytuj' }));
    await uzytkownik.clear(screen.getByLabelText('Treść po edycji'));
    await uzytkownik.type(screen.getByLabelText('Treść po edycji'), 'Zakładam zgodność wersji 1');
    await kliknij(uzytkownik, screen.getByRole('button', { name: 'Zatwierdź edycję' }));
    await screen.findByText('Zakładam zgodność wersji 1', { selector: 'article > p' });
    widok.unmount();
    render(<MemoryRouter initialEntries={['/inbox']}><Aplikacja repozytorium={utworzRepozytoriumIndexedDb(nazwaBazy)} /></MemoryRouter>);
    await screen.findByText('Zakładam zgodność wersji 1', { selector: 'article > p' });
    expect(screen.getByRole('heading', { name: 'Oryginalny wpis' }).nextElementSibling?.textContent).toBe(tresc);
    expect(screen.getByText(/Akceptacja założenia zachowuje założenie/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zakończ weryfikację' })).toBeDisabled();
    await kliknij(uzytkownik, screen.getByText('Historia weryfikacji'));
    expect(screen.getByText(/Wpis ręczny \(Użytkownik\)/)).toBeInTheDocument();
  });

  it('błąd apply pozostawia UI i bazę w REVIEWED, pozwalając ponowić zapis', async () => {
    const { repozytorium, uzytkownik } = await przygotuj('Decyduję: zapis lokalny.');
    await kliknij(uzytkownik, screen.getByRole('button', { name: 'Rozpocznij weryfikację' }));
    await kliknij(uzytkownik, screen.getByRole('button', { name: 'Akceptuj' }));
    await kliknij(uzytkownik, screen.getByRole('button', { name: 'Zakończ weryfikację' }));
    const oryginalnaOperacja = repozytorium.wykonajOperacjeAnalizyWpisu;
    const zapis = vi.spyOn(repozytorium, 'wykonajOperacjeAnalizyWpisu').mockImplementationOnce(async (operacja, kontekst) => {
      const historia = await repozytorium.pobierzZdarzenia();
      return oryginalnaOperacja(operacja, { ...kontekst, idZdarzenia: historia[0].id });
    });
    await kliknij(uzytkownik, await screen.findByRole('button', { name: 'Zastosuj zatwierdzone' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się zapisać danych lokalnych.');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Zastosuj zatwierdzone' })).toBeEnabled());
    expect((await repozytorium.pobierzWpisy())[0].status).toBe('REVIEWED');
    expect(await repozytorium.pobierzDecyzje()).toEqual([]);
    zapis.mockRestore();
    await kliknij(uzytkownik, screen.getByRole('button', { name: 'Zastosuj zatwierdzone' }));
    await screen.findByRole('link', { name: 'Otwórz decyzję' });
    expect((await repozytorium.pobierzWpisy())[0].status).toBe('APPLIED');
  });
});
