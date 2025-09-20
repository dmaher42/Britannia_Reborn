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

export class MagicShop {
  constructor(npc, party, options = {}) {
    this.npc = npc;
    this.party = party;
    this.reagentSystem = options.reagentSystem ?? null;
    this.inventoryManager = options.inventory ?? null;
    this.showMessage = typeof options.showMessage === 'function' ? options.showMessage : (text) => console.log(text);
    this.onTransaction = typeof options.onTransaction === 'function' ? options.onTransaction : null;
    this.onOpen = typeof options.onOpen === 'function' ? options.onOpen : null;
    this.onClose = typeof options.onClose === 'function' ? options.onClose : null;
    this.inventory = this.generateShopInventory();
    this.container = null;
    this.listElement = null;
    this.goldElement = null;
    this.titleElement = null;
    this.createShopInterface();
    this.installGlobalHandlers();
  }

  generateShopInventory() {
    return {
      garlic: { stock: 20, price: 1 },
      ginseng: { stock: 15, price: 4 },
      blood_moss: { stock: 12, price: 3 },
      black_pearl: { stock: 10, price: 5 },
      spider_silk: { stock: 8, price: 8 },
      sulfurous_ash: { stock: 10, price: 6 },
      nightshade: { stock: 5, price: 12 },
      mandrake_root: { stock: 3, price: 15 },
    };
  }

  createShopInterface() {
    if (typeof document === 'undefined') return;
    this.container = createElement('div', 'shop-overlay hidden');
    const windowEl = createElement('div', 'shop-window');

    const header = createElement('div', 'shop-header');
    this.titleElement = createElement('h2', '', `${this.npc?.name ?? 'Magic Shop'}`);
    this.goldElement = createElement('span', 'shop-gold', 'Gold: 0');
    const closeButton = createElement('button', 'shop-close', '×');
    closeButton.type = 'button';
    closeButton.addEventListener('click', () => this.close());
    header.append(this.titleElement, this.goldElement, closeButton);

    this.listElement = createElement('div', 'shop-list');

    windowEl.append(header, this.listElement);
    this.container.append(windowEl);
    document.body.appendChild(this.container);
  }

  installGlobalHandlers() {
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', (event) => {
      if (!this.isOpen()) return;
      if (event.key === 'Escape') {
        this.close();
      }
    });
  }

  isOpen() {
    return this.container && !this.container.classList.contains('hidden');
  }

  open() {
    if (!this.container) return;
    if (this.onOpen) {
      this.onOpen(this);
    }
    this.renderInventory();
    this.container.classList.remove('hidden');
    this.container.setAttribute('aria-hidden', 'false');
  }

  close() {
    if (!this.container) return;
    this.container.classList.add('hidden');
    this.container.setAttribute('aria-hidden', 'true');
    if (this.onClose) {
      this.onClose(this);
    }
  }

  renderInventory() {
    if (!this.listElement) return;
    if (this.titleElement) {
      this.titleElement.textContent = this.npc?.name ?? 'Magic Shop';
    }
    this.listElement.replaceChildren();
    Object.entries(this.inventory).forEach(([type, data]) => {
      const row = createElement('div', 'shop-item');
      const name = this.reagentSystem?.getReagent?.(type)?.name ?? type;
      const stock = createElement('span', 'shop-stock', `Stock: ${data.stock}`);
      const price = createElement('span', 'shop-price', `${data.price} gp`);
      const nameEl = createElement('span', 'shop-name', name);
      const controls = createElement('div', 'shop-controls');

      const buyOne = createElement('button', 'shop-buy', 'Buy 1');
      buyOne.type = 'button';
      buyOne.disabled = data.stock <= 0;
      buyOne.addEventListener('click', () => this.buyReagent(type, 1));

      const buyFive = createElement('button', 'shop-buy', 'Buy 5');
      buyFive.type = 'button';
      buyFive.disabled = data.stock < 5;
      buyFive.addEventListener('click', () => this.buyReagent(type, 5));

      controls.append(buyOne, buyFive);
      row.append(nameEl, price, stock, controls);
      this.listElement.appendChild(row);
    });
    const gold = this.party?.gold ?? 0;
    if (this.goldElement) {
      this.goldElement.textContent = `Gold: ${gold}`;
    }
  }

  buyReagent(reagentType, quantity = 1) {
    const entry = this.inventory[reagentType];
    if (!entry) return false;
    const amount = Number.isFinite(quantity) ? Math.max(1, Math.round(quantity)) : 1;
    if (entry.stock < amount) {
      this.showMessage('I have not that many in stock.');
      return false;
    }
    const totalCost = entry.price * amount;
    if (!this.party || this.party.gold < totalCost) {
      this.showMessage('Thou hast not enough gold.');
      return false;
    }
    const added = this.inventoryManager?.addReagent?.(reagentType, amount, {
      reagentSystem: this.reagentSystem,
    });
    if (!added) {
      this.showMessage('Thy packs cannot hold more reagents.');
      return false;
    }
    entry.stock -= amount;
    this.party.gold -= totalCost;
    this.showMessage(`Thou purchase${amount > 1 ? ' ' + amount : 's'} ${this.reagentSystem?.getReagent?.(reagentType)?.name ?? reagentType}.`);
    this.renderInventory();
    if (this.onTransaction) {
      this.onTransaction({ type: 'buy', reagent: reagentType, quantity: amount, cost: totalCost });
    }
    return true;
  }
}
