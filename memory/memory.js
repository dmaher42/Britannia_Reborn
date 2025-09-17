import { TagManager, normalizeTag, formatTag, presetTags } from './tag-manager.js';
import { createTagInput } from './tag-input.js';

const STORAGE_KEYS = {
  items: 'memoryCueItems',
  filters: 'memoryCueFilters',
};

const SECTION_CONFIG = {
  reminders: {
    formId: 'reminderForm',
    tagInputId: 'reminderTagInput',
    listId: 'remindersList',
    filterRegionId: 'remindersFilterRegion',
    activeFiltersId: 'remindersActiveFilters',
    empty: {
      title: 'No reminders yet',
      subtitle: 'Add upcoming tasks or communications to stay organised.',
    },
  },
  lessons: {
    formId: 'lessonForm',
    tagInputId: 'lessonTagInput',
    listId: 'lessonsList',
    filterRegionId: 'lessonsFilterRegion',
    activeFiltersId: 'lessonsActiveFilters',
    empty: {
      title: 'No lesson plans saved',
      subtitle: 'Capture your next activity and tag it for fast retrieval.',
    },
  },
  notes: {
    formId: 'noteForm',
    tagInputId: 'noteTagInput',
    listId: 'notesList',
    filterRegionId: 'notesFilterRegion',
    activeFiltersId: 'notesActiveFilters',
    empty: {
      title: 'Quick notes will appear here',
      subtitle: 'Jot down ideas, wins, or follow-ups and tag them for context.',
    },
  },
};

const tagManager = new TagManager();
const tagInputs = {};
const itemsState = loadItems();
const filtersState = loadFilters();

bootstrap();

function bootstrap() {
  tagManager.registerTags(presetTags);
  Object.values(itemsState).forEach((items) => {
    items.forEach((item) => tagManager.registerTags(item.tags));
  });
  setupForms();
  renderAll();
  renderDashboard();
  updatePreferencesSnapshot();
}

function loadItems() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return getDefaultState();
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.items);
    if (!raw) {
      return getDefaultState();
    }
    const parsed = JSON.parse(raw);
    return {
      reminders: Array.isArray(parsed?.reminders) ? parsed.reminders : [],
      lessons: Array.isArray(parsed?.lessons) ? parsed.lessons : [],
      notes: Array.isArray(parsed?.notes) ? parsed.notes : [],
    };
  } catch (error) {
    console.warn('[Memory Cue] Failed to load saved items', error);
    return getDefaultState();
  }
}

function saveItems() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEYS.items, JSON.stringify(itemsState));
  } catch (error) {
    console.warn('[Memory Cue] Failed to save items', error);
  }
}

function loadFilters() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { reminders: [], lessons: [], notes: [] };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.filters);
    if (!raw) {
      return { reminders: [], lessons: [], notes: [] };
    }
    const parsed = JSON.parse(raw);
    return {
      reminders: Array.isArray(parsed?.reminders) ? parsed.reminders.map(normalizeTag) : [],
      lessons: Array.isArray(parsed?.lessons) ? parsed.lessons.map(normalizeTag) : [],
      notes: Array.isArray(parsed?.notes) ? parsed.notes.map(normalizeTag) : [],
    };
  } catch (error) {
    console.warn('[Memory Cue] Failed to load filters', error);
    return { reminders: [], lessons: [], notes: [] };
  }
}

function saveFilters() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEYS.filters, JSON.stringify(filtersState));
  } catch (error) {
    console.warn('[Memory Cue] Failed to save filters', error);
  }
}

function getDefaultState() {
  const now = new Date();
  const iso = (date) => date.toISOString();
  return {
    reminders: [
      {
        id: 'rem-1',
        title: 'Grade math quiz',
        dueDate: iso(new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)),
        details: 'Return graded quizzes to students and flag reteach topics.',
        tags: ['math', 'grade-3', 'urgent'],
        createdAt: iso(new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)),
      },
      {
        id: 'rem-2',
        title: 'Send parent meeting notes',
        dueDate: iso(new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000)),
        details: 'Share action plan and next steps with guardians.',
        tags: ['parent-meeting'],
        createdAt: iso(new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000)),
      },
    ],
    lessons: [
      {
        id: 'lesson-1',
        title: 'Hands-on fractions lab',
        grade: 'Grade 3',
        overview: 'Stations with manipulatives to build fraction fluency.',
        tags: ['math', 'grade-3'],
        createdAt: iso(new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000)),
      },
      {
        id: 'lesson-2',
        title: 'Weather patterns investigation',
        grade: 'Grade 4',
        overview: 'Students analyse weather data and craft forecasts.',
        tags: ['science'],
        createdAt: iso(new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)),
      },
    ],
    notes: [
      {
        id: 'note-1',
        title: 'Parent meeting recap — Jordan',
        content: 'Discussed reading supports and scheduled follow-up call next week.',
        tags: ['parent-meeting', 'urgent'],
        createdAt: iso(new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000)),
      },
      {
        id: 'note-2',
        title: 'STEM night idea',
        content: 'Invite local engineers to run demo tables for families.',
        tags: ['science'],
        createdAt: iso(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)),
      },
    ],
  };
}

function setupForms() {
  Object.entries(SECTION_CONFIG).forEach(([section, config]) => {
    const form = document.getElementById(config.formId);
    const tagSlot = document.getElementById(config.tagInputId);
    if (!form || !tagSlot) return;
    const tagInput = createTagInput(tagSlot, {
      manager: tagManager,
      placeholder: 'Type a tag and press enter',
      onChange: () => updatePreferencesSnapshot(),
    });
    tagInputs[section] = tagInput;

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const tags = tagInput.getTags();
      const payload = collectFormData(section, formData, tags);
      if (!payload) {
        return;
      }
      itemsState[section].unshift(payload);
      tagManager.registerTags(payload.tags);
      saveItems();
      form.reset();
      tagInput.clear();
      renderSection(section);
      renderDashboard();
      updatePreferencesSnapshot();
    });
  });
}

function collectFormData(section, formData, tags) {
  const base = {
    id: `${section}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tags: tags.map(normalizeTag).filter(Boolean),
    createdAt: new Date().toISOString(),
  };

  if (!base.tags.length) {
    // ensure we keep tags array consistent even if empty
    base.tags = [];
  }

  if (section === 'reminders') {
    const title = String(formData.get('title') || '').trim();
    if (!title) return null;
    return {
      ...base,
      title,
      dueDate: formData.get('dueDate') || null,
      details: String(formData.get('details') || '').trim(),
    };
  }
  if (section === 'lessons') {
    const title = String(formData.get('title') || '').trim();
    if (!title) return null;
    return {
      ...base,
      title,
      grade: String(formData.get('grade') || '').trim(),
      overview: String(formData.get('overview') || '').trim(),
    };
  }
  if (section === 'notes') {
    const title = String(formData.get('title') || '').trim();
    if (!title) return null;
    return {
      ...base,
      title,
      content: String(formData.get('content') || '').trim(),
    };
  }
  return null;
}

function renderAll() {
  Object.keys(SECTION_CONFIG).forEach(renderSection);
}

function renderSection(section) {
  renderFilterControls(section);
  renderActiveFilters(section);
  renderItems(section);
}

function renderFilterControls(section) {
  const config = SECTION_CONFIG[section];
  const region = document.getElementById(config.filterRegionId);
  if (!region) return;
  region.replaceChildren();

  const counts = getTagCountsForSection(section);
  const filterContainer = document.createElement('div');
  filterContainer.className = 'tag-filter';
  if (!counts.length) {
    const disabledToggle = document.createElement('button');
    disabledToggle.type = 'button';
    disabledToggle.className = 'tag-filter-toggle';
    disabledToggle.textContent = 'No tags yet';
    disabledToggle.disabled = true;
    filterContainer.appendChild(disabledToggle);
    region.appendChild(filterContainer);
    return;
  }

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'tag-filter-toggle';
  const activeCount = filtersState[section]?.length || 0;
  toggle.textContent = activeCount ? `Tags (${activeCount})` : 'Filter by tags';
  filterContainer.appendChild(toggle);

  const menu = document.createElement('div');
  menu.className = 'tag-filter-menu';
  filterContainer.appendChild(menu);

  counts.forEach(({ tag, count }) => {
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = tag;
    checkbox.checked = filtersState[section].includes(tag);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        addFilterTag(section, tag);
      } else {
        removeFilterTag(section, tag);
      }
    });
    label.appendChild(checkbox);
    const span = document.createElement('span');
    span.textContent = formatTag(tag);
    label.appendChild(span);
    const countEl = document.createElement('span');
    countEl.className = 'count';
    countEl.textContent = `(${count})`;
    label.appendChild(countEl);
    menu.appendChild(label);
  });

  const actions = document.createElement('div');
  actions.className = 'actions';
  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.textContent = 'Clear filters';
  clearBtn.addEventListener('click', () => {
    setFilter(section, []);
    filterContainer.classList.remove('open');
  });
  actions.appendChild(clearBtn);
  menu.appendChild(actions);

  const closeMenu = (event) => {
    if (!filterContainer.contains(event.target)) {
      filterContainer.classList.remove('open');
      document.removeEventListener('click', closeMenu);
    }
  };

  toggle.addEventListener('click', (event) => {
    event.stopPropagation();
    const isOpen = filterContainer.classList.toggle('open');
    if (isOpen) {
      document.addEventListener('click', closeMenu);
    } else {
      document.removeEventListener('click', closeMenu);
    }
  });

  region.appendChild(filterContainer);
}

function renderActiveFilters(section) {
  const config = SECTION_CONFIG[section];
  const container = document.getElementById(config.activeFiltersId);
  if (!container) return;
  container.replaceChildren();
  const active = filtersState[section] || [];
  if (!active.length) return;

  active.forEach((tag) => {
    const chip = document.createElement('span');
    chip.className = 'filter-chip';
    chip.style.backgroundColor = tagManager.getTagColor(tag);
    chip.textContent = formatTag(tag);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove';
    remove.setAttribute('aria-label', `Remove filter ${formatTag(tag)}`);
    remove.textContent = '×';
    remove.addEventListener('click', () => {
      removeFilterTag(section, tag);
    });
    chip.appendChild(remove);
    container.appendChild(chip);
  });
}

function renderItems(section) {
  const config = SECTION_CONFIG[section];
  const container = document.getElementById(config.listId);
  if (!container) return;
  container.replaceChildren();

  const filters = filtersState[section] || [];
  const items = (itemsState[section] || []).slice().filter((item) => {
    if (!filters.length) return true;
    const itemTags = item.tags || [];
    return filters.every((filterTag) => itemTags.includes(filterTag));
  });

  if (!items.length) {
    const template = document.getElementById('emptyStateTemplate');
    if (template && 'content' in template) {
      const clone = template.content.firstElementChild.cloneNode(true);
      const title = clone.querySelector('.empty-title');
      const subtitle = clone.querySelector('.empty-subtitle');
      if (title) title.textContent = config.empty.title;
      if (subtitle) subtitle.textContent = filters.length
        ? 'No items match the selected tags yet.'
        : config.empty.subtitle;
      container.appendChild(clone);
      return;
    }
  }

  items
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .forEach((item) => {
      const card = createItemCard(section, item);
      container.appendChild(card);
    });
}

function createItemCard(section, item) {
  const card = document.createElement('article');
  card.className = 'item-card';

  const header = document.createElement('div');
  header.className = 'item-header';
  const title = document.createElement('h3');
  title.textContent = item.title;
  header.appendChild(title);

  const meta = document.createElement('div');
  meta.className = 'item-meta';
  const createdLabel = document.createElement('span');
  createdLabel.textContent = `Saved ${formatDate(item.createdAt)}`;
  meta.appendChild(createdLabel);

  if (section === 'reminders' && item.dueDate) {
    const due = document.createElement('span');
    due.textContent = `Due ${formatDate(item.dueDate)}`;
    meta.appendChild(due);
  }
  if (section === 'lessons' && item.grade) {
    const grade = document.createElement('span');
    grade.textContent = item.grade;
    meta.appendChild(grade);
  }

  header.appendChild(meta);
  card.appendChild(header);

  const bodyText =
    section === 'reminders' ? item.details : section === 'lessons' ? item.overview : item.content;
  if (bodyText) {
    const body = document.createElement('div');
    body.className = 'item-body';
    body.textContent = bodyText;
    card.appendChild(body);
  }

  if (item.tags?.length) {
    const tagsRow = document.createElement('div');
    tagsRow.className = 'tag-collection';
    item.tags.forEach((tag) => {
      const badge = createTagBadge(tag, { section });
      tagsRow.appendChild(badge);
    });
    card.appendChild(tagsRow);
  }

  return card;
}

function createTagBadge(tag, { section, onClick } = {}) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'tag-badge';
  const color = tagManager.getTagColor(tag);
  button.style.backgroundColor = color;
  button.textContent = formatTag(tag);
  button.addEventListener('click', () => {
    if (typeof onClick === 'function') {
      onClick(tag);
    } else if (section) {
      addFilterTag(section, tag);
    }
  });
  return button;
}

function addFilterTag(section, rawTag) {
  const tag = normalizeTag(rawTag);
  if (!tag) return;
  const list = filtersState[section] || (filtersState[section] = []);
  if (!list.includes(tag)) {
    list.push(tag);
    saveFilters();
    renderSection(section);
  }
}

function removeFilterTag(section, rawTag) {
  const tag = normalizeTag(rawTag);
  const list = filtersState[section] || (filtersState[section] = []);
  const idx = list.indexOf(tag);
  if (idx >= 0) {
    list.splice(idx, 1);
    saveFilters();
    renderSection(section);
  }
}

function setFilter(section, tags) {
  filtersState[section] = Array.from(new Set(tags.map(normalizeTag).filter(Boolean)));
  saveFilters();
  renderSection(section);
}

function getTagCountsForSection(section) {
  const counts = new Map();
  (itemsState[section] || []).forEach((item) => {
    (item.tags || []).forEach((tag) => {
      const normalized = normalizeTag(tag);
      if (!normalized) return;
      counts.set(normalized, (counts.get(normalized) || 0) + 1);
    });
  });
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.tag.localeCompare(b.tag);
    });
}

function aggregateTagUsage() {
  const usage = new Map();
  Object.entries(itemsState).forEach(([section, items]) => {
    items.forEach((item) => {
      (item.tags || []).forEach((tag) => {
        const normalized = normalizeTag(tag);
        if (!normalized) return;
        if (!usage.has(normalized)) {
          usage.set(normalized, {
            tag: normalized,
            total: 0,
            perSection: { reminders: 0, lessons: 0, notes: 0 },
            items: [],
          });
        }
        const entry = usage.get(normalized);
        entry.total += 1;
        entry.perSection[section] = (entry.perSection[section] || 0) + 1;
        entry.items.push({ section, item });
      });
    });
  });

  usage.forEach((entry) => {
    entry.items.sort((a, b) => new Date(b.item.createdAt).getTime() - new Date(a.item.createdAt).getTime());
  });

  return Array.from(usage.values()).sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return a.tag.localeCompare(b.tag);
  });
}

function renderDashboard() {
  const popularContainer = document.getElementById('popularTagsList');
  const recentSelect = document.getElementById('recentTagSelect');
  const recentItemsContainer = document.getElementById('recentTagItems');
  const quickLinksContainer = document.getElementById('tagQuickLinks');

  const aggregate = aggregateTagUsage();

  if (popularContainer) {
    popularContainer.replaceChildren();
    aggregate.slice(0, 6).forEach((entry) => {
      const row = document.createElement('div');
      row.className = 'popular-tag';
      const badge = createTagBadge(entry.tag, { onClick: (tag) => applyGlobalTagFilter(tag) });
      const count = document.createElement('span');
      count.className = 'count';
      count.textContent = `${entry.total} item${entry.total === 1 ? '' : 's'}`;
      row.appendChild(badge);
      row.appendChild(count);
      popularContainer.appendChild(row);
    });
    if (!aggregate.length) {
      popularContainer.textContent = 'Tag something to see insights here.';
    }
  }

  if (recentSelect && recentItemsContainer) {
    const previousValue = recentSelect.value;
    recentSelect.replaceChildren();
    aggregate.forEach((entry) => {
      const option = document.createElement('option');
      option.value = entry.tag;
      option.textContent = `${formatTag(entry.tag)} (${entry.total})`;
      recentSelect.appendChild(option);
    });
    if (!aggregate.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No tags yet';
      recentSelect.appendChild(option);
      recentSelect.disabled = true;
      recentSelect.value = '';
      recentSelect.onchange = null;
      recentItemsContainer.replaceChildren();
    } else {
      recentSelect.disabled = false;
      const selected = aggregate.some((entry) => entry.tag === previousValue)
        ? previousValue
        : aggregate[0].tag;
      recentSelect.value = selected;
      renderRecentItemsByTag(selected, aggregate, recentItemsContainer);
      recentSelect.onchange = (event) => {
        renderRecentItemsByTag(event.target.value, aggregate, recentItemsContainer);
      };
    }
  }

  if (quickLinksContainer) {
    quickLinksContainer.replaceChildren();
    if (!aggregate.length) {
      quickLinksContainer.textContent = 'Quick links will appear once you add a tagged item.';
    } else {
      const list = document.createElement('div');
      list.className = 'quick-links';
      aggregate.slice(0, 5).forEach((entry) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.innerHTML = `<span>${formatTag(entry.tag)}</span><span>${entry.total} item${entry.total === 1 ? '' : 's'}</span>`;
        button.addEventListener('click', () => applyGlobalTagFilter(entry.tag));
        list.appendChild(button);
      });
      quickLinksContainer.appendChild(list);
    }
  }
}

function renderRecentItemsByTag(tag, aggregate, container) {
  container.replaceChildren();
  const entry = aggregate.find((value) => value.tag === tag);
  if (!entry) {
    const message = document.createElement('li');
    message.textContent = 'No items for this tag yet.';
    container.appendChild(message);
    return;
  }
  entry.items.slice(0, 4).forEach(({ section, item }) => {
    const li = document.createElement('li');
    li.className = 'recent-item';
    const title = document.createElement('h4');
    title.textContent = item.title;
    li.appendChild(title);
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `${capitalize(section)} • ${formatDate(item.createdAt)}`;
    li.appendChild(meta);
    const viewAll = document.createElement('button');
    viewAll.type = 'button';
    viewAll.className = 'tag-badge';
    viewAll.style.backgroundColor = tagManager.getTagColor(tag);
    viewAll.textContent = `View all ${formatTag(tag)}`;
    viewAll.addEventListener('click', () => applyGlobalTagFilter(tag));
    li.appendChild(viewAll);
    container.appendChild(li);
  });
}

function applyGlobalTagFilter(tag) {
  Object.keys(SECTION_CONFIG).forEach((section) => {
    const hasTag = (itemsState[section] || []).some((item) => item.tags?.includes(tag));
    setFilter(section, hasTag ? [tag] : []);
  });
  renderDashboard();
  updatePreferencesSnapshot();
}

function formatDate(dateLike) {
  if (!dateLike) return 'No date';
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return 'No date';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function capitalize(value) {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function updatePreferencesSnapshot() {
  const snapshot = document.getElementById('tagPreferenceSnapshot');
  if (!snapshot) return;
  snapshot.textContent = tagManager.describePreferences();
}
