# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A React library (`@42.nl/final-form-field-validation`) that wraps `react-final-form`'s `Field` component to add combined sync + async validation with debouncing. The entire library is a single component in `src/Field.tsx` exported through `src/index.ts`.

## Commands

- **Run all checks:** `npm test` (lint + typecheck + tests with coverage)
- **Run tests only:** `npm run test:coverage`
- **Watch mode:** `npm start` (vitest --coverage, watch is default)
- **Lint:** `npm run lint`
- **Typecheck:** `npm run test:ts`
- **Build:** `npm run tsc` (outputs to `lib/`)
- **Release:** `npm run release` (build + np)

## Architecture

The library exports one component: `Field<FieldValue, T>` which extends `react-final-form`'s `FieldProps` with three additional props:
- `validators` — sync validators run first
- `asyncValidators` — only run when all sync validators pass
- `asyncValidatorsDebounce` — debounce delay (default 200ms), cancels previous pending async validation via a ref-based promise resolver pattern

## Testing

- Tests live in `tests/` (not co-located with source)
- Uses Vitest with jsdom, React Testing Library
- **100% coverage thresholds** on branches, functions, lines, and statements — all new code must be fully covered
- `tests/setupTests.ts` runs `clearAllMocks`/`resetAllMocks` before each test
- Async validation tests use `vi.useFakeTimers()` and manual timer advancement

## Code Style

- ESLint flat config with typescript-eslint, react, vitest, and prettier plugins
- Prettier runs on commit via husky + lint-staged
- Zero ESLint warnings allowed (`--max-warnings=0`)
