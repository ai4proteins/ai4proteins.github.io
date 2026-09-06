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
