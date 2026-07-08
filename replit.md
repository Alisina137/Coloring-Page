# AI Coloring Book Generator

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

This project is an AI-powered coloring book generator: kids/parents pick a theme, age group, and art style, and the app generates a black-and-white coloring page (plus a full-color hint illustration) along with daily challenges, stories, profiles, and stats.

## Artifacts

- `artifacts/coloring-book` (web, preview `/`) — React/Vite frontend.
- `artifacts/api-server` (api, preview `/api`) — Express API server; generates images via OpenAI DALL-E / Hugging Face (falls back if the primary provider fails or has no key), and prompts via Gemini when its key is set.
- `artifacts/mockup-sandbox` (design, preview `/__mockup`) — Canvas component preview server.

## Running

All three artifacts run as workflows (`pnpm --filter <pkg> run dev`). The API server builds with esbuild then runs the bundle; the frontend runs Vite directly.

## Environment

- `DATABASE_URL` — Replit-managed Postgres, already provisioned. Schema lives in `lib/db/src/schema`; push changes with `pnpm --filter @workspace/db run push`.
- `HF_API_TOKEN` (or `HUGGINGFACE_API_KEY`) — Hugging Face token used for image generation. Must have the "Make calls to Inference Providers" permission enabled on huggingface.co, or generation requests fail with a permissions error. Currently configured via `HUGGINGFACE_API_KEY`.
- `OPENAI_API_KEY` / `GEMINI_API_KEY` — optional; if set, used ahead of/alongside Hugging Face (OpenAI DALL-E tried first for the main image if present; Gemini improves prompt quality). Not currently set.

## Status

Set up and verified working on 2026-07-08: all three artifacts (`coloring-book`, `api-server`, `mockup-sandbox`) run as workflows, the Postgres schema is pushed, and end-to-end coloring page generation (via Hugging Face) was confirmed working.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
