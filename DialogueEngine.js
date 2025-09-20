import { WorldObject, registerWorldObjectType } from './WorldObject.js';

const normalizeEntry = (entry) => {
  if (!entry) {
    return { responses: [], hints: [] };
  }
  if (Array.isArray(entry)) {
    return { responses: [...entry], hints: [] };
  }
  if (typeof entry === 'object') {
    const responses = Array.isArray(entry.responses)
      ? [...entry.responses]
      : Array.isArray(entry.lines)
      ? [...entry.lines]
      : typeof entry.text === 'string'
      ? [entry.text]
      : [];
    const hints = Array.isArray(entry.hints) ? [...entry.hints] : [];
    return { responses, hints };
  }
  if (typeof entry === 'string') {
    return { responses: [entry], hints: [] };
  }
  return { responses: [], hints: [] };
};

const formatKeyword = (keyword) => keyword?.toLowerCase?.().trim() ?? '';

export class NPC extends WorldObject {
  constructor(name, x, y, npcData = {}) {
    super(npcData.id ?? `npc_${name.toLowerCase()}`, name, 'npc', x, y, {
      description: npcData.description ?? `You see ${name}, ${npcData.profession ?? 'a citizen of Britannia'}.`,
      canGet: false,
      canUse: false,
    });
    this.profession = npcData.profession ?? 'citizen';
    this.schedule = npcData.schedule ?? null;
    this.canTalk = npcData.canTalk ?? true;
    this.dialogues = {};
    const entries = npcData.dialogues ?? {};
    Object.keys(entries).forEach((keyword) => {
      this.dialogues[formatKeyword(keyword)] = normalizeEntry(entries[keyword]);
    });
    this.defaultResponses = Array.isArray(npcData.defaultResponses)
      ? [...npcData.defaultResponses]
      : ['I know little of that.'];
  }

  getResponse(keyword) {
    const normalized = formatKeyword(keyword);
    if (!normalized) {
      return this.selectResponse(this.defaultResponses);
    }
    const entry = this.dialogues[normalized];
    if (!entry || entry.responses.length === 0) {
      return this.getDefaultResponse(normalized);
    }
    return this.selectResponse(entry.responses);
  }

  getKeywordHints(keyword) {
    const normalized = formatKeyword(keyword);
    const entry = this.dialogues[normalized];
    if (!entry) return [];
    return entry.hints ?? [];
  }

  selectResponse(responses) {
    if (!Array.isArray(responses) || responses.length === 0) {
      return '';
    }
    const index = Math.floor(Math.random() * responses.length);
    return responses[index];
  }

  getDefaultResponse(keyword) {
    const fallback = this.selectResponse(this.defaultResponses);
    if (!keyword) return fallback;
    return `${fallback} (${this.name} seems unsure about "${keyword}".)`;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      profession: this.profession,
      schedule: this.schedule,
      dialogues: this.dialogues,
      defaultResponses: [...this.defaultResponses],
    };
  }

  static fromJSON(data = {}) {
    if (!data || typeof data !== 'object') {
      throw new TypeError('Invalid NPC data.');
    }

    const cloneValue = (value) => {
      if (Array.isArray(value)) {
        return value.map((entry) => cloneValue(entry));
      }
      if (value && typeof value === 'object') {
        return Object.fromEntries(
          Object.entries(value).map(([key, entry]) => [key, cloneValue(entry)])
        );
      }
      return value;
    };

    const npc = new NPC(data.name ?? data.id ?? 'NPC', data.x ?? 0, data.y ?? 0, {
      id: data.id,
      description: data.description,
      profession: data.profession,
      schedule: cloneValue(data.schedule),
      canTalk: data.canTalk,
      dialogues: cloneValue(data.dialogues ?? {}),
      defaultResponses: Array.isArray(data.defaultResponses)
        ? [...data.defaultResponses]
        : cloneValue(data.defaultResponses),
    });

    npc.type = data.type ?? npc.type;
    npc.flags = cloneValue(data.flags ?? {});
    npc.contains = Array.isArray(data.contains)
      ? data.contains.map((entry) =>
          entry instanceof WorldObject ? entry : WorldObject.fromJSON(entry)
        )
      : [];

    if (Number.isFinite(data.weight)) {
      npc.weight = Number(data.weight);
    }
    if (typeof data.canGet === 'boolean') {
      npc.canGet = data.canGet;
    }
    if (typeof data.canUse === 'boolean') {
      npc.canUse = data.canUse;
    }
    if (typeof data.isOpen === 'boolean') {
      npc.isOpen = data.isOpen;
    }

    return npc;
  }
}

registerWorldObjectType('npc', NPC);

export class DialogueEngine {
  constructor(gameWorld, options = {}) {
    this.gameWorld = gameWorld;
    this.activeNPC = null;
    this.conversationActive = false;
    this.historyElement = null;
    this.inputField = null;
    this.hintsElement = null;
    this.titleElement = null;
    this.container = null;
    this.keywordHistory = [];
    this.onKeyword = typeof options.onKeyword === 'function' ? options.onKeyword : null;
    this.onStart = typeof options.onStart === 'function' ? options.onStart : null;
    this.onEnd = typeof options.onEnd === 'function' ? options.onEnd : null;
    this.createConversationUI();
    this.installGlobalHandlers();
  }

  createConversationUI() {
    if (typeof document === 'undefined') return;
    this.container = createElement('div', 'conversation-overlay hidden');
    const windowEl = createElement('div', 'conversation-window');

    const header = createElement('div', 'conversation-header');
    this.titleElement = createElement('h2', '', 'Conversation');
    const closeButton = createElement('button', 'conversation-close', '×');
    closeButton.type = 'button';
    closeButton.addEventListener('click', () => this.endConversation());
    header.append(this.titleElement, closeButton);

    this.historyElement = createElement('div', 'conversation-history');
    this.hintsElement = createElement('div', 'conversation-hints');

    const inputRow = createElement('div', 'conversation-input');
    this.inputField = document.createElement('input');
    this.inputField.id = 'conversationInput';
    this.inputField.type = 'text';
    this.inputField.placeholder = 'Type a keyword (name, job, magic...)';
    this.inputField.autocomplete = 'off';
    const submitButton = createElement('button', 'conversation-submit', 'Say');
    submitButton.type = 'button';
    submitButton.addEventListener('click', () => this.handleSubmit());
    this.inputField.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.handleSubmit();
      }
    });
    inputRow.append(this.inputField, submitButton);

    windowEl.append(header, this.historyElement, inputRow, this.hintsElement);
    this.container.append(windowEl);
    document.body.appendChild(this.container);
  }

  installGlobalHandlers() {
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', (event) => {
      if (!this.conversationActive) return;
      if (event.key === 'Escape') {
        this.endConversation();
      }
    });
  }

  startConversation(npc) {
    if (!npc || !npc.canTalk) {
      this.gameWorld?.showMessage?.('They do not respond.');
      return;
    }
    if (this.onStart) {
      this.onStart(npc);
    }
    this.activeNPC = npc;
    this.conversationActive = true;
    this.keywordHistory = [];
    if (this.titleElement) {
      this.titleElement.textContent = npc.name;
    }
    if (this.historyElement) {
      this.historyElement.replaceChildren();
    }
    if (this.hintsElement) {
      this.hintsElement.replaceChildren();
    }
    if (this.container) {
      this.container.classList.remove('hidden');
      this.container.setAttribute('aria-hidden', 'false');
    }
    this.logSystem(`You greet ${npc.name}.`);
    this.processKeyword('name');
    this.focusInput();
  }

  focusInput() {
    if (this.inputField) {
      this.inputField.focus();
      this.inputField.select?.();
    }
  }

  handleSubmit() {
    if (!this.conversationActive) return;
    const value = this.inputField?.value ?? '';
    const keyword = formatKeyword(value);
    if (!keyword) {
      return;
    }
    this.inputField.value = '';
    this.processKeyword(keyword);
  }

  processKeyword(keyword) {
    if (!this.activeNPC || !this.conversationActive) return;
    const normalized = formatKeyword(keyword);
    if (!normalized) return;
    this.logPlayer(normalized);
    const response = this.activeNPC.getResponse(normalized);
    this.displayNPCResponse(response);
    const hints = this.activeNPC.getKeywordHints(normalized);
    this.displayKeywordHints(hints);
    this.keywordHistory.push(normalized);
    if (this.onKeyword) {
      this.onKeyword(normalized, this.activeNPC);
    }
    if (normalized === 'bye' || normalized === 'farewell') {
      this.logSystem(`${this.activeNPC.name} nods in parting.`);
      this.endConversation();
    }
  }

  displayNPCResponse(response) {
    if (!this.historyElement) return;
    const messages = Array.isArray(response) ? response : [response];
    messages.filter(Boolean).forEach((text) => {
      const line = createElement('div', 'npc-line');
      line.textContent = text;
      this.historyElement.appendChild(line);
    });
    this.historyElement.scrollTop = this.historyElement.scrollHeight;
  }

  displayKeywordHints(hints = []) {
    if (!this.hintsElement) return;
    this.hintsElement.replaceChildren();
    if (!Array.isArray(hints) || hints.length === 0) {
      return;
    }
    const label = createElement('div', 'hints-label', 'Keywords:');
    this.hintsElement.appendChild(label);
    hints.forEach((hint) => {
      const button = createElement('button', 'hint-button', hint);
      button.type = 'button';
      button.addEventListener('click', () => {
        this.inputField.value = hint;
        this.focusInput();
      });
      this.hintsElement.appendChild(button);
    });
  }

  logPlayer(keyword) {
    if (!this.historyElement) return;
    const entry = createElement('div', 'player-line', keyword);
    this.historyElement.appendChild(entry);
  }

  logSystem(message) {
    if (!this.historyElement) return;
    const entry = createElement('div', 'system-line', message);
    this.historyElement.appendChild(entry);
  }

  endConversation() {
    const previousNpc = this.activeNPC;
    this.conversationActive = false;
    this.activeNPC = null;
    if (this.container) {
      this.container.classList.add('hidden');
      this.container.setAttribute('aria-hidden', 'true');
    }
    if (this.onEnd) {
      this.onEnd(previousNpc);
    }
  }
}

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

export const NPC_DATA = {
  mariah: {
    profession: 'healer',
    dialogues: {
      name: {
        responses: ['I am Mariah, a healer of this town.'],
        hints: ['job', 'heal', 'magic'],
      },
      job: {
        responses: ['I tend to the sick and wounded. I also know something of magic.'],
        hints: ['heal', 'magic', 'reagents'],
      },
      heal: {
        responses: [
          'I can heal thy wounds for a small donation.',
          'Would thou like me to heal thee?',
        ],
        hints: ['donation'],
      },
      donation: {
        responses: ['Five gold will mend even serious hurts.'],
        hints: ['heal'],
      },
      magic: {
        responses: ['Magic requires reagents to work. The eight reagents can be combined in different ways.'],
        hints: ['reagents', 'spells'],
      },
      reagents: {
        responses: ['Black Pearl, Blood Moss, Garlic, Ginseng, Mandrake Root, Nightshade, Spider Silk, and Sulfurous Ash.'],
        hints: ['spells'],
      },
      spells: {
        responses: ['The simplest healing spell requires Garlic and Ginseng. Try mixing them!'],
        hints: ['heal', 'magic'],
      },
      bye: {
        responses: ['Fare thee well, and may thy journey be safe.'],
        hints: [],
      },
    },
  },
  gwenno: {
    profession: 'mage shopkeeper',
    dialogues: {
      name: {
        responses: ['I am Gwenno, keeper of the magic shop.'],
        hints: ['job', 'buy'],
      },
      job: {
        responses: ['I sell reagents and spell components to those who practice the mystic arts.'],
        hints: ['reagents', 'prices', 'buy'],
      },
      buy: {
        responses: ['What reagents dost thou require? I have them all, for the right price.'],
        hints: ['reagents', 'prices'],
      },
      reagents: {
        responses: ['I stock all eight reagents, though some are rarer than others.'],
        hints: ['prices'],
      },
      prices: {
        responses: ['Common reagents like Garlic are cheap. Rare ones like Mandrake Root cost much more.'],
        hints: ['buy'],
      },
      spells: {
        responses: ['I do not sell spells directly, but I know that different combinations create different effects.'],
        hints: ['magic'],
      },
      magic: {
        responses: ['Magic is dangerous without proper knowledge. Be careful what thou dost mix!'],
        hints: ['reagents', 'buy'],
      },
    },
  },
  smithy: {
    profession: 'blacksmith',
    dialogues: {
      name: {
        responses: ['I am the town blacksmith.'],
        hints: ['job', 'weapons'],
      },
      job: {
        responses: ['I forge weapons and armor for brave adventurers.'],
        hints: ['weapons', 'armor', 'repair'],
      },
      weapons: {
        responses: ['I can craft swords, maces, and axes. What dost thou need?'],
        hints: ['armor', 'repair'],
      },
      armor: {
        responses: ['Good armor can save thy life. I recommend at least leather for starting adventurers.'],
        hints: ['repair'],
      },
      repair: {
        responses: ['Bring me thy damaged equipment and I shall restore it.'],
        hints: ['armor'],
      },
      magic: {
        responses: ['I know nothing of magic, but I hear the reagent sellers do good business.'],
        hints: ['reagents'],
      },
    },
  },
};
