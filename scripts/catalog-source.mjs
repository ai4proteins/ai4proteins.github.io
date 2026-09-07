export function assetFilename(title) {
  return `${title.toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}.png`;
}

export function githubRepositoryParts(repositoryUrl) {
  const url = new URL(repositoryUrl);
  const pathSegments = url.pathname.split('/');
  const owner = pathSegments[1];
  const repository = pathSegments[2];
  const validOwner = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i;
  const validRepository = /^[a-z0-9._-]+$/i;

  if (url.origin !== 'https://github.com'
    || url.username !== ''
    || url.password !== ''
    || url.search !== ''
    || url.hash !== ''
    || pathSegments.length !== 3
    || !validOwner.test(owner ?? '')
    || !validRepository.test(repository ?? '')) {
    throw new TypeError(`Expected an HTTPS GitHub repository root: ${repositoryUrl}`);
  }

  return { owner, repository };
}

export function githubPreviewUrl(repositoryUrl) {
  const { owner, repository } = githubRepositoryParts(repositoryUrl);
  return `https://opengraph.githubassets.com/ai4proteins/${owner}/${repository}`;
}

export function toCatalogEntry(service, repositoryUrl) {
  githubRepositoryParts(repositoryUrl);
  return {
    title: service.title,
    description: service.desc_short,
    categories: [...service.categories],
    tags: [...service.tags],
    beta: Boolean(service.beta),
    image: `assets/tools/${assetFilename(service.title)}`,
    githubUrl: repositoryUrl,
    linkType: 'official',
  };
}

export function selectCatalogEntries(services, overrides) {
  return services
    .filter(({ title }) => Object.hasOwn(overrides, title))
    .map((service) => toCatalogEntry(service, overrides[service.title]));
}
