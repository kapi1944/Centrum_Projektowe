@AGENTS.md

# Claude Code — dodatki

Zasady wspólne dla wszystkich narzędzi są w AGENTS.md (import powyżej); nie powielaj ich tutaj. Poniżej tylko to, co dotyczy Claude Code.

- Agenci: `.claude/agents/` (`repo-auditor`, `implementation-planner`, `focused-implementer`, `qa-regression`, `security-privacy-reviewer`). Umiejętności: `.claude/skills/`. Architektura, uprawnienia i ewaluacje: [docs/agents/ARCHITEKTURA_AGENTOW.md](docs/agents/ARCHITEKTURA_AGENTOW.md).
- Procedury kontroli i format raportu mają jedno źródło: [PROCEDURY](docs/automatyzacja/PROCEDURY.md). Umiejętności `realizuj-etap`, `diagnostyka-bledow`, `testy-regresyjne`, `raport-etapu` mają jedno źródło w `.agents/skills/`; wersje w `.claude/skills/` tylko do nich odsyłają i dodają trasowanie do subagentów.
- Zasada oszczędności: jeden audyt na etap (`/audyt-repo`), potem wąskie zadania. Nie wywołuj pełnego audytu po drobnej zmianie ani kilku subagentów naraz bez potrzeby.
- Plan lub skill nie jest zgodą: `commit`, `push`, `merge`, zmiana zależności i `gh` z zapisem wymagają zgody na konkretną operację (strażnik `.claude/hooks/straznik-polecen.mjs` wymusza pytanie).
- Punkt wznowienia między sesjami: [docs/agents/PUNKT_WZNOWIENIA.md](docs/agents/PUNKT_WZNOWIENIA.md) (aktualizuje skill `/pakiet-kontekstu`).
