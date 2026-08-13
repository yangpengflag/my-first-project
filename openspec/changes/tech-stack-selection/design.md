## Context

Current `openspec/project.md` and `openspec/specs/springboot-skeleton.md` lock the stack to Java 17 + Spring Boot 3 + Vue 3. The team (3 React-familiar engineers, Vue only 2.x) must ship an MVP in 8 weeks, deploy to Vercel or self-hosted Docker, and lean on AI-generated code. The selected stack — Next.js 14 + NestJS, all TypeScript — maximizes AI output quality, minimizes learning cost, and keeps deployment light. See proposal.md - Why for motivation.

## Goals / Non-Goals

**Goals:**
- Freeze a single mandatory stack contract (`tech-stack` capability) for all future changes.
- Keep full-stack TypeScript with shared DTOs to eliminate frontend/backend type drift.
- Make Vercel (frontend) + lightweight Docker (backend) the default deploy path.
- Allow MVP SQLite → production PostgreSQL switch with zero business-code change.

**Non-Goals:**
- No business feature implementation (deferred to later changes).
- No CI/CD pipeline, monitoring, or auth scaffolding in this change.
- No rewrite of existing Spring/Vue submodule code into the new stack within this change (rebuild happens in separate scaffold change).

## Decisions

1. **Next.js 14 over Nuxt 3** — Team is React-native; Vue 2.x experience gives ~0 transfer to Nuxt 3 (Vue 3 Composition API + Nitro). Next 14 has the largest AI training corpus and first-class Vercel support. Alternative considered: Nuxt 3 — rejected on learning cost and weaker AI tooling.
2. **NestJS over Spring Boot 3** — Same TypeScript as frontend; decorator-based modules mirror Spring's structure so the team reads Spring docs intuitively. AI产出一致性强 (decorators + modules). Docker image ~10x lighter than JVM. Alternative considered: Spring Boot 3 — rejected on 8-week Java/JPA learning risk for a frontend team.
3. **Shared `packages/types`** — Single source of DTO truth; frontend and backend import the same compiled types. Enables `@nestjs/swagger` + `openapi-typescript` to keep contracts field-level aligned.
4. **SQLite → PostgreSQL via config only** — TypeORM abstraction; MVP avoids DB ops overhead, production switch touches only datasource.
5. **Deploy split** — Frontend Vercel zero-config; backend `node:20-alpine` Docker for self-host fallback.

## Risks / Trade-offs

- [Risk] NestJS ecosystem smaller than Spring for enterprise patterns → Mitigation: sufficient for MVP scope; revisit if complex domain logic emerges.
- [Risk] SQLite → PostgreSQL type discrepancies (e.g., JSON columns) → Mitigation: use portable column types in entities; validate on first PG switch.
- [Risk] Existing `springboot-skeleton` spec becomes stale → Mitigation: mark it deprecated in this change; remove after archive (see Migration Plan).
- [Risk] Vercel-only backend not supported → Mitigation: backend designed Docker-first, Vercel optional via separate serverless adapter later.

## Migration Plan

1. Approve this change (proposal + design + tasks signed).
2. Update `openspec/project.md` vision/scope/constraints to Next.js 14 + NestJS.
3. Rebuild `backend/` (NestJS) and `frontend/` (Next 14) scaffolds in a follow-up scaffold change.
4. On archive: move `springboot-skeleton.md` to deprecated state; `tech-stack` becomes the active spec.
5. Rollback: if stack rejected, simply do not apply; `project.md` and `springboot-skeleton.md` remain authoritative.

## Open Questions

- None blocking. Business domain (users/orders/content) deferred to the first feature change after scaffold.
