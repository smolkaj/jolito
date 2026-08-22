# ADR 0002: Application stack

- Status: Accepted
- Date: 2026-08-21

## Context

Ritmo is an offline-first language-learning product expected to be developed
primarily by AI agents. A small, familiar stack reduces ambiguous patterns and
lets contracts and tests be shared across clients and services.

## Decision

- Use strict TypeScript for web, domain, application, API, tooling, and tests.
- Use React with Vite for the offline web SPA; do not adopt an SSR metaframework
  without a user-facing requirement.
- Use Node.js 24 LTS for JavaScript tooling and future privileged services.
- Use PostgreSQL and SQL migrations as the canonical server data model.
- Prefer Supabase for managed Postgres, Auth, RLS, and media storage, subject to
  a focused implementation ADR when credentials and environments are created.
- Use Zod runtime schemas at storage, network, sync, and AI boundaries.
- Use Expo/React Native for future native clients while sharing non-UI packages.
- Introduce npm workspaces and Fastify only when the API is created.

## Consequences

The repository avoids a second application language and unnecessary SSR,
GraphQL, ORM, monorepo, and microservice machinery. Vendor integrations remain
replaceable behind application ports. SQL and browser-platform behavior require
dedicated tests rather than relying on TypeScript alone.
