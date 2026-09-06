import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isWebp } from './catalog-image.mjs';
import { assetFilename, toCatalogEntry } from './catalog-source.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const overridesPath = join(root, 'data', 'repository-overrides.json');
const toolsPath = join(root, 'data', 'tools.json');
const toolImagesPath = join(root, 'assets', 'tools');
const stagePath = await mkdtemp(join(root, '.catalog-stage-'));

async function replaceOutputs(outputs) {
  const backups = [];
  const installed = [];

  try {
    for (const output of outputs) {
      await mkdir(dirname(output.target), { recursive: true });
      try {
        await rename(output.target, output.backup);
        backups.push(output);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }

    for (const output of outputs) {
      await rename(output.source, output.target);
      installed.push(output);
    }
  } catch (error) {
    await Promise.all(installed.map(({ target }) => rm(target, { force: true, recursive: true })));
    await Promise.all(backups.map(({ backup, target }) => rename(backup, target)));
    throw error;
  }

  await Promise.all(backups.map(({ backup }) => rm(backup, { force: true, recursive: true })));
}

try {
  const overrides = JSON.parse(await readFile(overridesPath, 'utf8'));
  const services = await fetch('https://neurosnap.ai/api/services').then((response) => {
    if (!response.ok) throw new Error(`Catalog request failed: ${response.status}`);
    return response.json();
  });
  if (services.length !== 156) throw new Error(`Expected 156 services, got ${services.length}`);

  const tools = services.map((service) => toCatalogEntry(service, overrides[service.title]));
  const imageFilenames = tools.map(({ title }) => assetFilename(title));
  if (new Set(imageFilenames).size !== tools.length) {
    throw new Error('Catalog titles produce duplicate image filenames');
  }

  const stagedToolsPath = join(stagePath, 'tools.json');
  const stagedImagesPath = join(stagePath, 'tools');
  await mkdir(stagedImagesPath);
  await writeFile(stagedToolsPath, `${JSON.stringify(tools, null, 2)}\n`);

  const downloads = await Promise.allSettled(tools.map(async (tool) => {
    const response = await fetch(
      `https://neurosnap.ai/assets/services/${encodeURIComponent(tool.title)}.webp`,
    );
    if (!response.ok) {
      throw new Error(`Image request failed for ${tool.title}: ${response.status}`);
    }
    const image = Buffer.from(await response.arrayBuffer());
    if (!isWebp(image)) {
      throw new Error(`Image request returned invalid WebP data for ${tool.title}`);
    }
    await writeFile(join(stagedImagesPath, assetFilename(tool.title)), image);
  }));
  const failedDownload = downloads.find(({ status }) => status === 'rejected');
  if (failedDownload) {
    throw failedDownload.reason;
  }

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
} finally {
  await rm(stagePath, { force: true, recursive: true });
}
