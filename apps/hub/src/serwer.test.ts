import { once as poczekajNaZdarzenie } from 'node:events';
import { strict as sprawdz } from 'node:assert';
import { test as testuj } from 'node:test';
import type { StanHuba } from '@centrum-projektowe/contracts';
import { utworzSerwer } from './serwer.ts';

testuj('GET /health zwraca status, wersję i aktualny czas; pozostałe żądania nie mają endpointu', async () => {
  const serwer = utworzSerwer('0.0.0');
  serwer.listen(0, '127.0.0.1');
  await poczekajNaZdarzenie(serwer, 'listening');
  try {
    const adres = serwer.address();
    sprawdz.ok(adres && typeof adres !== 'string');
    const poczatek = Date.now();
    const odpowiedz = await fetch(`http://127.0.0.1:${adres.port}/health`);
    sprawdz.equal(odpowiedz.status, 200);
    sprawdz.match(odpowiedz.headers.get('content-type') ?? '', /application\/json/);
    const stan = await odpowiedz.json() as StanHuba;
    sprawdz.deepEqual(Object.keys(stan).sort(), ['status', 'timestamp', 'version']);
    sprawdz.equal(stan.status, 'ok');
    sprawdz.equal(stan.version, '0.0.0');
    sprawdz.ok(Date.parse(stan.timestamp) >= poczatek && Date.parse(stan.timestamp) <= Date.now());
    sprawdz.equal((await fetch(`http://127.0.0.1:${adres.port}/`)).status, 404);
    sprawdz.equal((await fetch(`http://127.0.0.1:${adres.port}/health`, { method: 'POST' })).status, 404);
  } finally {
    await new Promise<void>((rozwiaz, odrzuc) => serwer.close((blad) => blad ? odrzuc(blad) : rozwiaz()));
  }
});
