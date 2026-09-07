# GitHub Preview Tool Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep only the 130 tools with reviewed GitHub repositories and replace all tool artwork with local 1200x600 GitHub Open Graph previews.

**Architecture:** Pure catalog helpers validate repository roots, filter the source catalog, derive stable PNG names, and build GitHub preview URLs. The sync command deduplicates previews by repository, rate-limits and retries network work, validates every PNG, stages all outputs, and atomically replaces the generated catalog and asset directory. The dependency-free browser UI continues to consume checked-in JSON and local images.

**Tech Stack:** HTML5, CSS, browser-native JavaScript modules, Node.js 24 built-in tests, Python 3.12 Playwright, GitHub Pages

**Spec:** `docs/superpowers/specs/2026-09-07-github-preview-cards-design.md`

## Global Constraints

- Retain exactly the 130 current Neurosnap services named in `data/repository-overrides.json`, preserving their source order and visible metadata.
- Every retained destination must be an HTTPS GitHub repository root; no GitHub search URL may remain.
- Generate one title-specific local `assets/tools/*.png` file per tool from the GitHub Open Graph preview endpoint.
- Download each of the 116 unique repositories only once per sync, space request starts below the observed rate window, and retry only HTTP 429 or transient 5xx responses with bounded waits.
- Validate every preview as a structurally complete 1200x600 PNG before changing checked-in output.
- Replace `data/tools.json` and `assets/tools/` atomically; a failed sync must preserve both prior outputs.
- Keep the avatar, navigation, filtering behavior, placeholder routes, static hosting model, and dependency-free production runtime unchanged.
- Render card media at 2:1 without overlap, horizontal overflow, or layout shift on desktop, laptop, and phone viewports.

---

### Task 1: Official-Only Catalog And GitHub Preview Pipeline

**Files:**
- Modify: `tests/catalog-source.test.mjs`
- Modify: `tests/catalog-image.test.mjs`
- Modify: `tests/catalog.test.mjs`
- Modify: `tests/fetch-bytes.test.mjs`
- Create: `tests/github-preview.test.mjs`
- Modify: `scripts/catalog-source.mjs`
- Modify: `scripts/catalog-image.mjs`
- Modify: `scripts/fetch-bytes.mjs`
- Create: `scripts/github-preview.mjs`
- Modify: `scripts/sync-catalog.mjs`
- Regenerate: `data/tools.json`
- Replace: `assets/tools/*.webp` with `assets/tools/*.png`

**Interfaces:**
- Consumes: Neurosnap service objects and the title-to-repository object in `data/repository-overrides.json`.
- Produces: `assetFilename(title): string`, `githubRepositoryParts(url): { owner: string, repository: string }`, `githubPreviewUrl(url): string`, `toCatalogEntry(service, repositoryUrl): ToolRecord`, `selectCatalogEntries(services, overrides): ToolRecord[]`, and `isGithubPreviewPng(payload): boolean`.
- Produces: an HTTP error from `fetchBytes()` with numeric `status` and parsed `retryAfterMs` fields so the preview downloader can retry only rate-limit and transient server responses.
- Produces: `fetchGithubPreview(repositoryUrl, options): Promise<Buffer>` and `downloadRepositoryPreviews(tools, options): Promise<Map<string, Buffer>>`; injected fetch and wait functions keep external network and time outside unit tests.

- [ ] **Step 1: Write the failing catalog-source tests**

Replace the fallback-search assertions with literal behavior checks equivalent
to:

```js
assert.equal(assetFilename('PocketXMol | Dock'), 'pocketxmol-dock.png');
assert.deepEqual(
  githubRepositoryParts('https://github.com/chaidiscovery/chai-lab'),
  { owner: 'chaidiscovery', repository: 'chai-lab' },
);
assert.equal(
  githubPreviewUrl('https://github.com/chaidiscovery/chai-lab'),
  'https://opengraph.githubassets.com/ai4proteins/chaidiscovery/chai-lab',
);
assert.throws(() => githubRepositoryParts('https://github.com/search?q=chai'));
assert.deepEqual(
  selectCatalogEntries([mappedService, unmappedService], {
    [mappedService.title]: 'https://github.com/chaidiscovery/chai-lab',
  }).map(({ title }) => title),
  [mappedService.title],
);
```

- [ ] **Step 2: Run the catalog-source tests and verify RED**

Run: `node --test tests/catalog-source.test.mjs`

Expected: FAIL because PNG naming, repository parsing, preview URL generation,
and official-only selection are not implemented.

- [ ] **Step 3: Write the failing PNG and final-catalog tests**

Replace WebP parser tests with independently constructed PNG fixtures covering
a complete 1200x600 PNG, wrong signature, truncated chunks, missing IDAT/IEND,
wrong dimensions, and trailing data. Update final-data assertions to require:

```js
assert.equal(tools.length, 130);
assert.deepEqual(new Set(tools.map(({ title }) => title)), new Set(Object.keys(repositoryOverrides)));
assert.equal(new Set(tools.map(({ image }) => image)).size, 130);
assert.ok(tools.every(({ linkType }) => linkType === 'official'));
assert.ok(tools.every(({ image }) => image.endsWith('.png')));
```

The integrity test must compare the entire `assets/tools/` directory with the
130 referenced PNG basenames, assert that no `.webp` file remains, parse every
destination as a two-segment GitHub repository root, and validate every image
with `isGithubPreviewPng()`.

- [ ] **Step 4: Run the image and final-catalog tests and verify RED**

Run: `node --test tests/catalog-image.test.mjs tests/catalog.test.mjs`

Expected: FAIL because the parser still accepts WebP and generated output still
contains 156 WebPs including 26 search-only records.

- [ ] **Step 5: Write the failing HTTP metadata tests**

Extend the local-server tests so a 429 response causes `fetchBytes()` to reject
with `error.status === 429` and a numeric delay derived from `Retry-After: 2`.
Also cover a date-form Retry-After value and malformed values without replacing
the existing redirect, timeout, cancellation, and maximum-size checks.

- [ ] **Step 6: Run the HTTP tests and verify RED**

Run: `node --test tests/fetch-bytes.test.mjs`

Expected: FAIL because HTTP errors do not yet expose response status or retry
metadata.

- [ ] **Step 7: Write the failing preview-download tests**

Use specific injected fakes for the external fetch and timer boundaries. Assert
that two tools sharing one repository plus one distinct repository produce a
two-entry result with exactly two fetches and one 750ms inter-request wait.
Assert that 429 and 500 errors retry and eventually return the real buffer, that
the retry delay is the greater of a valid `retryAfterMs` and exponential
backoff up to 65 seconds, that no more than four total attempts occur, and that
404 and invalid PNG responses fail without retry.

- [ ] **Step 8: Run the preview-download tests and verify RED**

Run: `node --test tests/github-preview.test.mjs`

Expected: FAIL because the preview download module does not exist.

- [ ] **Step 9: Implement the smallest passing source, image, HTTP, and download contracts**

Implement strict two-segment GitHub repository validation, `.png` filename
generation, official-only selection, deterministic preview URLs, structural PNG
chunk validation, typed HTTP response metadata, sequential unique-repository
downloads, 750ms request-start spacing, and bounded four-attempt retry behavior.
Reject query strings,
fragments, non-GitHub origins, empty owner/repository segments, extra path
segments, malformed PNG chunk bounds, missing image data, wrong dimensions,
and bytes after IEND.

- [ ] **Step 10: Run the focused contract tests and verify GREEN**

Run: `node --test tests/catalog-source.test.mjs tests/catalog-image.test.mjs tests/fetch-bytes.test.mjs tests/github-preview.test.mjs`

Expected: all focused tests pass with zero warnings.

- [ ] **Step 11: Implement and run the staged sync**

Update `scripts/sync-catalog.mjs` to select only mapped services, reject missing
mapped titles or duplicate image filenames, group tools by validated repository
URL, call the tested preview downloader, write each shared buffer to every
title-specific staged path, validate before writing, then reuse the existing
rollback replacement logic. Run:

```sh
node scripts/sync-catalog.mjs
```

Expected: `data/tools.json` has 130 official records and `assets/tools/` has
exactly 130 1200x600 PNG files with no WebPs.

- [ ] **Step 12: Run the complete Node suite and commit**

Run:

```sh
node --test tests/*.test.mjs
git diff --check
```

Expected: all Node tests pass and the whitespace check is clean.

Commit:

```sh
git add scripts tests data/tools.json assets/tools docs/superpowers
git commit -m "feat: use GitHub previews for official tools"
```

### Task 2: Two-To-One Card Presentation And Browser Verification

**Files:**
- Modify: `tests/test_site.py`
- Modify: `assets/js/app.js`
- Modify: `assets/css/styles.css`
- Modify: `README.md`

**Interfaces:**
- Consumes: the 130-record Task 1 catalog and its local 1200x600 PNGs.
- Produces: cards with intrinsic image attributes `1200` by `600`, computed
  2:1 media boxes, direct repository-only accessibility labels, and current
  local/published verification instructions.

- [ ] **Step 1: Write the failing browser expectations**

Change all catalog count assertions from 156 to 130. For every card assert a
direct two-segment GitHub repository URL, `assets/tools/*.png`, hidden text
`official repository`, intrinsic DOM attributes `width="1200"` and
`height="600"`, successful decoding, natural dimensions 1200x600, and a
rendered image width-to-height ratio within 0.01 of 2.0. Preserve all existing
search, filter, loading, error, navigation, placeholder, focus, forced-color,
and overflow tests.

- [ ] **Step 2: Run the browser suite and verify RED**

Run: `/Users/jun/anaconda3/bin/python -B -m unittest tests/test_site.py -v`

Expected: image intrinsic dimension and rendered-ratio assertions fail while
the regenerated catalog already renders 130 cards.

- [ ] **Step 3: Implement the presentation change**

Set each generated image element to `width = 1200` and `height = 600`, make its
repository label unconditionally `official repository`, and change the card
image CSS to `aspect-ratio: 2 / 1` while retaining containment, background,
border, lazy loading, and stable grid behavior. Update README catalog counts,
asset extensions, link rules, sync behavior, rate-limit note, and publication
checks.

- [ ] **Step 4: Run all automated verification and commit**

Run:

```sh
node --test tests/*.test.mjs
/Users/jun/anaconda3/bin/python -B -m unittest tests/test_site.py -v
git diff --check
```

Expected: every test passes, images decode at 1200x600, rendered ratios are 2:1,
and no browser console/page errors are recorded.

Commit:

```sh
git add assets/js/app.js assets/css/styles.css tests/test_site.py README.md
git commit -m "feat: render GitHub preview cards"
```

- [ ] **Step 5: Perform visual QA**

Capture the Tools page at 1440x1000, 1024x768, and 390x844. Inspect image
framing, title wrapping, filters, open and closed mobile navigation, first-card
visibility, horizontal overflow, loaded images, and console errors. Any defect
must first receive a failing browser regression test, then a minimal fix and a
fresh full-suite run.
