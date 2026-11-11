---
title: Redesign validation
aliases:
  - Redesign acceptance matrix
tags:
  - osaca
  - design
  - accessibility
---

# Redesign validation

Rendered-surface acceptance pass for the OSACA visual identity redesign (issue #45, spec `.scratch/osaca-visual-identity-redesign/spec.md`). It covers the app, the Operator admin panel, the documentation and the landing page.

## How each surface was checked

| Surface | Rendered from | Browser checks |
| --- | --- | --- |
| Landing | `osaca_landing` static build, served locally | Chrome DevTools: Lighthouse (mobile), an in-page audit and keyboard walk |
| Docs | `osaca_docs` static build (`dist/client`), served locally | In-page audit on the security model, authentication, 404 and mobile menu |
| Admin | `cargo run -p osaca_admin --example render_acceptance_pages`, with the compiled Tailwind CSS and fonts | In-page audit on ten pages in six viewport and theme combinations, keyboard walk |
| App | `rspack serve --mode development` with the wasm modules built, behind a local proxy that serves a self-hosted discovery document and answers every API call with 503 | In-page audit on the boot failure, sign-in, registration and 404 screens, the sign-in error state and a keyboard walk; vitest render tests for the other states |

The in-page audit computes WCAG contrast for every visible text node against its resolved background, lists targets under 24×24 px (WCAG 2.2 2.5.8, inline links in text exempt), form fields without a label or ARIA name, controls without a visible focus style, horizontal overflow, and any visible "Fluxer" text.

Viewports: desktop 1440×900, tablet 820×1180, mobile 390×844. Themes: the system preference (light and dark) and, where a surface has one, its own theme picker. Reduced motion was emulated in the browser on the landing page; for the other surfaces it is checked in their stylesheets.

`tools/branding/RenderedSurfaces.test.mjs` (run it after building both sites) repeats the static part of this audit on every built landing and docs page: language, viewport and title, visible Fluxer names, link, button and image names, spacing around inline links, focus style and reduced motion.

## Acceptance matrix

✅ passes · not run: the screen could not be reached again once the wasm modules were built · 🔧 failed and fixed in this pass · ⚠️ limitation, see below · — not applicable

A 🔧 marks the combination where the failure was found; each fix applies to every combination of that surface, and the audit passed in all of them afterwards.

### Themes and viewports

| Surface | Light desktop | Light tablet | Light mobile | Dark desktop | Dark tablet | Dark mobile |
| --- | --- | --- | --- | --- | --- | --- |
| Landing | ✅ | ✅ | ✅ | ✅ | ✅ | 🔧 footer spacing |
| Docs | ✅ | ✅ | ✅ | ✅ | ✅ | 🔧 header logo |
| Admin | 🔧 contrast | ✅ | 🔧 sidebar focus | ✅ | ✅ | ✅ |
| App (sign-in, registration, 404) | ⚠️ shown dark | ⚠️ shown dark | ⚠️ shown dark | ✅ | ✅ | ✅ |
| App (boot failure) | not run | not run | ⚠️ shown dark | 🔧 contrast, logo | not run | not run |

### States

| Surface | Empty | Loading | Error | Success |
| --- | --- | --- | --- | --- |
| Landing | — | — | — | ✅ page |
| Docs | — | — | ✅ 404 | ✅ content pages |
| Admin | ✅ users, none found | ⚠️ drawer loading text only | ✅ page error, form error, not found | ✅ flash message, users list |
| App | ✅ `EmptyStateView` (vitest) | ✅ `AppSkeleton` in the browser and vitest | 🔧 boot failure; ✅ sign-in field error, 404, crash screen (vitest) | ⚠️ needs an API |

### Accessibility bar

| Check | Landing | Docs | Admin | App |
| --- | --- | --- | --- | --- |
| Text contrast ≥ 4.5:1 (3:1 large) | ✅ | ✅ | 🔧 | 🔧 |
| Visible focus on every control | ✅ | ✅ | ✅ | ✅ |
| Keyboard order and skip link | ✅ | ✅ | 🔧 | ✅ sign-in |
| Names for links, buttons, fields, images | ✅ | ✅ | 🔧 | ✅ |
| Targets ≥ 24×24 px or spaced | 🔧 | 🔧 | 🔧 | ✅ |
| Reduced motion honoured | ✅ browser | ✅ stylesheet | ✅ stylesheet | ✅ stylesheet (global rule) |
| No visible Fluxer relationship | ✅ | ✅ | ✅ | 🔧 |

## Fixed in this pass

- **App, every screen that shows the product icon** (boot failure, crash, 404, passkey bridge, system profiles): `OsacaIconMark` still drew the inherited Fluxer "≈" mark as an inline SVG path. It now renders the approved logo, `osaca_app/src/media/images/osaca-logo-color.svg`. `FluxerInventory.test.mjs` now rejects the old path anywhere in the repository.
- **App, boot failure and crash screens before a theme class is applied:** `:root` mixed the generated dark text tokens with white OSACA surfaces, so the text was near-white on white. The OSACA surface tokens at `:root` now match `.theme-dark`, as in the generated colour system.
- **App, primary buttons:** `--brand-primary` was `hsl(7, 80%, 55%)`, 3.76:1 under the white button text. It is now lightness 47, 4.65:1, still 3.41:1 against the dark canvas.
- **Admin, light theme:** Tailwind's `neutral-500` secondary text was 4.35:1 on the ivory page background; it is now `#606e7a` (4.80:1, 5.24:1 on white). Required-field asterisks moved from `red-500` (3.81:1) to `red-600`.
- **Admin, mobile:** the closed sidebar and closed drawers stayed in the tab order and the accessibility tree while off-screen. They are now hidden after their slide-out. The existing script still moves focus into the sidebar on open and back to the menu button on Escape, which the keyboard walk confirmed.
- **Admin, Users:** the search fields and the page-size select had only placeholders; they now have ARIA names.
- **Admin, Bulk Actions:** five forms reused the ids `user_ids` and `audit_log_reason`, so their labels pointed at the first form. Each field now has its own id.
- **Admin, not found state:** the back link is now a 24 px target.
- **Docs, mobile header:** the square OSACA logo was sized by width and overflowed the 64 px header onto the content. It is now sized by height.
- **Docs, heading anchor links:** now at least 24×24 px.
- **Landing, footer:** the build collapsed the space before the licence and NOTICE links ("under theGNU AGPL v3"). The standalone security model link is also now a 24 px target.

## Limitations

- **App flows that need a signed-in Account** — Community and Channel navigation, Private Conversations, settings, dialogs and permissions — were not exercised in a browser; the acceptance run had no API. Their styles are covered by the #40 source and render tests (`osaca_app/src/app/OsacaPrimaryApp.test.ts`, `OsacaPrimaryAppStates.test.tsx`). They need a run against a full local stack.
- **App, screens before sign-in** (boot failure, crash, sign-in, registration, 404) are dark whatever the system preference: the client's default theme is dark, and the light variant from #40 applies once an Account picks the light theme.
- **App, sign-in page** has no `main` landmark (seen in the accessibility tree; not fixed here).
- **App, boot failure screen, hosted-service leftovers:** when the client does not yet know it is self-hosted it shows "Check our Bluesky (@osaca.example)". The link comes from `osaca_app/src/features/app/components/BootstrapErrorScreen.tsx` and `ExternalUrls.BLUESKY`. Other `osaca.example` placeholders remain in `osaca_app/src/app/Routes.ts` (feedback), `features/app/config/I18nDisplayConstants.ts` (support email, downloads) and `features/app/config/HostedMedia.ts`. These are not branding but need a decision on what a self-hosted client shows.
- **App, the diagnostic line** on the boot failure screen names the internal module `@pkgs/libfluxcore` when the wasm build is missing. Only developers see it.
- **Admin, radios** in Bulk Actions and enforcement forms are 16×16 px. They pass 2.5.8 through the spacing exception (24 px between centres) and their labels are linked with `for`.
- **Admin, primary buttons** stay near-black rather than earth red, as in #41, so they read differently from crimson destructive actions.
- **Admin pages were rendered from fixed data**, not a running panel, so htmx requests, OAuth sign-in and permission-dependent navigation were not exercised in a browser. Navigation filtering by ACL is covered by the existing route code; the fixtures sign in with every ACL.
- **Docs default to the dark theme** until the reader picks one. This is the existing behaviour, and the theme select offers Auto.
- **Docs API reference** uses the wire names "Guild" and "guild channels" in its sidebar; `GLOSSARY.md` records these inherited identifiers.
