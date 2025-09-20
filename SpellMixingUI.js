import { KNOWN_REAGENTS } from './SpellSystem.js';

const createElement = (tag, className, textContent = '') => {
  const element = document.createElement(tag);
  if (className) {
    element.className = className;
  }
  if (textContent) {
    element.textContent = textContent;
  }
  return element;
};

const reagentDisplayName = (reagentSystem, type) => reagentSystem?.getReagent(type)?.name ?? type;

export class SpellMixingUI {
  constructor(spellSystem, party, options = {}) {
    this.spellSystem = spellSystem;
    this.party = party;
    this.mixingBowl = [];
    this.isVisible = false;
    this.getSelectedMember = typeof options.getSelectedMember === 'function'
      ? options.getSelectedMember
      : () => (this.party?.leader ?? null);
    this.onOpen = typeof options.onOpen === 'function' ? options.onOpen : null;
    this.onClose = typeof options.onClose === 'function' ? options.onClose : null;
    this.container = null;
    this.reagentListElement = null;
    this.bowlElement = null;
    this.spellNameElement = null;
    this.castButton = null;
    this.clearButton = null;
    this.targetContainer = null;
    this.currentSpell = null;
    this.availableCounts = new Map();
    this.createMixingInterface();
    this.installGlobalHandlers();
    this.refreshReagents();
  }

  createMixingInterface() {
    if (typeof document === 'undefined') return;
    this.container = createElement('div', 'spell-mixing-overlay hidden');

    const windowEl = createElement('div', 'spell-mixing-window');
    const header = createElement('div', 'spell-mixing-header');
    const title = createElement('h2', '', 'Spell Mixing');
    const closeButton = createElement('button', 'spell-mixing-close', '×');
    closeButton.type = 'button';
    closeButton.addEventListener('click', () => this.closeMixingInterface());
    header.append(title, closeButton);

    const content = createElement('div', 'spell-mixing-content');
    this.reagentListElement = createElement('div', 'reagent-list');
    this.reagentHeader = createElement('h3', '', 'Reagents');
    this.reagentHint = createElement('p', 'reagent-hint', 'Drag reagents into the mixing bowl or click to add them.');
    this.reagentListElement.append(this.reagentHeader, this.reagentHint);

    const bowlColumn = createElement('div', 'mixing-bowl-column');
    const bowlHeader = createElement('h3', '', 'Mixing Bowl');
    this.bowlElement = createElement('div', 'mixing-bowl');
    this.bowlElement.addEventListener('dragover', (event) => {
      event.preventDefault();
      this.bowlElement.classList.add('dragging');
    });
    this.bowlElement.addEventListener('dragleave', () => {
      this.bowlElement.classList.remove('dragging');
    });
    this.bowlElement.addEventListener('drop', (event) => {
      event.preventDefault();
      this.bowlElement.classList.remove('dragging');
      const type = event.dataTransfer?.getData('text/plain');
      if (type) {
        this.addReagentToBowl(type);
      }
    });

    const bowlHint = createElement('p', 'bowl-hint', 'Arrange reagents to discover Britannia’s spells.');
    bowlColumn.append(bowlHeader, this.bowlElement, bowlHint);

    content.append(this.reagentListElement, bowlColumn);

    const footer = createElement('div', 'spell-mixing-footer');
    this.spellNameElement = createElement('div', 'spell-result', 'No spell prepared.');

    this.targetContainer = createElement('div', 'spell-targets hidden');

    this.castButton = createElement('button', 'spell-cast-button', 'Cast Spell');
    this.castButton.type = 'button';
    this.castButton.disabled = true;
    this.castButton.addEventListener('click', () => {
      if (!this.currentSpell) return;
      const caster = this.getSelectedMember?.() ?? null;
      if (!caster) {
        this.spellSystem?.showMessage?.('No party member is ready to cast.');
        return;
      }
      if (this.spellSystem.requiresTarget(this.currentSpell)) {
        const targets = this.spellSystem.getPotentialTargets(this.currentSpell, caster);
        if (targets.length === 0) {
          this.spellSystem.showMessage('No valid target is available.');
          return;
        }
        this.renderTargetSelection(targets, caster, this.currentSpell);
      } else {
        this.invokeSpell(this.currentSpell, caster, null);
      }
    });

    this.clearButton = createElement('button', 'spell-clear-button', 'Clear Bowl');
    this.clearButton.type = 'button';
    this.clearButton.addEventListener('click', () => this.clearMixingBowl());

    footer.append(this.spellNameElement, this.targetContainer, this.castButton, this.clearButton);

    windowEl.append(header, content, footer);
    this.container.append(windowEl);
    document.body.appendChild(this.container);
  }

  installGlobalHandlers() {
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', (event) => {
      if (!this.isVisible) return;
      if (event.key === 'Escape') {
        this.closeMixingInterface();
      }
    });
  }

  refreshReagents() {
    if (!this.reagentListElement) return;
    const reagentSystem = this.spellSystem?.reagentSystem ?? null;
    const counts = this.spellSystem?.getReagentCounts?.() ?? new Map();
    this.availableCounts = counts;
    const list = createElement('div', 'reagent-grid');
    const definitions = reagentSystem?.listReagents?.() ?? KNOWN_REAGENTS.map((type) => ({ type }));
    definitions.forEach((definition) => {
      const type = definition.type;
      const name = reagentDisplayName(reagentSystem, type);
      const count = counts.get(type) ?? 0;
      const item = createElement('div', 'reagent-item');
      item.dataset.reagentType = type;
      item.draggable = true;
      item.innerHTML = `<span class="name">${name}</span><span class="count">${count}</span>`;
      item.addEventListener('dragstart', (event) => {
        event.dataTransfer?.setData('text/plain', type);
      });
      item.addEventListener('click', () => this.addReagentToBowl(type));
      if (count <= 0) {
        item.classList.add('unavailable');
      }
      list.appendChild(item);
    });
    this.reagentListElement.replaceChildren(this.reagentHeader, this.reagentHint, list);
  }

  refreshBowlDisplay() {
    if (!this.bowlElement) return;
    this.bowlElement.replaceChildren();
    if (this.mixingBowl.length === 0) {
      const empty = createElement('div', 'bowl-empty', 'No reagents in the bowl.');
      this.bowlElement.appendChild(empty);
      this.disableCastButton();
      return;
    }
    this.mixingBowl.forEach((type, index) => {
      const reagentSystem = this.spellSystem?.reagentSystem;
      const name = reagentDisplayName(reagentSystem, type);
      const chip = createElement('button', 'bowl-reagent', name);
      chip.type = 'button';
      chip.dataset.index = `${index}`;
      chip.addEventListener('click', () => this.removeReagentFromBowl(index));
      this.bowlElement.appendChild(chip);
    });
  }

  addReagentToBowl(reagentType) {
    if (!reagentType) return;
    const available = this.availableCounts.get(reagentType) ?? 0;
    const used = this.mixingBowl.filter((type) => type === reagentType).length;
    if (used >= available) {
      this.spellSystem?.showMessage?.(`You have no more ${reagentDisplayName(this.spellSystem?.reagentSystem, reagentType)}.`);
      return;
    }
    this.mixingBowl.push(reagentType);
    this.refreshBowlDisplay();
    this.checkForValidSpell();
  }

  removeReagentFromBowl(index) {
    if (index < 0 || index >= this.mixingBowl.length) return;
    this.mixingBowl.splice(index, 1);
    this.refreshBowlDisplay();
    this.checkForValidSpell();
  }

  checkForValidSpell() {
    const matching = this.spellSystem?.matchSpellByReagents?.(this.mixingBowl) ?? null;
    if (!matching) {
      this.disableCastButton();
      this.spellNameElement.textContent = 'No spell prepared.';
      this.currentSpell = null;
      return;
    }
    const spell = this.spellSystem.getSpell(matching);
    if (!spell) {
      this.disableCastButton();
      this.spellNameElement.textContent = 'No spell prepared.';
      this.currentSpell = null;
      return;
    }
    this.currentSpell = matching;
    this.spellSystem.prepareSpell(matching);
    this.spellNameElement.textContent = `${spell.name} (${matching.replace('_', ' ')})`;
    this.enableCastButton();
  }

  enableCastButton() {
    if (this.castButton) {
      this.castButton.disabled = false;
    }
  }

  disableCastButton() {
    if (this.castButton) {
      this.castButton.disabled = true;
    }
    if (this.targetContainer) {
      this.targetContainer.classList.add('hidden');
      this.targetContainer.replaceChildren();
    }
  }

  renderTargetSelection(targets, caster, spellName) {
    if (!this.targetContainer) return;
    this.targetContainer.classList.remove('hidden');
    this.targetContainer.replaceChildren();

    const prompt = createElement('div', 'target-prompt', 'Choose a target:');
    this.targetContainer.appendChild(prompt);

    const options = Array.isArray(targets) ? [...targets] : [];

    if (this.spellSystem.getTargetType(spellName) === 'ally' && caster) {
      const alreadyListed = options.some((entry) => entry.entity === caster);
      if (!alreadyListed) {
        options.unshift({ label: `${caster.name} (self)`, entity: caster });
      }
    }

    options.forEach((entry) => {
      const button = createElement('button', 'target-option', entry.label);
      button.type = 'button';
      button.addEventListener('click', () => this.invokeSpell(spellName, caster, entry.entity));
      this.targetContainer.appendChild(button);
    });

    const cancel = createElement('button', 'target-option cancel', 'Cancel');
    cancel.type = 'button';
    cancel.addEventListener('click', () => {
      this.targetContainer.classList.add('hidden');
      this.targetContainer.replaceChildren();
    });
    this.targetContainer.appendChild(cancel);
  }

  invokeSpell(spellName, caster, target) {
    const success = this.spellSystem.castSpell(spellName, caster, target);
    if (!success) {
      return;
    }
    this.clearMixingBowl();
    this.closeMixingInterface();
  }

  clearMixingBowl() {
    this.mixingBowl = [];
    this.refreshBowlDisplay();
    this.disableCastButton();
  }

  openMixingInterface() {
    if (!this.container) return;
    if (this.isVisible) {
      this.closeMixingInterface();
      return;
    }
    if (this.onOpen) {
      this.onOpen();
    }
    this.isVisible = true;
    this.refreshReagents();
    this.refreshBowlDisplay();
    this.container.classList.remove('hidden');
    this.container.setAttribute('aria-hidden', 'false');
  }

  closeMixingInterface() {
    if (!this.container) return;
    this.isVisible = false;
    this.container.classList.add('hidden');
    this.container.setAttribute('aria-hidden', 'true');
    this.targetContainer?.classList.add('hidden');
    this.targetContainer?.replaceChildren();
    if (this.onClose) {
      this.onClose();
    }
  }

  isOpen() {
    return this.isVisible;
  }
}
