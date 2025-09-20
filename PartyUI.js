const asElement = (value) => {
  if (!value) return null;
  if (value instanceof HTMLElement) return value;
  if (typeof value === 'string') {
    return document.querySelector(value);
  }
  return null;
};

const formatPercent = (current, max) => {
  if (!Number.isFinite(current) || !Number.isFinite(max) || max <= 0) return 0;
  return Math.max(0, Math.min(100, (current / max) * 100));
};

const slotLabels = {
  weapon: 'Weapon',
  armor: 'Armor',
  shield: 'Shield',
  ring: 'Ring',
};

export class PartyUI {
  constructor({
    party,
    inventory,
    portraitContainer,
    equipmentContainer,
    inventoryContainer,
    onSelectMember,
    onMakeLeader,
    onEquip,
    onUnequip,
  }) {
    this.party = party;
    this.inventory = inventory;
    this.portraitContainer = asElement(portraitContainer);
    this.equipmentContainer = asElement(equipmentContainer);
    this.inventoryContainer = asElement(inventoryContainer);
    this.callbacks = {
      onSelectMember: typeof onSelectMember === 'function' ? onSelectMember : null,
      onMakeLeader: typeof onMakeLeader === 'function' ? onMakeLeader : null,
      onEquip: typeof onEquip === 'function' ? onEquip : null,
      onUnequip: typeof onUnequip === 'function' ? onUnequip : null,
    };
    this.selectedMember = party?.leader ?? party?.members?.[0] ?? null;
    if (this.inventory && typeof this.inventory.setActiveMember === 'function') {
      this.inventory.setActiveMember(this.selectedMember);
    }
    this.dragData = null;
    this.createPartyPortraits();
    this.createEquipmentPanel();
    this.createInventoryPanel();
    this.render();
  }

  createPartyPortraits() {
    if (!this.portraitContainer) return;
    this.portraitContainer.innerHTML = '';
  }

  createEquipmentPanel() {
    if (!this.equipmentContainer) return;
    this.equipmentContainer.innerHTML = '';
  }

  createInventoryPanel() {
    if (!this.inventoryContainer) return;
    this.inventoryContainer.innerHTML = '';
  }

  setSelectedMember(member) {
    if (!member) return;
    this.selectedMember = member;
    if (this.inventory && typeof this.inventory.setActiveMember === 'function') {
      this.inventory.setActiveMember(member);
    }
    this.callbacks.onSelectMember?.(member);
    this.render();
  }

  render() {
    this.renderPortraits();
    this.renderEquipment();
    this.renderInventory();
  }

  renderPortraits() {
    if (!this.portraitContainer) return;
    this.portraitContainer.replaceChildren();
    if (!this.party) return;
    this.party.members.forEach((member, index) => {
      const portrait = document.createElement('button');
      portrait.type = 'button';
      portrait.className = 'party-portrait';
      portrait.dataset.memberId = member.id;
      if (member === this.selectedMember) {
        portrait.classList.add('selected');
      }
      if (member === this.party.leader) {
        portrait.classList.add('leader');
      }
      portrait.innerHTML = `
        <span class="portrait-name">${member.name}</span>
        <span class="portrait-class">${member.class}</span>
        <div class="bar health"><div style="width:${formatPercent(member.health.current, member.health.max)}%"></div></div>
        <div class="bar mana"><div style="width:${formatPercent(member.mana.current, member.mana.max)}%"></div></div>
      `;
      portrait.addEventListener('click', () => {
        this.setSelectedMember(member);
      });
      portrait.addEventListener('dblclick', () => {
        this.callbacks.onMakeLeader?.(index, member);
        this.renderPortraits();
      });
      this.portraitContainer.appendChild(portrait);
    });
  }

  renderEquipment() {
    if (!this.equipmentContainer) return;
    this.equipmentContainer.replaceChildren();
    const member = this.selectedMember;
    if (!member) return;
    const slots = ['weapon', 'armor', 'shield', 'ring'];
    slots.forEach((slot) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'equipment-slot';
      wrapper.dataset.slot = slot;
      wrapper.setAttribute('aria-label', `${slotLabels[slot] ?? slot}`);
      wrapper.innerHTML = `
        <header>${slotLabels[slot] ?? slot}</header>
        <div class="slot-body" data-slot="${slot}" draggable="${member.equipment[slot] ? 'true' : 'false'}">
          ${member.equipment[slot] ? `<span>${member.equipment[slot].name}</span>` : '<span>Empty</span>'}
        </div>
      `;
      const body = wrapper.querySelector('.slot-body');
      body.addEventListener('dragstart', (event) => this.handleSlotDragStart(event, slot));
      body.addEventListener('dragover', (event) => event.preventDefault());
      body.addEventListener('drop', (event) => this.handleSlotDrop(event, slot));
      body.addEventListener('click', () => {
        if (member.equipment[slot]) {
          this.callbacks.onUnequip?.(slot, member);
        }
      });
      this.equipmentContainer.appendChild(wrapper);
    });
  }

  renderInventory() {
    if (!this.inventoryContainer || !this.inventory) return;
    this.inventoryContainer.replaceChildren();
    const items = this.inventory.listBackpack ? this.inventory.listBackpack() : [];
    items.forEach((item) => {
      const entry = document.createElement('div');
      entry.className = 'inventory-item';
      entry.dataset.itemId = item.id;
      entry.draggable = true;
      entry.innerHTML = `
        <span class="item-name">${item.name}</span>
        <span class="item-weight">${Number.isFinite(item.weight) ? item.weight.toFixed(1) : Number.isFinite(item?.stats?.weight) ? item.stats.weight.toFixed(1) : '0.0'} st</span>
      `;
      entry.addEventListener('dragstart', (event) => this.handleInventoryDragStart(event, item.id));
      entry.addEventListener('click', () => {
        this.callbacks.onEquip?.(item.id, this.selectedMember);
      });
      this.inventoryContainer.appendChild(entry);
    });
  }

  handleInventoryDragStart(event, itemId) {
    this.dragData = { source: 'inventory', itemId };
    event.dataTransfer?.setData('text/plain', itemId);
  }

  handleSlotDragStart(event, slot) {
    const member = this.selectedMember;
    if (!member?.equipment?.[slot]) return;
    this.dragData = { source: 'slot', slot, itemId: member.equipment[slot].id };
    event.dataTransfer?.setData('text/plain', member.equipment[slot].id);
  }

  handleSlotDrop(event, slot) {
    event.preventDefault();
    const data = this.dragData;
    if (!data) return;
    if (data.source === 'inventory') {
      this.callbacks.onEquip?.(data.itemId, this.selectedMember, slot);
    } else if (data.source === 'slot' && data.slot === slot) {
      this.callbacks.onUnequip?.(slot, this.selectedMember);
    }
    this.dragData = null;
  }

  updateCombatDisplay(state = {}) {
    if (!this.portraitContainer) return;
    const targetMap = new Map();
    if (this.party?.members) {
      this.party.members.forEach((member) => {
        if (member.target) {
          targetMap.set(member.id, member.target.name);
        }
      });
    }
    this.portraitContainer.querySelectorAll('.party-portrait').forEach((portrait) => {
      const memberId = portrait.dataset.memberId;
      const targetName = targetMap.get(memberId);
      portrait.dataset.target = targetName ?? '';
      portrait.classList.toggle('has-target', Boolean(targetName));
    });
  }
}

