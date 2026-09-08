import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isGithubPreviewPng } from './catalog-image.mjs';
import { replaceOutputs, withStageCleanup } from './catalog-output.mjs';
import {
  assetFilename,
  githubRepositoryParts,
  selectCatalogEntries,
} from './catalog-source.mjs';
import { fetchBytes } from './fetch-bytes.mjs';
import { downloadRepositoryPreviews } from './github-preview.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const overridesPath = join(root, 'data', 'repository-overrides.json');
const toolsPath = join(root, 'data', 'tools.json');
const toolImagesPath = join(root, 'assets', 'tools');
const stagePath = await mkdtemp(join(root, '.catalog-stage-'));
const allowedOrigin = 'https://neurosnap.ai';
const requestTimeoutMs = 30_000;
const catalogMaxBytes = 2 * 1024 * 1024;

function repositoryKey(repositoryUrl) {
  const { owner, repository } = githubRepositoryParts(repositoryUrl);
  return `https://github.com/${owner.toLowerCase()}/${repository.toLowerCase()}`;
}

await withStageCleanup(stagePath, async () => {
  const overrides = JSON.parse(await readFile(overridesPath, 'utf8'));
  const catalogBytes = await fetchBytes('https://neurosnap.ai/api/services', {
    allowedOrigin,
    maxBytes: catalogMaxBytes,
    timeoutMs: requestTimeoutMs,
  });
  const services = JSON.parse(catalogBytes.toString('utf8'));
  if (!Array.isArray(services)) throw new TypeError('Expected the service catalog to be an array');

  const overrideTitles = Object.keys(overrides);
  if (overrideTitles.length !== 130) {
    throw new Error(`Expected 130 repository overrides, got ${overrideTitles.length}`);
  }
  const serviceTitles = new Set(services.map(({ title }) => title));
  const missingTitles = overrideTitles.filter((title) => !serviceTitles.has(title));
  if (missingTitles.length > 0) {
    throw new Error(`Mapped services are missing from the source catalog: ${missingTitles.join(', ')}`);
  }

  const tools = selectCatalogEntries(services, overrides);
  if (tools.length !== overrideTitles.length) {
    throw new Error(`Expected ${overrideTitles.length} mapped services, got ${tools.length}`);
  }
  const imageFilenames = tools.map(({ title }) => assetFilename(title));
  if (new Set(imageFilenames).size !== tools.length) {
    throw new Error('Catalog titles produce duplicate image filenames');
  }

  const stagedToolsPath = join(stagePath, 'tools.json');
  const stagedImagesPath = join(stagePath, 'tools');
  await mkdir(stagedImagesPath);
  await writeFile(stagedToolsPath, `${JSON.stringify(tools, null, 2)}\n`);

  const previews = await downloadRepositoryPreviews(tools);
  await Promise.all(tools.map(async (tool) => {
    const image = previews.get(repositoryKey(tool.githubUrl));
    if (!isGithubPreviewPng(image)) {
      throw new Error(`Missing valid GitHub preview PNG for ${tool.title}`);
    }
    await writeFile(join(stagedImagesPath, assetFilename(tool.title)), image);
  }));

  await replaceOutputs([
    {
      source: stagedToolsPath,
      target: toolsPath,
      backup: join(stagePath, 'previous-tools.json'),
    },
    {
      source: stagedImagesPath,
      target: toolImagesPath,
      backup: join(stagePath, 'previous-tool-images'),
    },
  ]);
});
