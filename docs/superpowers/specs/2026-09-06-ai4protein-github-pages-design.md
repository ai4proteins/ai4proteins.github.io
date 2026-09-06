# AI4Protein GitHub Pages Design

## Goal

Create and publish `ai4proteins.github.io` as a fast, responsive directory of open-source computational biology tools. The site takes visual and interaction cues from Neurosnap's Tools page while using AI4Protein's own identity, navigation, color system, and outbound GitHub links.

## Scope

- The root page is the Tools directory.
- The navigation contains: Tools, Papers, Molecules, Structure Prediction, Design, and Property.
- Papers, Molecules, Structure Prediction, Design, and Property contain the shared site shell and page title only; their main content remains intentionally empty.
- The Tools directory includes all 156 entries currently returned by Neurosnap's public `/api/services` catalog, including each title, short description, categories, tags, beta state, and card image.
- Each tool card opens a GitHub destination in a new tab. Verified official repositories are used where available. Entries without a verifiable public repository open a tool-specific GitHub repository search.
- Creating and publishing the public `ai4proteins/ai4proteins.github.io` repository is part of delivery.

## Technical Approach

Use a dependency-free static site so GitHub Pages can serve the repository directly from `main` without a build action.

```text
ai4proteins.github.io/
  index.html
  papers/index.html
  molecules/index.html
  structure-prediction/index.html
  design/index.html
  property/index.html
  assets/
    css/styles.css
    images/avatar.jpeg
    tools/*.webp
    js/catalog.js
    js/app.js
  data/tools.json
  tests/site.test.mjs
  README.md
```

The catalog is rendered from `data/tools.json`. Search and filters execute entirely in the browser. Shared page-shell markup remains deliberately small and duplicated across the five placeholder pages so the site needs no templating or compilation step.

## Visual Direction

The supplied protein image is the brand mark and source of the palette:

- Navigation: deep navy (`#07152f` range)
- Primary interaction: ice blue (`#75cfff` range)
- Secondary accent: restrained orchid pink (`#d58bdc` range)
- Main canvas: white and a very light cool gray
- Body text: dark neutral blue-gray

The header is compact and work-focused. On desktop, the avatar and `AI4Protein` wordmark sit left and the navigation sits right. On narrow screens, a menu button exposes the navigation without changing the page width.

The Tools page keeps the reference page's useful hierarchy: a prominent search field, category filters, tag filters, a result count, and a responsive card grid. Cards use local imagery, concise text, category chips, an external-link icon, and restrained hover motion. The grid is three columns on desktop, two on medium screens, and one on phones.

## Data And Link Resolution

Each tool record contains:

- `title`
- `description`
- `categories`
- `tags`
- `beta`
- `image`
- `githubUrl`
- `linkType` (`official` or `search`)

Repository mapping follows this order:

1. A repository referenced by the model's paper, project site, or maintaining organization.
2. A clearly canonical repository found under the named author or organization.
3. A scoped GitHub repository search for entries that are proprietary, generic workflows, or otherwise ambiguous.

Every destination must use HTTPS and the `github.com` host. The catalog has no runtime dependency on Neurosnap.

## Interaction

- Text search matches tool title, description, category, and tag, case-insensitively.
- Category and tag chips support multiple selections.
- Multiple selections within one filter group use OR matching; category and tag groups combine with AND matching.
- Active filters are visually distinct and keyboard accessible.
- A clear-filters action appears only while a search or filter is active.
- Empty results show a concise no-results state and a reset action.
- Tool cards open GitHub in a new tab with safe external-link attributes.
- The current navigation item is exposed visually and with `aria-current="page"`.

## Accessibility And Responsiveness

- Semantic header, navigation, main, section, and footer landmarks.
- Visible focus states and full keyboard operation.
- Form labels available to assistive technology.
- Sufficient color contrast against the navy and white surfaces.
- Fixed image aspect ratios and bounded card geometry prevent layout shift.
- Long tool names wrap safely without overlapping controls.
- Responsive checks cover a wide desktop, a laptop, and a phone viewport.

## Verification

Automated checks will verify:

- Exactly 156 unique tool records.
- Required data fields and local images exist.
- Every tool has a valid GitHub URL and valid `linkType`.
- Navigation and placeholder routes exist and use the expected active state.
- Search and combined-filter behavior.
- External card-link safety attributes.

Manual browser verification will cover search, category and tag filters, clearing filters, card navigation targets, mobile navigation, overflow, missing images, console errors, and screenshots at desktop and phone sizes.

## Publication

After verification, create the public repository `ai4proteins/ai4proteins.github.io`, push `main`, and confirm the published site at `https://ai4proteins.github.io/`. If GitHub requires an account-side confirmation or Pages activation that cannot be completed automatically, leave the fully verified repository ready and report the exact remaining action.
