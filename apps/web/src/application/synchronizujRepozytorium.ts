import { ostatniaMigawka, sprawdzBrakSekretow, type OperacjaRepozytorium, type PolaczenieRepozytorium, type StanRepozytoriow } from '../domain/kontekstRepozytorium';
import { BladGitHub, sprawdzOdczytGitHub, type OdczytGitHub, type CzytnikRepozytorium, type ZakresGitHub } from '../domain/synchronizacjaGitHub';
import { uporzadkuj } from '../domain/kopieZapasowe';
import { ostatniOdczytGitHub } from '../domain/inteligencjaGitHub';

export function utworzSynchronizacjeRepozytorium(czytnik: CzytnikRepozytorium, zegar = () => new Date().toISOString(), identyfikator = () => crypto.randomUUID()) {
  const trwajace = new Map<string, Promise<void>>();
  return function synchronizuj(repo: PolaczenieRepozytorium, dane: StanRepozytoriow, zapisz: (operacja: OperacjaRepozytorium) => Promise<void>, sygnal?: AbortSignal, zakres?: ZakresGitHub): Promise<void> {
    const trwajaca = trwajace.get(repo.id);
    if (trwajaca) return trwajaca;
    const zadanie = (async () => {
      const proba = zegar();
      const aktualizuj = (github: NonNullable<PolaczenieRepozytorium['github']>): PolaczenieRepozytorium => ({ ...repo, github, wersja: repo.wersja + 1, zaktualizowano: zegar() });
      let odczyt: OdczytGitHub;
      const poprzedniOdczyt = ostatniOdczytGitHub(dane, repo.id)?.github;
      try {
        if (repo.dostawca !== 'GITHUB') throw new BladGitHub('BLAD', 'Wybierz repozytorium GitHub.');
        if (repo.github?.ponowPo && Date.parse(repo.github.ponowPo) > Date.parse(proba)) throw new BladGitHub('LIMIT', 'Poczekaj na odnowienie limitu GitHub.', repo.github.ponowPo);
        if (zakres) {
          if (!poprzedniOdczyt || !czytnik.rozszerz) throw new BladGitHub('BLAD', 'Najpierw synchronizuj historię repozytorium.');
          odczyt = await czytnik.rozszerz(repo, poprzedniOdczyt, zakres, sygnal);
        } else {
          odczyt = { ...await czytnik.odczytaj(repo, sygnal), historiaPobrana: proba };
          if (poprzedniOdczyt?.inteligencja) odczyt = { ...odczyt, inteligencja: structuredClone(poprzedniOdczyt.inteligencja) };
        }
        if (!sprawdzOdczytGitHub(odczyt)) throw new BladGitHub('BLAD', 'Niepoprawny wynik odczytu repozytorium.');
        sprawdzBrakSekretow(odczyt);
        if (repo.github?.tozsamosc && repo.github.tozsamosc.identyfikator !== odczyt.tozsamosc.identyfikator) throw new BladGitHub('BLAD', 'Zmieniła się tożsamość repozytorium.');
        if (dane.polaczeniaRepozytoriow.some((inne) => inne.id !== repo.id && inne.github?.tozsamosc?.identyfikator === odczyt.tozsamosc.identyfikator)) throw new BladGitHub('BLAD', 'Ta tożsamość ma już powiązanie. Użyj „Powiąż istniejące repozytorium”.');
      } catch (blad) {
        const kontrolowany = blad instanceof BladGitHub ? blad : new BladGitHub('BLAD', 'Nie udało się zweryfikować bezpiecznej obserwacji GitHub.');
        const poprzedni = { ...repo.github };
        delete poprzedni.ponowPo;
        const rekord = aktualizuj({ ...poprzedni, status: kontrolowany.status, ostatniaProba: proba, komunikat: kontrolowany.message, ...(kontrolowany.ponowPo ? { ponowPo: kontrolowany.ponowPo } : {}) });
        await zapisz({ rodzaj: 'synchronizuj', rekord, oczekiwanaWersja: repo.wersja });
        return;
      }
      const czas = zegar();
      const rekord = { ...aktualizuj({ tozsamosc: odczyt.tozsamosc, status: 'POLACZONE', ostatniaProba: czas, ostatniaObserwacja: czas, komunikat: zakres ? 'Odczytano wybrany zakres GitHub. Historia commitów nie została odświeżona.' : 'Odczytano publiczne repozytorium GitHub.' }), adresZdalny: odczyt.tozsamosc.adres, domyslnaGalaz: odczyt.tozsamosc.domyslnaGalaz, weryfikacja: 'GITHUB_API' as const };
      const poprzednia = ostatniaMigawka(dane, repo.id);
      const dowodObejmujeProjekty = poprzednia && dane.dowody.some((dowod) => poprzednia.dowodIds.includes(dowod.id)
        && dowod.weryfikacja === 'GITHUB_API' && repo.projektIds.every((projektId) => dowod.projektIds.includes(projektId)));
      if (poprzednia?.zrodlo === 'GITHUB_API' && dowodObejmujeProjekty && JSON.stringify(uporzadkuj({ ...poprzednia.github, historiaPobrana: undefined })) === JSON.stringify(uporzadkuj({ ...odczyt, historiaPobrana: undefined }))) {
        await zapisz({ rodzaj: 'synchronizuj', rekord, oczekiwanaWersja: repo.wersja }); return;
      }
      const id = identyfikator(); const dowodId = identyfikator(); const sha = odczyt.commity[0]!.sha;
      await zapisz({ rodzaj: 'synchronizuj', rekord, oczekiwanaWersja: repo.wersja,
        migawka: { id, repoConnectionId: repo.id, github: odczyt, galaz: odczyt.tozsamosc.domyslnaGalaz, commitSha: sha, zaobserwowano: czas, zrodlo: 'GITHUB_API', opisZrodla: 'Anonimowy odczyt GitHub REST API', opis: odczyt.commity[0]!.opis, ostrzezenia: [...(odczyt.ograniczoneGalezie ? ['Lista gałęzi ograniczona do 100.'] : []), 'Historia obejmuje maksymalnie 20 commitów. Zakresy R3 mają osobne daty odczytu.', ...(zakres ? ['Rozszerzono wybrany zakres; historia pochodzi z wcześniejszej synchronizacji.'] : [])], dowodIds: [dowodId], weryfikacja: 'GITHUB_API' },
        dowod: { id: dowodId, projektIds: [...repo.projektIds], typZrodla: 'REPOSITORY_SNAPSHOT', zrodloId: id, pochodzenie: 'GITHUB_API', opis: zakres ? `Odczyt zakresu ${zakres.rodzaj} przez GitHub REST API; pozostałe dane zachowują wcześniejszy czas odczytu.` : 'Odczyt metadanych, HEAD, ograniczonej historii i gałęzi przez GitHub REST API.', rewizja: sha, zaobserwowano: czas, weryfikacja: 'GITHUB_API',
          polaczenieZrodla: { contractVersion: 1, idempotencyKey: `github:${repo.id}:repository:${odczyt.tozsamosc.identyfikator}`, providerId: 'GITHUB', connectionId: repo.id, resourceType: 'repository', externalId: String(odczyt.tozsamosc.identyfikator), externalRevision: sha, url: `${odczyt.tozsamosc.adres}/commit/${sha}` } } });
    })();
    trwajace.set(repo.id, zadanie);
    void zadanie.finally(() => trwajace.delete(repo.id)).catch(() => undefined);
    return zadanie;
  };
}
