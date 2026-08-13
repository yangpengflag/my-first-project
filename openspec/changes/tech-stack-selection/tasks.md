## 1. Finalize Stack Contract

- [ ] 1.1 Confirm `proposal.md`, `design.md`, `specs/tech-stack/spec.md` reflect the agreed stack (Next.js 14 + NestJS, all TypeScript)
- [ ] 1.2 Human sign-off on the three artifacts (proposal + design + tasks) before any implementation

## 2. Update Project Spec

- [ ] 2.1 Rewrite `openspec/project.md` vision to "Next.js 14 + NestJS full-stack TypeScript MVP framework"
- [ ] 2.2 Update scope: backend = NestJS + TypeORM (SQLite→PostgreSQL); frontend = Next.js 14 App Router + TypeScript
- [ ] 2.3 Update constraints: Node 20.19+, Vercel (frontend) + Docker node:20-alpine (backend), shared `packages/types`

## 3. Spec Lifecycle

- [ ] 3.1 Promote `specs/tech-stack/spec.md` to active spec under `openspec/specs/tech-stack/spec.md`
- [ ] 3.2 Mark `openspec/specs/springboot-skeleton.md` as deprecated (add deprecation header; remove on archive)

## 4. Validation

- [ ] 4.1 Run `openspec validate` and confirm the change passes with zero deltas unresolved
- [ ] 4.2 Confirm `openspec status --change tech-stack-selection` reports `tasks` done and change apply-ready

## 5. Handoff

- [ ] 5.1 Record follow-up change name `scaffold-next-nest` for actual backend/frontend rebuild (out of scope here)
- [ ] 5.2 Archive this change per `/opsx:archive` once signed and applied
