# auto-ABNT Design System

## 1. Overview

auto-ABNT converts a `.docx` into the abnTeX2 LaTeX skeleton (ABNT norms) entirely in the browser — no backend, nothing uploaded, nothing stored. The product talks to one anxious audience: a student hours from a deadline who does not know LaTeX and does not trust web tools with their thesis. So the design has exactly two jobs — look trustworthy enough to paste a TCC into, and make a three-step flow (fill the cover → upload the doc → hand off to an AI for refinement) feel like one short, calm errand. It borrows the entire visual language of the adsCLI system — light-first, almost monochrome, structure drawn with hairline borders instead of shadows, primary action as a solid black pill — and reskins its one dark "inversion" moment from a terminal to the thing this product actually produces.

The system is light-first and almost monochrome. Backgrounds are white, text is near-black, the page is built from hairlines and whitespace. Against that calm, the page gets exactly one inversion moment: the **prompt panel** — a dark, monospace panel holding the generated LaTeX and the ABNT-refinement prompt, with the buttons that launch ChatGPT or Claude pre-loaded with it. That panel is the emotional payoff of the whole flow (doc in → formatted draft + one-click handoff out), so it is the only object on the page allowed to be dark, and it is the signature element of the system. The accent — a signal green — lives almost exclusively in and around that panel and in the success line of the status message: it means *ready / done / copied*, the moment the draft exists and the work flows onward. On the white page itself, the single primary action ("Gerar arquivo ABNT") is a solid black pill; green is never a button.

Restraint is deliberate. The system has two border radii, one accent hue, no shadows, and one display typeface — and monospace is a first-class citizen, because the artifact this tool emits is literally machine text (`.tex`) and the handoff is a prompt. A small vocabulary used relentlessly is what makes a single-page utility look like a product someone can trust with their thesis.

**Key Characteristics**

- Light-first monochrome page; the dark **prompt panel** is the single inversion moment.
- Signature element: `{component.prompt-panel}` — the dark mono panel that holds the LaTeX + refinement prompt and the AI-launch buttons.
- One accent — signal green — confined to the prompt panel and the success/ready state; never a CTA color.
- The sole primary action is a solid black pill (`{component.button-primary}`); the two AI-launch buttons are neutral secondary pills of equal weight.
- Flat depth model: hairline borders, zero box shadows.
- Exactly two border radii: full pills for everything interactive, 16px for every container.
- Rounded humanist display face over a system body stack; monospace is first-class (LaTeX source, the prompt).
- Single centered reading column at 768px — a focused form-and-handoff flow, not a landing or a dashboard.

## 2. Colors

### Brand & Accent

| Name | Token | Hex |
|---|---|---|
| Ink | `{colors.ink}` | `#0A0A0A` |
| Ink Hover | `{colors.ink-hover}` | `#262626` |
| Signal Green | `{colors.signal}` | `#16A34A` |
| Signal Bright | `{colors.signal-bright}` | `#4ADE80` |

Ink is the brand color: wordmark, primary button, headings. Signal Green is the accent on light surfaces (the success status line, the "Copiado! ✓" confirmation); Signal Bright is its luminance-corrected twin for use on the dark prompt panel only. Never place `{colors.signal}` on `{colors.panel}` or `{colors.signal-bright}` on `{colors.surface}` — each hue belongs to one background family.

### Surface

| Name | Token | Hex |
|---|---|---|
| Page | `{colors.surface}` | `#FFFFFF` |
| Raised | `{colors.surface-raised}` | `#F5F5F5` |
| Panel | `{colors.panel}` | `#0A0A0A` |
| Panel Raised | `{colors.panel-raised}` | `#171717` |

Two surface families. The light family carries the entire page; the dark panel family appears only inside `{component.prompt-panel}`. There is no app-wide dark mode — the dark surface is content (the LaTeX/prompt), not a theme.

### Text

| Name | Token | Hex |
|---|---|---|
| Primary | `{colors.text-primary}` | `#171717` |
| Secondary | `{colors.text-secondary}` | `#525252` |
| Tertiary | `{colors.text-tertiary}` | `#A3A3A3` |
| On Dark | `{colors.text-on-dark}` | `#FAFAFA` |
| On Dark Muted | `{colors.text-on-dark-muted}` | `#A3A3A3` |
| On Ink | `{colors.text-on-ink}` | `#FFFFFF` |

### Border

| Name | Token | Hex |
|---|---|---|
| Hairline | `{colors.border}` | `#E5E5E5` |
| Hairline Dark | `{colors.border-dark}` | `#262626` |

### Semantic

The product has real states — conversion succeeded, conversion failed (invalid/non-`.docx` file), and informational progress ("Convertendo… isso acontece no seu navegador") — so a real semantic palette exists, used only in `{component.status-message}` and form validation, never decoratively.

| Name | Token | Hex |
|---|---|---|
| Success | `{colors.success}` | `#16A34A` |
| Success Tint | `{colors.success-tint}` | `#F0FDF4` |
| Warning | `{colors.warning}` | `#D97706` |
| Warning Tint | `{colors.warning-tint}` | `#FFFBEB` |
| Error | `{colors.error}` | `#DC2626` |
| Error Tint | `{colors.error-tint}` | `#FEF2F2` |

Success deliberately reuses the signal hue: "ready" and "succeeded" are the same color in this product — the draft exists, the flow continues.

### Focus

| Name | Token | Value |
|---|---|---|
| Focus Ring | `{colors.focus}` | `2px solid #16A34A`, offset 2px |

One focus treatment for every interactive element, on both surface families.

## 3. Typography

### Font Family

| Face | Role | Weights | Stack |
|---|---|---|---|
| Display | Headings, page title, step numbers | 500, 600 | `"SF Pro Rounded", {body stack}` |
| Body | All running text, form labels, helper copy | 400, 500 | `ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"` |
| Mono | LaTeX source, the refinement prompt, filenames, `npx`/Overleaf commands | 400, 500 | `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace` |

**Note on Font Substitutes.** SF Pro Rounded is Apple-licensed and unavailable as a webfont. The open-source substitute is **Nunito Sans** (closest rounded-humanist match; self-host weights 400/500/600). If no webfont is wanted, the system degrades gracefully to the body stack — the rounded warmth is a nice-to-have, not load-bearing. Mono needs no substitute; the system stack is correct (this tool emits machine text — native monospace is authenticity, not a compromise). Mock files that use `Space Mono` or any stand-in mono must resolve to the Mono stack above, never introduce the mock's font.

### Hierarchy

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| `{typography.display}` | 44px | 600 | 1.1 | -0.02em | Page title ("auto-ABNT") |
| `{typography.h2}` | 28px | 600 | 1.2 | -0.01em | Result heading ("Quase lá — faltam 2 passos") |
| `{typography.h3}` | 20px | 600 | 1.3 | 0 | Fieldset legends ("1. Dados da capa e folha de rosto") |
| `{typography.body-lg}` | 18px | 400 | 1.6 | 0 | Page subline ("Suba seu .docx, preencha os dados…") |
| `{typography.body-md}` | 16px | 400 | 1.6 | 0 | Default running text, inputs, step body |
| `{typography.body-sm}` | 14px | 400 | 1.5 | 0 | Field labels, footer, helper text |
| `{typography.caption}` | 12px | 500 | 1.4 | 0.02em | Badges, status timestamps, uppercase micro-labels |
| `{typography.code}` | 14px | 400 | 1.6 | 0 | LaTeX lines and prompt text inside `{component.prompt-panel}` |

### Principles

Copy is plain and reassuring — the register of someone calmly explaining a process, never marketing ("Tudo acontece no seu navegador — nada é enviado ou guardado"). Monospace is reserved for things that are literally machine text: the generated `.tex`, the prompt the user pastes, filenames, and the Overleaf/`npx` commands. Uppercase exists only at `{typography.caption}` size; nothing larger ever shouts. Step numbers in the result list use the Display face to feel like a friendly checklist, not a stack trace.

## 4. Layout

### Spacing System

Base unit: **4px**.

| Token | Value |
|---|---|
| `{spacing.xs}` | 4px |
| `{spacing.sm}` | 8px |
| `{spacing.md}` | 16px |
| `{spacing.lg}` | 24px |
| `{spacing.xl}` | 32px |
| `{spacing.2xl}` | 48px |
| `{spacing.3xl}` | 64px |
| `{spacing.4xl}` | 96px |

`{spacing.4xl}` (96px) is the **landing section rhythm** token (slice #8): the vertical
gap between top-level landing sections (`{component.section}`). It is the only new spacing
token the landing introduces; everything else composes the existing scale. On `sm` it
compresses to `{spacing.2xl}` (see §9).

Dominant rhythm: the page is a single vertical flow — header → form → status → result. Major blocks (form card, result card) are separated by `{spacing.2xl}`. Inside a card, legend-to-fields gap is `{spacing.lg}`; field-to-field gap `{spacing.md}`. The footer sits `{spacing.3xl}` below the last block.

### Grid & Container

| Context | Max Width | Grid |
|---|---|---|
| Page column | 768px | Single centered column |
| Cover fields | 768px | 2-up form grid (`{spacing.md}` gutter), collapsing 2 → 1 below `sm` |
| Full-width fields | 768px | Resumo / Abstract textareas and the file drop span the full column |
| Landing content column | 1040px | Marketing sections (`{component.section}`) — wider than the tool column so hero/cards/pricing breathe; centered with `{spacing.lg}` side gutters |
| Tool section column | 768px | The housed tool (`{component.tool-section}`) keeps the original 768px reading column inside the wider landing — the form is never widened (§4 whitespace rule) |

The landing introduces a **second, wider container** (1040px) for marketing sections only.
The tool itself stays in its original 768px column — a thesis-anxious user never faces a
wider wall of fields (§4). Two container widths total; no per-section widths.

### Whitespace Philosophy

The page is air-dominant and deliberately short to read: a stressed student should see the whole job — fill, upload, generate, hand off — without feeling buried in chrome. There is no sidebar, no navbar of links, no dashboard density; this product does one thing per visit. The column is narrow (768px) on purpose — forms read better narrow, and a thesis-anxious user should never face a wide, intimidating wall of fields. The system flexes through spacing, never through new tokens.

## 5. Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| 0 — Flat | background only, no border | Page background, header |
| 1 — Outlined | 1px `{colors.border}` | Form card, result card, inputs, file drop, step items |
| 2 — Inverted | `{colors.panel}` background panel | `{component.prompt-panel}` — the one highlight moment on the page |

There are **no box shadows anywhere**. Depth is communicated by hairlines and by the single dark inversion. If a layered element ever needs to separate from the page, it uses Level 1 plus a `{colors.surface}` background — contrast against content, not shadow, does the lifting.

### Decorative Depth

No mascots, no 3D, no gradients, no atmospheric blobs. The only motion in the system is functional feedback: the "Copiado! ✓" state swap on the copy button, and the status message changing as conversion progresses. Decoration is the tool reporting what it just did.

## 6. Shapes

### Border Radius Scale

| Token | Value | Use |
|---|---|---|
| `{rounded.full}` | 9999px | Every interactive element: buttons, text inputs, badges |
| `{rounded.card}` | 16px | Every container: form card, result card, prompt panel, file drop, textarea, step items |

Two radii, period. If a new component cannot decide: can you click it as a unit? → `{rounded.full}`. Does it contain things? → `{rounded.card}`.

### Photography Geometry

The system uses no photography. The only "imagery" is the generated LaTeX rendered as text inside `{component.prompt-panel}`, always inside a `{rounded.card}` container.

## 7. Components

Hover policy: hover states exist and are documented per component as `-hover` entries; the universal pattern is a one-step surface shift (white → `{colors.surface-raised}`, ink → `{colors.ink-hover}`) with a 150ms ease background transition and no motion, scale, or shadow.

### Buttons

**`{component.button-primary}`** — the sole primary action: "Gerar arquivo ABNT"
- Background `{colors.ink}` · Text `{colors.text-on-ink}` `{typography.body-md}` weight 500 · Radius `{rounded.full}` · Height 44px · Padding 0 `{spacing.lg}` · Border none · Full-width inside the form card

**`{component.button-primary-hover}`** — background `{colors.ink-hover}`, all else unchanged.

**`{component.button-primary-disabled}`** — background `{colors.surface-raised}`, text `{colors.text-tertiary}`, cursor not-allowed (while converting).

**`{component.button-secondary}`** — neutral secondary pill (e.g. "Baixar .tex" in `{component.download-bar}`)
- Background `{colors.surface}` · Text `{colors.text-primary}` `{typography.body-md}` weight 500 · Border 1px `{colors.border}` · Radius `{rounded.full}` · Height 44px · Padding 0 `{spacing.lg}`

**`{component.button-secondary-hover}`** — background `{colors.surface-raised}`.

**`{component.button-ghost}`** — low-emphasis inline actions
- Background transparent · Text `{colors.text-secondary}` `{typography.body-sm}` weight 500 · Radius `{rounded.full}` · Height 36px · Padding 0 `{spacing.md}` · Hover: background `{colors.surface-raised}`, text `{colors.text-primary}`

### AI Handoff (the product's payoff)

**`{component.ai-launch-group}`** — the pair of buttons that open an AI with the refinement prompt pre-loaded
- Two equal-weight `{component.ai-launch-button}` side by side, gap `{spacing.md}`, stacking 1-up below `sm`. Neither AI is preferred, so neither outranks the other; both are secondary so they never compete with `{component.button-primary}`.

**`{component.ai-launch-button}`** — "Abrir no ChatGPT", "Abrir no Claude"
- Background `{colors.surface}` · Text `{colors.text-primary}` `{typography.body-md}` weight 500 · Border 1px `{colors.border}` · Radius `{rounded.full}` · Height 44px · Padding 0 `{spacing.lg}` · Leading provider glyph (monochrome, `{colors.text-secondary}`, 16px) · Opens the provider in a new tab with the prompt + `.tex` prefilled
- Hover: background `{colors.surface-raised}`.

**`{component.copy-button}`** — copy the prompt + `.tex` (lives on the dark prompt panel)
- As `{component.button-ghost}` but text `{colors.text-on-dark-muted}` · Hover text `{colors.text-on-dark}` · Confirmed state ("Copiado! ✓") text `{colors.signal-bright}` for 2s, then reverts

### Inputs & Forms

**`{component.text-input}`** — cover fields (título, autor, instituição, curso, orientador, cidade, ano, palavras-chave, keywords)
- Background `{colors.surface}` · Text `{colors.text-primary}` `{typography.body-md}` · Placeholder `{colors.text-tertiary}` · Border 1px `{colors.border}` · Radius `{rounded.full}` · Height 44px · Padding 0 `{spacing.md}`

**`{component.text-input-focused}`** — border 1px `{colors.ink}` plus `{colors.focus}` ring.

**`{component.text-input-error}`** — border 1px `{colors.error}`; helper line below in `{typography.body-sm}` `{colors.error}`.

**`{component.textarea}`** — multi-line fields (Resumo, Abstract)
- As `{component.text-input}` but radius `{rounded.card}`, padding `{spacing.md}`, min-height 96px.

**`{component.field-label}`** — `{typography.body-sm}` weight 500 `{colors.text-primary}`, margin-bottom `{spacing.sm}`.

**`{component.fieldset}`** — form section grouping ("1. Dados da capa e folha de rosto", "2. O corpo do trabalho")
- Background `{colors.surface}` · Border 1px `{colors.border}` · Radius `{rounded.card}` · Padding `{spacing.xl}` · Legend `{component.fieldset-legend}` · Fields laid out on the cover grid (§4).

**`{component.fieldset-legend}`** — `{typography.h3}` `{colors.text-primary}`, margin-bottom `{spacing.lg}`.

**`{component.file-drop}`** — the `.docx` upload (accept=".docx")
- Background `{colors.surface-raised}` · Border 1px dashed `{colors.border}` · Radius `{rounded.card}` · Padding `{spacing.xl}` · Label `{typography.body-md}` `{colors.text-secondary}`, filename once chosen in `{typography.code}` `{colors.text-primary}` · Min-height 96px, centered content

**`{component.file-drop-dragover}`** — border 1px solid `{colors.ink}`, background `{colors.surface}`.

**`{component.file-drop-filled}`** — border 1px solid `{colors.border}`; a `{component.badge}` showing the filename, plus a `{component.button-ghost}` "Trocar arquivo".

### Cards & Containers

**`{component.result-card}`** — the post-conversion handoff ("Quase lá — faltam 2 passos")
- Background `{colors.surface}` · Border 1px `{colors.border}` · Radius `{rounded.card}` · Padding `{spacing.xl}` · Heading `{typography.h2}` · Contains the `{component.step-item}` list, the `{component.prompt-panel}`, the `{component.ai-launch-group}`, and the `{component.button-secondary}` (Overleaf)

**`{component.step-item}`** — a numbered step in the result list ("Refinar no ChatGPT", "Compilar no Overleaf")
- Leading number badge: Display face `{typography.h3}` `{colors.text-primary}`, 28px circle `{colors.surface-raised}`, `{rounded.full}` · Body `{typography.body-md}` `{colors.text-secondary}` · Gap `{spacing.md}` between items

### Signature: Prompt Panel (the one inversion)

**`{component.prompt-panel}`** — the dark mono panel holding the generated LaTeX + the ABNT-refinement prompt
- Background `{colors.panel}` · Border 1px `{colors.border-dark}` · Radius `{rounded.card}` · Padding `{spacing.lg}` · Text `{typography.code}` `{colors.text-on-dark}`, pre-wrapped, max-height ~320px with internal scroll · Top-right slot holds `{component.copy-button}` · This is the only Level-2 surface on the page

**`{component.prompt-panel-ready}`** — when freshly populated after a successful conversion: a 2px top edge in `{colors.signal-bright}` signaling "draft ready".

**`{component.pdf-preview}`** — the compiled ABNT PDF rendered inline, occupying `{component.prompt-panel}` post-pivot (replaces the LaTeX/handoff payload; resolves §11 "in-page document preview" gap)
- Lives inside `{component.prompt-panel}` (the one Level-2 inversion): the dark panel becomes the *frame* for the rendered page. Panel keeps Background `{colors.panel}` · Border 1px `{colors.border-dark}` · Radius `{rounded.card}` · Padding `{spacing.md}`.
- Embed: native `<iframe>`/`<embed>` of a blob URL (a real PDF the backend returns). pdf.js only if native is impossible — no new dep by default.
- Embed element: width 100% · aspect-ratio of an A4 page (height ≥ 480px desktop, scroll inside) · Background `{colors.surface}` (the white page reads correctly against the dark frame) · Border none (the panel hairline frames it) · Radius `{rounded.card}` (inner clip matches the frame) · the embed itself is the only white rectangle allowed on a dark surface, justified because it *is* the document.
- Panel header row above the embed: left a `{component.badge}` "Pré-visualização" `{colors.text-on-dark-muted}`; the `{colors.signal-bright}` 2px top edge from `{component.prompt-panel-ready}` fires when the PDF first loads (= ready/done signal). Green stays a signal, never a control.
- Empty/pre-generate: panel shows `{typography.code}` `{colors.text-on-dark-muted}` placeholder line ("A pré-visualização do PDF aparece aqui depois de gerar."); no embed mounted.
- Responsive: keeps `{rounded.card}` and scrolls internally; never shrinks the PDF below legibility — scroll, don't scale (mirrors prompt-panel rule §9).

**`{component.download-bar}`** — the download affordance row, shown only in the `pago` state (server-verified payment), directly below `{component.pdf-preview}` inside `{component.result-card}`
- Layout: horizontal row, gap `{spacing.md}`, stacking 1-up below `sm` (both full-width), margin-top `{spacing.lg}`.
- Primary: `{component.button-primary}` "Baixar PDF" — the single primary action of the result area (black pill; green is never the CTA).
- Optional secondary: `{component.button-secondary}` "Baixar .tex" — equal height, neutral pill, for users who want the source. Omit if only PDF is offered.
- **Gated on payment** (slice #9): hidden until the job is server-verified `paid`. In the unpaid `pronto` state the area shows `{component.paywall}` instead; the download-bar replaces it only after the Stripe return confirms payment. Never shown during convertendo/formatando/compilando/erro, and never while unpaid.

### Paywall (slice #9 — pay-before-download)

The preview is fully visible before payment (value shown first); the actual file download is gated behind a one-off charge (per billing CONTEXT: capture on download intent, server-verified, never bill on failure). The paywall is a calm, non-pushy gate that sits where `{component.download-bar}` would otherwise be — directly below `{component.pdf-preview}` inside `{component.result-card}`. It is **not** a new inversion or accent moment: it composes existing light-surface tokens and the single black primary pill.

**`{component.paywall}`** — the pay-to-unlock block shown in the unpaid `pronto` state, in the slot `{component.download-bar}` will occupy once paid
- Container: Background `{colors.surface}` · Border 1px `{colors.border}` · Radius `{rounded.card}` · Padding `{spacing.xl}` · margin-top `{spacing.lg}` (same rhythm the download-bar used).
- Contents, top to bottom: a one-line value note `{typography.body-md}` `{colors.text-secondary}` ("Seu PDF está pronto. Libere o download por **{preço}**."), then `{component.pay-button}` full-width, then a `{typography.body-sm}` `{colors.text-tertiary}` reassurance line ("Pagamento único, sem assinatura. Pagamento seguro via Stripe.").
- **Price is data, not copy**: `{preço}` is interpolated from a backend/env-provided value (BRL, formatted server- or client-side from centavos). The doc and UI never hardcode "R$ 9,90" as the source of truth — it is shown but sourced from config.
- Hidden until state = `pronto` AND not yet paid. Replaced by `{component.download-bar}` once payment is server-verified. Hidden during convertendo/formatando/compilando/erro.

**`{component.pay-button}`** — the checkout CTA that starts the Stripe hosted flow
- Reuses `{component.button-primary}` exactly (Background `{colors.ink}` · Text `{colors.text-on-ink}` `{typography.body-md}` weight 500 · Radius `{rounded.full}` · Height 44px · Padding 0 `{spacing.lg}` · full-width). The single black pill discipline holds: this is the one primary action of the unpaid result area, so it earns the black pill (the download CTA only appears *after* pay, so the two never coexist).
- Label: "Pagar {preço} e baixar" — price interpolated from config (see `{component.paywall}`). Green is never used here; it is a CTA, not a ready signal.
- States: `{component.pay-button-hover}` = `{component.button-primary-hover}` (`{colors.ink-hover}`). `{component.pay-button-loading}` = `{component.button-primary-disabled}` (`{colors.surface-raised}` / `{colors.text-tertiary}`, cursor not-allowed) while the POST /checkout request is in flight and the browser is redirecting to Stripe; label may switch to "Redirecionando…".
- Click → POST /checkout → browser redirects to the returned hosted `checkoutUrl`. No card fields live on this page (hosted Checkout); no Stripe SDK or styling lives in the design surface.
- Focus: `{colors.focus}` ring like every interactive element.

**`{component.paywall-canceled-note}`** — the calm note shown when the user returns from Stripe via the cancel_url (`?canceled=1`)
- Rendered as a `{component.status-message}` `-info` line (NOT `-erro`: a cancel is not a failure) directly above the re-shown `{component.paywall}`: `{typography.body-sm}` weight 500 `{colors.text-secondary}` on `{colors.surface-raised}`, radius `{rounded.full}`, padding `{spacing.xs}` `{spacing.md}` — "Pagamento cancelado. Você pode tentar de novo quando quiser." No error color, no alarm; the paywall simply returns.

### Inline & Status

**`{component.status-message}`** — conversion progress / outcome (the `#status` line)
- `{typography.body-sm}` weight 500 · Radius `{rounded.full}` · Padding `{spacing.xs}` `{spacing.md}` · Variants: `-info` text `{colors.text-secondary}` on `{colors.surface-raised}` ("Convertendo…"); `-ok` text `{colors.success}` on `{colors.success-tint}` ("Pronto! Baixamos o arquivo .tex."); `-erro` text `{colors.error}` on `{colors.error-tint}` ("Selecione um arquivo .docx primeiro.")
- **Post-pivot state flow** (server compile, no Overleaf). Five states map to the existing variants — no new tokens:
  - `convertendo` → `-info` · "Convertendo o .docx no seu navegador…"
  - `formatando` → `-info` · "Formatando em ABNT…"
  - `compilando` → `-info` · "Compilando o PDF…"
  - `pronto` → `-ok` (`{colors.success}` on `{colors.success-tint}`) · "Pronto! Seu PDF está pronto para baixar." (this is the green = ready/done moment; pairs with `{component.prompt-panel-ready}`'s `{colors.signal-bright}` top edge)
  - `erro` → `-erro` (`{colors.error}` on `{colors.error-tint}`) · plain reason ("Não conseguimos gerar o PDF. Tente novamente.")
  - **Payment return states (slice #9), mapped to the same variants — no new tokens:**
    - `pronto` (unpaid) → `-ok` line as above, with `{component.paywall}` shown below the preview (preview is the value; pay to unlock the file).
    - `pago` (Stripe success_url, server-verified `paid`) → `-ok` (`{colors.success}` on `{colors.success-tint}`) · "Pagamento confirmado. Seu PDF está liberado para baixar." — the green ready/done moment; pairs with `{component.prompt-panel-ready}`'s `{colors.signal-bright}` edge (already lit from `pronto`). `{component.download-bar}` replaces `{component.paywall}` here.
    - `cancelado` (Stripe cancel_url, `?canceled=1`) → `-info` (NOT `-erro`) via `{component.paywall-canceled-note}` · "Pagamento cancelado. Você pode tentar de novo quando quiser." — `{component.paywall}` is shown again; nothing is lost.
  - Copy register: calm, plain Portuguese, no hype — the in-progress trio (convertendo/formatando/compilando) are quiet `-info` lines, no warning/error color until something actually fails. `{colors.warning}` reserved for genuine soft-fail (e.g. compiled with avisos).

**`{component.badge}`** — filename chip, image-count note
- `{typography.caption}` weight 500 · Radius `{rounded.full}` · Padding `{spacing.xs}` `{spacing.sm}` · Default text `{colors.text-secondary}` on `{colors.surface-raised}`; mono content (filenames) in the Mono stack

### Header & Footer

**`{component.header}`** — page top (no nav links; single-page tool). **Superseded on the landing (slice #8)** by `{component.site-header}` (which DOES have nav). The bare-tool header survives as the typographic basis of `{component.hero}` (same Display wordmark + subline treatment), and remains the canonical header for any standalone/embedded tool view.
- Background `{colors.surface}` · No border · Wordmark "auto-ABNT" Display face weight 600 `{typography.display}` `{colors.text-primary}` · Subline `{typography.body-lg}` `{colors.text-secondary}`, max-width 52ch

**`{component.footer}`** — extended for the landing (slice #8): now a multi-column footer
- Background `{colors.surface}` · Top border 1px `{colors.border}` · Padding `{spacing.3xl}` 0 · Inner content constrained to the landing column (1040px, §4).
- Layout: wordmark block (left) + two link columns (right), space-between, gap `{spacing.2xl}`; stacks 1-up below `sm`.
- Wordmark block: "auto-ABNT" Display face weight 600 `{typography.h3}` `{colors.text-primary}`, then a `{typography.body-sm}` `{colors.text-secondary}` one-liner ("Seu .docx em PDF ABNT, na hora.").
- Link columns: each a `{typography.caption}` weight 500 uppercase `{colors.text-tertiary}` heading, then `{typography.body-sm}` `{colors.text-secondary}` links (e.g. "Produto": Como funciona · Preço · Normas ABNT; "Sobre": Privacidade · Contato). Link hover: `{colors.text-primary}`, no underline-on-rest.
- Bottom line (full width, above the columns or below, `{spacing.lg}` separation): the original reassurance `{typography.body-sm}` `{colors.text-secondary}` — "Entrada: .docx · Saída: PDF + LaTeX abnTeX2 · formatado em ABNT." Kept verbatim from the tool footer so the trust line survives the redesign.

### Landing (slice #8 — enterprise marketing layout, OUR tokens)

The landing **wraps** the existing tool: the cover form + result area (`{component.fieldset}` / `{component.prompt-panel}` / `{component.pdf-preview}` / `{component.paywall}` / `{component.download-bar}`) are unchanged and become the centerpiece section (`{component.tool-section}`). Marketing sections borrow Apply4You's vertical rhythm/positioning **only** — never its color. The signature holds: light-first page, one dark inversion (the prompt panel inside the tool), green = signal only, one black primary pill.

**`{component.notification-bar}`** — thin top strip (the Apply4You notification bar, calm version)
- Background `{colors.surface-raised}` · Bottom border 1px `{colors.border}` · No radius (full-bleed strip; the two-radii rule governs *components*, not a full-bleed edge — but it carries no interactive children except optional links). Height ~36px, vertically centered.
- Single centered line `{typography.caption}` weight 500 `{colors.text-secondary}` — reassurance, not a sale: "100% online · seu texto não é guardado · pague só quando baixar." Green is NOT used here (it is not a success state).
- Optional: dismissible — the dismiss control is a `{component.button-ghost}` (caption size). Stateless dismissal (per-session) is an impl detail.

**`{component.site-header}`** — the landing header (replaces the bare tool `{component.header}` on the landing; the tool's `{component.header}` typographic treatment survives as the hero, below)
- Background `{colors.surface}` · Bottom border 1px `{colors.border}` (hairline; no shadow) · Sticky top optional · Inner row constrained to the landing column (1040px), padding `{spacing.md}` 0.
- Layout (3 zones, space-between): **left** wordmark "auto-ABNT" Display face weight 600 `{typography.h3}` `{colors.ink}` (links to top); **center** `{component.nav}`; **right** a single `{component.button-primary}`-styled CTA "Gerar agora" that scrolls to `{component.tool-section}` (the one black pill in the header — discipline holds; it is the same action as the hero CTA, so they share the single-primary budget).
- Responsive: below `sm` the center `{component.nav}` collapses (links move into a `{component.button-ghost}` menu toggle or simply hide, keeping wordmark + CTA); the CTA stays.

**`{component.nav}`** — the center nav link group
- Horizontal row, gap `{spacing.lg}` · Each link `{component.nav-link}`.

**`{component.nav-link}`** — a single nav item ("Como funciona", "Preço")
- `{typography.body-sm}` weight 500 `{colors.text-secondary}` · Hover `{colors.text-primary}` (surface-shift register: text color only, 150ms, no motion) · Radius `{rounded.full}` hit area, padding `{spacing.sm}` `{spacing.md}` · Focus `{colors.focus}` ring · In-page anchor scroll to the matching section.

**`{component.section}`** — the top-level landing section primitive (rhythm + container)
- Vertical padding `{spacing.4xl}` top and bottom (the landing rhythm token); content centered in the landing column (1040px, §4) with `{spacing.lg}` side gutters.
- Background `{colors.surface}` by default; a section MAY alternate to `{colors.surface-raised}` to separate bands (the Apply4You alternating-band rhythm, in our greys — never a colored band). No borders between sections; the band background change + `{spacing.4xl}` rhythm does the separation (no horizontal rules — §8 Do #7).
- Optional `{component.section-heading}` at top.
- On `sm`: vertical padding compresses to `{spacing.2xl}` (§9).

**`{component.section-heading}`** — the heading block atop a section
- Optional eyebrow: `{typography.caption}` weight 500 uppercase `{colors.text-tertiary}` (the only uppercase, ≤12px — §8 Don't #7).
- Title `{typography.h2}` `{colors.text-primary}`, centered (or left for the stat/feature bands per layout).
- Optional subtitle `{typography.body-lg}` `{colors.text-secondary}`, max-width 60ch.
- Gap heading→content `{spacing.2xl}`.

**`{component.hero}`** — the opening section (centered, Apply4You hero positioning, OUR colors)
- A `{component.section}` (first band, `{colors.surface}`), content centered, max-width ~720px.
- **Two-line title**, Display face: line 1 `{typography.display}` `{colors.text-primary}`; **line 2 = the "accent" line** but green is forbidden for large text (§8 Don't #3) — the accent is rendered in `{colors.text-secondary}` (a calm tonal step-down, the *only* permitted "accent" treatment at display size), NOT `{colors.signal}`. Example: line 1 "Seu trabalho em ABNT," / line 2 "pronto para entregar." in `{colors.text-secondary}`.
- Subtitle `{typography.body-lg}` `{colors.text-secondary}`, max-width 52ch (matches the tool subline) — calm, plain pt-BR: "Suba o .docx, preencha a capa, baixe o PDF formatado nas normas. Sem Overleaf, sem instalar nada."
- CTA row: ONE primary `{component.button-primary}` "Gerar meu PDF" that scrolls to `{component.tool-section}`. Apply4You's second (outline) hero button maps to ONE `{component.button-secondary}` "Como funciona" (anchor to the features section) — optional; if kept it is the neutral pill, never a second black pill. Gap `{spacing.md}`, stacks 1-up below `sm`.
- Below the CTA, the trust line `{component.norms-line}` (replaces Apply4You's logo strip).
- No hero image (system uses no photography — §6); the visual payoff is the dark prompt panel further down, not a hero graphic.

**`{component.norms-line}`** — the small reassurance line replacing Apply4You's "confiam em nós" logo strip
- Centered, `{spacing.lg}` below the hero CTA · `{typography.body-sm}` `{colors.text-tertiary}` lead-in "Segue as normas:" then the norm numbers in the Mono stack `{typography.code}`-sized `{colors.text-secondary}` — "NBR 14724 · 6023 · 10520" (machine-ish identifiers → mono, per §3). Honest reassurance, no fake company logos.

**`{component.tool-section}`** — the centerpiece: the EXISTING tool, framed (Apply4You's "upload section" slot)
- A `{component.section}` with `id` anchor (e.g. `#ferramenta`) so header/hero CTAs scroll here. Background MAY be `{colors.surface-raised}` to read as the focal "card band" (the Apply4You dropzone-card moment) — but the tool's own cards stay `{colors.surface}` so they lift off the raised band via existing Level-1 hairlines (no shadow).
- `{component.section-heading}`: eyebrow "A ferramenta", title `{typography.h2}` "Gere seu documento agora", short subtitle.
- **Houses the existing markup UNCHANGED**: the `<form id="form">` (with `{component.fieldset}` blocks, `{component.text-input}`, `{component.file-drop}`, `{component.button-primary}` "Gerar arquivo ABNT", `{component.status-message}`) and the `<section id="resultado">` (with `{component.prompt-panel}` → `{component.pdf-preview}`, `{component.paywall}` / `{component.paywall-canceled-note}`, `{component.download-bar}`). df-frontend does NOT redesign tool internals — it only places this block inside the section and constrains it to the 768px tool column (centered within the wider 1040px band).
- The dark `{component.prompt-panel}` remains the page's single Level-2 inversion and the emotional payoff — landing bands above/below it are all light, so the inversion still lands as the climax of the flow.

**`{component.feature-card}`** — a "Como funciona" / value card (Apply4You's 3 feature cards)
- Background `{colors.surface}` · Border 1px `{colors.border}` · Radius `{rounded.card}` (16px) · Padding `{spacing.xl}` · No shadow.
- Optional leading icon: monochrome line glyph, `{colors.text-secondary}`, ~24px (decorative-but-neutral; no color). Icon is optional — copy carries the card.
- Title `{typography.h3}` `{colors.text-primary}`, margin-bottom `{spacing.sm}`.
- Body `{typography.body-md}` `{colors.text-secondary}`.
- Laid out 3-up in a grid (gap `{spacing.lg}`) inside a `{component.section}`; collapses 3→1 below `sm` (mirrors the cover-grid collapse, §9). Example trio: "Sem Overleaf" / "PDF pronto na hora" / "IA treinada nas normas ABNT".

**`{component.feature-card-hover}`** — background `{colors.surface-raised}`, 150ms ease, no motion/scale/shadow (universal hover rule, §7). Only if the whole card is a link/anchor; static cards need no hover.

**`{component.price-card}`** — the SINGLE clear price callout (Apply4You's 3 pricing cards → one honest card; we have ONE one-off price)
- A single centered card (NOT three tiers — no fake tiers): Background `{colors.surface}` · Border 1px `{colors.border}` · Radius `{rounded.card}` · Padding `{spacing.2xl}` · max-width ~420px, centered in the pricing `{component.section}`. No shadow.
- Contents top→bottom: a `{component.badge}` "Pagamento único" (`{colors.text-secondary}` on `{colors.surface-raised}`); the **price** — Display face `{typography.display}` `{colors.text-primary}` (big but `{colors.ink}`/text-primary, never green — §8 Don't #3); a `{typography.body-sm}` `{colors.text-tertiary}` qualifier "uma vez · sem assinatura"; a short `{typography.body-md}` `{colors.text-secondary}` inclusion line ("PDF formatado + arquivo .tex"); then ONE `{component.button-primary}` "Gerar e baixar" scrolling to `{component.tool-section}` (it is the same single primary action; checkout itself happens inside the tool via `{component.pay-button}` — the pricing CTA only routes the user to the tool, it does NOT start Stripe).
- **PRICE IS DATA, NOT COPY** (same rule as `{component.paywall}`): the displayed price comes from the backend at runtime via `GET /config` → `pricing.formatted` (BRL string already formatted server-side; see `src/api.js#getConfig`). df-frontend MUST fetch and interpolate it — never hardcode "R$ 9,90" in the markup. Until `/config` resolves, render a neutral skeleton/placeholder (e.g. the existing "…" pattern), never a guessed number.
- Apply4You's interval toggle (monthly/yearly) is **dropped**: there is no interval — one-off charge. Do not build a toggle.

**`{component.cta-band}`** — the "Pronto para começar?" closing CTA (Apply4You's pre-footer CTA)
- A `{component.section}`, background MAY be `{colors.surface-raised}` (a calm band, never a colored block — Apply4You uses an orange block here; we explicitly do NOT).
- Centered heading `{typography.h2}` `{colors.text-primary}` "Pronto para entregar no prazo?" + optional `{typography.body-lg}` `{colors.text-secondary}` line.
- CTA row: ONE `{component.button-primary}` "Gerar meu PDF" (scrolls to tool) + optional ONE `{component.button-secondary}` "Ver o preço" (scrolls to pricing). Same single-primary discipline; never two black pills.

**`{component.testimonials}`** — OPTIONAL, only if honest (slice #8 ships it OFF by default)
- Apply4You shows 4 testimonial cards. We have no real testimonials → **do not ship fabricated ones** (§8/copy honesty rule). This entry exists so a *future* real-quote pass has a token home: if/when real quotes exist, reuse `{component.feature-card}` geometry (surface, hairline, 16px radius, `{spacing.xl}` padding) with body `{typography.body-md}` `{colors.text-secondary}` + an attribution line `{typography.body-sm}` `{colors.text-tertiary}`. No avatars/photos (§6). Until then the section is omitted entirely — not stubbed with placeholders.

## 8. Do's and Don'ts

**Do**

1. Use `{component.button-primary}` (black pill) for the single primary action, "Gerar arquivo ABNT"; green is never a button color.
2. Keep exactly one `{component.prompt-panel}` Level-2 inversion on the page — it is the highlight budget and the signature.
3. Render all LaTeX, the prompt, filenames, and Overleaf/`npx` commands in the Mono stack — machine text is always monospace.
4. Pair `{colors.signal-bright}` with the dark panel and `{colors.signal}` with light surfaces (success status, "Copiado! ✓") — never cross the families.
5. Use `{component.status-message}` variants (`-info`/`-ok`/`-erro`) for every conversion outcome; never bare colored text.
6. Keep the two `{component.ai-launch-button}`s equal-weight secondary pills — neither ChatGPT nor Claude outranks the other, and neither competes with the primary.
7. Separate the form card and result card with `{spacing.2xl}` of whitespace; no horizontal rules.
8. Honor `prefers-reduced-motion`: the "Copiado! ✓" swap and status changes are instant, never animated, when requested.

**Don't**

1. Don't introduce box shadows anywhere — depth is hairlines and the dark prompt panel, full stop.
2. Don't add a third border radius; everything is `{rounded.full}` or `{rounded.card}`.
3. Don't use `{colors.signal}` for body text, headings, links, or large backgrounds — it is reserved for ready/success and the panel edge.
4. Don't build an app-wide dark mode; `{colors.panel}` is the prompt content surface, not a theme.
5. Don't make either AI-launch button a black primary pill — that would imply a preferred provider and steal emphasis from "Gerar".
6. Don't use marketing/hype copy; the register stays plain and reassuring ("nada é enviado ou guardado").
7. Don't set uppercase type above 12px (`{typography.caption}` is the ceiling for uppercase).
8. Don't add hover states that move, scale, or shadow — surface shift only.

## 9. Responsive Behavior

### Breakpoints

| Name | Width | Key Changes |
|---|---|---|
| `sm` | 640px | Cover fields 2 → 1-up; `{component.ai-launch-group}` stacks 1-up; `{typography.display}` drops to 36px |
| `md` | 768px | Page column reaches max width; cover fields go 2-up |

### Touch Targets

All interactive elements are ≥ 44×44px (`{component.button-primary}`, `{component.ai-launch-button}`, `{component.text-input}`, `{component.button-secondary}`) — meets WCAG 2.2 AA with margin; `{component.button-ghost}`/`{component.copy-button}` at 36px height compensate with ≥ 44px total hit area via padding.

### Collapsing Strategy

- **Form**: cover fields collapse from a 2-up grid to a single column below `sm`; full-width fields (textareas, file drop) are always full-column.
- **AI handoff**: `{component.ai-launch-group}` stacks vertically below `sm`; both buttons go full-width.
- **Prompt panel**: `{component.prompt-panel}` keeps its `{rounded.card}` and internal scroll; code never drops below 12px — scroll, don't shrink.
- **Spacing**: card padding compresses from `{spacing.xl}` to `{spacing.lg}` below `sm`.
- **Landing (slice #8)**: `{component.section}` vertical padding compresses `{spacing.4xl}`→`{spacing.2xl}` below `sm`; `{component.nav}` collapses (links hide or move behind a `{component.button-ghost}` toggle, wordmark + header CTA persist); `{component.feature-card}` grid 3-up→1-up below `sm`; `{component.hero}` and `{component.cta-band}` CTA rows stack 1-up (full-width) below `sm`; `{component.footer}` columns stack 1-up; the landing column (1040px) shrinks to 100% width minus `{spacing.lg}` gutters, while `{component.tool-section}`'s inner tool stays the 768px reading column.

### Image Behavior

No raster images. The prompt panel's mono text scales fluidly inside its container, maintaining radius and hairline; text inside never drops below 12px.

## 10. Iteration Guide

1. Change one component per iteration; never restyle a token and a component in the same pass.
2. Reference tokens directly in specs and code (`{colors.signal}`, not its hex); if you need a value with no token, the design conversation comes first, the code second.
3. Run `npx @google/design.md lint DESIGN.md` after every edit — it catches broken refs, contrast-ratio failures, and orphaned tokens.
4. Add variants as separate entries (`-hover`, `-disabled`, `-focused`, `-error`, `-dragover`), never as prose inside the base entry.
5. Respect the scarcity rules when extending: two radii, one accent, one inversion per page, no shadows. A new component that needs to violate one of these is a signal the component is wrong, not the rule.
6. Keep the single-primary discipline: only "Gerar arquivo ABNT" is a black pill. New actions are secondary or ghost until a design conversation says otherwise.
7. Before inventing a container, reuse `{component.fieldset}` / `{component.result-card}` / `{component.prompt-panel}` compositions.

## 11. Known Gaps

- **Harvest blind spot**: the adsCLI reference was mined from its `DESIGN.md` text, not from a rendered build — exact paddings and the live "Copiado!" timing are this document's own decisions, not pixel-measured values.
- ~~**In-page document preview not specified**~~ — RESOLVED (slice #7): preview = compiled PDF embedded inline via `{component.pdf-preview}` inside `{component.prompt-panel}`; download via `{component.download-bar}`. Overleaf + AI-handoff removed (handoff moved server-side).
- **AI deep-link mechanics out of scope**: how ChatGPT/Claude receive the pre-filled prompt (URL params vs clipboard-and-open) is an implementation detail, not a visual one; `{component.ai-launch-button}` governs appearance only.
- **`.zip` (with images) handoff** uses the same `{component.status-message}` and `{component.result-card}`; the "Upload Project no Overleaf" guidance is copy, not a new component.
- ~~**Pay-before-download UX not specified**~~ — RESOLVED (slice #9): paywall = `{component.paywall}` + `{component.pay-button}` (reuses `{component.button-primary}`) in the unpaid `pronto` slot; Stripe hosted-redirect return states (`pago`/`cancelado`) map to `{component.status-message}` `-ok`/`-info` (+ `{component.paywall-canceled-note}`); `{component.download-bar}` is gated on server-verified payment.
- **Empty/error states beyond conversion failure** (e.g. a `.docx` that yields an empty body) are not yet specified; until a dedicated pass, fall back to `{component.status-message}` `-erro`.
- **Logo/wordmark** does not exist yet; the header specifies typographic treatment only.
- ~~**Enterprise landing layout not specified**~~ — RESOLVED (slice #8): landing = `{component.notification-bar}` + `{component.site-header}` (`{component.nav}` / `{component.nav-link}`) + `{component.hero}` (two-line title, accent line = `{colors.text-secondary}`, NOT green) + `{component.norms-line}` + `{component.tool-section}` (houses the existing form + result UNCHANGED — the dark prompt panel stays the single inversion) + `{component.feature-card}` ×3 + `{component.price-card}` (single honest one-off, price from `GET /config`) + `{component.cta-band}` + extended `{component.footer}`. Section rhythm = `{component.section}` at `{spacing.4xl}`; testimonials (`{component.testimonials}`) deliberately OFF (no fake quotes). Apply4You positioning only — none of its orange/colors; signature preserved (one black pill, green = signal, two radii, no shadows, hairlines).
- **`{component.file-drop}` drag-and-drop** is specified visually (`-dragover`); the current build uses a plain file input — the drag affordance is a forward-looking spec for the implementation pass.
