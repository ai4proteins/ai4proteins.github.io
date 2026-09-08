# GitHub Preview Tool Cards Design

## Goal

Refine the AI4Protein Tools directory so every visible tool has a reviewed,
direct GitHub repository destination and every card uses the same GitHub Open
Graph preview shown when that repository is shared on X.

## Catalog Rules

- Retain only Neurosnap services whose title has an explicit entry in
  `data/repository-overrides.json`.
- The current reviewed catalog contains exactly 130 retained tools and 116
  unique repositories. The 26 search-only tools are removed.
- Every destination is an HTTPS repository root of the form
  `https://github.com/<owner>/<repository>`; GitHub search URLs and deeper paths
  are rejected.
- The generated records retain the existing visible title, description,
  categories, tags, beta state, source order, and `linkType: "official"`.

## Image Rules

- Build each preview request as
  `https://opengraph.githubassets.com/ai4proteins/<owner>/<repository>` from the
  validated repository URL.
- Download once per unique repository, then write one local PNG per retained
  tool so every catalog image path remains title-specific.
- Accept only structurally complete PNG responses whose IHDR dimensions are
  exactly 1200 by 600 pixels.
- Store generated previews in `assets/tools/*.png`. After a successful sync,
  `assets/tools/` contains exactly the 130 referenced PNGs and no WebP files.
- The avatar at `assets/images/avatar.jpeg` is unchanged.

## Synchronization And Failure Safety

- Keep the catalog source request constrained to `https://neurosnap.ai` and
  preview requests constrained to `https://opengraph.githubassets.com`.
- Space preview request starts to stay below the observed GitHub preview rate
  window, and retry HTTP 429 and transient 5xx failures with bounded waits.
- Stage the new JSON and image directory first. Replace the checked-in outputs
  only after every unique preview has downloaded and validated; restore both
  previous outputs if installation fails.
- Do not read, embed, log, or require GitHub credentials.

## Presentation And Verification

- Render preview images at a stable 2:1 ratio with intrinsic dimensions
  `width="1200"` and `height="600"`.
- Preserve the existing navigation, avatar, filters, responsive grid,
  accessibility behavior, and five intentionally empty content routes.
- Automated checks cover the 130-record official-only catalog, exact PNG asset
  set, PNG validation, direct repository links, browser image decoding and
  dimensions, 2:1 rendering, mobile layout, and absence of console errors.
- Inspect screenshots at 1440x1000, 1024x768, and 390x844 before publication.
