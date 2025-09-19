const formatWeight = (weight) => `${weight.toFixed(1)} st`;

export function setupUI({
  party,
  inventory,
  spellbook,
  combat,
  destinations = [],
  currentDestinationId = '',
  onTravel,
  onTalk,
  onCast,
  onStartCombat,
  onAddLoot,
  onEquipItem,
  onUseItem
}) {
  const partyList = document.getElementById('partyList');
  const inventoryList = document.getElementById('inventoryList');
  const inventoryWeight = document.getElementById('inventoryWeight');
  const inventoryGold = document.getElementById('inventoryGold');
  const terrainLabel = document.getElementById('terrainLabel');
  const statusText = document.getElementById('statusText');
  const logContainer = document.getElementById('log');
  const toast = document.getElementById('toast');
  const destinationSelect = document.getElementById('destinationSelect');
  const buttonTravel = document.getElementById('btnTravel');
  const buttonTalk = document.getElementById('btnTalk');
  const buttonCast = document.getElementById('btnCast');
  const buttonCombat = document.getElementById('btnCombat');
  const buttonLoot = document.getElementById('btnAddLoot');
  const sidebar = document.querySelector('.sidebar');
  const logPanelElement = document.querySelector('.panel.log');

  let combatPanel = null;
  let combatTurnLabel = null;
  let combatEnemyList = null;
  let combatAttackButton = null;
  let combatCastButton = null;

  if (combat && sidebar) {
    combatPanel = document.getElementById('combatPanel');
    if (!combatPanel) {
      combatPanel = document.createElement('section');
      combatPanel.id = 'combatPanel';
      combatPanel.className = 'panel combat';
      combatPanel.hidden = true;

      const header = document.createElement('header');
      const title = document.createElement('h2');
      title.textContent = 'Combat';
      header.appendChild(title);

      const statusRow = document.createElement('div');
      statusRow.className = 'combat-status';
      combatTurnLabel = document.createElement('span');
      combatTurnLabel.className = 'combat-turn';
      combatTurnLabel.textContent = 'Awaiting orders';
      statusRow.appendChild(combatTurnLabel);

      const commandRow = document.createElement('div');
      commandRow.className = 'combat-commands';
      combatAttackButton = document.createElement('button');
      combatAttackButton.type = 'button';
      combatAttackButton.className = 'combat-action combat-action-attack';
      combatAttackButton.textContent = 'Attack';
      combatAttackButton.disabled = true;
      commandRow.appendChild(combatAttackButton);

      combatCastButton = document.createElement('button');
      combatCastButton.type = 'button';
      combatCastButton.className = 'combat-action combat-action-cast';
      combatCastButton.textContent = 'Cast Fire Dart';
      combatCastButton.disabled = true;
      commandRow.appendChild(combatCastButton);

      combatEnemyList = document.createElement('div');
      combatEnemyList.className = 'combat-enemies';

      combatPanel.append(header, statusRow, commandRow, combatEnemyList);

      if (logPanelElement && logPanelElement.parentElement === sidebar) {
        sidebar.insertBefore(combatPanel, logPanelElement);
      } else {
        sidebar.appendChild(combatPanel);
      }
    } else {
      combatTurnLabel = combatPanel.querySelector('.combat-turn');
      combatEnemyList = combatPanel.querySelector('.combat-enemies');
      combatAttackButton = combatPanel.querySelector('.combat-action-attack');
      combatCastButton = combatPanel.querySelector('.combat-action-cast');
    }
  }

  const canCastSpells = !!spellbook;
  let selectedEnemyId = null;

  let toastTimeout = null;
  let travelBusy = false;
  let activeDestinationId = currentDestinationId;
  const travelButtonLabel = buttonTravel?.textContent ?? 'Travel';

  const addButtonHandler = (button, handler) => {
    if (button && typeof handler === 'function') {
      button.addEventListener('click', handler);
    }
  };

  const setTravelBusy = (busy) => {
    travelBusy = !!busy;
    if (destinationSelect) {
      const hasOptions = destinationSelect.options.length > 0;
      destinationSelect.disabled = travelBusy || !hasOptions;
    }
    if (buttonTravel) {
      if (travelBusy) {
        buttonTravel.disabled = true;
        buttonTravel.textContent = 'Traveling...';
      } else {
        const hasOptions = destinationSelect ? destinationSelect.options.length > 0 : true;
        buttonTravel.disabled = !hasOptions;
        buttonTravel.textContent = travelButtonLabel;
      }
    }
  };

  const setDestinations = (list = [], activeId = activeDestinationId) => {
    if (!destinationSelect) return;
    destinationSelect.replaceChildren();
    if (typeof activeId === 'string') {
      activeDestinationId = activeId;
    }
    list.forEach((dest) => {
      if (!dest || !dest.id) return;
      const option = document.createElement('option');
      option.value = dest.id;
      option.textContent = dest.name ?? dest.id;
      destinationSelect.appendChild(option);
    });
    const options = Array.from(destinationSelect.options);
    if (options.length > 0) {
      const hasActive = options.some((option) => option.value === activeDestinationId);
      destinationSelect.value = hasActive ? activeDestinationId : options[0].value;
      activeDestinationId = destinationSelect.value;
    } else {
      activeDestinationId = '';
    }
    setTravelBusy(travelBusy);
  };

  const setActiveDestination = (id) => {
    if (!destinationSelect || typeof id !== 'string' || id.length === 0) return;
    activeDestinationId = id;
    const options = Array.from(destinationSelect.options);
    const hasActive = options.some((option) => option.value === id);
    if (hasActive) {
      destinationSelect.value = id;
    }
  };

  addButtonHandler(buttonTalk, onTalk);
  addButtonHandler(buttonCast, onCast);
  addButtonHandler(buttonCombat, onStartCombat);
  addButtonHandler(buttonLoot, onAddLoot);

  if (destinationSelect) {
    destinationSelect.addEventListener('change', () => {
      if (destinationSelect.value) {
        activeDestinationId = destinationSelect.value;
      }
    });
  }

  if (buttonTravel && typeof onTravel === 'function') {
    buttonTravel.addEventListener('click', () => {
      if (travelBusy) return;
      const target = destinationSelect?.value;
      if (target) {
        onTravel(target);
      }
    });
  } else if (buttonTravel) {
    buttonTravel.disabled = true;
  }

  if (buttonCast && spellbook && party) {
    buttonCast.disabled = false;
  }

  function refreshParty() {
    if (!partyList) return;
    partyList.replaceChildren();
    const fragment = document.createDocumentFragment();
    party.members.forEach((member, index) => {
      const li = document.createElement('li');
      li.className = 'party-entry' + (index === party.leaderIndex ? ' leader' : '');

      const header = document.createElement('div');
      header.className = 'header';
      header.innerHTML = `<span>${member.name}</span><span class="class">${member.cls}</span>`;

      const stats = document.createElement('div');
      stats.className = 'stats';
      stats.innerHTML = `<span>HP ${Math.round(member.hp)}/${Math.round(member.hpMax)}</span><span>MP ${Math.round(member.mp)}/${Math.round(member.mpMax)}</span>`;

      const carry = document.createElement('div');
      carry.className = 'carry';
      carry.innerHTML = `<span>Equipped</span><span>${formatWeight(member.equippedWeight())} / ${member.STR}</span>`;

      const pack = document.createElement('div');
      pack.className = 'carry';
      pack.innerHTML = `<span>Backpack</span><span>${formatWeight(member.backpackWeight())} / ${(member.STR * 2).toFixed(1)}</span>`;

      const speed = document.createElement('div');
      speed.className = 'speed' + (member.isOverweight() ? ' overweight' : '');
      speed.innerHTML = `<span>Speed</span><span>${Math.round(member.speed())} u/s</span>`;

      li.append(header, stats, carry, pack, speed);
      fragment.appendChild(li);
    });
    partyList.appendChild(fragment);
  }

  function refreshInventory() {
    if (!inventoryList) return;
    inventoryList.replaceChildren();
    const fragment = document.createDocumentFragment();
    inventory.items.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'inventory-item';
      const weight = item.weight * item.qty;
      const nameSpan = document.createElement('span');
      nameSpan.textContent = item.name;

      const qtySpan = document.createElement('span');
      qtySpan.textContent = `x${item.qty}`;

      const weightSpan = document.createElement('span');
      weightSpan.textContent = formatWeight(weight);

      row.append(nameSpan, qtySpan, weightSpan);

      const actions = document.createElement('div');
      actions.className = 'inventory-actions';
      let hasAction = false;

      if (item.equip && typeof onEquipItem === 'function') {
        const equipButton = document.createElement('button');
        equipButton.type = 'button';
        equipButton.className = 'inventory-action equip';
        equipButton.textContent = 'Equip';
        equipButton.addEventListener('click', (event) => {
          event.stopPropagation();
          onEquipItem(item.id);
        });
        actions.appendChild(equipButton);
        hasAction = true;
      }

      if (item.tag === 'consumable' && typeof onUseItem === 'function') {
        const useButton = document.createElement('button');
        useButton.type = 'button';
        useButton.className = 'inventory-action use';
        useButton.textContent = 'Use';
        useButton.addEventListener('click', (event) => {
          event.stopPropagation();
          onUseItem(item.id);
        });
        actions.appendChild(useButton);
        hasAction = true;
      }

      if (hasAction) {
        row.appendChild(actions);
      }

      fragment.appendChild(row);
    });
    inventoryList.appendChild(fragment);
    if (inventoryWeight) {
      inventoryWeight.textContent = formatWeight(inventory.totalWeight());
    }
    if (inventoryGold) {
      inventoryGold.textContent = `${inventory.gold ?? 0}`;
    }
  }

  function setTerrain(name) {
    if (terrainLabel) {
      terrainLabel.textContent = `Terrain: ${name ?? '-'}`;
    }
  }

  function setStatus(message) {
    if (statusText) {
      statusText.textContent = message;
    }
  }

  function log(message) {
    if (!logContainer) return;
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.textContent = message;
    logContainer.appendChild(entry);
    while (logContainer.children.length > 40) {
      logContainer.removeChild(logContainer.firstChild);
    }
    logContainer.scrollTop = logContainer.scrollHeight;
  }

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    toast.classList.add('visible');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.classList.remove('visible');
      toastTimeout = setTimeout(() => {
        toast.hidden = true;
      }, 250);
    }, 2200);
  }

  function renderCombatState(state = null) {
    if (!combatPanel) return;
    const snapshot = state ?? (typeof combat?.getState === 'function' ? combat.getState() : null);
    const isActive = !!snapshot?.active;
    combatPanel.hidden = !isActive;

    if (!isActive) {
      selectedEnemyId = null;
      if (combatTurnLabel) {
        combatTurnLabel.textContent = 'Awaiting orders';
      }
      if (combatEnemyList) {
        combatEnemyList.replaceChildren();
      }
      if (combatAttackButton) {
        combatAttackButton.disabled = true;
      }
      if (combatCastButton) {
        combatCastButton.disabled = true;
      }
      return;
    }

    const enemies = Array.isArray(snapshot?.enemies) ? snapshot.enemies : [];
    const aliveEnemies = enemies.filter((enemy) => enemy.alive);
    if (!selectedEnemyId || !aliveEnemies.some((enemy) => enemy.id === selectedEnemyId)) {
      selectedEnemyId = aliveEnemies[0]?.id ?? null;
    }

    if (combatTurnLabel) {
      combatTurnLabel.textContent = snapshot.turn === 'player' ? 'Player Turn' : 'Enemy Turn';
    }

    if (combatEnemyList) {
      combatEnemyList.replaceChildren();
      const fragment = document.createDocumentFragment();
      enemies.forEach((enemy) => {
        const enemyButton = document.createElement('button');
        enemyButton.type = 'button';
        enemyButton.dataset.enemyId = enemy.id;
        const classes = ['combat-enemy'];
        if (enemy.id === selectedEnemyId) classes.push('selected');
        if (!enemy.alive) classes.push('defeated');
        enemyButton.className = classes.join(' ');
        enemyButton.disabled = !enemy.alive;

        const nameSpan = document.createElement('span');
        nameSpan.className = 'name';
        nameSpan.textContent = enemy.name;

        const hpSpan = document.createElement('span');
        hpSpan.className = 'hp';
        hpSpan.textContent = enemy.alive ? `${enemy.hp}/${enemy.hpMax} HP` : 'Downed';

        enemyButton.append(nameSpan, hpSpan);
        enemyButton.addEventListener('click', () => {
          if (!enemy.alive) return;
          selectedEnemyId = enemy.id;
          renderCombatState(snapshot);
        });
        fragment.appendChild(enemyButton);
      });

      if (!fragment.hasChildNodes()) {
        const emptyState = document.createElement('div');
        emptyState.className = 'combat-empty';
        emptyState.textContent = 'No enemies remain.';
        fragment.appendChild(emptyState);
      }

      combatEnemyList.appendChild(fragment);
    }

    const canAct = snapshot.turn === 'player';
    const hasTarget = aliveEnemies.length > 0 && !!selectedEnemyId;
    if (combatAttackButton) {
      combatAttackButton.disabled = !(canAct && hasTarget);
    }
    if (combatCastButton) {
      combatCastButton.disabled = !(canAct && hasTarget && canCastSpells);
    }
  }

  if (combat && combatAttackButton) {
    combatAttackButton.addEventListener('click', () => {
      const result = combat.playerAttack(selectedEnemyId);
      if (!result?.success && result?.message) {
        showToast(result.message);
      }
    });
  }

  if (combat && combatCastButton) {
    combatCastButton.addEventListener('click', () => {
      const result = combat.playerCast('fire_dart', selectedEnemyId);
      if (!result?.success && result?.message) {
        showToast(result.message);
      }
    });
  }

  if (combat) {
    renderCombatState(typeof combat.getState === 'function' ? combat.getState() : null);
    combat.onEvent((event, payload) => {
      if (event === 'log' && typeof payload === 'string') {
        log(payload);
        return;
      }
      if (event === 'state') {
        renderCombatState(payload);
        refreshParty();
        refreshInventory();
        return;
      }
      if (event === 'complete') {
        renderCombatState(typeof combat.getState === 'function' ? combat.getState() : null);
        if (payload?.victory) {
          showToast('Victory!');
        } else {
          showToast('The party must regroup!');
        }
      }
    });
  } else {
    renderCombatState();
  }

  setDestinations(destinations, currentDestinationId);
  refreshParty();
  refreshInventory();

  return {
    refreshParty,
    refreshInventory,
    setTerrain,
    setStatus,
    log,
    showToast,
    setDestinations,
    setActiveDestination,
    setTravelBusy
  };
}
