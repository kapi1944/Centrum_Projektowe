import { createRequire as utworzRequire } from 'node:module';
import { utworzSerwer } from './serwer.ts';

const zaladujModul = utworzRequire(import.meta.url);
const { version: wersja } = zaladujModul('../package.json') as { version: string };
const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Niepoprawny port Hubu.');
utworzSerwer(wersja).listen(port, '127.0.0.1', () => {
  console.info(`Hub: http://127.0.0.1:${port}/health`);
});
