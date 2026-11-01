import type { DaneKopii } from './kopieZapasowe';
import { magazynyZrodel, projektyZrodla, type Dowod, type PolaczenieRepozytorium, type StanRepozytoriow } from './kontekstRepozytorium';

export function ostatniOdczytGitHub(dane: StanRepozytoriow, repoId: string) {
  return [...dane.migawkiRepozytoriow].filter((migawka) => migawka.repoConnectionId === repoId && migawka.github)
    .sort((lewy, prawy) => Date.parse(prawy.zaobserwowano) - Date.parse(lewy.zaobserwowano) || lewy.id.localeCompare(prawy.id))[0];
}
export interface WyborPowiazaniaGitHub {
  projektId: string; typZrodla: 'WORK_ITEM' | 'STAGE' | 'DECISION' | 'REPOSITORY'; zrodloId: string;
  rodzaj: 'commit' | 'pull_request'; identyfikator: string; rola: NonNullable<Dowod['rola']>; opis: string;
}
export function utworzPowiazanieGitHub(dane: DaneKopii, repo: PolaczenieRepozytorium, wybor: WyborPowiazaniaGitHub, id: string, czas: string): Dowod {
  const migawka = ostatniOdczytGitHub(dane, repo.id);
  const odczyt = migawka?.github;
  if (!odczyt || !repo.projektIds.includes(wybor.projektId) || !projektyZrodla(dane, wybor.typZrodla, wybor.zrodloId).includes(wybor.projektId) || !wybor.opis.trim()) throw new Error('Wybierz źródło z tego projektu i opisz powiązanie.');
  if (wybor.rodzaj === 'pull_request' && (wybor.typZrodla !== 'WORK_ITEM' || wybor.rola !== 'ZMIANA')) throw new Error('Pull Request można powiązać z elementem pracy jako dowód zmiany.');
  if ((wybor.typZrodla === 'REPOSITORY') !== (wybor.rola === 'PRZEGLAD') || (wybor.typZrodla === 'REPOSITORY' && wybor.zrodloId !== repo.id)) throw new Error('Przegląd odnosi się do tego repozytorium.');
  const commit = odczyt.commity.find((commit) => commit.sha === wybor.identyfikator);
  const pr = odczyt.inteligencja?.pullRequesty?.rekordy.find((pr) => String(pr.numer) === wybor.identyfikator);
  const sha = wybor.rodzaj === 'commit' ? commit?.sha : pr?.sha;
  if (!sha) throw new Error('Wybrany zasób nie występuje w pobranych danych GitHub.');
  const cel = dane[magazynyZrodel[wybor.typZrodla]].find((rekord) => rekord.id === wybor.zrodloId)!;
  const rewizja = wybor.typZrodla === 'REPOSITORY' ? sha : 'wersja' in cel ? String(cel.wersja) : undefined;
  const klucz = `github:${repo.id}:${wybor.rodzaj}:${wybor.identyfikator}:${wybor.typZrodla}:${wybor.zrodloId}:${rewizja}:${sha}:${wybor.rola}`;
  const poprzedni = dane.dowody.find((dowod) => dowod.polaczenieZrodla?.idempotencyKey === klucz && dowod.projektIds.includes(wybor.projektId));
  if (poprzedni) return poprzedni;
  return { id, projektIds: [wybor.projektId], typZrodla: wybor.typZrodla, zrodloId: wybor.zrodloId, rola: wybor.rola,
    pochodzenie: 'UZYTKOWNIK', weryfikacja: 'NIEZWERYFIKOWANE', opis: wybor.opis.trim(), rewizja, zaobserwowano: czas,
    polaczenieZrodla: { contractVersion: 1, idempotencyKey: klucz, providerId: 'GITHUB', connectionId: repo.id,
      resourceType: wybor.rodzaj, externalId: wybor.identyfikator, externalRevision: sha,
      url: `${odczyt.tozsamosc.adres}/${wybor.rodzaj === 'commit' ? 'commit' : 'pull'}/${wybor.identyfikator}` } };
}
export interface PropozycjaUzgodnienia {
  id: string; rodzaj: 'BRAK_DOWODU' | 'POZA_HISTORIA' | 'BLAD_CI' | 'PRZEGLAD'; opis: string; zrodloId?: string; adres?: string;
}
export function uzgodnijProjektGitHub(dane: DaneKopii, repo: PolaczenieRepozytorium, projektId: string): PropozycjaUzgodnienia[] {
  if (!repo.projektIds.includes(projektId)) return [];
  const odczyt = ostatniOdczytGitHub(dane, repo.id)?.github;
  const propozycje: PropozycjaUzgodnienia[] = [];
  const dowody = dane.dowody.filter((dowod) => dowod.projektIds.includes(projektId));
  for (const praca of dane.elementyPracy.filter((praca) => praca.projektId === projektId && praca.status === 'DONE' && praca.typ === 'TASK')) {
    if (!dowody.some((dowod) => dowod.typZrodla === 'WORK_ITEM' && dowod.zrodloId === praca.id && dowod.rola === 'WDROZENIE' && dowod.rewizja === String(praca.wersja)))
      propozycje.push({ id: `brak:${praca.id}`, rodzaj: 'BRAK_DOWODU', zrodloId: praca.id, opis: `„${praca.tytul}” jest ukończone, ale nie ma przypisanego dowodu wdrożenia dla bieżącej wersji. Uzupełnij dowód lub sprawdź, czy wdrożenie ma zastosowanie. Brak dowodu nie oznacza niewykonania zadania.` });
  }
  if (!odczyt) return propozycje;
  const powiazania = dowody.filter((dowod) => dowod.polaczenieZrodla?.connectionId === repo.id && ['commit', 'pull_request'].includes(dowod.polaczenieZrodla.resourceType));
  for (const dowod of powiazania.filter((dowod) => dowod.polaczenieZrodla?.resourceType === 'commit' && dowod.rola !== 'PRZEGLAD')) {
    const sha = dowod.polaczenieZrodla!.externalRevision!;
    if (!odczyt.commity.some((commit) => commit.sha === sha)) propozycje.push({ id: `historia:${dowod.id}`, rodzaj: 'POZA_HISTORIA', zrodloId: dowod.zrodloId, opis: `Powiązany commit ${sha.slice(0, 8)} nie występuje w pobranym oknie historii (do 20 commitów). Sprawdź odnośnik; to nie dowód usunięcia commita.`, adres: dowod.polaczenieZrodla?.url });
  }
  // Ponowienie tego samego workflow rozstrzyga tylko jego własny wcześniejszy wynik.
  const najnowsze = new Map<string, NonNullable<NonNullable<typeof odczyt.inteligencja>['workflow']>['rekordy'][number]>();
  for (const przebieg of [...(odczyt.inteligencja?.workflow?.rekordy ?? [])].sort((lewy, prawy) => Date.parse(prawy.zaktualizowano) - Date.parse(lewy.zaktualizowano) || prawy.id - lewy.id)) {
    const klucz = `${przebieg.sha}:${przebieg.workflowId}`;
    if (!najnowsze.has(klucz)) najnowsze.set(klucz, przebieg);
  }
  for (const przebieg of najnowsze.values()) if (przebieg.status === 'BLAD' && powiazania.some((dowod) => dowod.polaczenieZrodla?.externalRevision === przebieg.sha))
    propozycje.push({ id: `ci:${przebieg.id}`, rodzaj: 'BLAD_CI', opis: `Workflow „${przebieg.nazwa}” zakończył się błędem dla powiązanego commita ${przebieg.sha.slice(0, 8)}. Przejrzyj wynik przed potwierdzeniem postępu.`, adres: `${odczyt.tozsamosc.adres}/actions/runs/${przebieg.id}` });
  const glowny = odczyt.commity[0]!.sha;
  if (!powiazania.some((dowod) => dowod.rola === 'PRZEGLAD' && dowod.polaczenieZrodla?.externalRevision === glowny))
    propozycje.push({ id: `przeglad:${glowny}`, rodzaj: 'PRZEGLAD', opis: `Zmiany do ${glowny.slice(0, 8)} wymagają ręcznego przeglądu względem zapisanej pracy. Możesz potwierdzić przegląd po sprawdzeniu historii i porównania.`, adres: `${odczyt.tozsamosc.adres}/commit/${glowny}` });
  return propozycje;
}
