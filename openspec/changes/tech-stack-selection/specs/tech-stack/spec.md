## Purpose

Defines the mandatory technology stack constraints for the MVP phase so that every subsequent change is validated against a single, agreed source of truth.

## ADDED Requirements

### Requirement: Frontend stack is Next.js 14
The system SHALL use Next.js 14 (App Router) with React 19 and TypeScript 5 as the frontend framework. Vue 3 / Nuxt 3 SHALL NOT be used.

#### Scenario: Frontend scaffold conforms to stack
- **WHEN** a new frontend module or page is created
- **THEN** it is implemented as a Next.js 14 App Router route under `frontend/app/` using TypeScript, not a Vue/Nuxt component

### Requirement: Backend stack is NestJS
The system SHALL use NestJS with TypeScript as the backend framework. Spring Boot 3 SHALL NOT be used for the MVP.

#### Scenario: Backend scaffold conforms to stack
- **WHEN** a new backend module or API is created
- **THEN** it is implemented as a NestJS module (decorators, `@Module`, controllers, services) under `backend/src/`, not a Spring Boot controller

### Requirement: Full-stack TypeScript with shared types
The system SHALL share data contracts via a `packages/types` package imported by both frontend and backend, ensuring DTO type parity.

#### Scenario: Shared DTO change propagates to both sides
- **WHEN** a DTO field is added or renamed in `packages/types`
- **THEN** both frontend and backend type-check fail until updated, preventing drift

### Requirement: Frontend deploys to Vercel
The frontend SHALL be deployable to Vercel with zero additional configuration (native Next.js support).

#### Scenario: Vercel deploy succeeds
- **WHEN** the frontend is pushed to a connected Vercel project
- **THEN** it builds and serves without custom build scripts beyond defaults

### Requirement: Backend deploys as lightweight Docker image
The backend SHALL be packaged as a Docker image based on `node:20-alpine` for self-hosted deployment as a fallback to Vercel-only setups.

#### Scenario: Backend Docker image builds and runs
- **WHEN** `docker build` is run against the backend Dockerfile
- **THEN** a runnable image is produced that starts the NestJS service on the configured port

### Requirement: MVP database is SQLite, production is PostgreSQL
The backend SHALL use SQLite via TypeORM for the MVP and SHALL support switching to PostgreSQL by changing only the datasource configuration, with no business-logic changes.

#### Scenario: Switch datasource without code change
- **WHEN** the TypeORM datasource config is changed from SQLite to PostgreSQL
- **THEN** existing entities and services compile and run unchanged

### Requirement: Runtime requires Node 20.19+
The project SHALL require Node.js 20.19.0 or higher, matching the OpenSpec CLI and Next.js 14 toolchain baseline.

#### Scenario: Node version enforced
- **WHEN** a developer attempts to run tooling on Node < 20.19
- **THEN** the CLI/setup step warns or fails with a clear version message
