import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { assetFilename, githubRepositoryParts } from '../scripts/catalog-source.mjs';
import { isGithubPreviewPng } from '../scripts/catalog-image.mjs';
import { collectFilters, filterTools } from '../assets/js/catalog.js';

const tools = JSON.parse(await readFile(new URL('../data/tools.json', import.meta.url)));
const repositoryOverrides = JSON.parse(
  await readFile(new URL('../data/repository-overrides.json', import.meta.url)),
);

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

test('catalog has exactly the 130 reviewed official tools', async () => {
  assert.equal(tools.length, 130);
  assert.deepEqual(
    new Set(tools.map(({ title }) => title)),
    new Set(Object.keys(repositoryOverrides)),
  );
  assert.equal(new Set(tools.map(({ image }) => image)).size, 130);
  assert.ok(tools.every(({ linkType }) => linkType === 'official'));
  assert.ok(tools.every(({ image }) => image.endsWith('.png')));

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
    assert.equal(typeof tool.githubUrl, 'string');
    assert.doesNotThrow(() => githubRepositoryParts(tool.githubUrl));
  }
});

test('tool image directory exactly matches the referenced valid PNG assets', async () => {
  const expectedImages = new Set(tools.map(({ image }) => image.replace('assets/tools/', '')));
  const imageFiles = await readdir(new URL('../assets/tools/', import.meta.url));

  assert.equal(imageFiles.some((filename) => filename.endsWith('.webp')), false);
  assert.deepEqual(new Set(imageFiles), expectedImages);

  for (const filename of imageFiles) {
    const image = await readFile(new URL(`../assets/tools/${filename}`, import.meta.url));
    assert.ok(isGithubPreviewPng(image), `${filename} is not a valid GitHub preview PNG`);
  }
});

test('confirmed repository review findings stay corrected in source and generated catalog', () => {
  const expected = {
    AfCycDesign: {
      override: 'https://github.com/sokrypton/ColabDesign',
      githubUrl: 'https://github.com/sokrypton/ColabDesign',
      linkType: 'official',
    },
    'EnzBert E.C. Prediction': {
      override: undefined,
      retained: false,
    },
    'AutoDock Vina (smina)': {
      override: undefined,
      retained: false,
    },
  };

  for (const [title, values] of Object.entries(expected)) {
    assert.equal(repositoryOverrides[title], values.override, `${title} source override`);
    const tool = tools.find((entry) => entry.title === title);
    if (values.retained === false) {
      assert.equal(tool, undefined, `${title} is omitted from generated catalog`);
    } else {
      assert.ok(tool, `${title} exists in generated catalog`);
      assert.equal(tool.githubUrl, values.githubUrl, `${title} generated URL`);
      assert.equal(tool.linkType, values.linkType, `${title} generated classification`);
    }
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
