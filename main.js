import { Character } from './Character.js';
import { Player } from './Player.js';
import { GameMap } from './GameMap.js';
import { MapRenderer } from './MapRenderer.js';
import { ObjectRenderer } from './ObjectRenderer.js';
import { InteractionSystem } from './InteractionSystem.js';
import { InputController } from './controls.js';
import { MessageDisplay } from './MessageDisplay.js';
import { WorldInventory } from './inventory.js';
import { Item, Door, Container, Lever } from './WorldObject.js';
import { SaveManager, buildSaveData } from './SaveManager.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const deviceRatio = Math.min(window.devicePixelRatio || 1, 2);

const statusElement = document.getElementById('statusText');
const modeElement = document.getElementById('modeIndicator');
const messageLogElement = document.getElementById('messageLog');
const equippedList = document.getElementById('equippedList');
const inventoryList = document.getElementById('inventoryList');
const equippedWeightLabel = document.getElementById('equippedWeight');
const backpackWeightLabel = document.getElementById('backpackWeight');
const areaLabel = document.getElementById('areaLabel');
const tileLabel = document.getElementById('tileLabel');
const characterNameLabel = document.getElementById('characterName');
const hpLabel = document.getElementById('hpLabel');
const mpLabel = document.getElementById('mpLabel');
const statsList = document.getElementById('statList');
const saveButton = document.getElementById('saveButton');
const loadButton = document.getElementById('loadButton');
const inventoryPanel = document.querySelector('.inventory-panel');

const map = new GameMap();
const renderer = new MapRenderer();
const objectRenderer = new ObjectRenderer();
const messageDisplay = new MessageDisplay({
  logElement: messageLogElement,
  statusElement,
  modeElement,
});

const saveManager = new SaveManager();
const input = new InputController(window);

let character = new Character({
  name: 'Avatar',
  stats: { STR: 14, DEX: 12, INT: 12, VIT: 12, LUK: 12 },
});
let player = new Player(character, {
  x: (map.currentArea?.spawn?.x ?? 2) + 0.5,
  y: (map.currentArea?.spawn?.y ?? 5) + 0.5,
  area: map.currentAreaId,
});
let inventory = new WorldInventory(character);
let interactionSystem = null;

function createStarterObjects() {
  const door = new Door('door1', 'wooden door', 0, 5, {
    description: 'A stout wooden door bound with iron.',
  });
  const secretDoor = new Door('secretDoor', 'secret stone door', 8, 5, {
    description: 'A section of wall looks slightly loose.',
    isOpen: false,
  });
  const lever = new Lever('lever1', 'stone lever', 5, 5, {
    toggles: 'secretDoor',
    description: 'A lever jutting from a metal plate bolted to the floor.',
  });
  const apple = new Item('apple1', 'red apple', 3, 2, {
    description: 'A crisp apple with a shine to its peel.',
    weight: 0.1,
    food: true,
  });
  const chest = new Container('chest1', 'wooden chest', 8, 8, {
    description: 'An old chest with an iron lock long since broken.',
    contains: [
      new Item('sword1', 'iron sword', 8, 8, {
        description: 'A sturdy iron blade, serviceable if not ornate.',
        weight: 3,
        stats: { attack: 5 },
        flags: { slot: 'weapon' },
      }),
      new Item('gold_pouch', 'pouch of gold', 8, 8, {
        description: 'A leather pouch jingling with a few coins.',
        weight: 0.4,
      }),
    ],
  });
  return [door, secretDoor, lever, apple, chest];
}

map.setObjects('starter-room', createStarterObjects());

function rebuildInteractionSystem() {
  if (interactionSystem) {
    interactionSystem.destroy();
  }
  interactionSystem = new InteractionSystem({
    canvas,
    map,
    player,
    inventory,
    character,
    messageDisplay,
    objectRenderer,
    onInventoryChange: () => renderInventory(),
  });
  messageDisplay.setMode(null);
  messageDisplay.setStatus('Moving freely. Use L/G/U/T to interact.');
}

rebuildInteractionSystem();

function resizeCanvas() {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(rect.width * deviceRatio));
  canvas.height = Math.max(1, Math.round(rect.height * deviceRatio));
  ctx.setTransform(deviceRatio, 0, 0, deviceRatio, 0, 0);
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function createContext() {
  return {
    map,
    world: map,
    inventory,
    player,
    character,
    messageDisplay,
  };
}

function formatWeight(value, limit) {
  return `${value.toFixed(1)} / ${limit}`;
}

function renderCharacter() {
  if (characterNameLabel) characterNameLabel.textContent = character.name;
  if (hpLabel) hpLabel.textContent = `${character.hp} / ${character.hpMax}`;
  if (mpLabel) mpLabel.textContent = `${character.mp} / ${character.mpMax}`;
  if (statsList) {
    statsList.innerHTML = '';
    Character.BASE_STATS.forEach((stat) => {
      const li = document.createElement('li');
      li.textContent = `${stat}: ${character.stats[stat]}`;
      statsList.appendChild(li);
    });
  }
}

function renderInventory() {
  if (equippedWeightLabel) {
    equippedWeightLabel.textContent = formatWeight(inventory.equippedWeight(), character.stats.STR);
  }
  if (backpackWeightLabel) {
    backpackWeightLabel.textContent = formatWeight(inventory.backpackWeight(), character.stats.STR * 2);
  }
  if (equippedList) {
    equippedList.replaceChildren();
    const equipped = inventory.listEquipped();
    ['weapon', 'armor', 'accessory'].forEach((slot) => {
      const item = equipped[slot];
      const li = document.createElement('li');
      li.className = 'equipped-slot';
      const title = slot.charAt(0).toUpperCase() + slot.slice(1);
      li.innerHTML = `<strong>${title}</strong><span>${item ? item.name : 'Empty'}</span>`;
      if (item) {
        const dropButton = document.createElement('button');
        dropButton.type = 'button';
        dropButton.dataset.action = 'unequip';
        dropButton.dataset.slot = slot;
        dropButton.textContent = 'Unequip';
        li.appendChild(dropButton);
      }
      equippedList.appendChild(li);
    });
  }
  if (inventoryList) {
    inventoryList.replaceChildren();
    inventory.listBackpack().forEach((item) => {
      const li = document.createElement('li');
      li.className = 'inventory-entry';
      li.dataset.itemId = item.id;
      const header = document.createElement('div');
      header.className = 'entry-title';
      const weightValue = Number.isFinite(item.weight)
        ? item.weight.toFixed(1)
        : Number.isFinite(item?.stats?.weight)
        ? item.stats.weight.toFixed(1)
        : '0.0';
      header.innerHTML = `<strong>${item.name}</strong><span>${weightValue} st</span>`;
      const description = document.createElement('p');
      description.textContent = item.description;
      const actions = document.createElement('div');
      actions.className = 'entry-actions';
      if (typeof item.onUse === 'function') {
        const useButton = document.createElement('button');
        useButton.type = 'button';
        useButton.dataset.action = 'use';
        useButton.dataset.itemId = item.id;
        useButton.textContent = 'Use';
        actions.appendChild(useButton);
      }
      const slot = inventory.slotFor(item);
      if (slot) {
        const equipButton = document.createElement('button');
        equipButton.type = 'button';
        equipButton.dataset.action = 'equip';
        equipButton.dataset.itemId = item.id;
        equipButton.textContent = 'Equip';
        actions.appendChild(equipButton);
      }
      const dropButton = document.createElement('button');
      dropButton.type = 'button';
      dropButton.dataset.action = 'drop';
      dropButton.dataset.itemId = item.id;
      dropButton.textContent = 'Drop';
      actions.appendChild(dropButton);
      li.append(header, description, actions);
      inventoryList.appendChild(li);
    });
  }
}

function updateWorldInfo() {
  const tileX = Math.floor(player.position.x);
  const tileY = Math.floor(player.position.y);
  if (areaLabel) areaLabel.textContent = map.getAreaName();
  if (tileLabel) tileLabel.textContent = map.tileNameAt(tileX, tileY);
}

function handleInventoryAction(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const { action, itemId, slot } = button.dataset;
  if (action === 'equip' && itemId) {
    const result = inventory.equip(itemId);
    if (!result.success) {
      messageDisplay.log(result.message);
    } else {
      const item = inventory.find(itemId);
      messageDisplay.log(`You equip the ${item?.name ?? 'item'}.`);
    }
    renderInventory();
  } else if (action === 'drop' && itemId) {
    dropItem(itemId);
  } else if (action === 'use' && itemId) {
    useItem(itemId);
  } else if (action === 'unequip' && slot) {
    const result = inventory.unequip(slot);
    if (!result.success) {
      messageDisplay.log(result.message);
    } else {
      messageDisplay.log(`You remove the ${result.item?.name ?? 'item'}.`);
    }
    renderInventory();
  }
}

inventoryList?.addEventListener('click', handleInventoryAction);
equippedList?.addEventListener('click', handleInventoryAction);

function dropItem(id) {
  const item = inventory.drop(id);
  if (!item) {
    messageDisplay.log('You cannot drop that.');
    return;
  }
  const tileX = Math.floor(player.position.x);
  const tileY = Math.floor(player.position.y);
  item.setPosition(tileX, tileY);
  map.addObject(item);
  messageDisplay.log(`You drop the ${item.name}.`);
  renderInventory();
}

function useItem(id) {
  const result = inventory.use(id, createContext());
  if (!result.success && result.message) {
    messageDisplay.log(result.message);
  } else if (result.message) {
    messageDisplay.log(result.message);
  }
  if (result.success) {
    renderCharacter();
    renderInventory();
  }
}

function saveGame() {
  const success = saveManager.save(buildSaveData({ character, player, map, inventory }));
  messageDisplay.log(success ? 'You inscribe your progress into the ether.' : 'The ether refuses your plea.');
}

function loadGame() {
  const data = saveManager.load();
  if (!data) {
    messageDisplay.log('No memories surface.');
    return;
  }
  const loadedCharacter = Character.from(data.character);
  if (!loadedCharacter) {
    messageDisplay.log('The past cannot be recalled.');
    return;
  }
  character = loadedCharacter;
  inventory = new WorldInventory(character);
  if (data.inventory) {
    inventory.loadFrom(data.inventory);
  }
  map.load(data.world);
  const position = data.player?.position ?? { x: (map.currentArea?.spawn?.x ?? 2) + 0.5, y: (map.currentArea?.spawn?.y ?? 5) + 0.5 };
  player = new Player(character, {
    x: position.x,
    y: position.y,
    area: data.player?.area ?? map.currentAreaId,
  });
  rebuildInteractionSystem();
  renderCharacter();
  renderInventory();
  messageDisplay.log('Your past deeds return to mind.');
}

saveButton?.addEventListener('click', saveGame);
loadButton?.addEventListener('click', loadGame);

window.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
    return;
  }
  if (event.key === 'i' || event.key === 'I') {
    event.preventDefault();
    inventoryPanel?.classList.toggle('collapsed');
  }
});

renderCharacter();
renderInventory();
messageDisplay.log('You awaken in a small chamber within Britannia.');
updateWorldInfo();

let lastTime = performance.now();

function update(dt) {
  player.update(dt, input, map);
  const tileX = Math.floor(player.position.x);
  const tileY = Math.floor(player.position.y);
  map.updateTileInfo(player.position.x, player.position.y);
  updateWorldInfo();
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  renderer.draw(ctx, map, player);
  objectRenderer.draw(ctx, map, map.getObjects());
}

function frame(time) {
  const dt = Math.min((time - lastTime) / 1000, 0.25);
  lastTime = time;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

window.addEventListener('beforeunload', () => input.destroy());
