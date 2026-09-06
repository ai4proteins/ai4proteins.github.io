# AI4Protein

A static catalog of 156 open-source tools for protein science. Search and combine category and tag filters on the Tools page. Papers, Molecules, Structure Prediction, Design, and Property currently contain page headings only.

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

The browser suite starts and stops its own local server. On the original development machine, the Python interpreter is `/Users/jun/anaconda3/bin/python`.

Before publication, inspect 1440x1000, 1024x768, and 390x844 browser viewports. Check loaded images, wrapped titles and filters, keyboard focus, navigation open/close behavior, and absence of horizontal overflow. Confirm all five placeholder routes contain only `main > section > h1` in their main content and that the mobile menu also works on a placeholder page. The browser console should have no unexpected errors.

## GitHub Pages

Publish the repository as `ai4proteins/ai4proteins.github.io`. In repository Settings > Pages, select **Deploy from a branch**, branch **main**, and folder **/(root)**. Keep `.nojekyll` at the repository root; no build workflow is needed.

After pushing the verified site to `main`, wait for the Pages deployment and check <https://ai4proteins.github.io/> plus each navigation route. Confirm 156 tools render, search and filters work, and images load on the published site.

Catalog entries live in `data/tools.json`, local thumbnails in `assets/tools/`, and the shared layout and behavior in `assets/css/styles.css` and `assets/js/app.js`. Repository links are marked in the catalog as official or GitHub repository searches.
