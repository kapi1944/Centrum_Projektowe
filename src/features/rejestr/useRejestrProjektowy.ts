import { useEffect, useState } from 'react';
import type { Projekt, Wpis } from '../../domain/modele';
import { utworzProjekt, utworzWpis } from '../../domain/operacje';
import type { RepozytoriumProjektowe } from '../../domain/repozytorium';

export function useRejestrProjektowy(repozytorium: RepozytoriumProjektowe) {
  const [projekty, ustawProjekty] = useState<Projekt[]>([]);
  const [wpisy, ustawWpisy] = useState<Wpis[]>([]);
  const [stan, ustawStan] = useState<'ladowanie' | 'gotowy' | 'blad'>('ladowanie');
  const [blad, ustawBlad] = useState('');

  useEffect(() => {
    let aktywny = true;
    Promise.all([repozytorium.pobierzProjekty(), repozytorium.pobierzWpisy()])
      .then(([odczytaneProjekty, odczytaneWpisy]) => {
        if (!aktywny) return;
        ustawProjekty(odczytaneProjekty);
        ustawWpisy(odczytaneWpisy);
        ustawStan('gotowy');
      })
      .catch(() => {
        if (!aktywny) return;
        ustawBlad('Nie udało się odczytać danych lokalnych. Odśwież stronę, aby spróbować ponownie.');
        ustawStan('blad');
      });
    return () => { aktywny = false; };
  }, [repozytorium]);

  async function dodajProjekt(nazwa: string) {
    const projekt = utworzProjekt(nazwa, crypto.randomUUID(), new Date().toISOString());
    await repozytorium.dodajProjekt(projekt);
    ustawProjekty((poprzednie) => [...poprzednie, projekt]);
  }

  async function dodajWpis(tresc: string, projektId: string | null) {
    const wpis = utworzWpis(tresc, projektId, crypto.randomUUID(), new Date().toISOString());
    await repozytorium.dodajWpis(wpis);
    ustawWpisy((poprzednie) => [...poprzednie, wpis]);
  }

  return { projekty, wpisy, stan, blad, dodajProjekt, dodajWpis };
}
