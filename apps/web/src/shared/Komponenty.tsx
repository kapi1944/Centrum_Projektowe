import type { ComponentPropsWithRef, HTMLAttributes, ReactNode } from 'react';

type WlasciwosciPowierzchni = HTMLAttributes<HTMLElement>;
type TonStatusu = 'neutralny' | 'akcent' | 'sukces' | 'ostrzezenie' | 'blad';

export function Panel({ className = '', ...wlasciwosci }: WlasciwosciPowierzchni) {
  return <section className={`panel ${className}`} {...wlasciwosci} />;
}

export function Karta({ className = '', ...wlasciwosci }: WlasciwosciPowierzchni) {
  return <article className={`karta ${className}`} {...wlasciwosci} />;
}

export function EtykietaStatusu({ children, ton = 'neutralny' }: { children: ReactNode; ton?: TonStatusu }) {
  return <span className={`etykieta-statusu status-${ton}`}><span aria-hidden="true" className="kropka-statusu" />{children}</span>;
}

export function KafelekMetryki({ etykieta, wartosc, opis }: { etykieta: string; wartosc: number; opis: string }) {
  return <Karta className="kafelek-metryki"><span>{etykieta}</span><strong>{wartosc}</strong><small>{opis}</small></Karta>;
}

export function PustyStan({ children }: { children: ReactNode }) {
  return <div className="pusty-stan"><span className="znak-pustego-stanu" aria-hidden="true">—</span><p>{children}</p></div>;
}

export function NaglowekSekcji({ tytul, opis, poziom = 2, id, children }: {
  tytul: string; opis?: string; poziom?: 1 | 2; id?: string; children?: ReactNode;
}) {
  const Naglowek = poziom === 1 ? 'h1' : 'h2';
  return <div className="naglowek-sekcji"><div><Naglowek id={id}>{tytul}</Naglowek>{opis && <p>{opis}</p>}</div>{children}</div>;
}

export function PrzyciskAkcji({ className = '', wariant = 'glowny', type = 'button', ...wlasciwosci }: ComponentPropsWithRef<'button'> & {
  wariant?: 'glowny' | 'drugorzedny' | 'niebezpieczny';
}) {
  return <button type={type} className={`przycisk-akcji przycisk-${wariant} ${className}`} {...wlasciwosci} />;
}
