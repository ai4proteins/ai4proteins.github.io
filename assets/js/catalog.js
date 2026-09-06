export function normalizeSearchText(value) {
  return value.normalize('NFKD').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
}

export function matchesTool(tool, { query, categories, tags }) {
  const haystack = normalizeSearchText([
    tool.title, tool.description, ...tool.categories, ...tool.tags,
  ].join(' '));
  const queryMatch = !query || haystack.includes(normalizeSearchText(query));
  const categoryMatch = categories.size === 0 || tool.categories.some((x) => categories.has(x));
  const tagMatch = tags.size === 0 || tool.tags.some((x) => tags.has(x));
  return queryMatch && categoryMatch && tagMatch;
}

export function filterTools(tools, state) {
  return tools.filter((tool) => matchesTool(tool, state));
}

export function collectFilters(tools) {
  const categories = new Set();
  const tags = new Set();
  for (const tool of tools) {
    tool.categories.forEach((category) => categories.add(category));
    tool.tags.forEach((tag) => tags.add(tag));
  }
  return {
    categories: [...categories].sort((a, b) => a.localeCompare(b)),
    tags: [...tags].sort((a, b) => a.localeCompare(b)),
  };
}
