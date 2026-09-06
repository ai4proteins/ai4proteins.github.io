# AI4Protein GitHub Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publish a responsive AI4Protein GitHub Pages catalog containing all 156 Neurosnap Tools entries, each linked to an official GitHub repository or a precise GitHub repository search.

**Architecture:** A dependency-free static site loads a checked-in `data/tools.json` catalog and renders it with small ES modules. Pure catalog behavior is covered with Node's built-in test runner, while real-page navigation and interaction are covered with Python Playwright against a local HTTP server.

**Tech Stack:** HTML5, CSS, browser-native JavaScript modules, JSON, Node.js 24 built-in tests, Python 3.12 Playwright, GitHub Pages

**Spec:** `docs/superpowers/specs/2026-09-06-ai4protein-github-pages-design.md`

## Global Constraints

- Serve directly from the `main` branch with no production build step and no runtime framework.
- The root page is the Tools directory.
- Navigation labels are exactly: Tools, Papers, Molecules, Structure Prediction, Design, Property.
- Include exactly 156 unique catalog entries from the Neurosnap snapshot captured on 2026-09-06.
- Every tool destination must use HTTPS on `github.com`; use a verified official repository when possible and a repository search otherwise.
- All card imagery and the supplied avatar must be local repository assets.
- Placeholder pages include the common site shell and page title, with no additional main content.
- Search is case-insensitive across title, description, categories, and tags.
- Category selections use OR, tag selections use OR, and the two groups combine with AND.
- Desktop, laptop, and phone layouts must avoid overlap, horizontal overflow, and layout shift.

## File Map

- `index.html`: Tools document structure and accessible control containers.
- `papers/index.html`, `molecules/index.html`, `structure-prediction/index.html`, `design/index.html`, `property/index.html`: shared shell and intentionally empty route bodies.
- `assets/css/styles.css`: palette, layout, responsive navigation, filters, cards, empty states, and focus treatment.
- `assets/js/catalog.js`: pure normalization and filtering functions usable in Node and the browser.
- `assets/js/app.js`: fetches the data, owns UI state, renders controls/cards, and handles mobile navigation.
- `assets/images/avatar.jpeg`: supplied AI4Protein avatar.
- `assets/tools/*.webp`: 156 local card images.
- `data/repository-overrides.json`: reviewed official repository mappings.
- `data/tools.json`: generated, deployable catalog.
- `scripts/catalog-source.mjs`: deterministic catalog conversion and asset filename helpers.
- `scripts/sync-catalog.mjs`: one-time source fetch, link resolution, and image download command.
- `tests/catalog-source.test.mjs`: conversion/link fallback tests.
- `tests/catalog.test.mjs`: filter behavior and final catalog integrity tests.
- `tests/test_site.py`: browser-level interaction, route, accessibility-state, and responsive smoke tests.
- `README.md`: local verification and publishing notes.
- `.nojekyll`: ensures GitHub Pages serves static assets without Jekyll processing.

---

### Task 1: Catalog Conversion Contract

**Files:**
- Create: `tests/catalog-source.test.mjs`
- Create: `scripts/catalog-source.mjs`

**Interfaces:**
- Consumes: Neurosnap service objects with `title`, `desc_short`, `categories`, `tags`, and `beta`.
- Produces: `githubSearchUrl(title): string`, `assetFilename(title): string`, and `toCatalogEntry(service, officialUrl?): ToolRecord`.

- [ ] **Step 1: Write the failing conversion tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assetFilename,
  githubSearchUrl,
  toCatalogEntry,
} from '../scripts/catalog-source.mjs';

const service = {
  title: 'Chai-1 (AlphaFold3)',
  desc_short: 'Predict biomolecular structures.',
  categories: ['Structure Prediction & Folding'],
  tags: ['Co-Folding', 'Proteins'],
  beta: false,
};

test('fallback links search GitHub repositories for the exact title', () => {
  assert.equal(
    githubSearchUrl(service.title),
    'https://github.com/search?q=Chai-1+%28AlphaFold3%29&type=repositories',
  );
});

test('catalog conversion preserves visible content and identifies official links', () => {
  assert.deepEqual(
    toCatalogEntry(service, 'https://github.com/chaidiscovery/chai-lab'),
    {
      title: 'Chai-1 (AlphaFold3)',
      description: 'Predict biomolecular structures.',
      categories: ['Structure Prediction & Folding'],
      tags: ['Co-Folding', 'Proteins'],
      beta: false,
      image: 'assets/tools/chai-1-alphafold3.webp',
      githubUrl: 'https://github.com/chaidiscovery/chai-lab',
      linkType: 'official',
    },
  );
});

test('asset filenames are stable for punctuation-heavy titles', () => {
  assert.equal(assetFilename('PocketXMol | Dock'), 'pocketxmol-dock.webp');
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `node --test tests/catalog-source.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `scripts/catalog-source.mjs`.

- [ ] **Step 3: Implement the smallest conversion module**

```js
export function githubSearchUrl(title) {
  const query = new URLSearchParams({ q: title, type: 'repositories' });
  return `https://github.com/search?${query.toString()}`;
}

export function assetFilename(title) {
  return `${title.toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}.webp`;
}

export function toCatalogEntry(service, officialUrl) {
  return {
    title: service.title,
    description: service.desc_short,
    categories: [...service.categories],
    tags: [...service.tags],
    beta: Boolean(service.beta),
    image: `assets/tools/${assetFilename(service.title)}`,
    githubUrl: officialUrl ?? githubSearchUrl(service.title),
    linkType: officialUrl ? 'official' : 'search',
  };
}
```

- [ ] **Step 4: Run the conversion tests and verify GREEN**

Run: `node --test tests/catalog-source.test.mjs`

Expected: 3 tests pass, 0 fail.

- [ ] **Step 5: Commit the conversion contract**

```bash
git add tests/catalog-source.test.mjs scripts/catalog-source.mjs
git commit -m "test: define catalog conversion contract"
```

### Task 2: Complete Catalog And Local Assets

**Files:**
- Create: `data/repository-overrides.json`
- Create: `scripts/sync-catalog.mjs`
- Create: `data/tools.json`
- Create: `assets/images/avatar.jpeg`
- Create: `assets/tools/*.webp`
- Create: `tests/catalog.test.mjs`

**Interfaces:**
- Consumes: `toCatalogEntry()` and `assetFilename()` from Task 1, the public source endpoint, and reviewed overrides.
- Produces: an array of exactly 156 `ToolRecord` objects at `data/tools.json` and one local image per record.

- [ ] **Step 1: Write the failing final-data integrity test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const tools = JSON.parse(await readFile(new URL('../data/tools.json', import.meta.url)));

test('catalog has 156 unique and complete GitHub-linked tools', async () => {
  assert.equal(tools.length, 156);
  assert.equal(new Set(tools.map(({ title }) => title)).size, 156);

  for (const tool of tools) {
    assert.ok(tool.title && tool.description);
    assert.ok(tool.categories.length > 0);
    assert.ok(Array.isArray(tool.tags));
    assert.ok(['official', 'search'].includes(tool.linkType));
    const url = new URL(tool.githubUrl);
    assert.equal(url.protocol, 'https:');
    assert.equal(url.hostname, 'github.com');
    await access(new URL(`../${tool.image}`, import.meta.url));
  }
});
```

- [ ] **Step 2: Run the integrity test and verify RED**

Run: `node --test tests/catalog.test.mjs`

Expected: FAIL because `data/tools.json` does not exist.

- [ ] **Step 3: Add reviewed repository overrides and the sync command**

`repository-overrides.json` is a title-to-URL object. Start with verified canonical mappings such as:

```json
{
  "Chai-1 (AlphaFold3)": "https://github.com/chaidiscovery/chai-lab",
  "Boltz-2 (AlphaFold3)": "https://github.com/jwohlwend/boltz",
  "Protenix (AlphaFold3)": "https://github.com/bytedance/Protenix",
  "AlphaFold2": "https://github.com/google-deepmind/alphafold",
  "ProteinMPNN": "https://github.com/dauparas/ProteinMPNN"
}
```

`sync-catalog.mjs` must:

```js
const services = await fetch('https://neurosnap.ai/api/services').then((r) => {
  if (!r.ok) throw new Error(`Catalog request failed: ${r.status}`);
  return r.json();
});
if (services.length !== 156) throw new Error(`Expected 156 services, got ${services.length}`);
```

It sorts nothing, preserving source display order; converts each record; writes formatted JSON; and downloads `/assets/services/${encodeURIComponent(title)}.webp` to the converted local filename. Failed downloads terminate the command rather than leaving partial data.

- [ ] **Step 4: Generate the catalog and copy the supplied avatar**

Run: `node scripts/sync-catalog.mjs`

Run: `cp /Users/jun/Pictures/Photos\ Library.photoslibrary/resources/derivatives/E/E891C08B-701A-4EB0-87DE-838F64BCF649_1_102_o.jpeg assets/images/avatar.jpeg`

Expected: `data/tools.json` contains 156 records and `assets/tools/` contains 156 WebP files.

- [ ] **Step 5: Run the integrity test and verify GREEN**

Run: `node --test tests/catalog.test.mjs`

Expected: 1 test passes, 0 fail.

- [ ] **Step 6: Inspect unresolved links and correct false negatives**

Run: `jq -r '.[] | select(.linkType == "search") | .title' data/tools.json`

For each entry with a clearly verifiable official repository, add the canonical URL to `repository-overrides.json`, regenerate, and rerun the integrity test. Keep proprietary and generic workflow entries as `search`.

- [ ] **Step 7: Commit the catalog and assets**

```bash
git add data scripts/sync-catalog.mjs assets/images/avatar.jpeg assets/tools tests/catalog.test.mjs
git commit -m "feat: add complete tools catalog"
```

### Task 3: Search And Filter Behavior

**Files:**
- Modify: `tests/catalog.test.mjs`
- Create: `assets/js/catalog.js`

**Interfaces:**
- Consumes: `ToolRecord[]` and `{ query, categories: Set<string>, tags: Set<string> }`.
- Produces: `normalizeSearchText(value): string`, `matchesTool(tool, state): boolean`, `filterTools(tools, state): ToolRecord[]`, and `collectFilters(tools): { categories: string[], tags: string[] }`.

- [ ] **Step 1: Add failing behavior tests**

```js
test('search matches descriptions and tags without case sensitivity', () => {
  const result = filterTools(fixtureTools, {
    query: 'AFFINITY', categories: new Set(), tags: new Set(),
  });
  assert.deepEqual(result.map(({ title }) => title), ['Binding Model']);
});

test('category OR and tag OR groups combine with AND', () => {
  const result = filterTools(fixtureTools, {
    query: '',
    categories: new Set(['Protein Design', 'Structure Prediction & Folding']),
    tags: new Set(['Antibodies', 'Peptides']),
  });
  assert.deepEqual(result.map(({ title }) => title), ['Binding Model', 'Fold Model']);
});

test('collectFilters returns unique locale-sorted labels', () => {
  assert.deepEqual(collectFilters(fixtureTools), {
    categories: ['Protein Design', 'Structure Prediction & Folding'],
    tags: ['Antibodies', 'Peptides', 'Proteins'],
  });
});
```

- [ ] **Step 2: Run the behavior tests and verify RED**

Run: `node --test tests/catalog.test.mjs`

Expected: FAIL because `assets/js/catalog.js` does not exist.

- [ ] **Step 3: Implement pure catalog behavior**

```js
export function normalizeSearchText(value) {
  return value.normalize('NFKD').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
}

export function matchesTool(tool, { query, categories, tags }) {
  const haystack = normalizeSearchText([
    tool.title, tool.description, ...tool.categories, ...tool.tags,
  ].join(' '));
  const queryMatch = !query || haystack.includes(normalizeSearchText(query));
  const categoryMatch = categories.size === 0 || tool.categories.some((x) => categories.has(x));
  const tagMatch = tags.size === 0 || tool.tags.some((x) => tags.has(x));
  return queryMatch && categoryMatch && tagMatch;
}

export function filterTools(tools, state) {
  return tools.filter((tool) => matchesTool(tool, state));
}
```

Implement `collectFilters()` with `Set` deduplication and `localeCompare` sorting.

- [ ] **Step 4: Run all Node tests and verify GREEN**

Run: `node --test tests/*.test.mjs`

Expected: all tests pass.

- [ ] **Step 5: Commit search and filtering**

```bash
git add assets/js/catalog.js tests/catalog.test.mjs
git commit -m "feat: add catalog search and filtering"
```

### Task 4: Tools Page And Real Browser Interaction

**Files:**
- Create: `tests/test_site.py`
- Create: `index.html`
- Create: `assets/js/app.js`
- Create: `assets/css/styles.css`

**Interfaces:**
- Consumes: `data/tools.json` and the pure functions from Task 3.
- Produces: a rendered, accessible Tools page with search, filter toggles, clear action, result count, cards, mobile menu, loading state, and error state.

- [ ] **Step 1: Write failing Playwright interactions**

Use `unittest`, start `python -m http.server` on an ephemeral port in `setUpClass`, and launch Chromium once. Assert real rendered behavior:

```python
def test_tools_render_and_search(self):
    self.page.goto(self.base_url)
    self.page.get_by_role("heading", name="Open-source tools for protein science").wait_for()
    self.assertEqual(self.page.locator("[data-tool-card]").count(), 156)
    self.page.get_by_role("searchbox", name="Search tools").fill("AlphaFold2")
    self.assertEqual(self.page.locator("[data-tool-card]").count(), 1)
    self.assertEqual(self.page.locator("[data-tool-card] h2").inner_text(), "AlphaFold2")

def test_filters_combine_and_clear(self):
    self.page.goto(self.base_url)
    self.page.get_by_role("button", name="Protein Design", exact=True).click()
    self.page.get_by_role("button", name="Antibodies", exact=True).click()
    visible = self.page.locator("[data-tool-card]").count()
    self.assertGreater(visible, 0)
    self.assertLess(visible, 156)
    self.page.get_by_role("button", name="Clear filters").click()
    self.assertEqual(self.page.locator("[data-tool-card]").count(), 156)

def test_cards_are_safe_github_links(self):
    self.page.goto(self.base_url)
    card = self.page.locator("[data-tool-card]").first
    self.assertTrue(card.get_attribute("href").startswith("https://github.com/"))
    self.assertEqual(card.get_attribute("target"), "_blank")
    self.assertIn("noopener", card.get_attribute("rel"))
```

- [ ] **Step 2: Run the browser tests and verify RED**

Run: `/Users/jun/anaconda3/bin/python -m unittest tests/test_site.py -v`

Expected: FAIL because `index.html` does not exist.

- [ ] **Step 3: Build semantic markup and catalog rendering**

`index.html` includes the brand link, six navigation links, a menu icon button, a labeled search field, category and tag field groups, result count, clear button, grid, loading state, no-results state, and a minimal footer.

`app.js` keeps one state object:

```js
const state = {
  query: '',
  categories: new Set(),
  tags: new Set(),
};
```

It renders buttons with `aria-pressed`, cards with local `<img loading="lazy">`, and a visually hidden `official repository` or `GitHub repository search` label. Fetch failures replace the loading state with a clear catalog-unavailable message.

- [ ] **Step 4: Implement the avatar-derived visual system**

Define stable tokens and geometry at the top of `styles.css`:

```css
:root {
  --navy-950: #050b20;
  --navy-900: #07152f;
  --ink: #10243e;
  --muted: #5b6d82;
  --ice: #75cfff;
  --orchid: #d58bdc;
  --surface: #f5f8fc;
  --line: #dbe5ef;
  --radius: 8px;
  --content: 1320px;
}
```

Keep cards at `border-radius: 8px`, card images at a fixed `aspect-ratio: 16 / 9`, icon buttons square, typography non-scaling, and text wrapping enabled. At `max-width: 760px`, show the menu button and collapse the navigation until expanded.

- [ ] **Step 5: Run browser and Node tests and verify GREEN**

Run: `/Users/jun/anaconda3/bin/python -m unittest tests/test_site.py -v`

Run: `node --test tests/*.test.mjs`

Expected: all tests pass with no browser console errors.

- [ ] **Step 6: Commit the Tools experience**

```bash
git add index.html assets/js/app.js assets/css/styles.css tests/test_site.py
git commit -m "feat: build responsive tools directory"
```

### Task 5: Placeholder Routes And Shared Navigation

**Files:**
- Modify: `tests/test_site.py`
- Create: `papers/index.html`
- Create: `molecules/index.html`
- Create: `structure-prediction/index.html`
- Create: `design/index.html`
- Create: `property/index.html`
- Create: `.nojekyll`

**Interfaces:**
- Consumes: the shared `assets/css/styles.css` navigation styles.
- Produces: five routable page shells with correct document titles, headings, relative asset paths, and active navigation state.

- [ ] **Step 1: Add a failing route table test**

```python
def test_placeholder_routes_have_only_the_requested_shell(self):
    routes = {
        "/papers/": "Papers",
        "/molecules/": "Molecules",
        "/structure-prediction/": "Structure Prediction",
        "/design/": "Design",
        "/property/": "Property",
    }
    for route, title in routes.items():
        with self.subTest(route=route):
            self.page.goto(self.base_url + route)
            self.assertEqual(self.page.get_by_role("heading", name=title).count(), 1)
            self.assertEqual(
                self.page.get_by_role("link", name=title, exact=True).get_attribute("aria-current"),
                "page",
            )
            self.assertEqual(self.page.locator("main > *").count(), 1)
```

- [ ] **Step 2: Run the route test and verify RED**

Run: `/Users/jun/anaconda3/bin/python -m unittest tests.test_site.SiteTests.test_placeholder_routes_have_only_the_requested_shell -v`

Expected: FAIL with HTTP 404 for `/papers/`.

- [ ] **Step 3: Add the five page shells and `.nojekyll`**

Each route uses the same header/footer, links `../assets/css/styles.css`, marks exactly one link with `aria-current="page"`, and contains exactly one main child:

```html
<section class="placeholder-page" aria-labelledby="page-title">
  <h1 id="page-title">Papers</h1>
</section>
```

- [ ] **Step 4: Run the full browser suite and verify GREEN**

Run: `/Users/jun/anaconda3/bin/python -m unittest tests/test_site.py -v`

Expected: all route and Tools tests pass.

- [ ] **Step 5: Commit the routes**

```bash
git add .nojekyll papers molecules structure-prediction design property tests/test_site.py
git commit -m "feat: add future content routes"
```

### Task 6: Responsive And Visual Quality Gate

**Files:**
- Modify: `tests/test_site.py`
- Modify: `assets/css/styles.css`
- Modify: `assets/js/app.js`
- Create: `README.md`

**Interfaces:**
- Consumes: the complete local site.
- Produces: verified desktop/mobile presentation, documented local checks, and no outstanding visual defects.

- [ ] **Step 1: Add failing overflow and mobile-menu tests**

```python
def test_phone_layout_has_no_horizontal_overflow_and_menu_works(self):
    self.page.set_viewport_size({"width": 390, "height": 844})
    self.page.goto(self.base_url)
    self.assertLessEqual(
        self.page.evaluate("document.documentElement.scrollWidth"),
        390,
    )
    navigation = self.page.get_by_role("navigation", name="Primary")
    self.assertFalse(navigation.is_visible())
    self.page.get_by_role("button", name="Open navigation").click()
    self.assertTrue(navigation.is_visible())
```

- [ ] **Step 2: Run the focused browser test and verify RED if any contract is missing**

Run: `/Users/jun/anaconda3/bin/python -m unittest tests.test_site.SiteTests.test_phone_layout_has_no_horizontal_overflow_and_menu_works -v`

Expected: FAIL until responsive navigation and overflow constraints satisfy the test.

- [ ] **Step 3: Correct responsive behavior and document usage**

Keep the mobile header single-row, make the open navigation a full-width band below it, wrap filter labels, bound all grid children with `min-width: 0`, and close the menu after a navigation link is selected. Document local preview and both test commands in `README.md`.

- [ ] **Step 4: Run full automated verification**

Run: `node --test tests/*.test.mjs`

Run: `/Users/jun/anaconda3/bin/python -m unittest tests/test_site.py -v`

Run: `git diff --check`

Expected: all tests pass, 0 failures, and no whitespace errors.

- [ ] **Step 5: Start the site and visually inspect three viewports**

Run: `python3 -m http.server 4173`

Inspect with Playwright/Codex browser at `1440x1000`, `1024x768`, and `390x844`. Capture screenshots and check the first viewport signal, card image loading, filter wrapping, menu state, long titles, footer position, and absence of overlap. Review browser console logs and correct every error.

- [ ] **Step 6: Commit final polish and documentation**

```bash
git add assets tests README.md
git commit -m "docs: add verification and preview guidance"
```

### Task 7: GitHub Publication

**Files:**
- No site files expected; modify only if live-site verification exposes a reproducible defect, with a failing test first.

**Interfaces:**
- Consumes: verified `main` branch.
- Produces: public `ai4proteins/ai4proteins.github.io` repository and live `https://ai4proteins.github.io/` site.

- [ ] **Step 1: Verify the release candidate from a clean status**

Run: `git status --short --branch`

Run: `node --test tests/*.test.mjs`

Run: `/Users/jun/anaconda3/bin/python -m unittest tests/test_site.py -v`

Expected: clean `main`; all tests pass.

- [ ] **Step 2: Create the public repository and attach the remote**

Create `ai4proteins/ai4proteins.github.io` as a public, empty repository in the authenticated GitHub account, then run:

```bash
git remote add origin https://github.com/ai4proteins/ai4proteins.github.io.git
git push -u origin main
```

- [ ] **Step 3: Verify the published site**

Open `https://ai4proteins.github.io/` and confirm the Tools heading, 156 rendered cards, local avatar and tool images, working search/filter interaction, and correct placeholder routes. Allow GitHub Pages' initial deployment window before treating an initial 404 as failure.

- [ ] **Step 4: Report publication evidence**

Record the repository URL, live site URL, final test counts, official-versus-search link counts, and any GitHub-side action still required.
