import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { assetFilename } from '../scripts/catalog-source.mjs';
import { isWebp } from '../scripts/catalog-image.mjs';
import { collectFilters, filterTools } from '../assets/js/catalog.js';

const tools = JSON.parse(await readFile(new URL('../data/tools.json', import.meta.url)));

const fixtureTools = [
  {
    title: 'Binding Model',
    description: 'Predicts binding AFFINITY for proteins.',
    categories: ['Protein Design'],
    tags: ['Antibodies'],
  },
  {
    title: 'Fold Model',
    description: 'Structure prediction for protein folds.',
    categories: ['Structure Prediction & Folding'],
    tags: ['Peptides'],
  },
  {
    title: 'Sequence Model',
    description: 'Analyzes protein sequences.',
    categories: ['Protein Design'],
    tags: ['Proteins'],
  },
];

test('catalog has 156 unique and complete GitHub-linked tools', async () => {
  assert.equal(tools.length, 156);
  assert.equal(new Set(tools.map(({ title }) => title)).size, 156);
  assert.equal(new Set(tools.map(({ image }) => image)).size, 156);

  const expectedFields = [
    'beta',
    'categories',
    'description',
    'githubUrl',
    'image',
    'linkType',
    'tags',
    'title',
  ];
  const expectedImages = new Set(tools.map(({ image }) => image.replace('assets/tools/', '')));
  const imageFiles = (await readdir(new URL('../assets/tools/', import.meta.url)))
    .filter((filename) => filename.endsWith('.webp'));
  assert.equal(imageFiles.length, 156);
  assert.deepEqual(new Set(imageFiles), expectedImages);

  for (const tool of tools) {
    assert.deepEqual(Object.keys(tool).sort(), expectedFields);
    assert.equal(typeof tool.title, 'string');
    assert.ok(tool.title.length > 0);
    assert.equal(typeof tool.description, 'string');
    assert.ok(tool.description.length > 0);
    assert.ok(Array.isArray(tool.categories));
    assert.ok(tool.categories.length > 0);
    assert.ok(tool.categories.every((category) => typeof category === 'string' && category.length > 0));
    assert.ok(Array.isArray(tool.tags));
    assert.ok(tool.tags.every((tag) => typeof tag === 'string'));
    assert.equal(typeof tool.beta, 'boolean');
    assert.equal(tool.image, `assets/tools/${assetFilename(tool.title)}`);
    assert.ok(['official', 'search'].includes(tool.linkType));
    assert.equal(typeof tool.githubUrl, 'string');
    const url = new URL(tool.githubUrl);
    assert.equal(url.protocol, 'https:');
    assert.equal(url.hostname, 'github.com');
    const image = await readFile(new URL(`../${tool.image}`, import.meta.url));
    assert.ok(isWebp(image), `${tool.image} is not a valid WebP payload`);
  }
});

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
