import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assetFilename,
  githubPreviewUrl,
  githubRepositoryParts,
  selectCatalogEntries,
  toCatalogEntry,
} from '../scripts/catalog-source.mjs';

const mappedService = {
  title: 'Chai-1 (AlphaFold3)',
  desc_short: 'Predict biomolecular structures.',
  categories: ['Structure Prediction & Folding'],
  tags: ['Co-Folding', 'Proteins'],
  beta: false,
};

const unmappedService = {
  title: 'Unreviewed Tool',
  desc_short: 'Not retained in the public catalog.',
  categories: ['Other'],
  tags: [],
  beta: true,
};

test('asset filenames are stable PNG names for punctuation-heavy titles', () => {
  assert.equal(assetFilename('PocketXMol | Dock'), 'pocketxmol-dock.png');
});

test('parses an HTTPS GitHub repository root', () => {
  assert.deepEqual(
    githubRepositoryParts('https://github.com/chaidiscovery/chai-lab'),
    { owner: 'chaidiscovery', repository: 'chai-lab' },
  );
});

test('rejects URLs that are not exact HTTPS GitHub repository roots', () => {
  for (const url of [
    'http://github.com/chaidiscovery/chai-lab',
    'https://example.com/chaidiscovery/chai-lab',
    'https://github.com/search?q=chai',
    'https://github.com/chaidiscovery/chai-lab/issues',
    'https://github.com/chaidiscovery/chai-lab?tab=readme',
    'https://github.com/chaidiscovery/chai-lab#readme',
    'https://github.com/chaidiscovery',
  ]) {
    assert.throws(() => githubRepositoryParts(url), url);
  }
});

test('builds the deterministic GitHub Open Graph preview URL', () => {
  assert.equal(
    githubPreviewUrl('https://github.com/chaidiscovery/chai-lab'),
    'https://opengraph.githubassets.com/ai4proteins/chaidiscovery/chai-lab',
  );
});

test('catalog conversion preserves visible content and uses an official repository', () => {
  assert.deepEqual(
    toCatalogEntry(mappedService, 'https://github.com/chaidiscovery/chai-lab'),
    {
      title: 'Chai-1 (AlphaFold3)',
      description: 'Predict biomolecular structures.',
      categories: ['Structure Prediction & Folding'],
      tags: ['Co-Folding', 'Proteins'],
      beta: false,
      image: 'assets/tools/chai-1-alphafold3.png',
      githubUrl: 'https://github.com/chaidiscovery/chai-lab',
      linkType: 'official',
    },
  );
});

test('selects only mapped services while preserving source order', () => {
  const selected = selectCatalogEntries([mappedService, unmappedService], {
    [mappedService.title]: 'https://github.com/chaidiscovery/chai-lab',
  });

  assert.deepEqual(selected.map(({ title }) => title), [mappedService.title]);
});
