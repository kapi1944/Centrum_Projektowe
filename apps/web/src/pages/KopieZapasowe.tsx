import { useRef, useState } from 'react';
import type { RepozytoriumProjektowe } from '../domain/repozytorium';
import { BladKonfliktow, odczytajKopie, nazwyMagazynow, schematDanych, type KopiaZapasowa, type KopiaZapasowaV1, type TrybImportu, type KonfliktKopii } from '../domain/kopieZapasowe';
import { formatujDate } from '../shared/formatujDate';

export function KopieZapasowe({ repozytorium, odswiez }: { repozytorium: RepozytoriumProjektowe; odswiez: () => void }) {
  const [kopia, ustawKopie] = useState<KopiaZapasowa | KopiaZapasowaV1 | null>(null);
  const [tryb, ustawTryb] = useState<TrybImportu>('polacz');
  const [potwierdzono, ustawPotwierdzenie] = useState(false);
  const [blad, ustawBlad] = useState('');
  const [komunikat, ustawKomunikat] = useState('');
  const [zajety, ustawZajety] = useState(false);
  const [konflikty, ustawKonflikty] = useState<KonfliktKopii[]>([]);
  const plik = useRef<HTMLInputElement>(null);
  const blokada = useRef(false);
  function opisRekordu(wartosc: unknown) {
    const rekord = wartosc as Record<string, unknown>;
    return ['nazwa', 'tytul', 'pytanie', 'trescOryginalna', 'opis', 'kontekst']
      .flatMap((pole) => typeof rekord[pole] === 'string' && rekord[pole] ? [rekord[pole]] : []).join('\n') || 'Rekord bez opisu tekstowego.';
  }
  function zmienionePola(konflikt: KonfliktKopii) {
    const obecny = konflikt.obecny as Record<string, unknown>;
    const importowany = konflikt.importowany as Record<string, unknown>;
    return [...new Set([...Object.keys(obecny), ...Object.keys(importowany)])]
      .filter((pole) => JSON.stringify(obecny[pole]) !== JSON.stringify(importowany[pole])).join(', ');
  }

  async function wykonaj(operacja: () => Promise<void>) {
    if (blokada.current) return;
    blokada.current = true; ustawZajety(true); ustawBlad(''); ustawKomunikat(''); ustawKonflikty([]);
    try { await operacja(); } catch (blad) {
      ustawBlad(blad instanceof Error ? blad.message : 'Operacja nie powiodła się.');
      if (blad instanceof BladKonfliktow) ustawKonflikty(blad.konflikty);
    } finally { blokada.current = false; ustawZajety(false); }
  }
  async function eksportuj() {
    await wykonaj(async () => {
      const kopia = await repozytorium.eksportujKopie();
      const adres = URL.createObjectURL(new Blob([JSON.stringify(kopia, null, 2)], { type: 'application/json' }));
      const odnosnik = document.createElement('a');
      odnosnik.href = adres; odnosnik.download = `centrum-projektowe-kopia-${kopia.exportedAt.slice(0, 10)}.json`;
      document.body.append(odnosnik); odnosnik.click(); odnosnik.remove();
      // Przeglądarka potrzebuje chwili na rozpoczęcie pobierania.
      setTimeout(() => URL.revokeObjectURL(adres), 1000);
      ustawKomunikat('Plik kopii został przygotowany do pobrania. Zachowaj go w bezpiecznym miejscu.');
    });
  }
  async function sprawdz() {
    const wybrany = plik.current?.files?.[0];
    ustawKopie(null); ustawPotwierdzenie(false);
    await wykonaj(async () => {
      if (!wybrany) throw new Error('Wybierz plik kopii zapasowej.');
      const kopia = odczytajKopie(await wybrany.text());
      ustawKopie(kopia); ustawKomunikat('Kopia jest poprawna. Sprawdzenie nie zmieniło obecnych danych.');
    });
  }
  async function importuj() {
    await wykonaj(async () => {
      if (!kopia) throw new Error('Najpierw sprawdź kopię.');
      await repozytorium.importujKopie(kopia, tryb, potwierdzono);
      ustawKopie(null); ustawPotwierdzenie(false);
      ustawKomunikat('Odtworzono dane z kopii zapasowej.');
      odswiez();
    });
  }
  return <>
    <h1>Dane i kopie zapasowe</h1>
    <p>Dane są lokalne. Regularnie zapisuj kopię poza tą przeglądarką. Synchronizacja nie jest dostępna.</p>
    <section aria-labelledby="eksport-kopii">
      <h2 id="eksport-kopii">Eksport danych</h2>
      <p>Plik kopii zapasowej może zawierać prywatne informacje o projektach. Przechowuj go w bezpiecznym miejscu.</p>
      <button disabled={zajety} onClick={eksportuj}>Utwórz kopię zapasową</button>
    </section>
    <section aria-labelledby="import-kopii">
      <h2 id="import-kopii">Import danych</h2>
      <label>Plik kopii zapasowej <input ref={plik} type="file" accept=".json,application/json" disabled={zajety} onChange={() => {
        ustawKopie(null); ustawPotwierdzenie(false); ustawBlad(''); ustawKomunikat(''); ustawKonflikty([]);
      }} /></label>
      <button disabled={zajety} onClick={sprawdz}>Sprawdź kopię</button>
      {kopia && <>
        <h2>Kopia zawiera</h2>
        <p>Data wykonania: {formatujDate(kopia.exportedAt)}. Wersja schematu: {kopia.schemaVersion}. Wersja aplikacji: {kopia.appVersion}.</p>
        <ul>{nazwyMagazynow.filter((nazwa) => kopia.schemaVersion === 2 || nazwa !== 'przebiegiAnaliz').map((nazwa) => <li key={nazwa}>{schematDanych[nazwa].etykieta}: {nazwa === 'przebiegiAnaliz' ? (kopia.schemaVersion === 2 ? kopia.data.przebiegiAnaliz.length : 0) : kopia.data[nazwa].length}</li>)}
          <li>Analiz łącznie: {kopia.data.analizyWpisow.length + kopia.data.analizyWplywu.length}</li>
        </ul>
        <label>Sposób odtworzenia <select disabled={zajety} value={tryb} onChange={(zdarzenie) => {
          ustawTryb(zdarzenie.target.value as TrybImportu); ustawPotwierdzenie(false); ustawKonflikty([]);
        }}>
          <option value="polacz">Połącz z obecnymi danymi</option>
          <option value="zastap">Zastąp obecne dane</option>
        </select></label>
        {tryb === 'polacz' && <p>Identyczne rekordy zostaną pominięte, nowe dodane. Każdy konflikt zatrzyma cały import. Możesz anulować import albo świadomie zastąpić całą bazę kopią.</p>}
        {tryb === 'zastap' && <p><label><input type="checkbox" disabled={zajety} checked={potwierdzono} onChange={(zdarzenie) => ustawPotwierdzenie(zdarzenie.target.checked)} /> Potwierdzam usunięcie wszystkich obecnych danych i zastąpienie ich tą kopią, także gdy kopia jest pusta.</label></p>}
        <button disabled={zajety || (tryb === 'zastap' && !potwierdzono)} onClick={importuj}>Odtwórz z kopii</button>
      </>}
    </section>
    {zajety && <p role="status">Trwa operacja…</p>}
    {blad && <p role="alert">{blad}</p>}
    {komunikat && <p role="status">{komunikat}</p>}
    {konflikty.length > 0 && <section><h2>Konflikty ({konflikty.length})</h2>
      <p>Nie zmieniono bazy. Porównaj opisy przed decyzją o zastąpieniu danych. Lista pól wskazuje też różnice w relacjach i historii. Pełne rekordy możesz porównać w plikach kopii.</p>
      {konflikty.map((konflikt) => <details key={`${konflikt.magazyn}:${konflikt.id}`}>
        <summary>{schematDanych[konflikt.magazyn].etykieta} — {konflikt.id}</summary>
        <p>Różniące się pola: {zmienionePola(konflikt)}</p>
        <h3>Obecny rekord</h3><p className="surowy-wpis">{opisRekordu(konflikt.obecny)}</p>
        <h3>Rekord z kopii</h3><p className="surowy-wpis">{opisRekordu(konflikt.importowany)}</p>
      </details>)}
    </section>}
  </>;
}
