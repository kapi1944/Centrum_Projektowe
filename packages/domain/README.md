# Domena

Pierwszy fundament domeny 2.0: kontrakt `JednostkaPracy` oraz typy `RekordZrodlowy`, `PrzebiegAnalizy`, `PropozycjaZmiany`, `ZestawZmian` i `KopertaZdarzeniaDomenowego`. Pakiet zawiera wyłącznie deklaracje, bez Reacta, IndexedDB i runtime. Nie zastępuje istniejących rekordów.

Sześć portów korzystających z modeli v1 pozostaje w `apps/web/src/domain/porty.ts`, a dwa przypadki użycia w `apps/web/src/application`. Adapter v1 ↔ v2 jest w `apps/web/src/infrastructure/zgodnoscV1V2.ts`. Kolejne konteksty będą przenoszone osobno. [Zakres i ograniczenia fundamentu](../../docs/v2/DOMAIN_FOUNDATION.md).
