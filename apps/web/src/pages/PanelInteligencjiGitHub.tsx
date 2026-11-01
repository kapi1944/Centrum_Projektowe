import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { DaneKopii } from '../domain/kopieZapasowe';
import { magazynyZrodel, typyZrodelDowodu, type OperacjaRepozytorium, type PolaczenieRepozytorium } from '../domain/kontekstRepozytorium';
import { ostatniOdczytGitHub, utworzPowiazanieGitHub, uzgodnijProjektGitHub, type WyborPowiazaniaGitHub } from '../domain/inteligencjaGitHub';
import { statusyWorkflow, type PlikZmiany, type ZakresGitHub } from '../domain/synchronizacjaGitHub';
import { adresZrodla } from '../domain/pakietKontekstu';
import { formatujDate } from '../shared/formatujDate';

type Zapisz = (operacja: OperacjaRepozytorium) => Promise<void>;
export function PanelInteligencjiGitHub({ repo, dane, projektId, zajety, odczytaj, wykonaj }: {
  repo: PolaczenieRepozytorium; dane: DaneKopii; projektId: string; zajety: boolean; odczytaj: (zakres: ZakresGitHub) => void; wykonaj: Zapisz;
}) {
  const [wybor, ustawWybor] = useState<{ rodzaj: 'commit' | 'pull_request'; identyfikator: string; zrodloId?: string } | null>(null);
  const [komunikat, ustawKomunikat] = useState('');
  const [zapisuje, ustawZapisywanie] = useState(false);
  const blokada = useRef(false);
  const migawka = ostatniOdczytGitHub(dane, repo.id);
  const odczyt = migawka?.github;
  if (!odczyt) return <p>Synchronizuj repozytorium, aby otworzyć historię i analizę zmian.</p>;
  const inteligencja = odczyt.inteligencja;
  const powiazania = dane.dowody.filter((dowod) => dowod.projektIds.includes(projektId) && dowod.polaczenieZrodla?.connectionId === repo.id && ['commit', 'pull_request'].includes(dowod.polaczenieZrodla.resourceType));
  const propozycje = uzgodnijProjektGitHub(dane, repo, projektId);
  async function zapisz(wybor: WyborPowiazaniaGitHub) {
    if (blokada.current) return;
    blokada.current = true; ustawZapisywanie(true); ustawKomunikat('');
    try {
      await wykonaj({ rodzaj: 'dowod', rekord: utworzPowiazanieGitHub(dane, repo, wybor, crypto.randomUUID(), new Date().toISOString()) });
      ustawWybor(null); ustawKomunikat('Potwierdzenie zapisano jako lokalny dowód. Stan pracy i decyzje pozostają pod kontrolą użytkownika.');
    } catch (blad) { ustawKomunikat(blad instanceof Error ? blad.message : 'Nie udało się zapisać powiązania.'); }
    finally { blokada.current = false; ustawZapisywanie(false); }
  }
  return <div className="inteligencja-github">
    <p className="ograniczenia-github">Odczyt na żądanie: do 20 commitów, 100 plików wybranego commita, 300 plików porównania, 20 PR i 20 uruchomień Actions. Bez kolejnych stron i automatycznych ponowień. Zakresy mają osobne daty; brak wpisu w tym oknie nie dowodzi braku zmiany. Obowiązuje anonimowy limit API GitHub.</p>
    <section aria-label={`Historia ${repo.nazwa}`}><h3>Historia commitów</h3>
      <p>Zapisana historia: {odczyt.historiaPobrana ? formatujDate(odczyt.historiaPobrana) : 'starszy odczyt — czas w historii obserwacji'} · gałąź {odczyt.tozsamosc.domyslnaGalaz}</p>
      <ol className="historia-github">{odczyt.commity.map((commit) => {
        const szczegoly = inteligencja?.szczegoly.find((szczegol) => szczegol.sha === commit.sha);
        const dowody = powiazania.filter((dowod) => dowod.polaczenieZrodla?.externalRevision === commit.sha);
        return <li key={commit.sha}><div className="naglowek-commita"><a title={commit.sha} href={`${odczyt.tozsamosc.adres}/commit/${commit.sha}`} target="_blank" rel="noreferrer">{commit.sha.slice(0, 8)}</a><time dateTime={commit.czas}>{formatujDate(commit.czas)}</time></div>
          <p className="surowy-wpis">{commit.opis}</p><small>Zaobserwowany przez API · powiązane dowody: {dowody.length}</small>
          <div className="akcje-wpisu"><button className="przycisk-drugorzedny" disabled={zajety} onClick={() => odczytaj({ rodzaj: 'COMMIT', sha: commit.sha })}>{szczegoly ? 'Odśwież pliki' : 'Pobierz pliki'} {commit.sha.slice(0, 8)}</button>
            <button disabled={zapisuje} onClick={() => ustawWybor({ rodzaj: 'commit', identyfikator: commit.sha })}>Powiąż commit {commit.sha.slice(0, 8)}</button></div>
          {szczegoly ? <details open><summary>Statystyki i pliki: +{szczegoly.dodano} / −{szczegoly.usunieto}</summary><p>Pobrano: {formatujDate(szczegoly.pobrano)}. Statystyki dotyczą całego commita; lista plików może być ograniczona.</p><ListaPlikow pliki={szczegoly.pliki} ograniczone={szczegoly.ograniczone} /></details> : <p>Statystyki i pliki dostępne po wybraniu „Pobierz pliki”.</p>}
        </li>;
      })}</ol>
    </section>
    <section aria-label={`Porównanie ${repo.nazwa}`}><h3>Porównywarka zmian</h3>
      <form key={odczyt.commity[0]!.sha} onSubmit={(zdarzenie: FormEvent<HTMLFormElement>) => {
        zdarzenie.preventDefault(); const formularz = new FormData(zdarzenie.currentTarget);
        const podstawa = String(formularz.get('podstawa')); const cel = String(formularz.get('cel'));
        if (podstawa === cel) { ustawKomunikat('Wybierz dwa różne commity do porównania.'); return; }
        odczytaj({ rodzaj: 'POROWNANIE', podstawa, cel });
      }}><fieldset disabled={zajety || odczyt.commity.length < 2}><legend>Wybierz zakres od podstawy do celu</legend>
        <label>Commit podstawy <select name="podstawa" defaultValue={odczyt.commity.at(-1)!.sha}>{odczyt.commity.map((commit) => <option key={commit.sha} value={commit.sha}>{commit.sha.slice(0, 8)} · {commit.opis.slice(0, 80)}</option>)}</select></label>
        <label>Commit celu <select name="cel" defaultValue={odczyt.commity[0]!.sha}>{odczyt.commity.map((commit) => <option key={commit.sha} value={commit.sha}>{commit.sha.slice(0, 8)} · {commit.opis.slice(0, 80)}</option>)}</select></label><button>Porównaj commity</button>
      </fieldset></form>
      {inteligencja?.porownanie && <><p>Zakres: {inteligencja.porownanie.podstawa.slice(0, 8)} → {inteligencja.porownanie.cel.slice(0, 8)} · relacja: {({ ahead: 'do przodu', behind: 'wstecz', identical: 'identyczne', diverged: 'rozbieżne' })[inteligencja.porownanie.status]} · commitów w porównaniu: {inteligencja.porownanie.liczbaCommitow}</p>
        <p>Pobrano: {formatujDate(inteligencja.porownanie.pobrano)}</p><a href={`${odczyt.tozsamosc.adres}/compare/${inteligencja.porownanie.podstawa}...${inteligencja.porownanie.cel}`} target="_blank" rel="noreferrer">Porównanie na GitHub</a><ListaPlikow pliki={inteligencja.porownanie.pliki} ograniczone={inteligencja.porownanie.ograniczone} /></>}
    </section>
    <div className="panele-github">
      <section aria-label={`CI/CD ${repo.nazwa}`}><h3>CI/CD · GitHub Actions</h3><button disabled={zajety} onClick={() => odczytaj({ rodzaj: 'WORKFLOW' })}>Pobierz status Actions</button>
        <p>Status CI opisuje wyłącznie dane uruchomienie workflow. Sukces nie gwarantuje poprawności całej aplikacji ani wdrożenia.</p>
        {inteligencja?.workflow ? <><p>Pobrano: {formatujDate(inteligencja.workflow.pobrano)}</p><p>Ostatni status: {inteligencja.workflow.rekordy[0] ? statusyWorkflow[inteligencja.workflow.rekordy[0].status] : 'Nieznany — brak uruchomień'}</p>
          {inteligencja.workflow.ograniczone && <p>Pokazano tylko pierwsze 20 uruchomień.</p>}
          <ul className="lista-github">{inteligencja.workflow.rekordy.map((przebieg) => <li key={przebieg.id}><a href={`${odczyt.tozsamosc.adres}/actions/runs/${przebieg.id}`} target="_blank" rel="noreferrer">{przebieg.nazwa}</a> · <strong>{statusyWorkflow[przebieg.status]}</strong> ({przebieg.wynik ?? 'bez wyniku'})
            <p>Commit: <a href={`${odczyt.tozsamosc.adres}/commit/${przebieg.sha}`} target="_blank" rel="noreferrer">{przebieg.sha.slice(0, 8)}</a> · {formatujDate(przebieg.rozpoczeto)}</p><p>Czas wykonania: {przebieg.czasSekundy === null ? 'nieustalony' : `około ${przebieg.czasSekundy} s (do ostatniej aktualizacji)`}</p></li>)}</ul></> : <p>Nieznany — status Actions nie został pobrany.</p>}
      </section>
      <section aria-label={`Pull Requests ${repo.nazwa}`}><h3>Pull Requests</h3><button disabled={zajety} onClick={() => odczytaj({ rodzaj: 'PR' })}>Pobierz Pull Requests</button>
        {inteligencja?.pullRequesty ? <><p>Pobrano: {formatujDate(inteligencja.pullRequesty.pobrano)} · ostatnio aktualizowane, wszystkie stany</p>{inteligencja.pullRequesty.ograniczone && <p>Lista ograniczona do 20 PR.</p>}
          {!inteligencja.pullRequesty.rekordy.length && <p>Brak PR w odpowiedzi GitHub.</p>}<ul className="lista-github">{inteligencja.pullRequesty.rekordy.map((pr) => <li key={pr.numer}><a href={`${odczyt.tozsamosc.adres}/pull/${pr.numer}`} target="_blank" rel="noreferrer">#{pr.numer} {pr.tytul}</a><p>{pr.stan === 'open' ? 'Otwarty' : 'Zamknięty'}{pr.szkic ? ' · szkic' : ''} · {formatujDate(pr.zaktualizowano)}</p><button disabled={zapisuje} onClick={() => ustawWybor({ rodzaj: 'pull_request', identyfikator: String(pr.numer) })}>Powiąż PR #{pr.numer}</button></li>)}</ul></> : <p>Lista PR nie została pobrana.</p>}
      </section>
    </div>
    <section aria-label={`Powiązania ${repo.nazwa}`}><h3>Powiązania z pracą i dowody</h3><p>Wybierz commit lub PR, a następnie potwierdź cel i znaczenie powiązania. Powiązanie jest deklaracją użytkownika; sam commit nie potwierdza wdrożenia.</p>
      {wybor && <FormularzPowiazania key={`${wybor.rodzaj}:${wybor.identyfikator}:${wybor.zrodloId ?? ''}`} dane={dane} projektId={projektId} wybor={wybor} zajety={zapisuje} zapisz={zapisz} anuluj={() => ustawWybor(null)} />}
      {!powiazania.length && <p>Brak ręcznych powiązań GitHub.</p>}
      <ul className="lista-github">{powiazania.map((dowod) => <li key={dowod.id}><a href={dowod.polaczenieZrodla!.url} target="_blank" rel="noreferrer">{dowod.polaczenieZrodla!.resourceType === 'commit' ? dowod.polaczenieZrodla!.externalId.slice(0, 8) : `PR #${dowod.polaczenieZrodla!.externalId}`}</a> → <Link to={adresZrodla(dane, dowod.typZrodla, dowod.zrodloId, projektId)}>{typyZrodelDowodu[dowod.typZrodla]}: {dowod.zrodloId}</Link><p>{dowod.opis} · {dowod.rola} · deklaracja użytkownika · rewizja celu {dowod.rewizja}</p></li>)}</ul>
      <p role="status">{komunikat}</p>
    </section>
    <section aria-label={`Uzgodnienie ${repo.nazwa}`}><h3>Project Reconciliation · propozycje przeglądu</h3><p>Analiza porównuje lokalne deklaracje z ograniczonymi obserwacjami GitHub. Propozycje wymagają oceny i potwierdzenia użytkownika; nie zmieniają zadań, etapów ani decyzji.</p>
      {!propozycje.length && <p>Brak propozycji w obecnym zakresie danych.</p>}
      <ul className="lista-github">{propozycje.map((propozycja) => <li key={propozycja.id}><p>{propozycja.opis}</p>{propozycja.adres && <a href={propozycja.adres} target="_blank" rel="noreferrer">Sprawdź dowód na GitHub</a>}
        {propozycja.rodzaj === 'BRAK_DOWODU' && <button disabled={zapisuje} onClick={() => ustawWybor({ rodzaj: 'commit', identyfikator: odczyt.commity[0]!.sha, zrodloId: propozycja.zrodloId })}>Uzupełnij dowód po weryfikacji</button>}
        {propozycja.rodzaj === 'PRZEGLAD' && <button disabled={zapisuje} onClick={() => { void zapisz({ projektId, typZrodla: 'REPOSITORY', zrodloId: repo.id, rodzaj: 'commit', identyfikator: odczyt.commity[0]!.sha, rola: 'PRZEGLAD', opis: 'Użytkownik potwierdził przegląd zmian względem stanu pracy. Nie potwierdza to wdrożenia ani poprawności aplikacji.' }); }}>Potwierdzam wykonany przegląd {odczyt.commity[0]!.sha.slice(0, 8)}</button>}
      </li>)}</ul>
    </section>
  </div>;
}
function ListaPlikow({ pliki, ograniczone }: { pliki: PlikZmiany[]; ograniczone: boolean }) {
  return <>{ograniczone && <p>Lista może być niepełna z powodu limitu plików API. Sprawdź pełne zmiany na GitHub.</p>}
    <p>Suma dla pobranych plików: +{pliki.reduce((suma, plik) => suma + plik.dodano, 0)} / −{pliki.reduce((suma, plik) => suma + plik.usunieto, 0)}. Porównanie przedstawia zmiany GitHub od wspólnego przodka; pliki binarne mogą mieć zerowe statystyki linii.</p>
    {!pliki.length && <p>Brak plików w tym zakresie.</p>}<ul className="lista-github">{pliki.map((plik) => <li key={plik.nazwa}><code>{plik.nazwa}</code> · {plik.status} · +{plik.dodano} / −{plik.usunieto}{plik.poprzedniaNazwa && <p>Poprzednia nazwa: {plik.poprzedniaNazwa}</p>}</li>)}</ul></>;
}
function FormularzPowiazania({ dane, projektId, wybor, zajety, zapisz, anuluj }: {
  dane: DaneKopii; projektId: string; wybor: { rodzaj: 'commit' | 'pull_request'; identyfikator: string; zrodloId?: string }; zajety: boolean; zapisz: (wybor: WyborPowiazaniaGitHub) => Promise<void>; anuluj: () => void;
}) {
  const [typ, ustawTyp] = useState<'WORK_ITEM' | 'STAGE' | 'DECISION'>('WORK_ITEM');
  const cele = dane[magazynyZrodel[typ]].filter((cel) => 'projektIds' in cel ? cel.projektIds.includes(projektId) : cel.projektId === projektId);
  return <form className="formularz-realizacji" onSubmit={(zdarzenie) => {
    zdarzenie.preventDefault(); const formularz = new FormData(zdarzenie.currentTarget);
    void zapisz({ projektId, typZrodla: typ, zrodloId: String(formularz.get('cel')), rodzaj: wybor.rodzaj, identyfikator: String(formularz.get('zasob')), rola: String(formularz.get('rola')) as 'ZMIANA' | 'WDROZENIE', opis: String(formularz.get('opis')) });
  }}><fieldset disabled={zajety}><legend>Potwierdź powiązanie {wybor.rodzaj === 'commit' ? 'commita' : 'PR'}</legend>
    <label>{wybor.rodzaj === 'commit' ? 'SHA commita' : 'Numer PR'} <input name="zasob" defaultValue={wybor.identyfikator} required /></label>
    <label>Typ celu <select value={typ} onChange={(zdarzenie) => ustawTyp(zdarzenie.target.value as typeof typ)}>{(['WORK_ITEM', ...(wybor.rodzaj === 'commit' ? ['STAGE', 'DECISION'] as const : [])] as const).map((rodzaj) => <option key={rodzaj} value={rodzaj}>{typyZrodelDowodu[rodzaj]}</option>)}</select></label>
    <label>Cel powiązania <select key={typ} name="cel" required defaultValue={wybor.zrodloId}>{cele.map((cel) => <option key={cel.id} value={cel.id}>{'tytul' in cel ? cel.tytul : cel.nazwa}</option>)}</select></label>
    <label>Znaczenie dowodu <select name="rola" defaultValue={wybor.zrodloId ? 'WDROZENIE' : 'ZMIANA'}><option value="ZMIANA">Zmiana w kodzie</option>{wybor.rodzaj === 'commit' && <option value="WDROZENIE">Ręczne potwierdzenie wdrożenia</option>}</select></label>
    <label>Uzasadnienie i źródło potwierdzenia <textarea name="opis" required /></label><p>Potwierdzenie wdrożenia wymaga własnej weryfikacji i opisu środowiska lub dowodu. Odczyt API tego nie sprawdza.</p>
    <div className="akcje-wpisu"><button disabled={!cele.length}>Potwierdź i zapisz powiązanie</button><button type="button" className="przycisk-drugorzedny" onClick={anuluj}>Anuluj powiązanie</button></div>
  </fieldset></form>;
}
