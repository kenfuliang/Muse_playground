# AGENTS.md — rules for every agent session on this repo

Read `docs/design-spec.md` before touching any UI. Read `docs/architecture-blueprint.md`
before touching architecture. These docs are frozen; changing them needs Ken's approval.

## Working rules
1. Small diffs. Never rewrite a whole file to change part of it.
2. No new colors, fonts, or UI libraries. The tokens in `packages/ui/src/tokens.css` are the entire visual system.
3. Worker UI: max 3 screens (login → my jobs → job actions). No dashboards, charts, side menus, or dropdowns on the worker side. Violations get reverted.
4. All domain logic lives in `packages/shared` (zod schemas, state machines, barcode formats, i18n). API and web import from there — never duplicate the definition.
5. Module boundaries: code in `apps/api/src/modules/*` (today: `mes/`) may not import from a sibling module. Cross-module communication goes through domain events (to be added in phase 2).
6. Every PR: `npm run typecheck`, `npm run test`, `npm run build` must pass. UI changes include a screenshot or a precise description of what changed on screen.
7. Vietnamese (vi) and Traditional Chinese (zh-Hant) ship together. A worker-facing string with only one translation does not ship.
8. Seed data must keep the demo runnable: `npm run db:seed -w packages/db` after migrate.
9. Ask Ken before: changing the DB schema in a way that loses data, adding a dependency, touching CI/deploy config, or widening v1 scope (QC/shipping/customer/finance are phase 2+).
