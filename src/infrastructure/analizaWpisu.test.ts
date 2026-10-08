import { describe, expect, it } from 'vitest';
import type { AnalizaWpisu, PropozycjaAnalizy, StatusReview } from '../domain/analizaWpisu';
import type { KontekstZapisu } from '../domain/modele';
import { utworzProjekt, utworzWpis } from '../domain/operacje';
import type { AnalizaWplywu, Decyzja } from '../domain/ustalenia';
import { RuleBasedAnalysisProvider } from './RuleBasedAnalysisProvider';
import { utworzRepozytoriumIndexedDb } from './repozytoriumIndexedDb';

function kontekst(): KontekstZapisu {
  return { idZdarzenia: crypto.randomUUID(), czas: new Date().toISOString(), zrodlo: { typ: 'USER', nazwa: 'Użytkownik' } };
}
function element(typ: PropozycjaAnalizy['typ'], tresc = 'Decyduję: zachowujemy dane lokalnie.'): PropozycjaAnalizy {
  return { typ, tresc, zrodlo: 'SYSTEM' };
}
async function przygotuj(elementy = [element('POSSIBLE_DECISION')], projektId: string | null = 'p1') {
  const nazwaBazy = crypto.randomUUID();
  const repozytorium = utworzRepozytoriumIndexedDb(nazwaBazy);
  const projekt = utworzProjekt('Projekt', 'p1', '2026-10-08T10:00:00Z');
  const wpis = utworzWpis('  Decyduję: zachowujemy dane lokalnie.\nCo dalej?  ', projektId, 'w1', projekt.utworzono);
  await repozytorium.dodajProjekt(projekt, kontekst());
  await repozytorium.dodajWpis(wpis, kontekst());
  const projektyPrzed = await repozytorium.pobierzProjekty();
  const wynikDostawcy = await new RuleBasedAnalysisProvider().analizuj(wpis.trescOryginalna);
  const wygenerowana = await repozytorium.wykonajOperacjeAnalizyWpisu({ rodzaj: 'generuj', id: 'a1', wpisId: wpis.id, wynik: { ...wynikDostawcy, elementy } }, kontekst());
  async function pobierz(): Promise<AnalizaWpisu> { return (await repozytorium.pobierzAnalizyWpisow())[0]; }
  async function rozpocznij() {
    const analiza = await pobierz();
    return repozytorium.wykonajOperacjeAnalizyWpisu({ rodzaj: 'rozpocznij', id: analiza.id, wersja: analiza.wersja }, kontekst());
  }
  async function ocen(numer: number, status: Exclude<StatusReview, 'PENDING'>, trescEdytowana?: string) {
    const analiza = await pobierz();
    return repozytorium.wykonajOperacjeAnalizyWpisu({ rodzaj: 'review', id: analiza.id, wersja: analiza.wersja, elementId: analiza.elementy[numer].id, status, trescEdytowana }, kontekst());
  }
  async function zakoncz() {
    const analiza = await pobierz();
    return repozytorium.wykonajOperacjeAnalizyWpisu({ rodzaj: 'zakoncz', id: analiza.id, wersja: analiza.wersja }, kontekst());
  }
  async function zastosuj(kontekstZapisu = kontekst(), wybranyProjektId?: string) {
    const analiza = await pobierz();
    return repozytorium.wykonajOperacjeAnalizyWpisu({ rodzaj: 'zastosuj', id: analiza.id, wersja: analiza.wersja, projektId: wybranyProjektId }, kontekstZapisu);
  }
  return { nazwaBazy, repozytorium, projekt, wpis, projektyPrzed, wygenerowana, pobierz, rozpocznij, ocen, zakoncz, zastosuj };
}

describe('CaptureAnalysis z istniejącymi ustaleniami', () => {
  it('zachowuje rawText identyczny po analizie, review, edycji i apply', async () => {
    const { repozytorium, wpis, rozpocznij, ocen, zakoncz, zastosuj } = await przygotuj();
    expect((await repozytorium.pobierzWpisy())[0].trescOryginalna).toBe(wpis.trescOryginalna);
    await rozpocznij(); await ocen(0, 'EDITED', 'Treść użytkownika'); await zakoncz(); await zastosuj();
    expect((await repozytorium.pobierzWpisy())[0].trescOryginalna).toBe(wpis.trescOryginalna);
  });

  it('sama analiza nie zmienia żadnego pola Project', async () => {
    const { repozytorium, projektyPrzed } = await przygotuj();
    expect(await repozytorium.pobierzProjekty()).toEqual(projektyPrzed);
  });

  it('sama analiza nie tworzy Decision ani ImpactAnalysis', async () => {
    const { repozytorium } = await przygotuj([element('POSSIBLE_DECISION'), element('IMPACT_CANDIDATE')]);
    expect(await repozytorium.pobierzDecyzje()).toEqual([]);
    expect(await repozytorium.pobierzAnalizyWplywu()).toEqual([]);
  });

  it('PENDING blokuje zakończenie review i apply, także obok ACCEPTED', async () => {
    const { repozytorium, rozpocznij, ocen, zakoncz, zastosuj, pobierz } = await przygotuj([element('POSSIBLE_DECISION'), element('POSSIBLE_DECISION')]);
    await expect(zastosuj()).rejects.toThrow('weryfikację');
    await rozpocznij(); await ocen(0, 'ACCEPTED');
    await expect(zakoncz()).rejects.toThrow('wszystkie elementy');
    await expect(zastosuj()).rejects.toThrow('weryfikację');
    expect((await pobierz()).elementy[1].statusReview).toBe('PENDING');
    expect(await repozytorium.pobierzDecyzje()).toEqual([]);
    expect((await repozytorium.pobierzWpisy())[0].status).toBe('ANALYZED');
  });

  it('REJECTED pozostaje w audycie i nie jest stosowany obok ACCEPTED', async () => {
    const { repozytorium, rozpocznij, ocen, zakoncz, zastosuj, pobierz } = await przygotuj([element('POSSIBLE_DECISION', 'Odrzucona decyzja'), element('FACT', 'Zachowana obserwacja')]);
    await rozpocznij(); await ocen(0, 'REJECTED'); await ocen(1, 'ACCEPTED'); await zakoncz(); await zastosuj();
    expect(await repozytorium.pobierzDecyzje()).toEqual([]);
    const analiza = await pobierz();
    expect(analiza.elementy[0]).toMatchObject({ statusReview: 'REJECTED', trescOryginalna: 'Odrzucona decyzja', historiaReview: [{ status: 'REJECTED', czas: expect.any(String), zrodlo: expect.any(Object) }] });
    expect(analiza.elementy[0].zastosowanie).toBeUndefined();
    expect(analiza.elementy[1].zastosowanie?.rodzaj).toBe('RETAINED');
  });

  it('ACCEPTED POSSIBLE_DECISION tworzy istniejącą Decyzję jako PROPOSED', async () => {
    const { repozytorium, rozpocznij, ocen, zakoncz, zastosuj, pobierz } = await przygotuj();
    await rozpocznij(); await ocen(0, 'ACCEPTED'); await zakoncz(); await zastosuj();
    expect(await repozytorium.pobierzDecyzje()).toEqual([expect.objectContaining({ czytelneId: 'DEC-0001', tytul: 'Decyduję: zachowujemy dane lokalnie.', status: 'PROPOSED', wersja: 1, zastapionaPrzezId: null })]);
    expect((await pobierz()).elementy[0].zastosowanie).toMatchObject({ rodzaj: 'DECISION', encjaId: 'decyzja-a1:1', projektId: 'p1' });
    expect((await repozytorium.pobierzWpisy())[0].status).toBe('APPLIED');
  });

  it('EDITED stosuje editedText, pozostawiając originalText i historię edycji', async () => {
    const { repozytorium, rozpocznij, ocen, zakoncz, zastosuj, pobierz } = await przygotuj();
    await rozpocznij(); await ocen(0, 'EDITED', 'Pierwsza korekta'); await ocen(0, 'EDITED', 'Ostateczna korekta'); await zakoncz(); await zastosuj();
    expect((await repozytorium.pobierzDecyzje())[0]).toMatchObject({ tytul: 'Ostateczna korekta', opis: 'Ostateczna korekta' });
    expect((await pobierz()).elementy[0]).toMatchObject({ trescOryginalna: 'Decyduję: zachowujemy dane lokalnie.', trescEdytowana: 'Ostateczna korekta' });
    expect((await pobierz()).elementy[0].historiaReview.map((zmiana) => zmiana.trescEdytowana)).toEqual(['Pierwsza korekta', 'Ostateczna korekta']);
  });

  it('Decision zachowuje provenance do Capture, analizy, elementu i dostawcy', async () => {
    const { repozytorium, wpis, rozpocznij, ocen, zakoncz, zastosuj, pobierz } = await przygotuj();
    await rozpocznij(); await ocen(0, 'ACCEPTED'); await zakoncz(); await zastosuj();
    const analiza = await pobierz();
    expect((await repozytorium.pobierzDecyzje())[0]).toMatchObject({ wpisZrodlowyId: wpis.id, analizaWpisuId: analiza.id, elementAnalizyId: analiza.elementy[0].id, typZrodla: 'SYSTEM', nazwaZrodla: analiza.nazwaDostawcy });
    expect(analiza).toMatchObject({ wpisId: wpis.id, typDostawcy: 'RULE_BASED', wersjaDostawcy: '1', wersjaAnalizy: '1', utworzono: expect.any(String), sprawdzono: expect.any(String), zastosowano: expect.any(String) });
  });

  it('IMPACT_CANDIDATE inicjuje istniejący ImpactAnalysis, a zmiana projektu wymaga osobnej zgody', async () => {
    const { repozytorium, projektyPrzed, rozpocznij, ocen, zakoncz, zastosuj, pobierz } = await przygotuj([element('IMPACT_CANDIDATE', 'Wpływ: zmiana zakresu')]);
    await rozpocznij(); await ocen(0, 'EDITED', 'Wpływ po korekcie'); await zakoncz(); await zastosuj();
    expect(await repozytorium.pobierzProjekty()).toEqual(projektyPrzed);
    const wplyw = (await repozytorium.pobierzAnalizyWplywu())[0];
    expect(wplyw).toMatchObject({ zrodlo: { typ: 'CAPTURE', id: 'w1' }, zrodloAnalizyWpisu: { analizaWpisuId: 'a1', elementAnalizyId: 'a1:1', tresc: 'Wpływ po korekcie' } });
    expect(wplyw.propozycje).toEqual([expect.objectContaining({ rodzaj: 'RESUME', stan: 'PENDING' })]);
    expect((await pobierz()).elementy[0].zastosowanie).toMatchObject({ rodzaj: 'IMPACT', encjaId: wplyw.id });
    await repozytorium.wykonajOperacjeUstalen({ rodzaj: 'rozstrzygnij', analizaId: wplyw.id, propozycjaId: wplyw.propozycje[0].id, zatwierdz: true }, kontekst());
    expect((await repozytorium.pobierzProjekty())[0].nastepnyKrok).toBe('Sprawdź wpływ nowej informacji na ustalenia projektu.');
  });

  it.each(['FACT', 'ASSUMPTION', 'SUGGESTION', 'RECOMMENDED_ACTION', 'OPEN_QUESTION'] as const)('%s pozostaje swoim typem i nie tworzy Decision ani nowej encji wykonania', async (typ) => {
    const { repozytorium, projektyPrzed, rozpocznij, ocen, zakoncz, zastosuj, pobierz } = await przygotuj([element(typ, 'Zachowany element')], null);
    await rozpocznij(); await ocen(0, 'ACCEPTED'); await zakoncz(); await zastosuj();
    expect((await pobierz()).elementy[0]).toMatchObject({ typ, statusReview: 'ACCEPTED', zastosowanie: { rodzaj: 'RETAINED', czas: expect.any(String) } });
    expect(await repozytorium.pobierzDecyzje()).toEqual([]);
    expect(await repozytorium.pobierzAnalizyWplywu()).toEqual([]);
    expect(await repozytorium.pobierzProjekty()).toEqual(projektyPrzed);
  });

  it('analiza może istnieć bez apply, a ponowne otwarcie zachowuje review i odrzucone elementy', async () => {
    const { nazwaBazy, repozytorium, rozpocznij, ocen, zakoncz, pobierz } = await przygotuj([element('FACT'), element('POSSIBLE_DECISION')]);
    await rozpocznij(); await ocen(0, 'EDITED', 'Poprawiona obserwacja'); await ocen(1, 'REJECTED'); await zakoncz();
    const analiza = await pobierz();
    const ponownieOtwarte = utworzRepozytoriumIndexedDb(nazwaBazy);
    expect(await ponownieOtwarte.pobierzAnalizyWpisow()).toEqual([analiza]);
    expect(analiza.status).toBe('REVIEWED');
    expect(await ponownieOtwarte.pobierzDecyzje()).toEqual([]);
    expect(await ponownieOtwarte.pobierzWpisy()).toEqual(await repozytorium.pobierzWpisy());
    expect((await ponownieOtwarte.pobierzWpisy())[0].status).toBe('REVIEWED');
  });

  it('błąd transakcji wycofuje apply, Decision, ImpactAnalysis, Project i historię', async () => {
    const { repozytorium, rozpocznij, ocen, zakoncz, zastosuj, pobierz } = await przygotuj([element('POSSIBLE_DECISION'), element('IMPACT_CANDIDATE')]);
    await rozpocznij(); await ocen(0, 'ACCEPTED'); await ocen(1, 'ACCEPTED'); await zakoncz();
    const analiza = await pobierz();
    const wpisy = await repozytorium.pobierzWpisy();
    const projekty = await repozytorium.pobierzProjekty();
    const historia = await repozytorium.pobierzZdarzenia();
    await expect(zastosuj({ ...kontekst(), idZdarzenia: historia[0].id })).rejects.toBeTruthy();
    expect(await pobierz()).toEqual(analiza);
    expect(await repozytorium.pobierzWpisy()).toEqual(wpisy);
    expect(await repozytorium.pobierzProjekty()).toEqual(projekty);
    expect(await repozytorium.pobierzDecyzje()).toEqual([]);
    expect(await repozytorium.pobierzAnalizyWplywu()).toEqual([]);
    expect(await repozytorium.pobierzZdarzenia()).toEqual(historia);
    await zastosuj();
    expect((await pobierz()).status).toBe('APPLIED');
  });

  it('nieaktualny ImpactAnalysis po CaptureAnalysis nadal blokuje stale proposal', async () => {
    const { repozytorium, rozpocznij, ocen, zakoncz, zastosuj } = await przygotuj([element('IMPACT_CANDIDATE')]);
    await repozytorium.wykonajOperacjeUstalen({ rodzaj: 'utworz', id: 'd1', dane: { tytul: 'Wcześniejsza decyzja', opis: 'Opis', projektIds: ['p1'], typZrodla: 'USER', nazwaZrodla: 'Użytkownik', odniesienieZrodla: '', wpisZrodlowyId: null, notatki: '', powiazaneElementy: [] } }, kontekst());
    await repozytorium.wykonajOperacjeUstalen({ rodzaj: 'status', id: 'd1', wersja: 1, status: 'ACCEPTED' }, kontekst());
    await rozpocznij(); await ocen(0, 'ACCEPTED'); await zakoncz(); await zastosuj();
    const wplyw = (await repozytorium.pobierzAnalizyWplywu())[0];
    const projekt = (await repozytorium.pobierzProjekty())[0];
    await repozytorium.zmienProjekt('p1', { rodzaj: 'punktPowrotu', dane: { ...projekt, nastepnyKrok: 'Nowszy stan' } }, kontekst());
    await repozytorium.wykonajOperacjeUstalen({ rodzaj: 'status', id: 'd1', wersja: 2, status: 'IMPLEMENTED' }, kontekst());
    const historia = await repozytorium.pobierzZdarzenia();
    for (const propozycja of wplyw.propozycje) await expect(repozytorium.wykonajOperacjeUstalen({ rodzaj: 'rozstrzygnij', analizaId: wplyw.id, propozycjaId: propozycja.id, zatwierdz: true }, kontekst())).rejects.toThrow('zmieni');
    expect(await repozytorium.pobierzAnalizyWplywu()).toEqual([wplyw]);
    expect(await repozytorium.pobierzZdarzenia()).toEqual(historia);
    expect((await repozytorium.pobierzDecyzje())[0].status).toBe('IMPLEMENTED');
    expect((await repozytorium.pobierzProjekty())[0].nastepnyKrok).toBe('Nowszy stan');
  });

  it('serializuje równoczesny apply i nie tworzy duplikatów decyzji', async () => {
    const { repozytorium, rozpocznij, ocen, zakoncz, zastosuj, pobierz } = await przygotuj();
    await rozpocznij(); await ocen(0, 'ACCEPTED'); await zakoncz();
    const wyniki = await Promise.allSettled([zastosuj(), zastosuj()]);
    expect(wyniki.map((wynik) => wynik.status).sort()).toEqual(['fulfilled', 'rejected']);
    expect(await repozytorium.pobierzDecyzje()).toHaveLength(1);
    await expect(zastosuj()).rejects.toThrow('już zastosowana');
    const analiza = await pobierz();
    await expect(repozytorium.wykonajOperacjeAnalizyWpisu({ rodzaj: 'review', id: analiza.id, wersja: analiza.wersja, elementId: analiza.elementy[0].id, status: 'REJECTED' }, kontekst())).rejects.toThrow('już zastosowana');
  });

  it('zachowuje kolejne numery istniejących Decision dla wielu zatwierdzonych elementów', async () => {
    const { repozytorium, rozpocznij, ocen, zakoncz, zastosuj } = await przygotuj([element('POSSIBLE_DECISION', 'Pierwsza'), element('POSSIBLE_DECISION', 'Druga')]);
    await rozpocznij(); await ocen(0, 'ACCEPTED'); await ocen(1, 'ACCEPTED'); await zakoncz(); await zastosuj();
    expect((await repozytorium.pobierzDecyzje()).map((decyzja) => decyzja.czytelneId)).toEqual(['DEC-0001', 'DEC-0002']);
  });

  it('blokuje utratę review przez zapis z nieaktualnej karty i nie spamuje ActivityEvent', async () => {
    const { repozytorium, rozpocznij, ocen, zakoncz, pobierz } = await przygotuj();
    await rozpocznij();
    const poprzednia = await pobierz();
    await ocen(0, 'EDITED', 'Korekta');
    await expect(repozytorium.wykonajOperacjeAnalizyWpisu({ rodzaj: 'review', id: poprzednia.id, wersja: poprzednia.wersja, elementId: poprzednia.elementy[0].id, status: 'REJECTED' }, kontekst())).rejects.toThrow('zmieniła');
    expect((await pobierz()).elementy[0].trescEdytowana).toBe('Korekta');
    expect((await repozytorium.pobierzZdarzenia()).filter((zdarzenie) => zdarzenie.typZdarzenia.startsWith('CAPTURE_')).map((zdarzenie) => zdarzenie.typZdarzenia)).toEqual(expect.arrayContaining(['CAPTURE_CREATED', 'CAPTURE_ANALYZED']));
    expect(await repozytorium.pobierzZdarzenia()).toHaveLength(3);
    await zakoncz();
    expect((await repozytorium.pobierzZdarzenia()).filter((zdarzenie) => zdarzenie.typZdarzenia === 'CAPTURE_REVIEWED')).toHaveLength(1);
  });

  it('brak zatwierdzonych elementów nie oznacza Capture jako APPLIED', async () => {
    const { repozytorium, rozpocznij, ocen, zakoncz, zastosuj } = await przygotuj();
    await rozpocznij(); await ocen(0, 'REJECTED'); await zakoncz();
    await expect(zastosuj()).rejects.toThrow('Brak zatwierdzonych');
    expect((await repozytorium.pobierzWpisy())[0].status).toBe('REVIEWED');
  });

  it('wymaga aktywnego celu dla luźnego Capture i zapisuje cel w provenance wpływu', async () => {
    const { repozytorium, rozpocznij, ocen, zakoncz, zastosuj, wpis } = await przygotuj([element('IMPACT_CANDIDATE')], null);
    await rozpocznij(); await ocen(0, 'ACCEPTED'); await zakoncz();
    await expect(zastosuj()).rejects.toThrow('aktywny projekt');
    await zastosuj(kontekst(), 'p1');
    expect((await repozytorium.pobierzAnalizyWplywu())[0].projektIds).toEqual(['p1']);
    expect((await repozytorium.pobierzWpisy())[0]).toMatchObject({ projektId: null, trescOryginalna: wpis.trescOryginalna });
  });

  it('migracja v3 → v4 zachowuje Project, Capture, Decision, ImpactAnalysis i historię Etapu 4', async () => {
    const nazwaBazy = crypto.randomUUID();
    const projekt = { ...utworzProjekt('Dawny projekt', 'p1', '2026-10-08T10:00:00Z'), status: 'ACTIVE' as const, nastepnyKrok: 'Obecny krok' };
    const wpis = utworzWpis('  Oryginał sprzed migracji\n ', 'p1', 'w1', projekt.utworzono);
    const decyzja: Decyzja = { id: 'd1', czytelneId: 'DEC-0001', tytul: 'Dawna decyzja', opis: 'Treść', projektIds: ['p1'], typZrodla: 'USER', nazwaZrodla: 'Użytkownik', odniesienieZrodla: '', wpisZrodlowyId: 'w1', notatki: 'Historia', powiazaneElementy: [], status: 'SUPERSEDED', utworzono: projekt.utworzono, zaktualizowano: projekt.utworzono, wersja: 2, zastapionaPrzezId: 'd2' };
    const nastepna = { ...decyzja, id: 'd2', czytelneId: 'DEC-0002', status: 'ACCEPTED', zastapionaPrzezId: null };
    const analiza: AnalizaWplywu = { id: 'i1', zrodlo: { typ: 'CAPTURE', id: 'w1' }, projektIds: ['p1'], utworzono: projekt.utworzono,
      propozycje: [{ id: 'i1:1', tytul: 'Dawny wpływ', uzasadnienie: 'Relacja', stan: 'PENDING', rodzaj: 'DECISION_STATUS', decyzjaId: 'd2', wersja: 2, poprzedniStatus: 'ACCEPTED', proponowanyStatus: 'PROPOSED' }] };
    const historia = { id: 'z1', projektId: 'p1', typEncji: 'DECISION', encjaId: 'd1', typZdarzenia: 'DECISION_SUPERSEDED', tytul: 'Zachowana historia', utworzono: projekt.utworzono, zrodlo: projekt.zrodlo };
    await new Promise<void>((rozwiaz, odrzuc) => {
      const zadanie = indexedDB.open(nazwaBazy, 3);
      zadanie.onupgradeneeded = () => {
        const baza = zadanie.result;
        baza.createObjectStore('projekty', { keyPath: 'id' }).add(projekt);
        baza.createObjectStore('wpisy', { keyPath: 'id' }).add(wpis);
        baza.createObjectStore('zdarzenia', { keyPath: 'id' }).add(historia);
        const decyzje = baza.createObjectStore('decyzje', { keyPath: 'id' });
        decyzje.createIndex('czytelneId', 'czytelneId', { unique: true });
        decyzje.createIndex('projektIds', 'projektIds', { multiEntry: true });
        decyzje.add(decyzja); decyzje.add(nastepna);
        baza.createObjectStore('analizyWplywu', { keyPath: 'id' }).add(analiza);
      };
      zadanie.onerror = () => odrzuc(zadanie.error);
      zadanie.onsuccess = () => { expect(zadanie.result.version).toBe(3); zadanie.result.close(); rozwiaz(); };
    });
    const repozytorium = utworzRepozytoriumIndexedDb(nazwaBazy);
    expect(await repozytorium.pobierzProjekty()).toEqual([projekt]);
    expect(await repozytorium.pobierzWpisy()).toEqual([wpis]);
    expect(await repozytorium.pobierzDecyzje()).toEqual([decyzja, nastepna]);
    expect(await repozytorium.pobierzAnalizyWplywu()).toEqual([analiza]);
    expect(await repozytorium.pobierzZdarzenia()).toEqual([historia]);
    expect(await repozytorium.pobierzAnalizyWpisow()).toEqual([]);
    const wynik = await repozytorium.wykonajOperacjeAnalizyWpisu({ rodzaj: 'generuj', id: 'a1', wpisId: wpis.id, wynik: await new RuleBasedAnalysisProvider().analizuj(wpis.trescOryginalna) }, kontekst());
    expect(wynik.analizaWpisu.status).toBe('GENERATED');
  });
});

describe('RuleBasedAnalysisProvider', () => {
  it('rozpoznaje wyłącznie jawne zwroty, oznaczając wszystkie elementy jako SYSTEM', async () => {
    const wynik = await new RuleBasedAnalysisProvider().analizuj('Decyduję: zapis lokalny.\nCo dalej?\nTrzeba sprawdzić zapis.\nWpływ: nowy zakres.\nZakładam zgodność.\nProponuję test.');
    expect(wynik.elementy.map((element) => element.typ)).toEqual(['POSSIBLE_DECISION', 'OPEN_QUESTION', 'RECOMMENDED_ACTION', 'IMPACT_CANDIDATE', 'ASSUMPTION', 'SUGGESTION']);
    expect(wynik.elementy.every((element) => element.zrodlo === 'SYSTEM' && element.pewnosc === undefined)).toBe(true);
  });

  it('nie zgaduje faktów, intencji, negacji ani semantycznego wpływu nieznanego tekstu', async () => {
    const tekst = 'Baza działa. Nie trzeba zmieniać projektu. Może to zmieni wszystko.';
    const wynik = await new RuleBasedAnalysisProvider().analizuj(tekst);
    expect(wynik.elementy).toEqual([]);
    expect(wynik.klasyfikacja).toBe('Niesklasyfikowany');
    expect(wynik.podsumowanie).toBe(`Skrót oryginału (bez interpretacji): ${tekst}`);
    expect((await new RuleBasedAnalysisProvider().analizuj('Decyduję?')).elementy[0].typ).toBe('OPEN_QUESTION');
  });
});
