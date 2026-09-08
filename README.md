# AI4Protein

A static catalog of 130 reviewed open-source tools for protein science. Search and combine category and tag filters on the Tools page. Papers, Molecules, Structure Prediction, Design, and Property currently contain page headings only.

## Local preview

From the repository root, start an HTTP server with Python 3:

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

Open <http://127.0.0.1:4173/>. Use another port if 4173 is occupied. An HTTP server is required for JavaScript modules and the catalog request; opening `index.html` directly is insufficient. There is no build step or production package installation.

## Verification

Use Node.js 24 and Python 3.12 with Playwright and its Chromium browser installed. For a new test environment:

```sh
python3 -m pip install playwright
python3 -m playwright install chromium
```

Run from the repository root:

```sh
node --test tests/*.test.mjs
python3 -B -m unittest tests/test_site.py -v
git diff --check
```

The browser suite starts and stops its own local server.

**Development-machine note:** The original development machine uses `/Users/jun/anaconda3/bin/python` as its Python interpreter.

Catalog records are generated from reviewed repository overrides. Every catalog link is a direct HTTPS GitHub repository root (`https://github.com/<owner>/<repository>`), and each card uses its local `assets/tools/*.png` GitHub preview at 1200x600. No GitHub search links or WebP previews are published.

To refresh the catalog and previews, run:

```sh
node scripts/sync-catalog.mjs
```

The sync fetches the source catalog and GitHub previews without credentials, validates every 1200x600 PNG, then replaces `data/tools.json` and `assets/tools/` together only after all outputs succeed. Preview requests start at least 750 ms apart to stay below GitHub's observed rate window; HTTP 429, 500, 502, 503, and 504 responses retry with bounded waits.

Before publication, run the verification commands above and inspect 1440x1000, 1024x768, and 390x844 browser viewports. Check loaded 2:1 images, wrapped titles and filters, keyboard focus, navigation open/close behavior, and absence of horizontal overflow. Confirm all five placeholder routes contain only `main > section > h1` in their main content and that the mobile menu also works on a placeholder page. The browser console should have no unexpected errors.

## GitHub Pages

Publish the repository as `ai4proteins/ai4proteins.github.io`. In repository Settings > Pages, select **Deploy from a branch**, branch **main**, and folder **/(root)**. Keep `.nojekyll` at the repository root; no build workflow is needed.

After pushing the verified site to `main`, wait for the Pages deployment and check <https://ai4proteins.github.io/> plus each navigation route. Confirm 130 tools render, search and filters work, every card opens its direct GitHub repository, and the local 1200x600 PNG previews load on the published site.

Catalog entries live in `data/tools.json`, local PNG previews in `assets/tools/`, and the shared layout and behavior in `assets/css/styles.css` and `assets/js/app.js`. All retained repository links are marked as official.
