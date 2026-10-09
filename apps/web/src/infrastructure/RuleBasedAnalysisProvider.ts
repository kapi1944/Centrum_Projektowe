import type { AnalysisProvider, PropozycjaAnalizy, WynikDostawcyAnalizy } from '../domain/analizaWpisu';

export class RuleBasedAnalysisProvider implements AnalysisProvider {
  async analizuj(trescOryginalna: string): Promise<WynikDostawcyAnalizy> {
    const elementy: PropozycjaAnalizy[] = [];
    const zdania = trescOryginalna.match(/[^.!?\n]+[.!?]*/gu) ?? [];
    for (const fragment of zdania) {
      const tresc = fragment.trim();
      if (!tresc) continue;
      const typ = tresc.endsWith('?') ? 'OPEN_QUESTION'
        : /^(decyduj[eę]|zdecydowa[lł]em|ustalamy|decyzja\s*:)/iu.test(tresc) ? 'POSSIBLE_DECISION'
        : /^(trzeba|nale[zż]y|musz[eę]|do zrobienia\s*:)/iu.test(tresc) ? 'RECOMMENDED_ACTION'
        : /^wp[lł]yw\s*:/iu.test(tresc) ? 'IMPACT_CANDIDATE'
        : /^(zak[lł]adam|za[lł]o[zż]enie\s*:)/iu.test(tresc) ? 'ASSUMPTION'
        : /^(proponuj[eę]|sugestia\s*:)/iu.test(tresc) ? 'SUGGESTION' : null;
      if (typ) elementy.push({ typ, tresc, zrodlo: 'SYSTEM' });
    }
    return {
      typDostawcy: 'RULE_BASED', nazwaDostawcy: 'Reguły jawnych zwrotów', wersjaDostawcy: '1', wersjaAnalizy: '1',
      klasyfikacja: elementy.length ? 'Wpis z rozpoznanymi zwrotami' : 'Niesklasyfikowany',
      podsumowanie: `Skrót oryginału (bez interpretacji): ${trescOryginalna.slice(0, 180)}${trescOryginalna.length > 180 ? '…' : ''}`,
      elementy,
    };
  }
}
