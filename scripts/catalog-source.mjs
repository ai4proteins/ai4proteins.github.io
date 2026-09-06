export function githubSearchUrl(title) {
  const query = new URLSearchParams({ q: title, type: 'repositories' });
  return `https://github.com/search?${query.toString()}`;
}

export function assetFilename(title) {
  return `${title.toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}.webp`;
}

export function toCatalogEntry(service, officialUrl) {
  return {
    title: service.title,
    description: service.desc_short,
    categories: [...service.categories],
    tags: [...service.tags],
    beta: Boolean(service.beta),
    image: `assets/tools/${assetFilename(service.title)}`,
    githubUrl: officialUrl ?? githubSearchUrl(service.title),
    linkType: officialUrl ? 'official' : 'search',
  };
}
