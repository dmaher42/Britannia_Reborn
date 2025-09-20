import { formatTag, normalizeTag } from './tag-manager.js';

export function createTagInput(container, { manager, placeholder = 'Add tag', initialTags = [], onChange, inputId } = {}) {
  if (!container) {
    throw new Error('Tag input requires a container element.');
  }
  if (!manager) {
    throw new Error('Tag input requires a TagManager instance.');
  }

  const root = document.createElement('div');
  root.className = 'tag-input';
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = placeholder;
  input.setAttribute('aria-label', placeholder);
  if (inputId) {
    input.id = inputId;
  }
  root.appendChild(input);

  const suggestionsEl = document.createElement('div');
  suggestionsEl.className = 'tag-suggestions';
  root.appendChild(suggestionsEl);

  container.replaceChildren(root);

  const tags = [];
  let suggestionItems = [];
  let activeIndex = -1;
  let suppressBlur = false;

  function notifyChange() {
    if (typeof onChange === 'function') {
      onChange(tags.slice());
    }
  }

  function renderChips() {
    root.querySelectorAll('.tag-chip').forEach((chip) => chip.remove());
    tags.forEach((tag) => {
      const chip = document.createElement('span');
      chip.className = 'tag-chip';
      const label = document.createElement('span');
      label.textContent = formatTag(tag);
      chip.appendChild(label);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.setAttribute('aria-label', `Remove tag ${formatTag(tag)}`);
      remove.textContent = '×';
      remove.addEventListener('click', () => {
        removeTag(tag);
        input.focus();
      });
      chip.appendChild(remove);
      root.insertBefore(chip, input);
    });
  }

  function hideSuggestions() {
    suggestionsEl.classList.remove('visible');
    suggestionsEl.replaceChildren();
    suggestionItems = [];
    activeIndex = -1;
  }

  function highlight(index) {
    activeIndex = index;
    const buttons = suggestionsEl.querySelectorAll('button');
    buttons.forEach((button, idx) => {
      if (idx === index) {
        button.classList.add('active');
        button.setAttribute('aria-selected', 'true');
      } else {
        button.classList.remove('active');
        button.removeAttribute('aria-selected');
      }
    });
  }

  function showSuggestions(query = '') {
    const trimmed = query.trim();
    suggestionItems = manager.getSuggestions(trimmed);
    suggestionsEl.replaceChildren();

    if (!suggestionItems.length) {
      if (trimmed) {
        const tag = normalizeTag(trimmed);
        if (tag) {
          const button = document.createElement('button');
          button.type = 'button';
          button.innerHTML = `<span>${formatTag(tag)}</span><span class="hint">Add new tag</span>`;
          button.addEventListener('click', () => {
            addTag(tag);
            hideSuggestions();
            input.value = '';
            input.focus();
          });
          suggestionsEl.appendChild(button);
          suggestionItems = [{ tag, isNew: true }];
          highlight(0);
          suggestionsEl.classList.add('visible');
          return;
        }
      }
      hideSuggestions();
      return;
    }

    suggestionItems.forEach((item, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.innerHTML = `<span>${formatTag(item.tag)}</span><span class="hint">${item.isNew ? 'Add new tag' : 'Use existing tag'}</span>`;
      button.addEventListener('mousedown', () => {
        suppressBlur = true;
      });
      button.addEventListener('click', () => {
        addTag(item.tag);
        hideSuggestions();
        input.value = '';
        input.focus();
      });
      suggestionsEl.appendChild(button);
      if (index === 0) {
        highlight(0);
      }
    });

    suggestionsEl.classList.add('visible');
  }

  function addTag(rawTag) {
    const normalized = manager.ensureTag(rawTag);
    if (!normalized) {
      return;
    }
    if (!tags.includes(normalized)) {
      tags.push(normalized);
      renderChips();
      notifyChange();
    }
  }

  function removeTag(rawTag) {
    const normalized = normalizeTag(rawTag);
    const idx = tags.indexOf(normalized);
    if (idx >= 0) {
      tags.splice(idx, 1);
      renderChips();
      notifyChange();
    }
  }

  function commitInput(preferredTag) {
    const value = preferredTag ?? input.value;
    const normalized = normalizeTag(value);
    if (!normalized) {
      input.value = '';
      return;
    }
    addTag(normalized);
    input.value = '';
  }

  input.addEventListener('focus', () => {
    root.classList.add('focused');
    showSuggestions(input.value);
  });

  input.addEventListener('blur', () => {
    setTimeout(() => {
      root.classList.remove('focused');
      if (suppressBlur) {
        suppressBlur = false;
        return;
      }
      hideSuggestions();
    }, 80);
  });

  input.addEventListener('input', () => {
    showSuggestions(input.value);
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === 'Tab' || event.key === ',') {
      if (event.key !== 'Tab') {
        event.preventDefault();
      }
      if (activeIndex >= 0 && suggestionItems[activeIndex]) {
        commitInput(suggestionItems[activeIndex].tag);
        hideSuggestions();
      } else {
        commitInput();
      }
      showSuggestions('');
    } else if (event.key === 'Backspace' && !input.value && tags.length) {
      event.preventDefault();
      removeTag(tags[tags.length - 1]);
    } else if (event.key === 'ArrowDown' && suggestionItems.length) {
      event.preventDefault();
      const next = (activeIndex + 1) % suggestionItems.length;
      highlight(next);
    } else if (event.key === 'ArrowUp' && suggestionItems.length) {
      event.preventDefault();
      const prev = activeIndex <= 0 ? suggestionItems.length - 1 : activeIndex - 1;
      highlight(prev);
    } else if (event.key === 'Escape') {
      hideSuggestions();
    }
  });

  suggestionsEl.addEventListener('mouseleave', () => {
    activeIndex = -1;
    highlight(-1);
  });

  setTags(initialTags);

  function setTags(nextTags = []) {
    tags.splice(0, tags.length);
    nextTags.forEach((tag) => {
      const normalized = manager.ensureTag(tag);
      if (normalized && !tags.includes(normalized)) {
        tags.push(normalized);
      }
    });
    renderChips();
    notifyChange();
  }

  function clear() {
    setTags([]);
    input.value = '';
    hideSuggestions();
  }

  return {
    getTags: () => tags.slice(),
    setTags,
    clear,
    focus: () => input.focus(),
    addTag,
    removeTag,
    element: root,
  };
}
