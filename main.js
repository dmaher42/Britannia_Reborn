import { Party } from './party.js';
import { PartyMember } from './PartyMember.js';
import { PartyMovement } from './PartyMovement.js';
import { PartyInventory } from './PartyInventory.js';
import { PartyUI } from './PartyUI.js';
import { RealTimeCombat } from './RealTimeCombat.js';
import { Enemy } from './Enemy.js';
import { GameMap } from './GameMap.js';
import { MapRenderer } from './MapRenderer.js';
import { ObjectRenderer } from './ObjectRenderer.js';
import { InteractionSystem } from './InteractionSystem.js';
import { InputController } from './controls.js';
import { MessageDisplay } from './MessageDisplay.js';
import { Item, Door, Container, Lever } from './WorldObject.js';
import { SaveManager, buildSaveData } from './SaveManager.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const deviceRatio = Math.min(window.devicePixelRatio || 1, 2);

const statusElement = document.getElementById('statusText');
const modeElement = document.getElementById('modeIndicator');
const messageLogElement = document.getElementById('messageLog');
const areaLabel = document.getElementById('areaLabel');
const tileLabel = document.getElementById('tileLabel');
const saveButton = document.getElementById('saveButton');
const loadButton = document.getElementById('loadButton');
const equippedWeightLabel = document.getElementById('equippedWeight');
const sharedWeightLabel = document.getElementById('sharedWeight');
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

const floatingEffects = [];
const worldAdapter = {
  map,
  showMessage: (text) => messageDisplay.log(text),
  showFloatingDamage: (x, y, amount) => {
    floatingEffects.push({
      x,
      y,
      text: amount,
      alpha: 1,
      offset: 0,
    });
  },
  canMoveTo: (x, y, radius = 0.3) => map.isWalkableCircle(x, y, radius),
};

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
        stats: { attack: 5, attackSpeed: 900, str_req: 10 },
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

const starterPartyMembers = [
  new PartyMember('Avatar', 'Fighter', { str: 18, dex: 14, int: 12, health: { current: 42, max: 42 }, mana: { current: 12, max: 12 } }),
  new PartyMember('Iolo', 'Bard', { str: 14, dex: 16, int: 15, health: { current: 36, max: 36 }, mana: { current: 14, max: 14 } }),
  new PartyMember('Shamino', 'Ranger', { str: 16, dex: 18, int: 13, health: { current: 38, max: 38 }, mana: { current: 10, max: 10 } }),
];

let party = new Party({ members: starterPartyMembers });
const spawn = map.currentArea?.spawn ?? { x: 2, y: 5 };
party.members.forEach((member, index) => {
  member.setPosition(spawn.x + 0.5 - index * 0.6, spawn.y + 0.5 + index * 0.4);
});
let partyInventory = new PartyInventory(party);
let partyMovement = new PartyMovement(party, map, { followSpacing: 0.9, speed: 3.6 });
let combat = new RealTimeCombat(party, [], worldAdapter, {
  inventory: partyInventory,
  onUpdate: () => partyUI?.updateCombatDisplay(),
  onVictory: () => messageDisplay.log('The foes lie defeated.'),
  onInventoryChange: () => {
    partyUI?.renderInventory();
    updateWeightLabels();
  },
});
let partyUI = null;
let interactionSystem = null;
let selectedMember = party.leader;
const leaderProxy = { position: { x: party.leader?.x ?? 0, y: party.leader?.y ?? 0 } };

const combatTriggers = [
  {
    area: 'starter-room',
    bounds: { x: 4, y: 3, width: 4, height: 3 },
    triggered: false,
    message: 'Rats scurry from the shadows!',
    enemies: [
      { type: 'rat', x: 6.5, y: 3.5 },
      { type: 'rat', x: 7.2, y: 4.5 },
      { type: 'rat', x: 5.8, y: 4.0 },
      { type: 'bat', x: 6.5, y: 2.5 },
    ],
  },
];

function updateWeightLabels() {
  if (equippedWeightLabel) {
    const equipped = selectedMember?.equippedWeight?.() ?? 0;
    const limit = selectedMember ? selectedMember.str : 0;
    equippedWeightLabel.textContent = `${equipped.toFixed(1)} / ${limit}`;
  }
  if (sharedWeightLabel) {
    const shared = partyInventory.backpackWeight();
    const capacity = party.getAvailableInventorySpace() + shared;
    sharedWeightLabel.textContent = `${shared.toFixed(1)} / ${capacity.toFixed(1)}`;
  }
}

function handleSelectMember(member) {
  if (!member) return;
  selectedMember = member;
  partyInventory.setActiveMember(member);
  if (interactionSystem) {
    interactionSystem.character = member;
  }
  updateWeightLabels();
}

function handleMakeLeader(index, member) {
  if (party.setLeader(index)) {
    selectedMember = member;
    partyInventory.setActiveMember(member);
    if (interactionSystem) {
      interactionSystem.character = member;
    }
    messageDisplay.log(`${member.name} now leads the party.`);
    partyUI?.renderPortraits();
    partyUI?.renderEquipment();
  }
}

function handleEquipItem(itemId, member, slot) {
  const target = member ?? selectedMember;
  if (!target) return;
  const result = partyInventory.equip(itemId, target, slot ?? null);
  if (!result.success) {
    messageDisplay.log(result.message ?? 'They cannot equip that.');
    return;
  }
  messageDisplay.log(`${target.name} equips the ${partyInventory.find(itemId)?.name ?? 'item'}.`);
  partyUI?.renderEquipment();
  partyUI?.renderInventory();
  updateWeightLabels();
}

function handleUnequipItem(slot, member) {
  const target = member ?? selectedMember;
  if (!target) return;
  const result = partyInventory.unequip(slot, target);
  if (!result.success) {
    messageDisplay.log(result.message ?? 'Cannot remove that.');
    return;
  }
  if (result.item) {
    messageDisplay.log(`${target.name} stows the ${result.item.name}.`);
  }
  partyUI?.renderEquipment();
  partyUI?.renderInventory();
  updateWeightLabels();
}

function initializeUI() {
  selectedMember = party.leader ?? party.members[0] ?? null;
  partyInventory.setActiveMember(selectedMember);
  partyUI = new PartyUI({
    party,
    inventory: partyInventory,
    portraitContainer: '#partyPortraits',
    equipmentContainer: '#equipmentSlots',
    inventoryContainer: '#sharedInventory',
    onSelectMember: handleSelectMember,
    onMakeLeader: handleMakeLeader,
    onEquip: handleEquipItem,
    onUnequip: handleUnequipItem,
  });
  partyUI.updateCombatDisplay();
  updateWeightLabels();
}

function rebuildInteractionSystem() {
  if (interactionSystem) {
    interactionSystem.destroy();
  }
  interactionSystem = new InteractionSystem({
    canvas,
    map,
    player: leaderProxy,
    inventory: partyInventory,
    character: selectedMember,
    messageDisplay,
    objectRenderer,
    onInventoryChange: () => {
      partyUI?.renderInventory();
      updateWeightLabels();
    },
    onEnemyTarget: (enemy) => {
      combat?.setPartyTarget(selectedMember, enemy);
      partyUI?.updateCombatDisplay();
    },
    getSelectedMember: () => selectedMember,
  });
  messageDisplay.setStatus('Moving freely. Use L/G/U/T to interact.');
}

function resizeCanvas() {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(rect.width * deviceRatio));
  canvas.height = Math.max(1, Math.round(rect.height * deviceRatio));
  ctx.setTransform(deviceRatio, 0, 0, deviceRatio, 0, 0);
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function updateWorldInfo() {
  const leader = party.leader;
  if (!leader) return;
  const tileX = Math.floor(leader.x);
  const tileY = Math.floor(leader.y);
  if (areaLabel) areaLabel.textContent = map.getAreaName();
  if (tileLabel) tileLabel.textContent = map.tileNameAt(tileX, tileY);
}

function isWithinBounds(x, y, bounds) {
  return x >= bounds.x && x < bounds.x + bounds.width && y >= bounds.y && y < bounds.y + bounds.height;
}

function spawnEnemies(trigger) {
  const enemies = trigger.enemies.map((config) => {
    const enemy = new Enemy(config.type, config.x, config.y);
    enemy.x = config.x;
    enemy.y = config.y;
    map.addObject(enemy);
    combat.addEnemy(enemy);
    return enemy;
  });
  if (trigger.message) {
    messageDisplay.log(trigger.message);
  }
  if (enemies.length > 0) {
    combat.startCombat(combat.enemies);
  }
}

function checkCombatTriggers() {
  const leader = party.leader;
  if (!leader) return;
  combatTriggers.forEach((trigger) => {
    if (trigger.triggered) return;
    if (map.currentAreaId !== trigger.area) return;
    if (isWithinBounds(leader.x, leader.y, trigger.bounds)) {
      trigger.triggered = true;
      spawnEnemies(trigger);
    }
  });
}

function getCurrentAreaEnemies() {
  return map
    .getObjects()
    .filter((object) => object?.type === 'enemy');
}

function restoreCombatEnemies(options = {}) {
  const { startCombat: shouldStart = false } = options;
  if (!combat) return [];
  const enemies = getCurrentAreaEnemies();
  combat.setEnemies(enemies);
  const living = enemies.filter((enemy) => {
    if (typeof enemy.alive === 'boolean') {
      return enemy.alive;
    }
    const current = enemy.health?.current;
    return Number.isFinite(current) ? current > 0 : true;
  });
  if (shouldStart && living.length > 0) {
    combat.startCombat(enemies);
  }
  return living;
}

function updateFloatingEffects(dt) {
  for (let i = floatingEffects.length - 1; i >= 0; i -= 1) {
    const effect = floatingEffects[i];
    effect.alpha -= dt * 1.5;
    effect.offset += dt * 18;
    if (effect.alpha <= 0) {
      floatingEffects.splice(i, 1);
    }
  }
}

function update(dt) {
  const direction = input.getDirection();
  partyMovement.moveParty(direction, dt, map);
  const leader = party.leader;
  if (leader) {
    leaderProxy.position.x = leader.x;
    leaderProxy.position.y = leader.y;
    map.updateTileInfo(leader.x, leader.y);
  }
  checkCombatTriggers();
  updateWorldInfo();
  updateFloatingEffects(dt);
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  renderer.draw(ctx, map, party, combat.enemies, { effects: floatingEffects });
  objectRenderer.draw(ctx, map, map.getObjects());
}

let lastTime = performance.now();
function frame(time) {
  const dt = Math.min((time - lastTime) / 1000, 0.25);
  lastTime = time;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

function saveGame() {
  const triggerStates = combatTriggers.map((trigger) => trigger.triggered);
  const success = saveManager.save(buildSaveData({ party, map, inventory: partyInventory, triggers: triggerStates }));
  messageDisplay.log(success ? 'You inscribe your progress into the ether.' : 'The ether refuses your plea.');
}

function loadGame() {
  const data = saveManager.load();
  if (!data) {
    messageDisplay.log('No memories surface.');
    return;
  }
  if (combat) {
    combat.stopCombat();
  }
  map.load(data.world);
  if (data.party) {
    party = Party.fromJSON(data.party);
  }
  selectedMember = party.leader ?? party.members[0] ?? null;
  partyInventory = new PartyInventory(party);
  if (data.inventory) {
    partyInventory.loadFrom(data.inventory);
  }
  partyInventory.setActiveMember(selectedMember);
  partyMovement = new PartyMovement(party, map, { followSpacing: 0.9, speed: 3.6 });
  combat = new RealTimeCombat(party, [], worldAdapter, {
    inventory: partyInventory,
    onUpdate: () => partyUI?.updateCombatDisplay(),
    onVictory: () => messageDisplay.log('The foes lie defeated.'),
    onInventoryChange: () => {
      partyUI?.renderInventory();
      updateWeightLabels();
    },
  });
  if (Array.isArray(data.triggers)) {
    combatTriggers.forEach((trigger, index) => {
      trigger.triggered = Boolean(data.triggers[index]);
    });
  } else {
    combatTriggers.forEach((trigger) => {
      trigger.triggered = false;
    });
  }
  restoreCombatEnemies({ startCombat: true });
  leaderProxy.position.x = selectedMember?.x ?? 0;
  leaderProxy.position.y = selectedMember?.y ?? 0;
  floatingEffects.length = 0;
  map.updateTileInfo(leaderProxy.position.x, leaderProxy.position.y);
  initializeUI();
  rebuildInteractionSystem();
  updateWeightLabels();
  updateWorldInfo();
  messageDisplay.log('Your past deeds return to mind.');
}

saveButton?.addEventListener('click', saveGame);
loadButton?.addEventListener('click', loadGame);

window.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
    return;
  }
  if (/^[1-8]$/.test(event.key)) {
    const index = Number(event.key) - 1;
    if (party.members[index]) {
      partyUI?.setSelectedMember(party.members[index]);
    }
  } else if (event.key === 'Tab') {
    event.preventDefault();
    const next = party.cycleLeader(1);
    partyUI?.setSelectedMember(party.members[next]);
    messageDisplay.log(`${party.leader.name} takes point.`);
  } else if (event.key === 'F' || event.key === 'f') {
    const formation = party.cycleFormation();
    messageDisplay.log(`The party shifts into ${formation} formation.`);
  } else if (event.key === ' ') {
    const paused = combat.togglePause();
    messageDisplay.log(paused ? 'Combat pauses.' : 'Combat resumes.');
  } else if (event.key === 'I' || event.key === 'i') {
    event.preventDefault();
    inventoryPanel?.classList.toggle('collapsed');
  } else if (event.key === 'C' || event.key === 'c') {
    event.preventDefault();
    document.querySelector('.equipment-panel')?.classList.toggle('highlight');
  }
});

initializeUI();
rebuildInteractionSystem();
messageDisplay.log('You awaken in a small chamber within Britannia.');
updateWorldInfo();
requestAnimationFrame(frame);

window.addEventListener('beforeunload', () => input.destroy());
