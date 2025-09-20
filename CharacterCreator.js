import { Character, CharacterStats } from './Character.js';

const randomStat = () =>
  Math.floor(Math.random() * (CharacterStats.MAX - CharacterStats.MIN + 1)) + CharacterStats.MIN;

const clampStat = (value) =>
  Math.min(Math.max(Math.round(value), CharacterStats.MIN), CharacterStats.MAX);

const template = () => `
  <div class="creator-backdrop" role="presentation"></div>
  <div class="creator-panel" role="dialog" aria-modal="true" aria-labelledby="creatorTitle">
    <form class="creator-form">
      <header>
        <h2 id="creatorTitle">Forge Your Avatar</h2>
        <p>Create a hero to lead Britannia's rebirth. Allocate core attributes or embrace fate.</p>
      </header>
      <label class="field" for="characterName">
        <span>Name</span>
        <input id="characterName" name="name" type="text" maxlength="24" placeholder="Avatar" required />
      </label>
      <div class="stats">
        ${CharacterStats.KEYS.map(
          (stat) => `
            <div class="stat" data-stat="${stat}">
              <span class="label">${stat}</span>
              <div class="controls">
                <button type="button" class="decrement" aria-label="Decrease ${stat}">-</button>
                <span class="value">${CharacterStats.MIN}</span>
                <button type="button" class="increment" aria-label="Increase ${stat}">+</button>
              </div>
            </div>`
        ).join('')}
      </div>
      <footer>
        <div class="actions">
          <button type="button" class="randomize">Randomize</button>
          <button type="button" class="cancel">Back</button>
          <button type="submit" class="confirm">Begin Journey</button>
        </div>
        <p class="hint">Stats range from ${CharacterStats.MIN} to ${CharacterStats.MAX}. Hold Shift for +/-5.</p>
      </footer>
    </form>
  </div>
`;

export function createCharacterCreator({ container = document.body, onCreate, onCancel } = {}) {
  const host = document.createElement('div');
  host.className = 'character-creator';
  host.innerHTML = template();
  host.hidden = true;

  const form = host.querySelector('.creator-form');
  const nameInput = host.querySelector('input[name="name"]');
  const randomizeButton = host.querySelector('.randomize');
  const cancelButton = host.querySelector('.cancel');
  const statElements = new Map();
  const stats = {};

  CharacterStats.KEYS.forEach((stat) => {
    const element = host.querySelector(`.stat[data-stat="${stat}"]`);
    statElements.set(stat, element);
    stats[stat] = CharacterStats.MIN;
  });

  const updateDisplay = () => {
    CharacterStats.KEYS.forEach((stat) => {
      const element = statElements.get(stat);
      if (!element) return;
      const value = element.querySelector('.value');
      if (value) value.textContent = stats[stat];
    });
  };

  const adjustStat = (stat, delta) => {
    const current = stats[stat] ?? CharacterStats.MIN;
    stats[stat] = clampStat(current + delta);
    updateDisplay();
  };

  const randomizeStats = () => {
    CharacterStats.KEYS.forEach((stat) => {
      stats[stat] = randomStat();
    });
    updateDisplay();
  };

  host.addEventListener('click', (event) => {
    if (event.target === host || event.target.classList.contains('creator-backdrop')) {
      event.preventDefault();
      if (typeof onCancel === 'function') onCancel();
      hide();
    }
  });

  statElements.forEach((element, stat) => {
    const inc = element.querySelector('.increment');
    const dec = element.querySelector('.decrement');
    inc?.addEventListener('click', (event) => {
      const step = event.shiftKey ? 5 : 1;
      adjustStat(stat, step);
    });
    dec?.addEventListener('click', (event) => {
      const step = event.shiftKey ? 5 : 1;
      adjustStat(stat, -step);
    });
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const name = (formData.get('name') ?? '').toString().trim() || 'Avatar';
    const character = new Character({ name, stats });
    if (typeof onCreate === 'function') {
      onCreate(character);
    }
    hide();
  });

  randomizeButton?.addEventListener('click', () => randomizeStats());
  cancelButton?.addEventListener('click', () => {
    if (typeof onCancel === 'function') onCancel();
    hide();
  });

  const show = () => {
    if (!host.isConnected) {
      (container ?? document.body).appendChild(host);
    }
    randomizeStats();
    host.hidden = false;
    requestAnimationFrame(() => {
      nameInput?.focus();
    });
  };

  const hide = () => {
    host.hidden = true;
  };

  return {
    element: host,
    show,
    hide,
    destroy: () => host.remove(),
  };
}

