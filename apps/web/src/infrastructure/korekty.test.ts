import { afterEach, describe, expect, it, vi } from 'vitest';
import { utworzRepozytoriumIndexedDb } from './repozytoriumIndexedDb';
import { utworzProjekt, utworzWpis } from '../domain/operacje';
import { pusteDaneKopii, sprawdzKopie, type KopiaZapasowaV1, type KopiaZapasowaV2 } from '../domain/kopieZapasowe';
import { typyKorekt, wykonajKorekte, type DaneKorekty } from '../domain/korekty';
import type { RepozytoriumProjektowe } from '../domain/repozytorium';
import { uruchomAnalizePoKorekcie, uruchomAnalizeWpisu } from '../application/przypadkiUzycia';
import { RuleBasedAnalysisProvider } from './RuleBasedAnalysisProvider';

const czas = '2026-10-09T12:00:00Z';
function kontekst() { return { czas, idZdarzenia: crypto.randomUUID(), zrodlo: { typ: 'USER' as const, nazwa: 'Użytkownik' } }; }
function korekta(zmiana: Partial<DaneKorekty> = {}): DaneKorekty {
  return { id: crypto.randomUUID(), projektId: 'p1', typCelu: 'PROJECT', celId: 'p1', pole: 'opis',
    typ: 'FACT_CORRECTION', nowaWartosc: 'Dopuszczam Raspberry Pi jako prywatny hub; aplikacja nadal local-first.',
    opis: 'Zmiana założenia', powod: 'Nowe wymaganie', odniesienieZrodla: 'Rozmowa z użytkownikiem', ...zmiana };
}
function staraKopia(): KopiaZapasowaV1 {
  const dane = pusteDaneKopii();
  dane.projekty.push({ ...utworzProjekt('Projekt', 'p1', czas), opis: 'Wyłącznie lokalnie.' });
  dane.wpisy.push(utworzWpis('Proponuję Google Drive.', 'p1', 'w1', czas));
  dane.elementyPracy.push({ id: 'r1', projektId: 'p1', tytul: 'Backup', opis: '', typ: 'TASK', status: 'TODO',
    decyzjaIds: [], priorytet: 'LOW', utworzono: czas, zaktualizowano: czas, wersja: 1 });
  const stare = Object.fromEntries(Object.entries(dane).filter(([nazwa]) => !['przebiegiAnaliz', 'korekty', 'propozycjeZmian', 'zestawyZmian', 'zdarzeniaDomenowe'].includes(nazwa))) as KopiaZapasowaV1['data'];
  return { format: 'centrum-projektowe', schemaVersion: 1, appVersion: '0.0.0', exportedAt: czas, data: stare };
}
async function przygotuj(kopia: unknown = staraKopia()) {
  const nazwaBazy = crypto.randomUUID();
  const repozytorium = utworzRepozytoriumIndexedDb(nazwaBazy);
  await repozytorium.importujKopie(kopia, 'zastap', true);
  return { repozytorium, nazwaBazy };
}
async function utworz(repozytorium: RepozytoriumProjektowe, dane = korekta()) {
  await repozytorium.wykonajOperacjeKorekty({ rodzaj: 'utworz', dane }, kontekst()); return dane.id;
}
async function reviewuj(repozytorium: RepozytoriumProjektowe, id: string, przyjmij = true, trescEdytowana?: string, wplyw = false) {
  const propozycja = (await repozytorium.pobierzKorekty()).propozycjeZmian.find((propozycja) => propozycja.correctionId === id)!;
  let wersja = propozycja.reviewRevision;
  for (const operacja of propozycja.operations) {
    await repozytorium.wykonajOperacjeKorekty({ rodzaj: 'review', id, wersja: wersja++, operacjaId: operacja.id,
      status: operacja.rodzaj === 'KOREKTA' ? trescEdytowana ? 'EDITED' : przyjmij ? 'ACCEPTED' : 'REJECTED' : wplyw ? 'ACCEPTED' : 'REJECTED',
      trescEdytowana: operacja.rodzaj === 'KOREKTA' ? trescEdytowana : undefined }, kontekst());
  }
  return wersja;
}
async function zastosuj(repozytorium: RepozytoriumProjektowe, id: string, wersja?: number) {
  const propozycja = (await repozytorium.pobierzKorekty()).propozycjeZmian.find((propozycja) => propozycja.correctionId === id)!;
  await repozytorium.wykonajOperacjeKorekty({ rodzaj: 'zastosuj', id, wersja: wersja ?? propozycja.reviewRevision, idempotencyKey: `apply:${id}` }, kontekst());
}
async function przygotujDecyzje(projektIds = ['p1']) {
  const przygotowane = await przygotuj();
  const { repozytorium } = przygotowane;
  if (projektIds.includes('p2')) await repozytorium.dodajProjekt(utworzProjekt('Drugi projekt', 'p2', czas), kontekst());
  await repozytorium.wykonajOperacjeUstalen({ rodzaj: 'utworz', id: 'd1', dane: {
    tytul: 'Wspólna decyzja', opis: 'Użyj A', projektIds, typZrodla: 'USER', nazwaZrodla: 'Użytkownik',
    odniesienieZrodla: '', wpisZrodlowyId: 'w1', notatki: '', powiazaneElementy: [],
  } }, kontekst());
  await repozytorium.wykonajOperacjeUstalen({ rodzaj: 'status', id: 'd1', wersja: 1, status: 'ACCEPTED' }, kontekst());
  const id = await utworz(repozytorium, korekta({ typCelu: 'DECISION', celId: 'd1', nowaWartosc: 'Użyj B' }));
  await reviewuj(repozytorium, id);
  return { ...przygotowane, id };
}
afterEach(() => vi.restoreAllMocks());

describe('Integralność historii korekt i audyt wieloprojektowy', () => {
  it.each([
    ['null', null], ['pusty obiekt', {}], ['nieistniejący następca', { id: 'brak' }],
  ])('odrzuca nieprawidłowe PO (%s) przed zapisem i pozostawia bazę bez zmian', async (_etykieta, po) => {
    const { repozytorium, id } = await przygotujDecyzje(); await zastosuj(repozytorium, id);
    const kopia = await repozytorium.eksportujKopie(); const uszkodzona = structuredClone(kopia);
    uszkodzona.data.zdarzeniaDomenowe[0].payload.after = po;
    const zapis = vi.spyOn(IDBObjectStore.prototype, 'clear');
    const dodanie = vi.spyOn(IDBObjectStore.prototype, 'add');
    await expect(repozytorium.importujKopie(uszkodzona, 'zastap', true)).rejects.toThrow(/Zdarzenie .*PO/);
    expect(zapis).not.toHaveBeenCalled(); expect(dodanie).not.toHaveBeenCalled();
    expect((await repozytorium.eksportujKopie()).data).toEqual(kopia.data);
  });
  it.each(['id', 'opis', 'projektIds', 'wpisZrodlowyId'])('odrzuca poprawny strukturalnie snapshot z niespójnym polem %s', async (pole) => {
    const { repozytorium, id } = await przygotujDecyzje(); await zastosuj(repozytorium, id);
    const kopia = await repozytorium.eksportujKopie(); const przed = structuredClone(kopia.data);
    const po = kopia.data.zdarzeniaDomenowe[0].payload.after as Record<string, unknown>;
    po[pole] = pole === 'projektIds' ? ['p1', 'brak'] : 'brak';
    await expect(repozytorium.importujKopie(kopia, 'zastap', true)).rejects.toThrow('niepoprawna historia');
    expect((await repozytorium.eksportujKopie()).data).toEqual(przed);
  });
  it('odrzuca podmienione PRZED i nie maskuje go treścią bieżącej decyzji', async () => {
    const { repozytorium, id } = await przygotujDecyzje(); await zastosuj(repozytorium, id);
    const kopia = await repozytorium.eksportujKopie();
    (kopia.data.zdarzeniaDomenowe[0].payload.before as Record<string, unknown>).opis = 'Podmieniona historia';
    expect(() => sprawdzKopie(kopia)).toThrow('PRZED nie odpowiada');
  });
  it.each([['p1'], ['p1', 'p2', 'p2']])('odrzuca niepełny lub powtórzony zakres zdarzenia: %j', async (...projektIds) => {
    const { repozytorium, id } = await przygotujDecyzje(['p1', 'p2']); await zastosuj(repozytorium, id);
    const kopia = await repozytorium.eksportujKopie();
    const uszkodzona = structuredClone(kopia);
    uszkodzona.data.zdarzeniaDomenowe[0] = { ...uszkodzona.data.zdarzeniaDomenowe[0], projectIds: projektIds };
    await expect(repozytorium.importujKopie(uszkodzona, 'zastap', true)).rejects.toThrow();
    expect((await repozytorium.eksportujKopie()).data).toEqual(kopia.data);
  });
  it.each(['null', 'brak zdarzenia'])('odwracanie uszkodzonej historii (%s) zgłasza kontrolowany błąd', async (wariant) => {
    const { repozytorium, id } = await przygotujDecyzje(); await zastosuj(repozytorium, id);
    const dane = (await repozytorium.eksportujKopie()).data;
    if (wariant === 'null') dane.zdarzeniaDomenowe[0].payload.after = null;
    else dane.zdarzeniaDomenowe = [];
    const przed = structuredClone(dane);
    expect(() => wykonajKorekte(dane, { rodzaj: 'odwroc', id, noweId: 'odwrocenie' }, kontekst())).toThrow(/histori/i);
    expect(dane).toEqual(przed);
  });
  it.each([['p1'], ['p1', 'p2']])('poprawny backup v3 decyzji projektów %j pozwala odtworzyć i odwrócić korektę', async (...projektIds) => {
    const { repozytorium, id } = await przygotujDecyzje(projektIds); await zastosuj(repozytorium, id);
    const kopia = await repozytorium.eksportujKopie();
    const { repozytorium: odtworzone } = await przygotuj(JSON.parse(JSON.stringify(kopia)));
    await odtworzone.wykonajOperacjeKorekty({ rodzaj: 'odwroc', id, noweId: 'odwrocenie' }, kontekst());
    await reviewuj(odtworzone, 'odwrocenie'); await zastosuj(odtworzone, 'odwrocenie');
    const decyzje = await odtworzone.pobierzDecyzje();
    expect(decyzje.filter((decyzja) => decyzja.status === 'ACCEPTED')).toEqual([
      expect.objectContaining({ id: 'decyzja-odwrocenie', opis: 'Użyj A', projektIds }),
    ]);
    expect(decyzje.find((decyzja) => decyzja.id === 'd1')?.opis).toBe('Użyj A');
    sprawdzKopie(await odtworzone.eksportujKopie());
  });
  it('wspólna decyzja ma pełny wpływ i audyt obu projektów bez duplikowania decyzji i niepowiązanej pracy', async () => {
    const { repozytorium, id } = await przygotujDecyzje(['p1', 'p2']);
    const analiza = (await repozytorium.pobierzAnalizyWplywu()).find((analiza) => analiza.zrodlo.id === id)!;
    expect(analiza.projektIds).toEqual(['p1', 'p2']);
    expect(analiza.propozycje.filter((propozycja) => propozycja.rodzaj === 'RESUME').map((propozycja) => propozycja.projektId)).toEqual(['p1', 'p2']);
    expect(analiza.propozycje.some((propozycja) => propozycja.rodzaj === 'REVIEW' && propozycja.element.id === 'r1')).toBe(false);
    const czasZmiany = '2026-10-10T12:00:00Z';
    const propozycja = (await repozytorium.pobierzKorekty()).propozycjeZmian.find((propozycja) => propozycja.correctionId === id)!;
    await repozytorium.wykonajOperacjeKorekty({ rodzaj: 'zastosuj', id, wersja: propozycja.reviewRevision,
      idempotencyKey: `apply:${id}` }, { ...kontekst(), czas: czasZmiany });
    const dane = (await repozytorium.eksportujKopie()).data;
    expect(dane.decyzje).toHaveLength(2);
    expect(dane.decyzje.filter((decyzja) => decyzja.status === 'ACCEPTED')).toEqual([
      expect.objectContaining({ opis: 'Użyj B', projektIds: ['p1', 'p2'] }),
    ]);
    expect(dane.zdarzeniaDomenowe).toHaveLength(1);
    expect(dane.zdarzeniaDomenowe[0].projectIds).toEqual(['p1', 'p2']);
    const historia = dane.zdarzenia.filter((zdarzenie) => zdarzenie.typZdarzenia === 'CORRECTION_APPLIED');
    expect(historia.map((zdarzenie) => zdarzenie.projektId).sort()).toEqual(['p1', 'p2']);
    expect(new Set(historia.map((zdarzenie) => zdarzenie.metadane?.operacjaZrodlowaId)).size).toBe(1);
    expect(historia.every((zdarzenie) => zdarzenie.encjaId === id)).toBe(true);
    expect(dane.projekty.every((projekt) => projekt.ostatniaAktywnosc === czasZmiany)).toBe(true);
    sprawdzKopie(await repozytorium.eksportujKopie());
  });
  it('jawne powiązanie pracy drugiego projektu jest kandydatem wpływu', async () => {
    const { repozytorium } = await przygotujDecyzje(['p1', 'p2']);
    const kopia = await repozytorium.eksportujKopie();
    kopia.data.elementyPracy.push({ ...kopia.data.elementyPracy[0], id: 'r2', projektId: 'p2', decyzjaIds: ['d1'] });
    await repozytorium.importujKopie(kopia, 'zastap', true);
    const id = await utworz(repozytorium, korekta({ typCelu: 'DECISION', celId: 'd1', nowaWartosc: 'Użyj C' }));
    const analiza = (await repozytorium.pobierzAnalizyWplywu()).find((analiza) => analiza.zrodlo.id === id)!;
    expect(analiza.propozycje.filter((propozycja) => propozycja.rodzaj === 'REVIEW').map((propozycja) => propozycja.element.id)).toEqual(['r2']);
  });
  it('błąd zapisu historii drugiego projektu wycofuje decyzję, ChangeSet i całą historię', async () => {
    const { repozytorium, id } = await przygotujDecyzje(['p1', 'p2']);
    const przed = (await repozytorium.eksportujKopie()).data;
    const dodaj = IDBObjectStore.prototype.add;
    vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(function (this: IDBObjectStore, rekord, klucz) {
      if (this.name === 'zdarzenia' && rekord.typZdarzenia === 'CORRECTION_APPLIED' && rekord.projektId === 'p2') dodaj.call(this, rekord, klucz);
      return dodaj.call(this, rekord, klucz);
    });
    await expect(zastosuj(repozytorium, id)).rejects.toThrow('Nie udało');
    expect((await repozytorium.eksportujKopie()).data).toEqual(przed);
    vi.restoreAllMocks(); await zastosuj(repozytorium, id);
    expect((await repozytorium.pobierzKorekty()).zestawyZmian).toHaveLength(1);
  });
});

describe('Korekty, review i atomowy zestaw zmian', () => {
  it.each(Object.keys(typyKorekt) as DaneKorekty['typ'][])('zapisuje i stosuje %s po review, zachowuje PRZED i źródło', async (typ) => {
    const { repozytorium } = await przygotuj(); const przed = (await repozytorium.eksportujKopie()).data;
    const dane = korekta({ typ, ...(typ === 'PRIORITY_CHANGE' ? { typCelu: 'WORK_ITEM', celId: 'r1', pole: 'priorytet', nowaWartosc: 'HIGH' } : {}) });
    const id = await utworz(repozytorium, dane);
    expect((await repozytorium.eksportujKopie()).data.projekty).toEqual(przed.projekty);
    expect((await repozytorium.eksportujKopie()).data.elementyPracy).toEqual(przed.elementyPracy);
    await reviewuj(repozytorium, id); await zastosuj(repozytorium, id);
    const po = (await repozytorium.eksportujKopie()).data;
    expect(po.korekty[0]).toMatchObject({ typ, status: 'APPLIED', poprzedniaWartosc: typ === 'PRIORITY_CHANGE' ? 'LOW' : 'Wyłącznie lokalnie.', powod: 'Nowe wymaganie' });
    expect(typ === 'PRIORITY_CHANGE' ? po.elementyPracy[0].priorytet : po.projekty[0].opis).toBe(dane.nowaWartosc);
    expect(po.wpisy).toEqual(przed.wpisy); expect(po.zestawyZmian[0].operations).toHaveLength(1);
    expect(po.zdarzeniaDomenowe[0].payload.before).toEqual(typ === 'PRIORITY_CHANGE' ? przed.elementyPracy[0] : przed.projekty[0]);
  });
  it('częściowa akceptacja i EDITED stosują treść użytkownika; odrzucony wpływ pozostaje dostępny', async () => {
    const { repozytorium } = await przygotuj(); const id = await utworz(repozytorium);
    const przed = (await repozytorium.pobierzProjekty())[0].nastepnyKrok;
    await reviewuj(repozytorium, id, true, 'Priorytetem jest niezawodność backupu.');
    expect((await repozytorium.pobierzProjekty())[0].opis).toBe('Wyłącznie lokalnie.');
    await zastosuj(repozytorium, id);
    expect((await repozytorium.pobierzProjekty())[0]).toMatchObject({ opis: 'Priorytetem jest niezawodność backupu.', nastepnyKrok: przed });
    const stan = await repozytorium.pobierzKorekty();
    expect(stan.zestawyZmian[0].operations[0]).toMatchObject({ status: 'EDITED', trescEdytowana: 'Priorytetem jest niezawodność backupu.' });
    expect((await repozytorium.pobierzAnalizyWplywu())[0].propozycje.every((propozycja) => propozycja.stan === 'REJECTED')).toBe(true);
  });
  it('odrzucenie sugestii jest trwałą wiedzą bez zmiany oryginalnego wpisu', async () => {
    const { repozytorium } = await przygotuj();
    const id = await utworz(repozytorium, korekta({ typ: 'REJECTION', typCelu: 'CAPTURE', celId: 'w1', pole: undefined, nowaWartosc: 'Nie chcę Google Drive.' }));
    await reviewuj(repozytorium, id); await zastosuj(repozytorium, id);
    const po = (await repozytorium.eksportujKopie()).data;
    expect(po.wpisy[0].trescOryginalna).toBe('Proponuję Google Drive.');
    expect(po.korekty[0]).toMatchObject({ typ: 'REJECTION', nowaWartosc: 'Nie chcę Google Drive.', typZrodla: 'USER' });
    expect(po.zdarzeniaDomenowe[0].eventType).toBe('CORRECTION_KNOWLEDGE_RETAINED');
  });
  it('EDITED wpływu stosuje własny następny krok i zachowuje oryginalną propozycję oraz uzasadnienie', async () => {
    const { repozytorium } = await przygotuj(); const id = await utworz(repozytorium);
    const analiza = (await repozytorium.pobierzAnalizyWplywu())[0];
    const oryginal = structuredClone(analiza.propozycje.find((propozycja) => propozycja.rodzaj === 'RESUME'));
    await reviewuj(repozytorium, id);
    const propozycja = (await repozytorium.pobierzKorekty()).propozycjeZmian[0];
    const operacja = propozycja.operations.find((operacja) => operacja.propozycjaWplywuId === oryginal?.id)!;
    await repozytorium.wykonajOperacjeKorekty({ rodzaj: 'review', id, wersja: propozycja.reviewRevision, operacjaId: operacja.id,
      status: 'EDITED', trescEdytowana: 'Sprawdź restore backupu.' }, kontekst());
    await zastosuj(repozytorium, id);
    expect((await repozytorium.pobierzProjekty())[0].nastepnyKrok).toBe('Sprawdź restore backupu.');
    const wplyw = (await repozytorium.pobierzAnalizyWplywu())[0].propozycje.find((propozycja) => propozycja.id === oryginal?.id);
    expect(wplyw).toMatchObject({ proponowane: oryginal?.rodzaj === 'RESUME' ? oryginal.proponowane : {},
      proponowanePoReview: { nastepnyKrok: 'Sprawdź restore backupu.' }, stan: 'APPROVED', uzasadnienie: oryginal?.uzasadnienie });
  });
  it('chroni nieaktualne review, zakres projektu i blokuje wpływ korekty poza ChangeSet', async () => {
    const { repozytorium } = await przygotuj(); const id = await utworz(repozytorium);
    const propozycja = (await repozytorium.pobierzKorekty()).propozycjeZmian[0];
    const operacja = { rodzaj: 'review' as const, id, wersja: propozycja.reviewRevision, operacjaId: propozycja.operations[0].id, status: 'ACCEPTED' as const };
    await repozytorium.wykonajOperacjeKorekty(operacja, kontekst());
    await expect(repozytorium.wykonajOperacjeKorekty(operacja, kontekst())).rejects.toThrow('Review zmieniło');
    const analiza = (await repozytorium.pobierzAnalizyWplywu())[0];
    await expect(repozytorium.wykonajOperacjeUstalen({ rodzaj: 'rozstrzygnij', analizaId: analiza.id,
      propozycjaId: analiza.propozycje[0].id, zatwierdz: true }, kontekst())).rejects.toThrow('zestaw zmian korekty');
    await repozytorium.dodajProjekt(utworzProjekt('Inny projekt', 'p2', czas), kontekst());
    await expect(utworz(repozytorium, korekta({ projektId: 'p2' }))).rejects.toThrow('innego projektu');
  });
  it('pełne odrzucenie zachowuje propozycje i nie tworzy ChangeSet ani zdarzeń zastosowania', async () => {
    const { repozytorium } = await przygotuj(); const id = await utworz(repozytorium);
    await reviewuj(repozytorium, id, false); await zastosuj(repozytorium, id);
    const stan = await repozytorium.pobierzKorekty(); expect(stan.korekty[0].status).toBe('REJECTED');
    expect(stan.propozycjeZmian).toHaveLength(1); expect(stan.zestawyZmian).toHaveLength(0); expect(stan.zdarzeniaDomenowe).toHaveLength(0);
  });
  it('ponowna korekta tej samej informacji i odwrócenie tworzą nowe rekordy', async () => {
    const { repozytorium } = await przygotuj(); const id = await utworz(repozytorium);
    await reviewuj(repozytorium, id, true, 'Nowy cel'); await zastosuj(repozytorium, id);
    const pierwsza = structuredClone((await repozytorium.pobierzKorekty()).korekty.find((korekta) => korekta.id === id));
    const drugiId = await utworz(repozytorium, korekta({ nowaWartosc: 'Kolejny cel' }));
    await reviewuj(repozytorium, drugiId); await zastosuj(repozytorium, drugiId);
    expect((await repozytorium.pobierzKorekty()).korekty.find((korekta) => korekta.id === id)).toEqual(pierwsza);
    expect((await repozytorium.pobierzKorekty()).korekty.find((korekta) => korekta.id === drugiId)?.poprzedniaWartosc).toBe('Nowy cel');
    await repozytorium.wykonajOperacjeKorekty({ rodzaj: 'odwroc', id: drugiId, noweId: 'odwrocenie' }, kontekst());
    expect((await repozytorium.pobierzProjekty())[0].opis).toBe('Kolejny cel');
    await reviewuj(repozytorium, 'odwrocenie'); await zastosuj(repozytorium, 'odwrocenie');
    expect((await repozytorium.pobierzProjekty())[0].opis).toBe('Nowy cel');
  });
  it('zastępuje decyzję przez istniejący mechanizm; stara treść i provenance pozostają', async () => {
    const { repozytorium } = await przygotuj();
    await repozytorium.wykonajOperacjeUstalen({ rodzaj: 'utworz', id: 'd1', dane: { tytul: 'Mechanizm A', opis: 'Użyj A', projektIds: ['p1'], typZrodla: 'USER', nazwaZrodla: 'Użytkownik', odniesienieZrodla: '', wpisZrodlowyId: 'w1', notatki: '', powiazaneElementy: [{ typ: 'WORK_ITEM', id: 'r1', tytul: 'Backup' }] } }, kontekst());
    await repozytorium.wykonajOperacjeUstalen({ rodzaj: 'status', id: 'd1', wersja: 1, status: 'ACCEPTED' }, kontekst());
    const id = await utworz(repozytorium, korekta({ typ: 'TEST_RESULT', typCelu: 'DECISION', celId: 'd1', nowaWartosc: 'Mechanizm A nie spełnia wymagania X.' }));
    expect((await repozytorium.pobierzAnalizyWplywu())[0].propozycje.filter((propozycja) => propozycja.rodzaj === 'REVIEW' && propozycja.element.id === 'r1')).toHaveLength(1);
    await reviewuj(repozytorium, id); await zastosuj(repozytorium, id);
    expect(await repozytorium.pobierzDecyzje()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'd1', opis: 'Użyj A', status: 'SUPERSEDED', wpisZrodlowyId: 'w1' }),
      expect.objectContaining({ id: `decyzja-${id}`, opis: 'Mechanizm A nie spełnia wymagania X.', status: 'ACCEPTED' }),
    ]));
  });
  it('nowy run po korekcie zachowuje stary wynik, review i jedno preferred; nie ponawia odrzuconej sugestii', async () => {
    const { repozytorium } = await przygotuj(); const dostawca = new RuleBasedAnalysisProvider();
    const wynik = await uruchomAnalizeWpisu(repozytorium, (await repozytorium.pobierzWpisy())[0], dostawca, kontekst);
    const stara = structuredClone(wynik.analizaWpisu);
    const id = await utworz(repozytorium, korekta({ typ: 'REJECTION', typCelu: 'ANALYSIS_RUN', celId: stara.id, pole: undefined, nowaWartosc: 'Nie chcę Google Drive.' }));
    await expect(uruchomAnalizePoKorekcie(repozytorium, id, dostawca, kontekst)).rejects.toThrow('zastosowanej');
    await reviewuj(repozytorium, id); await zastosuj(repozytorium, id);
    const nowa = await uruchomAnalizePoKorekcie(repozytorium, id, dostawca, kontekst);
    expect(nowa.analizaWpisu.elementy).toHaveLength(0);
    const runy = await repozytorium.pobierzPrzebiegiAnaliz();
    expect(runy).toHaveLength(2); expect(runy.filter((run) => run.preferred)).toHaveLength(1);
    expect(runy.find((run) => run.preferred)).toMatchObject({ correctionId: id, supersedesAnalysisRunId: stara.id, inputText: 'Nie chcę Google Drive.' });
    expect((await repozytorium.pobierzAnalizyWpisow()).find((analiza) => analiza.id === stara.id)).toEqual(stara);
    const kopia = await repozytorium.eksportujKopie();
    const { repozytorium: odtworzone } = await przygotuj(JSON.parse(JSON.stringify(kopia)));
    expect((await odtworzone.eksportujKopie()).data).toEqual(JSON.parse(JSON.stringify(kopia.data)));
  });
  it('błąd nowej analizy zachowuje poprzedni aktualny wynik i korektę', async () => {
    const { repozytorium } = await przygotuj(); const dostawca = new RuleBasedAnalysisProvider();
    await uruchomAnalizeWpisu(repozytorium, (await repozytorium.pobierzWpisy())[0], dostawca, kontekst);
    const id = await utworz(repozytorium, korekta({ typCelu: 'CAPTURE', celId: 'w1', pole: undefined }));
    await reviewuj(repozytorium, id); await zastosuj(repozytorium, id);
    vi.spyOn(dostawca, 'analizuj').mockRejectedValue(new Error('Błąd dostawcy'));
    await expect(uruchomAnalizePoKorekcie(repozytorium, id, dostawca, kontekst)).rejects.toThrow('Błąd dostawcy');
    expect((await repozytorium.pobierzPrzebiegiAnaliz()).map((run) => [run.status, run.preferred])).toEqual(expect.arrayContaining([['SUCCEEDED', true], ['FAILED', false]]));
  });
  it.each(['zdarzeniaDomenowe', 'zestawyZmian', 'zdarzenia'])('błąd magazynu %s wycofuje cały ChangeSet, projekcję i review wpływu', async (magazyn) => {
    const { repozytorium } = await przygotuj(); const id = await utworz(repozytorium); await reviewuj(repozytorium, id, true, undefined, true);
    const przed = (await repozytorium.eksportujKopie()).data;
    const dodaj = IDBObjectStore.prototype.add;
    vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(function (this: IDBObjectStore, rekord, klucz) {
      if (this.name === magazyn) dodaj.call(this, rekord, klucz);
      return dodaj.call(this, rekord, klucz);
    });
    await expect(zastosuj(repozytorium, id)).rejects.toThrow('Nie udało');
    expect((await repozytorium.eksportujKopie()).data).toEqual(przed);
    vi.restoreAllMocks(); await zastosuj(repozytorium, id);
    expect((await repozytorium.pobierzKorekty()).zestawyZmian).toHaveLength(1);
  });
  it('wymaga pełnego review, chroni rewizje i idempotentnie ponawia apply', async () => {
    const { repozytorium } = await przygotuj(); const id = await utworz(repozytorium);
    await expect(zastosuj(repozytorium, id)).rejects.toThrow('Rozstrzygnij');
    const wersja = await reviewuj(repozytorium, id); await zastosuj(repozytorium, id, wersja);
    const przed = (await repozytorium.eksportujKopie()).data; await zastosuj(repozytorium, id, wersja);
    expect((await repozytorium.eksportujKopie()).data).toEqual(przed);
    const drugi = await utworz(repozytorium); await reviewuj(repozytorium, drugi);
    await repozytorium.zmienProjekt('p1', { rodzaj: 'edycja', dane: { ...(await repozytorium.pobierzProjekty())[0], opis: 'Równoczesna zmiana' } }, kontekst());
    await expect(zastosuj(repozytorium, drugi)).rejects.toThrow('Cel korekty zmienił');
  });
  it.each([1, 2])('backup v%s → import/migracja → Correction → export v3 → restore zachowuje wszystkie dane', async (wersja) => {
    const stara = staraKopia();
    const kopia: KopiaZapasowaV1 | KopiaZapasowaV2 = wersja === 1 ? stara : { ...stara, schemaVersion: 2, data: { ...stara.data, przebiegiAnaliz: [] } };
    const { repozytorium } = await przygotuj(kopia); const id = await utworz(repozytorium);
    await reviewuj(repozytorium, id); await zastosuj(repozytorium, id);
    const nowa = await repozytorium.eksportujKopie(); expect(nowa.schemaVersion).toBe(3);
    const { repozytorium: odtworzone } = await przygotuj(JSON.parse(JSON.stringify(nowa)));
    expect((await odtworzone.eksportujKopie()).data).toEqual(JSON.parse(JSON.stringify(nowa.data)));
  });
  it('upgrade v6 → v7 nie zmienia runów, review, oryginałów i danych; dodaje puste magazyny', async () => {
    const { repozytorium } = await przygotuj(); await uruchomAnalizeWpisu(repozytorium, (await repozytorium.pobierzWpisy())[0], new RuleBasedAnalysisProvider(), kontekst);
    const kopia = await repozytorium.eksportujKopie(); const nazwaBazy = crypto.randomUUID();
    const stare = Object.fromEntries(Object.entries(kopia.data).filter(([nazwa]) => !['korekty', 'propozycjeZmian', 'zestawyZmian', 'zdarzeniaDomenowe'].includes(nazwa)));
    await new Promise<void>((rozwiaz, odrzuc) => {
      const zadanie = indexedDB.open(nazwaBazy, 6);
      zadanie.onupgradeneeded = () => { for (const [nazwa, rekordy] of Object.entries(stare)) {
        const magazyn = zadanie.result.createObjectStore(nazwa, { keyPath: 'id' });
        if (nazwa === 'analizyWpisow') magazyn.createIndex('wpisId', 'wpisId');
        for (const rekord of rekordy) magazyn.add(rekord);
      } };
      zadanie.onerror = () => odrzuc(zadanie.error);
      zadanie.onsuccess = () => { zadanie.result.close(); rozwiaz(); };
    });
    const po = await utworzRepozytoriumIndexedDb(nazwaBazy).eksportujKopie(); expect(po.data).toEqual(kopia.data);
  });
  it('uszkodzony backup odrzuca przed zapisem: brak zdarzeń, niezgodny zestaw i brak celu', async () => {
    const { repozytorium } = await przygotuj(); const id = await utworz(repozytorium); await reviewuj(repozytorium, id); await zastosuj(repozytorium, id);
    const kopia = await repozytorium.eksportujKopie();
    for (const zmien of [
      (nowa: typeof kopia) => { nowa.data.zdarzeniaDomenowe = []; },
      (nowa: typeof kopia) => { nowa.data.zestawyZmian[0].operations[0].tresc = 'Podmieniona treść'; },
      (nowa: typeof kopia) => { nowa.data.korekty[0] = { ...nowa.data.korekty[0], celId: 'brak' }; },
      (nowa: typeof kopia) => { nowa.data.analizyWplywu[0].propozycje[0].stan = 'APPROVED'; },
      (nowa: typeof kopia) => { nowa.data.propozycjeZmian[0].reviewRevision++; },
      (nowa: typeof kopia) => { nowa.data.zdarzeniaDomenowe[0] = { ...nowa.data.zdarzeniaDomenowe[0], projectIds: ['brak'] }; },
    ]) { const nowa = structuredClone(kopia); zmien(nowa); expect(() => sprawdzKopie(nowa)).toThrow(); await expect(repozytorium.importujKopie(nowa, 'zastap', true)).rejects.toThrow(); }
    expect((await repozytorium.eksportujKopie()).data).toEqual(kopia.data);
  });
});
