import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const tools = JSON.parse(await readFile(new URL('../data/tools.json', import.meta.url)));

test('catalog has 156 unique and complete GitHub-linked tools', async () => {
  assert.equal(tools.length, 156);
  assert.equal(new Set(tools.map(({ title }) => title)).size, 156);

  for (const tool of tools) {
    assert.ok(tool.title && tool.description);
    assert.ok(tool.categories.length > 0);
    assert.ok(Array.isArray(tool.tags));
    assert.ok(['official', 'search'].includes(tool.linkType));
    const url = new URL(tool.githubUrl);
    assert.equal(url.protocol, 'https:');
    assert.equal(url.hostname, 'github.com');
    await access(new URL(`../${tool.image}`, import.meta.url));
  }
});
