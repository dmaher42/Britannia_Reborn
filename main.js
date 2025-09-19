import { createCharacterCreator } from './CharacterCreator.js';
import { Character } from './Character.js';
import { Player } from './Player.js';
import { GameMap } from './GameMap.js';
import { MapRenderer } from './MapRenderer.js';
import { Inventory, ItemHelpers } from './inventory.js';
import { ItemGenerator } from './ItemGenerator.js';
import { CombatEngine } from './CombatEngine.js';
import { Enemy } from './Enemy.js';
import { SaveManager, buildSaveData } from './SaveManager.js';
import { InputController } from './controls.js';
import { setupUI } from './ui.js';
import { initTooltips } from './public/ui/tooltip.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const minimapCanvas = document.getElementById('minimap');
const minimapCtx = minimapCanvas?.getContext('2d') ?? null;

const deviceRatio = Math.min(window.devicePixelRatio || 1, 2);

const map = new GameMap();
const renderer = new MapRenderer();
const itemGenerator = new ItemGenerator();
const inventory = new Inventory([
  {
    id: 'traveler_blade',
    name: 'Traveler Blade',
    type: 'weapon',
    stats: { attack: 5, str_req: 10, weight: 2.4 },
    stackable: false,
    value: 36,
    weight: 2.4,
  },
  {
    id: 'leather_coat_1',
    name: 'Worn Leather',
    type: 'armor',
    stats: { defense: 4, str_req: 10, weight: 3.8 },
    stackable: false,
    value: 28,
    weight: 3.8,
  },
  {
    id: 'health_potion',
    name: 'Health Draught',
    type: 'consumable',
    stats: { hp_restore: 40, weight: 0.4 },
    stackable: true,
    quantity: 2,
    value: 25,
    weight: 0.4,
  },
  {
    id: 'mana_potion',
    name: 'Mana Tonic',
    type: 'consumable',
    stats: { mp_restore: 30, weight: 0.3 },
    stackable: true,
    quantity: 1,
    value: 32,
    weight: 0.3,
  },
]);
inventory.gold = 75;

const saveManager = new SaveManager();
const input = new InputController(window);

let character = null;
let player = null;
let combat = null;
let awaitingItemSelection = false;
let transitionCooldown = 0;
let lastTileKey = '';
let panelsState = { character: true, inventory: false, journal: false };

const ui = setupUI({
  onAttack: (targetId) => {
    if (!combat) return;
    const result = combat.attack(targetId);
    if (!result.success && result.message) {
      ui.showToast(result.message);
    }
  },
  onDefend: () => {
    if (!combat) return;
    const result = combat.defend();
    if (!result.success && result.message) {
      ui.showToast(result.message);
    }
  },
  onUseItemAction: () => {
    if (!combat || !combat.isPlayerTurn()) {
      ui.showToast('Items can be used from the inventory.');
      return;
    }
    awaitingItemSelection = true;
    ui.highlightConsumables(true);
    ui.renderInventory(inventory, character);
    ui.showToast('Select a consumable from the inventory.');
  },
  onEquip: (itemId) => handleEquip(itemId),
  onUseItem: (itemId) => handleUseItem(itemId),
  onSave: () => manualSave(),
  onLoad: () => loadGame(),
  onAllocateStat: (stat) => allocateStat(stat),
});

const characterCreator = createCharacterCreator({
  onCreate: (createdCharacter) => {
    startNewGame(createdCharacter);
    ui.showToast('A new hero awakens in Britannia.');
  },
});

const resizeCanvas = () => {
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(rect.width * deviceRatio));
  canvas.height = Math.max(1, Math.round(rect.height * deviceRatio));
  ctx.setTransform(deviceRatio, 0, 0, deviceRatio, 0, 0);
  if (minimapCanvas && minimapCtx) {
    const miniRect = minimapCanvas.getBoundingClientRect();
    minimapCanvas.width = Math.max(1, Math.round(miniRect.width * deviceRatio));
    minimapCanvas.height = Math.max(1, Math.round(miniRect.height * deviceRatio));
    minimapCtx.setTransform(deviceRatio, 0, 0, deviceRatio, 0, 0);
  }
};

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

const updatePanelsState = (updates) => {
  panelsState = { ...panelsState, ...updates };
  ui.setPanelsActive(panelsState);
};

window.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
    return;
  }
  if (event.key === 'i' || event.key === 'I') {
    event.preventDefault();
    updatePanelsState({ inventory: !panelsState.inventory });
  } else if (event.key === 'c' || event.key === 'C') {
    event.preventDefault();
    updatePanelsState({ character: !panelsState.character });
  } else if (event.key === 'j' || event.key === 'J') {
    event.preventDefault();
    updatePanelsState({ journal: !panelsState.journal });
  }
});

const startNewGame = (newCharacter) => {
  character = newCharacter instanceof Character ? newCharacter : new Character(newCharacter);
  map.setArea('forest', map.currentArea?.spawn);
  player = new Player(character, {
    x: (map.currentArea?.spawn?.x ?? 2) + 0.5,
    y: (map.currentArea?.spawn?.y ?? 2) + 0.5,
    area: map.currentAreaId,
  });
  transitionCooldown = 0.8;
  lastTileKey = '';
  instantiateCombat();
  ui.renderCharacter(character);
  ui.renderInventory(inventory, character);
  ui.setWorldInfo({ area: map.getAreaName(), tile: map.tileNameAt(Math.floor(player.position.x), Math.floor(player.position.y)) });
  ui.log(`${character.name} arrives in the ${map.getAreaName()}.`);
  autoSave('new-game');
};

const instantiateCombat = () => {
  if (combat) {
    combat = null;
  }
  combat = new CombatEngine({
    player,
    inventory,
    itemGenerator,
    onRespawn: () => {
      map.setArea('forest', map.currentArea?.spawn);
      player.setArea('forest', map.currentArea?.spawn);
      transitionCooldown = 1.2;
      ui.setWorldInfo({ area: map.getAreaName(), tile: map.tileNameAt(Math.floor(player.position.x), Math.floor(player.position.y)) });
      autoSave('respawn');
    },
  });

  combat.on('log', (message) => ui.log(message));
  combat.on('state', (state) => {
    ui.renderCombat(state);
    if (state.turn !== 'player' && awaitingItemSelection) {
      awaitingItemSelection = false;
      ui.highlightConsumables(false);
      ui.renderInventory(inventory, character);
    }
  });
  combat.on('victory', ({ loot = [] }) => {
    if (loot.length > 0) {
      ui.renderInventory(inventory, character);
      ui.showToast('Spoils added to the packs.');
    }
    ui.renderCharacter(character);
    autoSave('victory');
  });
  combat.on('level-up', () => {
    ui.renderCharacter(character);
    ui.showToast(`${character.name} feels their power grow!`);
    autoSave('level-up');
  });
  combat.on('defeat', () => {
    awaitingItemSelection = false;
    ui.highlightConsumables(false);
    ui.renderInventory(inventory, character);
    ui.renderCharacter(character);
    ui.showToast('Defeated! You regroup at the forest edge.');
  });
};

const manualSave = () => {
  if (!character || !player) {
    ui.showToast('Create a character before saving.');
    return;
  }
  const success = saveManager.save(buildSaveData({ character, player, map, inventory }));
  ui.showToast(success ? 'Progress saved.' : 'Failed to save.');
};

const autoSave = (reason) => {
  if (!character || !player) return;
  saveManager.save(buildSaveData({ character, player, map, inventory }));
  if (reason === 'transition') {
    ui.log('An autosave crystal hums as you cross into new lands.');
  }
};

const loadGameFromData = (data) => {
  if (!data) return false;
  const loadedCharacter = Character.from(data.character);
  if (!loadedCharacter) return false;
  character = loadedCharacter;
  map.load(data.world);
  const position = data.player?.position ?? { x: (map.currentArea?.spawn?.x ?? 2) + 0.5, y: (map.currentArea?.spawn?.y ?? 2) + 0.5 };
  player = new Player(character, { area: data.player?.area ?? map.currentAreaId, x: position.x, y: position.y });
  inventory.loadFrom(data.inventory);
  inventory.gold = data.inventoryGold ?? inventory.gold ?? 0;
  transitionCooldown = 0.6;
  lastTileKey = '';
  instantiateCombat();
  ui.renderCharacter(character);
  ui.renderInventory(inventory, character);
  ui.setWorldInfo({ area: map.getAreaName(), tile: map.tileNameAt(Math.floor(player.position.x), Math.floor(player.position.y)) });
  ui.showToast('Loaded the last journey.');
  ui.log('Past deeds resurface as the moongates align.');
  return true;
};

const loadGame = () => {
  const data = saveManager.load();
  if (!loadGameFromData(data)) {
    ui.showToast('No save data available.');
  }
};

const handleEquip = (itemId) => {
  if (!character) {
    ui.showToast('Create a hero first.');
    return;
  }
  const item = inventory.get(itemId);
  if (!item) {
    ui.showToast('That item is not in the packs.');
    return;
  }
  if (!ItemHelpers.isEquippable(item)) {
    ui.showToast('That item cannot be equipped.');
    return;
  }
  if (!character.canEquip(item)) {
    ui.showToast('You lack the strength to wield that.');
    return;
  }
  const slot = item.type;
  const previous = character.equipment[slot] ? { ...character.equipment[slot], quantity: 1 } : null;
  if (!character.equip(item)) {
    ui.showToast('You cannot equip that right now.');
    return;
  }
  inventory.remove(item.id, 1);
  if (previous) {
    inventory.add(previous);
  }
  ui.renderCharacter(character);
  ui.renderInventory(inventory, character);
  ui.showToast(`${character.name} equips ${item.name}.`);
  autoSave('equip');
};

const consumeItemEffect = (item) => {
  let applied = false;
  const effects = [];
  if (item.stats?.hp_restore) {
    const restored = character.heal(item.stats.hp_restore);
    if (restored > 0) {
      applied = true;
      effects.push(`restores ${restored} HP`);
    }
  }
  if (item.stats?.mp_restore) {
    const restored = character.restoreMana(item.stats.mp_restore);
    if (restored > 0) {
      applied = true;
      effects.push(`restores ${restored} MP`);
    }
  }
  return { applied, effects };
};

const handleUseItem = (itemId) => {
  if (!character) return;
  const item = inventory.get(itemId);
  if (!item) {
    ui.showToast('Nothing like that remains in the packs.');
    return;
  }

  if (combat?.active && combat.isPlayerTurn()) {
    const result = combat.useItem(itemId);
    if (!result.success && result.message) {
      ui.showToast(result.message);
      return;
    }
    awaitingItemSelection = false;
    ui.highlightConsumables(false);
    ui.renderCharacter(character);
    ui.renderInventory(inventory, character);
    return;
  }

  if (!ItemHelpers.isConsumable(item)) {
    ui.showToast('Only consumables can be used.');
    return;
  }

  const { applied, effects } = consumeItemEffect(item);
  if (!applied) {
    ui.showToast('The item has no effect.');
    return;
  }
  inventory.remove(item.id, 1);
  ui.renderCharacter(character);
  ui.renderInventory(inventory, character);
  ui.showToast(`${character.name} ${effects.join(' and ')}.`);
  autoSave('item');
};

const allocateStat = (stat) => {
  if (!character) return;
  const success = character.allocateStat(stat, 1);
  if (!success) {
    ui.showToast('No stat points available.');
    return;
  }
  ui.renderCharacter(character);
  ui.showToast(`${stat} rises to ${character.stats[stat]}.`);
  autoSave('stat');
};

const maybeTriggerEncounter = () => {
  if (!player || !character || combat?.active) return;
  const area = map.currentArea;
  if (!area || area.safe) return;
  if (Math.random() < 0.1) {
    const count = 1 + Math.floor(Math.random() * 2);
    const enemies = Array.from({ length: count }, () => Enemy.create(map.getAreaLevel()))
      .map((enemy) => ({
        id: enemy.id,
        name: enemy.name,
        hp: enemy.hp,
        hpMax: enemy.hpMax,
        attack: enemy.attack,
        defense: enemy.defense,
        level: enemy.level,
        xpValue: enemy.xpValue,
      }));
    if (combat.start(enemies, map.getAreaLevel())) {
      awaitingItemSelection = false;
      ui.highlightConsumables(false);
      ui.showToast('An encounter begins!');
    }
  }
};

const update = (dt) => {
  if (!character || !player) return;
  if (transitionCooldown > 0) {
    transitionCooldown -= dt;
  }

  if (!combat?.active) {
    player.update(dt, input, map);
  }

  const tileX = Math.floor(player.position.x);
  const tileY = Math.floor(player.position.y);
  const tileType = map.updateTileInfo(player.position.x, player.position.y);
  ui.setTerrain(map.tileNameAt(tileX, tileY));
  ui.setWorldInfo({ area: map.getAreaName(), tile: map.tileNameAt(tileX, tileY) });

  if (!combat?.active) {
    const tileKey = `${map.currentAreaId}:${tileX},${tileY}`;
    if (tileKey !== lastTileKey) {
      lastTileKey = tileKey;
      maybeTriggerEncounter();
    }
  }

  if (transitionCooldown <= 0) {
    const transition = map.checkTransition(tileX, tileY);
    if (transition) {
      map.setArea(transition.to, transition.spawn);
      player.setArea(transition.to, transition.spawn);
      transitionCooldown = 1;
      lastTileKey = '';
      ui.showToast(`Entering ${map.getAreaName()}.`);
      ui.log(`The party crosses into ${map.getAreaName()}.`);
      ui.setWorldInfo({ area: map.getAreaName(), tile: map.tileNameAt(Math.floor(player.position.x), Math.floor(player.position.y)) });
      autoSave('transition');
    }
  }

  if (combat?.active) {
    ui.setStatus('Choose an action for the encounter.');
  } else {
    const direction = input.getDirection();
    if (direction.x !== 0 || direction.y !== 0) {
      ui.setStatus(`Exploring ${map.getAreaName()}...`);
    } else {
      ui.setStatus('Use WASD or the arrow keys to move.');
    }
  }
};

const render = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  renderer.draw(ctx, map, player);
  if (minimapCtx) {
    renderer.drawMinimap(minimapCtx, map, player);
  }
};

let lastTime = performance.now();

const frame = (time) => {
  const dt = Math.min((time - lastTime) / 1000, 0.25);
  lastTime = time;
  update(dt);
  render();
  requestAnimationFrame(frame);
};

const boot = () => {
  initTooltips({ selector: '.action-btn,[data-tip]' });
  const saved = saveManager.load();
  if (!loadGameFromData(saved)) {
    characterCreator.show();
  }
  requestAnimationFrame(frame);
};

boot();

window.addEventListener('beforeunload', () => input.destroy());

