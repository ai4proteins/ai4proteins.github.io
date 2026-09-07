import test from 'node:test';
import assert from 'node:assert/strict';
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  replaceOutputs,
  withStageCleanup,
} from '../scripts/catalog-output.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'catalog-output-test-'));
  t.after(() => rm(root, { force: true, recursive: true }));

  const stagePath = join(root, 'stage');
  const livePath = join(root, 'live');
  const sourceTools = join(stagePath, 'tools.json');
  const sourceImages = join(stagePath, 'tools');
  const targetTools = join(livePath, 'tools.json');
  const targetImages = join(livePath, 'tools');
  const backupTools = join(stagePath, 'previous-tools.json');
  const backupImages = join(stagePath, 'previous-tool-images');

  await mkdir(sourceImages, { recursive: true });
  await mkdir(targetImages, { recursive: true });
  await writeFile(sourceTools, 'new catalog');
  await writeFile(join(sourceImages, 'preview.png'), 'new image');
  await writeFile(targetTools, 'old catalog');
  await writeFile(join(targetImages, 'preview.png'), 'old image');

  return {
    stagePath,
    sourceImages,
    targetImages,
    backupTools,
    outputs: [
      { source: sourceTools, target: targetTools, backup: backupTools },
      { source: sourceImages, target: targetImages, backup: backupImages },
    ],
  };
}

function installationFailure(sourceImages, targetImages, restoreFailure) {
  return async (source, target) => {
    if (source === sourceImages && target === targetImages) {
      throw new Error('simulated image installation failure');
    }
    if (restoreFailure?.source === source && restoreFailure.target === target) {
      throw new Error('simulated catalog restoration failure');
    }
    await rename(source, target);
  };
}

async function assertMissing(path) {
  await assert.rejects(access(path), (error) => error.code === 'ENOENT');
}

test('ordinary installation failure restores both original outputs and cleans staging', async (t) => {
  const state = await fixture(t);

  await assert.rejects(
    withStageCleanup(state.stagePath, () => replaceOutputs(state.outputs, {
      rename: installationFailure(state.sourceImages, state.targetImages),
    })),
    /simulated image installation failure/,
  );

  assert.equal(await readFile(state.outputs[0].target, 'utf8'), 'old catalog');
  assert.equal(await readFile(join(state.outputs[1].target, 'preview.png'), 'utf8'), 'old image');
  await assertMissing(state.stagePath);
});

test('failed restoration retains and reports the surviving recovery copy', async (t) => {
  const state = await fixture(t);
  const restoreFailure = {
    source: state.backupTools,
    target: state.outputs[0].target,
  };

  await assert.rejects(
    withStageCleanup(state.stagePath, () => replaceOutputs(state.outputs, {
      rename: installationFailure(state.sourceImages, state.targetImages, restoreFailure),
    })),
    (error) => {
      assert.deepEqual(error.recoveryPaths, [state.backupTools]);
      assert.match(error.message, new RegExp(state.backupTools.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      return true;
    },
  );

  assert.equal(await readFile(state.backupTools, 'utf8'), 'old catalog');
  assert.equal(await readFile(join(state.outputs[1].target, 'preview.png'), 'utf8'), 'old image');
  await assertMissing(state.outputs[0].target);
  await access(state.stagePath);
});

test('successful replacement installs both new outputs and cleans staging', async (t) => {
  const state = await fixture(t);

  await withStageCleanup(state.stagePath, () => replaceOutputs(state.outputs));

  assert.equal(await readFile(state.outputs[0].target, 'utf8'), 'new catalog');
  assert.equal(await readFile(join(state.outputs[1].target, 'preview.png'), 'utf8'), 'new image');
  await assertMissing(state.stagePath);
});
