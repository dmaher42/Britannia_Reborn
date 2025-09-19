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
  onAddLoot
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

  if (combat) {
    combat.onEvent((event, payload) => {
      if (event === 'log' && typeof payload === 'string') {
        log(payload);
      }
      if (event === 'complete' && payload?.victory) {
        showToast('Victory!');
      }
    });
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
      row.innerHTML = `<span>${item.name}</span><span>x${item.qty}</span><span>${formatWeight(weight)}</span>`;
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
