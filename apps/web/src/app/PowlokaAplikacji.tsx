import { useRef, useState, type ReactNode, type RefObject } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { EtykietaStatusu, PrzyciskAkcji } from '../shared/Komponenty';
import { House as IkonaStartu, LayoutGrid as IkonaProjektow, Inbox as IkonaSkrzynki, CircleAlert as IkonaUwagi, Database as IkonaDanych, ArrowUpRight as IkonaOtwierania, ListChecks as IkonaUstalen, History as IkonaKorekt, GitBranch as IkonaRepozytorium, PanelLeftClose as IkonaZwijania, PanelLeftOpen as IkonaRozwijania, Menu as IkonaMenu, X as IkonaZamkniecia } from 'lucide-react';

const pozycjeNawigacji = [
  { adres: '/', etykieta: 'Start', Ikona: IkonaStartu },
  { adres: '/projekty', etykieta: 'Projekty', Ikona: IkonaProjektow },
  { adres: '/inbox', etykieta: 'Skrzynka', Ikona: IkonaSkrzynki },
  { adres: '/uwaga', etykieta: 'Wymaga uwagi', Ikona: IkonaUwagi },
  { adres: '/dane', etykieta: 'Dane i kopie zapasowe', Ikona: IkonaDanych },
];

export function PasekBoczny({ zwiniety, przelacz, zamknijMenu, projektId }: {
  zwiniety: boolean; przelacz: () => void; zamknijMenu: () => void; projektId?: string;
}) {
  return <aside className="pasek-boczny">
    <Link to="/" className="marka" aria-label="Centrum Projektowe — Start" onClick={zamknijMenu}>
      <span className="sygnet" aria-hidden="true">CP</span><span className="opis-marki">Centrum<strong>Projektowe <small>2.0</small></strong></span>
    </Link>
    <span className="podpis-nawigacji">Przestrzeń robocza</span>
    <nav id="nawigacja-glowna" aria-label="Główna nawigacja">
      {pozycjeNawigacji.map((pozycja) => <NavLink key={pozycja.adres} to={pozycja.adres} end={pozycja.adres === '/'} title={pozycja.etykieta} onClick={zamknijMenu}>
        <pozycja.Ikona className="symbol-nawigacji" size={19} strokeWidth={1.7} aria-hidden="true" /><span className="tekst-nawigacji">{pozycja.etykieta}</span>
      </NavLink>)}
      {projektId && <div className="nawigacja-projektu"><span className="podpis-nawigacji">Otwarty projekt</span>{[
        { sciezka: '', tytul: 'Przegląd projektu', Ikona: IkonaOtwierania },
        { sciezka: '/ustalenia', tytul: 'Ustalenia', Ikona: IkonaUstalen },
        { sciezka: '/korekty', tytul: 'Korekty i rewizje', Ikona: IkonaKorekt },
        { sciezka: '/repozytoria', tytul: 'Repozytoria i kontekst', Ikona: IkonaRepozytorium },
      ].map((pozycja) => <NavLink key={pozycja.sciezka} end to={`/projekty/${projektId}${pozycja.sciezka}`} title={pozycja.tytul} onClick={zamknijMenu}>
        <pozycja.Ikona className="symbol-nawigacji" size={18} strokeWidth={1.7} aria-hidden="true" /><span className="tekst-nawigacji">{pozycja.tytul}</span>
      </NavLink>)}</div>}
    </nav>
    <div className="dol-sidebaru"><span className="podpis-nawigacji">Twoje projekty. Twój kontekst.</span>
      <PrzyciskAkcji className="przelacz-sidebar" wariant="drugorzedny" aria-label={zwiniety ? 'Rozwiń sidebar' : 'Zwiń sidebar'} aria-expanded={!zwiniety} aria-controls="nawigacja-glowna" onClick={przelacz}>
        {zwiniety ? <IkonaRozwijania size={18} aria-hidden="true" /> : <IkonaZwijania size={18} aria-hidden="true" />}<span className="tekst-nawigacji">Zwiń sidebar</span>
      </PrzyciskAkcji>
    </div>
  </aside>;
}

export function GornyPasek({ tytul, menuOtwarte, przelaczMenu, przyciskMenu }: {
  tytul: string; menuOtwarte: boolean; przelaczMenu: () => void; przyciskMenu: RefObject<HTMLButtonElement | null>;
}) {
  return <header className="gorny-pasek">
    <PrzyciskAkcji ref={przyciskMenu} className="przycisk-menu" wariant="drugorzedny" aria-label={menuOtwarte ? 'Zamknij menu' : 'Otwórz menu'} aria-expanded={menuOtwarte} aria-controls="nawigacja-glowna" onClick={przelaczMenu}>{menuOtwarte ? <IkonaZamkniecia size={20} aria-hidden="true" /> : <IkonaMenu size={20} aria-hidden="true" />}<span>Menu</span></PrzyciskAkcji>
    <div className="sciezka-ekranu"><span>Przestrzeń robocza</span><span aria-hidden="true">/</span><strong>{tytul}</strong></div>
    <EtykietaStatusu ton="sukces">Dane lokalne</EtykietaStatusu>
  </header>;
}

export function PowlokaAplikacji({ children }: { children: ReactNode }) {
  const [zwiniety, ustawZwiniety] = useState(false);
  const [menuOtwarte, ustawMenuOtwarte] = useState(false);
  const przyciskMenu = useRef<HTMLButtonElement>(null);
  const lokalizacja = useLocation();
  const projektId = lokalizacja.pathname.match(/^\/projekty\/([^/]+)/)?.[1];
  const tytul = projektId ? (lokalizacja.pathname.endsWith('/ustalenia') ? 'Ustalenia' : lokalizacja.pathname.endsWith('/korekty') ? 'Korekty' : lokalizacja.pathname.endsWith('/repozytoria') ? 'Repozytoria i kontekst' : 'Projekt')
    : pozycjeNawigacji.find((pozycja) => pozycja.adres === lokalizacja.pathname)?.etykieta ?? 'Nieznana strona';

  function zamknijMenu() {
    ustawMenuOtwarte(false);
  }

  return <div className={`powloka glassplate-2 ${zwiniety ? 'sidebar-zwiniety' : ''} ${menuOtwarte ? 'menu-otwarte' : ''}`} onKeyDown={(zdarzenie) => {
    if (zdarzenie.key === 'Escape' && menuOtwarte) { zamknijMenu(); przyciskMenu.current?.focus(); }
  }}>
    <a className="pomin-nawigacje" href="#tresc">Przejdź do treści</a>
    <GornyPasek tytul={tytul} menuOtwarte={menuOtwarte} przelaczMenu={() => ustawMenuOtwarte(!menuOtwarte)} przyciskMenu={przyciskMenu} />
    <PasekBoczny zwiniety={zwiniety} przelacz={() => ustawZwiniety(!zwiniety)} zamknijMenu={() => {
      zamknijMenu();
      if (menuOtwarte) document.getElementById('tresc')?.focus();
    }} projektId={projektId} />
    <div className="kolumna-robocza">
      <main id="tresc" tabIndex={-1}>{children}</main>
      <footer className="stopka-aplikacji">Dane są przechowywane w tej przeglądarce. Usunięcie danych witryny usuwa także zapisane projekty, wpisy i historię. Możesz wykonać kopię zapasową na ekranie „Dane i kopie zapasowe”. Odczyt publicznego GitHub jest dostępny w repozytoriach projektu.</footer>
    </div>
  </div>;
}
