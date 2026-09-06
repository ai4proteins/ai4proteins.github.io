import { collectFilters, filterTools } from './catalog.js';

const menuButton = document.querySelector('.menu-button');
const navigation = document.querySelector('.primary-navigation');
const mobileViewport = window.matchMedia('(max-width: 760px)');

function closeNavigation() {
  menuButton?.setAttribute('aria-expanded', 'false');
  navigation?.classList.remove('is-open');
}

menuButton?.addEventListener('click', () => {
  const expanded = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(expanded));
  navigation.classList.toggle('is-open', expanded);
});
navigation?.addEventListener('click', (event) => {
  if (event.target.closest('a')) closeNavigation();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menuButton?.getAttribute('aria-expanded') === 'true') {
    closeNavigation();
    menuButton.focus();
  }
});
mobileViewport.addEventListener('change', closeNavigation);

const grid = document.querySelector('#tool-grid');
if (grid) initializeCatalog();

async function initializeCatalog() {
  const state = { query: '', categories: new Set(), tags: new Set() };
  const search = document.querySelector('#tool-search');
  const clearSearch = document.querySelector('#clear-search');
  const clearFilters = document.querySelector('#clear-filters');
  const status = document.querySelector('#catalog-status');
  const noResults = document.querySelector('#no-results');
  const error = document.querySelector('#catalog-error');
  const results = document.querySelector('.catalog-results');
  const categoryDetails = document.querySelector('#category-filters');
  const tagCount = document.querySelector('#tag-selection-count');
  categoryDetails.open = !mobileViewport.matches;
  let tools = [];

  function render() {
    const visible = filterTools(tools, state);
    grid.replaceChildren(...visible.map(createCard));
    status.textContent = `${visible.length} ${visible.length === 1 ? 'tool' : 'tools'}`;
    noResults.hidden = visible.length !== 0;
    clearSearch.hidden = !state.query;
    clearFilters.hidden = !state.query && !state.categories.size && !state.tags.size;
    tagCount.textContent = state.tags.size ? `(${state.tags.size})` : '';
    document.querySelectorAll('[data-filter-group]').forEach((button) => {
      button.setAttribute('aria-pressed', String(state[button.dataset.filterGroup].has(button.value)));
    });
  }

  function renderFilters(values, group, container) {
    const buttons = values.map((value) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'filter-button';
      button.value = value;
      button.textContent = value;
      button.dataset.filterGroup = group;
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => {
        if (state[group].has(value)) state[group].delete(value);
        else state[group].add(value);
        render();
      });
      return button;
    });
    container.replaceChildren(...buttons);
  }

  search.addEventListener('input', () => {
    state.query = search.value;
    render();
  });
  clearSearch.addEventListener('click', () => {
    state.query = search.value = '';
    render();
    search.focus();
  });
  clearFilters.addEventListener('click', () => {
    state.query = search.value = '';
    state.categories.clear();
    state.tags.clear();
    render();
    search.focus();
  });

  try {
    const response = await fetch('data/tools.json');
    if (!response.ok) throw new Error('Catalog request failed');
    tools = await response.json();
    const filters = collectFilters(tools);
    renderFilters(filters.categories, 'categories', document.querySelector('#category-options'));
    renderFilters(filters.tags, 'tags', document.querySelector('#tag-options'));
    render();
    search.disabled = false;
    document.querySelectorAll('.catalog-filters fieldset').forEach((fieldset) => {
      fieldset.disabled = false;
    });
  } catch {
    grid.replaceChildren();
    noResults.hidden = true;
    status.textContent = '';
    error.hidden = false;
  } finally {
    results.setAttribute('aria-busy', 'false');
  }
}

function createCard(tool) {
  const card = document.createElement('a');
  card.className = 'tool-card';
  card.dataset.toolCard = '';
  card.href = tool.githubUrl;
  card.target = '_blank';
  card.rel = 'noopener noreferrer';

  const image = document.createElement('img');
  image.src = tool.image;
  image.alt = '';
  image.loading = 'lazy';
  image.width = 640;
  image.height = 360;
  card.append(image);

  const body = document.createElement('div');
  body.className = 'tool-card-body';
  const heading = document.createElement('h2');
  heading.textContent = tool.title;
  const external = document.createElement('span');
  external.className = 'external-icon';
  external.textContent = '\u2197';
  external.setAttribute('aria-hidden', 'true');
  const titleRow = document.createElement('div');
  titleRow.className = 'card-title';
  titleRow.append(heading, external);
  const description = document.createElement('p');
  description.className = 'tool-description';
  description.textContent = tool.description;
  const categories = document.createElement('div');
  categories.className = 'card-categories';
  for (const category of tool.categories) {
    const label = document.createElement('span');
    label.textContent = category;
    categories.append(label);
  }
  if (tool.beta) {
    const beta = document.createElement('span');
    beta.className = 'beta-label';
    beta.textContent = 'Beta';
    categories.append(beta);
  }
  const repositoryLabel = document.createElement('span');
  repositoryLabel.className = 'visually-hidden';
  repositoryLabel.textContent = tool.linkType === 'official' ? 'official repository' : 'GitHub repository search';
  body.append(titleRow, description, categories, repositoryLabel);
  card.append(body);
  return card;
}
