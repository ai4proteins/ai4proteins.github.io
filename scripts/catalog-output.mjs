import {
  mkdir as makeDirectory,
  rename as renamePath,
  rm as removePath,
} from 'node:fs/promises';
import { dirname } from 'node:path';

export async function replaceOutputs(outputs, {
  mkdir = makeDirectory,
  rename = renamePath,
  rm = removePath,
} = {}) {
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
  } catch (installationError) {
    const removalResults = await Promise.allSettled(installed.map(
      ({ target }) => rm(target, { force: true, recursive: true }),
    ));
    const restorationResults = await Promise.allSettled(backups.map(
      ({ backup, target }) => rename(backup, target),
    ));
    const recoveryPaths = backups
      .filter((_output, index) => restorationResults[index].status === 'rejected')
      .map(({ backup }) => backup);

    if (recoveryPaths.length > 0) {
      const rollbackErrors = [
        installationError,
        ...removalResults.filter(({ status }) => status === 'rejected').map(({ reason }) => reason),
        ...restorationResults.filter(({ status }) => status === 'rejected').map(({ reason }) => reason),
      ];
      const error = new AggregateError(
        rollbackErrors,
        `Output rollback was incomplete; recovery copies retained at: ${recoveryPaths.join(', ')}`,
        { cause: installationError },
      );
      error.recoveryPaths = recoveryPaths;
      throw error;
    }

    throw installationError;
  }

  await Promise.all(backups.map(
    ({ backup }) => rm(backup, { force: true, recursive: true }),
  ));
}

export async function withStageCleanup(stagePath, operation, {
  rm = removePath,
} = {}) {
  let preserveRecoveryCopies = false;
  try {
    return await operation();
  } catch (error) {
    preserveRecoveryCopies = Array.isArray(error.recoveryPaths)
      && error.recoveryPaths.length > 0;
    throw error;
  } finally {
    if (!preserveRecoveryCopies) {
      await rm(stagePath, { force: true, recursive: true });
    }
  }
}
