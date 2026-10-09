import { createServer as utworzSerwerHttp } from 'node:http';
import type { StanHuba } from '@centrum-projektowe/contracts';

export function utworzSerwer(wersja: string) {
  return utworzSerwerHttp((zadanie, odpowiedz) => {
    if (zadanie.method === 'GET' && zadanie.url === '/health') {
      const stan: StanHuba = { status: 'ok', version: wersja, timestamp: new Date().toISOString() };
      odpowiedz.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      odpowiedz.end(JSON.stringify(stan));
      return;
    }
    odpowiedz.writeHead(404);
    odpowiedz.end();
  });
}
