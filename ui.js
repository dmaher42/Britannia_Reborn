import { Character } from './Character.js';
import { ItemHelpers } from './inventory.js';

const formatWeight = (weight = 0) => `${weight.toFixed(1)} st`;

const createCombatPanel = (sidebar) => {
  const logPanel = sidebar.querySelector('.panel.log');
  let panel = document.getElementById('combatPanel');
  if (panel) return panel;
  panel = document.createElement('section');
  panel.id = 'combatPanel';
  panel.className = 'panel combat';
  panel.hidden = true;

  const header = document.createElement('header');
  const title = document.createElement('h2');
  title.textContent = 'Encounter';
  header.appendChild(title);

  const turnLabel = document.createElement('div');
  turnLabel.className = 'combat-status';
  turnLabel.innerHTML = '<span class="combat-turn">Awaiting enemies...</span>';

  const enemyList = document.createElement('div');
  enemyList.className = 'combat-enemies';

  panel.append(header, turnLabel, enemyList);
  if (logPanel) {
    sidebar.insertBefore(panel, logPanel);
  } else {
    sidebar.appendChild(panel);
  }
  return panel;
};

const buildTooltip = (item, character) => {
  if (!item || !character) return '';
  const parts = [];
  if (item.type === 'weapon') {
    const current = character.equipment.weapon?.stats?.attack ?? 0;
    const diff = item.stats?.attack ?? 0 - current;
    parts.push(`Attack ${item.stats?.attack ?? 0} (${diff >= 0 ? '+' : ''}${diff})`);
  } else if (item.type === 'armor') {
    const current = character.equipment.armor?.stats?.defense ?? 0;
    const diff = item.stats?.defense ?? 0 - current;
    parts.push(`Defense ${item.stats?.defense ?? 0} (${diff >= 0 ? '+' : ''}${diff})`);
  }
  if (item.stats?.str_req) {
    parts.push(`Requires STR ${item.stats.str_req}`);
  }
  if (item.stats?.hp_restore) {
    parts.push(`Restores ${item.stats.hp_restore} HP`);
  }
  if (item.stats?.mp_restore) {
    parts.push(`Restores ${item.stats.mp_restore} MP`);
  }
  return parts.join(' • ');
};

export function setupUI({
  onAttack,
  onDefend,
  onUseItemAction,
  onEquip,
  onUseItem,
  onSave,
  onLoad,
  onAllocateStat,
} = {}) {
  const partyList = document.getElementById('partyList');
  const inventoryList = document.getElementById('inventoryList');
  const inventoryWeight = document.getElementById('inventoryWeight');
  const inventoryGold = document.getElementById('inventoryGold');
  const worldArea = document.getElementById('worldArea');
  const worldTile = document.getElementById('worldTile');
  const terrainLabel = document.getElementById('terrainLabel');
  const statusText = document.getElementById('statusText');
  const logContainer = document.getElementById('log');
  const toast = document.getElementById('toast');
  const sidebar = document.querySelector('.sidebar');

  const combatPanel = createCombatPanel(sidebar);
  const combatTurnLabel = combatPanel.querySelector('.combat-turn');
  const combatEnemyList = combatPanel.querySelector('.combat-enemies');

  const attackButton = document.getElementById('btn-attack');
  const defendButton = document.getElementById('btn-defend');
  const useItemButton = document.getElementById('btn-use-item');
  const saveButton = document.getElementById('btn-save');
  const loadButton = document.getElementById('btn-load');

  let toastTimer = 0;
  let selectedEnemyId = null;
  let highlightConsumables = false;
  let activePanels = { character: true, inventory: false, journal: false };

  const setButton = (button, handler) => {
    if (button && typeof handler === 'function') {
      button.addEventListener('click', handler);
    }
  };

  setButton(attackButton, () => onAttack?.(selectedEnemyId));
  setButton(defendButton, () => onDefend?.());
  setButton(useItemButton, () => onUseItemAction?.());
  setButton(saveButton, () => onSave?.());
  setButton(loadButton, () => onLoad?.());

  partyList?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action="allocate"]');
    if (!button) return;
    const stat = button.dataset.stat;
    if (stat) {
      onAllocateStat?.(stat);
    }
  });

  inventoryList?.addEventListener('click', (event) => {
    const actionButton = event.target.closest('[data-action]');
    if (!actionButton) return;
    const { action, itemId } = actionButton.dataset;
    if (!itemId) return;
    if (action === 'equip') {
      onEquip?.(itemId);
    } else if (action === 'use') {
      onUseItem?.(itemId);
    }
  });

  const renderCharacter = (character) => {
    if (!partyList) return;
    partyList.replaceChildren();
    if (!character) return;
    const li = document.createElement('li');
    li.className = 'party-entry leader';

    const header = document.createElement('div');
    header.className = 'header';
    header.innerHTML = `<span>${character.name}</span><span>Level ${character.level}</span>`;

    const xpNeeded = Character.xpForLevel(character.level + 1);
    const xpRow = document.createElement('div');
    xpRow.className = 'stats';
    xpRow.innerHTML = `<span>HP ${character.hp} / ${character.hpMax}</span><span>MP ${character.mp} / ${character.mpMax}</span>`;

    const derived = document.createElement('div');
    derived.className = 'stats';
    derived.innerHTML = `<span>Attack ${character.attack}</span><span>Defense ${character.defense}</span>`;

    const statList = document.createElement('div');
    statList.className = 'stats';
    const available = character.availableStatPoints ?? 0;
    statList.innerHTML = Character.BASE_STATS.map((stat) => {
      const value = character.stats[stat];
      const button = available > 0 ? `<button type="button" data-action="allocate" data-stat="${stat}">+</button>` : '';
      return `<span>${stat}: ${value}</span>${button}`;
    }).join('');

    const xpInfo = document.createElement('div');
    xpInfo.className = 'stats';
    xpInfo.innerHTML = `<span>XP ${character.xp} / ${xpNeeded}</span><span>${available} stat pts</span>`;

    const carry = document.createElement('div');
    carry.className = 'carry';
    carry.innerHTML = `<span>Equipped</span><span>${formatWeight(character.equippedWeight())} / ${character.stats.STR}</span>`;

    const carry2 = document.createElement('div');
    carry2.className = 'carry';
    carry2.innerHTML = `<span>Backpack</span><span>${formatWeight(character.backpackWeight())} / ${character.stats.STR * 2}</span>`;

    const equipment = document.createElement('div');
    equipment.className = 'stats';
    equipment.innerHTML = `<span>Weapon: ${character.equipment.weapon?.name ?? 'None'}</span><span>Armor: ${character.equipment.armor?.name ?? 'None'}</span>`;

    li.append(header, xpRow, derived, statList, xpInfo, carry, carry2, equipment);
    partyList.appendChild(li);
  };

  const renderInventory = (inventory, character) => {
    if (!inventoryList) return;
    inventoryList.replaceChildren();
    if (!inventory) return;
    inventory.items.forEach((item) => {
      const div = document.createElement('div');
      div.className = 'inventory-item';
      if (highlightConsumables && item.type === 'consumable') {
        div.classList.add('highlight');
      }
      div.dataset.itemId = item.id;
      const tooltip = buildTooltip(item, character);
      if (tooltip) {
        div.dataset.tip = tooltip;
      }
      const meta = document.createElement('div');
      meta.className = 'meta';
      const quantity = item.quantity ?? 1;
      const lines = [
        `<strong>${item.name}</strong>`,
        `${item.type.charAt(0).toUpperCase() + item.type.slice(1)} • Qty ${quantity}`,
        `Weight ${item.weight ?? item.stats?.weight ?? 0}`,
      ];
      if (item.stats?.attack) lines.push(`Attack +${item.stats.attack}`);
      if (item.stats?.defense) lines.push(`Defense +${item.stats.defense}`);
      if (item.stats?.hp_restore) lines.push(`Heal ${item.stats.hp_restore}`);
      if (item.stats?.mp_restore) lines.push(`Restore ${item.stats.mp_restore} MP`);
      meta.innerHTML = lines.map((text) => `<span>${text}</span>`).join('');

      const actions = document.createElement('div');
      actions.className = 'actions';
      if (ItemHelpers.isEquippable(item)) {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.action = 'equip';
        button.dataset.itemId = item.id;
        button.textContent = 'Equip';
        actions.appendChild(button);
      }
      if (ItemHelpers.isConsumable(item)) {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.action = 'use';
        button.dataset.itemId = item.id;
        button.textContent = 'Use';
        actions.appendChild(button);
      }

      div.append(meta, actions);
      inventoryList.appendChild(div);
    });

    if (inventoryWeight) {
      inventoryWeight.textContent = formatWeight(inventory.totalWeight());
    }
    if (inventoryGold) {
      inventoryGold.textContent = `${inventory.gold ?? 0}`;
    }
  };

  const renderCombat = (state) => {
    if (!combatPanel || !combatEnemyList || !combatTurnLabel) return;
    if (!state?.active) {
      combatPanel.hidden = true;
      selectedEnemyId = null;
      attackButton.disabled = true;
      defendButton.disabled = true;
      useItemButton.disabled = true;
      combatEnemyList.replaceChildren();
      return;
    }
    combatPanel.hidden = false;
    combatTurnLabel.textContent = state.turn === 'player' ? 'Your turn' : "Enemy's turn";
    const canAct = state.turn === 'player';
    attackButton.disabled = !canAct;
    defendButton.disabled = !canAct;
    useItemButton.disabled = !canAct;

    combatEnemyList.replaceChildren();
    state.enemies.forEach((enemy) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'combat-enemy';
      button.dataset.enemyId = enemy.id;
      if (!enemy.alive) {
        button.classList.add('defeated');
        button.disabled = true;
      }
      if (selectedEnemyId === enemy.id) {
        button.classList.add('selected');
      }
      button.innerHTML = `<span class="name">${enemy.name}</span><span class="hp">${enemy.hp} / ${enemy.hpMax}</span>`;
      button.addEventListener('click', () => {
        selectedEnemyId = enemy.id;
        renderCombat(state);
      });
      combatEnemyList.appendChild(button);
    });
    if (!selectedEnemyId) {
      const firstAlive = state.enemies.find((enemy) => enemy.alive);
      selectedEnemyId = firstAlive?.id ?? null;
    }
  };

  const setStatus = (text) => {
    if (statusText) statusText.textContent = text;
  };

  const setTerrain = (tileName) => {
    if (terrainLabel) terrainLabel.textContent = `Terrain: ${tileName}`;
  };

  const setWorldInfo = ({ area, tile }) => {
    if (worldArea) worldArea.textContent = area ?? '-';
    if (worldTile) worldTile.textContent = tile ?? '-';
  };

  const log = (message) => {
    if (!logContainer || !message) return;
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.textContent = message;
    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight;
  };

  const showToast = (message, duration = 2200) => {
    if (!toast || !message) return;
    toast.textContent = message;
    toast.hidden = false;
    toast.classList.add('visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.classList.remove('visible');
      toastTimer = 0;
    }, duration);
  };

  const setPanelsActive = ({ character, inventory, journal }) => {
    activePanels = { character, inventory, journal };
    const characterPanel = partyList?.closest('.panel');
    const inventoryPanel = inventoryList?.closest('.panel');
    const journalPanel = logContainer?.closest('.panel');
    if (characterPanel) {
      characterPanel.classList.toggle('panel-active', !!character);
    }
    if (inventoryPanel) {
      inventoryPanel.classList.toggle('panel-active', !!inventory);
    }
    if (journalPanel) {
      journalPanel.classList.toggle('panel-active', !!journal);
    }
  };

  const highlightItems = (value) => {
    highlightConsumables = value;
  };

  return {
    renderCharacter,
    renderInventory,
    renderCombat,
    setStatus,
    setTerrain,
    setWorldInfo,
    log,
    showToast,
    setPanelsActive,
    highlightConsumables: highlightItems,
  };
}

