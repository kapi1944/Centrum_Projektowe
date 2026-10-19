import { render, screen, within } from '@testing-library/react';
import osobaTestowa from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { Aplikacja } from '../app/Aplikacja';
import { utworzRepozytoriumIndexedDb } from '../infrastructure/repozytoriumIndexedDb';
import { utworzProjekt } from '../domain/operacje';
import { odczytajPakietJson } from '../domain/pakietKontekstu';

const czas = '2026-10-13T10:00:00.000Z';
const kontekst = { czas, idZdarzenia: 'z1', zrodlo: { typ: 'USER' as const, nazwa: 'Użytkownik' } };
async function przygotuj() {
  const repo = utworzRepozytoriumIndexedDb(crypto.randomUUID());
  await repo.dodajProjekt(utworzProjekt('Aplikacja', 'p1', czas), kontekst);
  await repo.dodajProjekt(utworzProjekt('Dokumentacja', 'p2', czas), { ...kontekst, idZdarzenia: 'z2' });
  await repo.wykonajOperacjeRepozytorium({ rodzaj: 'zapisz', oczekiwanaWersja: null, rekord: { id: 'repo1', projektIds: ['p1'], nazwa: 'Kod aplikacji', rodzaj: 'APLIKACJA', dostawca: 'GITHUB', adresZdalny: 'https://github.com/przyklad/app', domyslnaGalaz: 'main', weryfikacja: 'NIEZWERYFIKOWANE', utworzono: czas, zaktualizowano: czas, wersja: 1, notatka: '' } });
  return repo;
}
describe('Repozytoria i generator kontekstu w UI', () => {
  it('edytuje wspólny rekord, zapisuje nową obserwację i zachowuje ją po ponownym otwarciu', async () => {
    const repo = await przygotuj(); const osoba = osobaTestowa.setup();
    const widok = render(<MemoryRouter initialEntries={['/projekty/p1/repozytoria']}><Aplikacja repozytorium={repo} /></MemoryRouter>);
    await screen.findByRole('heading', { name: 'Repozytoria i generator kontekstu' });
    await osoba.click(screen.getByRole('button', { name: 'Edytuj metadane: Kod aplikacji' }));
    await osoba.click(screen.getByRole('checkbox', { name: 'Dokumentacja' }));
    await osoba.type(screen.getByLabelText('Lokalna ścieżka'), 'C:\\Projekty\\Aplikacja');
    await osoba.click(screen.getByRole('button', { name: 'Zapisz repozytorium' }));
    await screen.findByText('Projekty: Aplikacja, Dokumentacja');
    await osoba.click(screen.getByText('Dodaj obserwację: Kod aplikacji'));
    await osoba.type(screen.getByLabelText('Opis źródła / nazwa raportu'), 'Wpis ręczny');
    await osoba.type(screen.getByLabelText('Commit SHA (niezweryfikowany)'), 'abcdef1234567');
    await osoba.type(screen.getByLabelText('Opis stanu'), 'Testy wymagają uruchomienia');
    await osoba.click(screen.getByRole('button', { name: 'Zapisz nową obserwację' }));
    await screen.findAllByText(/Gałąź: main · Commit:/);
    expect((await repo.pobierzRepozytoria()).polaczeniaRepozytoriow).toHaveLength(1);
    widok.unmount();
    render(<MemoryRouter initialEntries={['/projekty/p2/repozytoria']}><Aplikacja repozytorium={repo} /></MemoryRouter>);
    await screen.findAllByText('Testy wymagają uruchomienia');
    expect(screen.getAllByText(/Gałąź: main · Commit:/)[0]).toHaveTextContent('abcdef12 · Niezweryfikowane');
  });
  it('sprawdza GitHub świadomą akcją, pokazuje SHA i zachowuje odczyt po utracie sieci oraz po ponownym otwarciu', async () => {
    const repozytorium = await przygotuj();
    const osoba = osobaTestowa.setup();
    const sha = 'a'.repeat(40);
    const siec = vi.spyOn(globalThis, 'fetch').mockImplementation(async (wejscie) => {
      const adres = String(wejscie);
      const dane = adres.includes('/branches?') ? [{ name: 'main', commit: { sha } }]
        : adres.includes('/commits?') ? [{ sha, commit: { message: 'Rzeczywisty odczyt testowy', committer: { date: czas } } }]
        : { id: 987, name: 'app', owner: { login: 'przyklad' }, html_url: 'https://github.com/przyklad/app', default_branch: 'main', visibility: 'public', private: false, archived: false };
      return new Response(adres.includes('/commits/') ? sha : JSON.stringify(dane), { status: 200 });
    });
    try {
      const widok = render(<MemoryRouter initialEntries={['/projekty/p1/repozytoria']}><Aplikacja repozytorium={repozytorium} /></MemoryRouter>);
      await screen.findByText('Status: Gotowe do sprawdzenia');
      expect(siec).not.toHaveBeenCalled();
      await osoba.click(screen.getByRole('button', { name: 'Sprawdź połączenie' }));
      await screen.findByText('Status: Połączone');
      expect(siec).toHaveBeenCalledTimes(4);
      const artykul = screen.getByRole('heading', { name: 'Kod aplikacji' }).closest('article')!;
      expect(within(artykul).getAllByText('aaaaaaaa')[0]).toHaveAttribute('title', sha);
      expect(within(artykul).getAllByRole('link', { name: 'Commit na GitHub' })[0]).toHaveAttribute('href', `https://github.com/przyklad/app/commit/${sha}`);
      await osoba.click(screen.getByRole('button', { name: 'Edytuj metadane: Kod aplikacji' }));
      await osoba.type(screen.getByLabelText('Notatka'), 'Lokalna notatka');
      await osoba.click(screen.getByRole('button', { name: 'Zapisz repozytorium' }));
      await screen.findByText('Lokalna notatka');
      expect((await repozytorium.pobierzRepozytoria()).polaczeniaRepozytoriow[0].weryfikacja).toBe('GITHUB_API');
      siec.mockRejectedValue(new TypeError('Offline'));
      await osoba.click(screen.getByRole('button', { name: 'Synchronizuj' }));
      await screen.findByText('Status: Offline');
      const dane = await repozytorium.pobierzRepozytoria();
      expect(dane.migawkiRepozytoriow).toHaveLength(1);
      widok.unmount();
      render(<MemoryRouter initialEntries={['/projekty/p1/repozytoria']}><Aplikacja repozytorium={repozytorium} /></MemoryRouter>);
      await screen.findByText('Status: Offline');
      expect(screen.getAllByText('Rzeczywisty odczyt testowy').length).toBeGreaterThan(0);
      expect((await repozytorium.pobierzRepozytoria()).migawkiRepozytoriow).toEqual(dane.migawkiRepozytoriow);
    } finally { vi.restoreAllMocks(); }
  });
  it('pokazuje dokładny zakres, kopiuje ten sam Markdown i przygotowuje lokalne pliki bez sieci ani zmian projektu', async () => {
    const repo = await przygotuj(); const osoba = osobaTestowa.setup();
    await repo.wykonajOperacjeRealizacji({ rodzaj: 'praca', id: 'r1', dane: { projektId: 'p1', tytul: 'Wybrana praca', opis: 'Sprawdź zapis', typ: 'TASK', status: 'TODO', decyzjaIds: [] } }, { ...kontekst, idZdarzenia: 'r1' });
    const przed = (await repo.eksportujKopie()).data;
    const siec = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Offline'));
    const adres = vi.fn(() => 'blob:lokalny-pakiet'); const zwolnij = vi.fn();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: adres, revokeObjectURL: zwolnij }));
    const klik = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    try {
      render(<MemoryRouter initialEntries={['/projekty/p1/repozytoria']}><Aplikacja repozytorium={repo} /></MemoryRouter>);
      await screen.findByRole('heading', { name: 'Generator kontekstu' });
      expect(screen.queryByRole('button', { name: 'Eksportuj JSON' })).not.toBeInTheDocument();
      await osoba.type(screen.getByLabelText('Cel zadania'), 'Napraw zapis');
      await osoba.selectOptions(screen.getByLabelText('Repozytorium do pakietu'), 'repo1');
      await osoba.click(screen.getByRole('checkbox', { name: 'Wybrana praca' }));
      await osoba.click(screen.getByRole('button', { name: 'Wygeneruj podgląd' }));
      const podglad = (screen.getByLabelText('Podgląd Markdown') as HTMLTextAreaElement).value;
      expect(podglad).toContain('Wybrana praca');
      const schowek = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
      await osoba.click(screen.getByRole('button', { name: 'Kopiuj Markdown' })); expect(schowek).toHaveBeenCalledWith(podglad);
      await osoba.click(screen.getByText('Dokładny podgląd JSON'));
      const json = screen.getByText((_, element) => element?.tagName === 'PRE' && !!element.textContent?.includes('centrum-projektowe-context')).textContent!;
      expect(odczytajPakietJson(json).wybranePrace[0].id).toBe('r1');
      await osoba.click(screen.getByRole('button', { name: 'Eksportuj Markdown' })); await osoba.click(screen.getByRole('button', { name: 'Eksportuj JSON' }));
      expect(adres).toHaveBeenCalledTimes(2); expect(klik).toHaveBeenCalledTimes(2); expect(siec).not.toHaveBeenCalled();
      expect((await repo.eksportujKopie()).data).toEqual(przed);
      await osoba.click(screen.getByRole('checkbox', { name: 'Wybrana praca' }));
      expect(screen.queryByLabelText('Podgląd Markdown')).not.toBeInTheDocument();
      await osoba.click(screen.getByRole('button', { name: 'Wygeneruj podgląd' })); expect(screen.getByLabelText('Podgląd Markdown')).not.toHaveValue(expect.stringContaining('Wybrana praca'));
    } finally { vi.restoreAllMocks(); vi.unstubAllGlobals(); }
  });
  it('importuje raport jako dane niezweryfikowane i zachowuje formularz po błędnym zapisie', async () => {
    const repo = await przygotuj(); const osoba = osobaTestowa.setup();
    render(<MemoryRouter initialEntries={['/projekty/p1/repozytoria']}><Aplikacja repozytorium={repo} /></MemoryRouter>);
    await screen.findByRole('heading', { name: 'Repozytoria i generator kontekstu' });
    await osoba.click(screen.getByText('Dodaj obserwację: Kod aplikacji'));
    await osoba.selectOptions(screen.getByLabelText('Źródło obserwacji'), 'RAPORT');
    await osoba.type(screen.getByLabelText('Opis źródła / nazwa raportu'), 'Raport Codexa');
    const pole = screen.getByLabelText('Treść raportu JSON');
    await osoba.click(pole); await osoba.paste(JSON.stringify({ galaz: 'main', commitSha: 'abcdef1234567', zaobserwowano: czas, opis: 'Narzędzie deklaruje sukces' }));
    await osoba.click(screen.getByRole('button', { name: 'Zapisz nową obserwację' }));
    await screen.findAllByText('Narzędzie deklaruje sukces');
    expect((await repo.pobierzRepozytoria()).migawkiRepozytoriow[0].weryfikacja).toBe('NIEZWERYFIKOWANE');
    await osoba.click(screen.getByRole('button', { name: 'Dodaj repozytorium' }));
    await osoba.type(screen.getByLabelText('Nazwa repozytorium'), 'Nowe repo'); await osoba.type(screen.getByLabelText('Notatka'), 'token=abc123');
    await osoba.click(screen.getByRole('button', { name: 'Zapisz repozytorium' }));
    expect(await screen.findByText(/Wykryto możliwy sekret/)).toBeInTheDocument(); expect(screen.getByLabelText('Nazwa repozytorium')).toHaveValue('Nowe repo');
    expect(within(screen.getByRole('region', { name: 'Repozytoria projektu' })).getAllByRole('heading', { level: 3 })).toHaveLength(1);
  });
});
