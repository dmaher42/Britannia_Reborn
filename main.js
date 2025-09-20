import { Party } from './party.js';
import { PartyMember } from './PartyMember.js';
import { PartyMovement } from './PartyMovement.js';
import { PartyInventory } from './PartyInventory.js';
import { PartyUI } from './PartyUI.js';
import { RealTimeCombat } from './RealTimeCombat.js';
import { Enemy } from './Enemy.js';
import { GameMap } from './GameMap.js';
import { InteractionSystem } from './InteractionSystem.js';
import { InputController } from './controls.js';
import { MessageDisplay } from './MessageDisplay.js';
import { Item, Door, Container, Lever } from './WorldObject.js';
import { SaveManager, buildSaveData } from './SaveManager.js';
import { ReagentSystem } from './ReagentSystem.js';
import { SpellSystem } from './SpellSystem.js';
import { SpellMixingUI } from './SpellMixingUI.js';
import { DialogueEngine, NPC, NPC_DATA } from './DialogueEngine.js';
import { MagicShop } from './MagicShop.js';
import { SpriteRenderer } from './SpriteRenderer.js';
import { WorldRenderer } from './WorldRenderer.js';
import { AnimationSystem } from './AnimationSystem.js';
import { EffectsRenderer } from './EffectsRenderer.js';
import { LightingSystem } from './LightingSystem.js';
import { ParticleSystem } from './ParticleSystem.js';
import { ModernUI } from './ModernUI.js';
import { GameLoop } from './GameLoop.js';

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
const messageDisplay = new MessageDisplay({
  logElement: messageLogElement,
  statusElement,
  modeElement,
});
const saveManager = new SaveManager();
const reagentSystem = new ReagentSystem();

const spriteRenderer = new SpriteRenderer(canvas, ctx);
const animationSystem = new AnimationSystem(spriteRenderer);
const worldRenderer = new WorldRenderer(spriteRenderer, map, {});
worldRenderer.setAnimationSystem(animationSystem);
const effectsRenderer = new EffectsRenderer(spriteRenderer, worldRenderer);
const lightingSystem = new LightingSystem(canvas, worldRenderer);
const particleSystem = new ParticleSystem(canvas);

let modernUI = null;
let gameState = null;
let gameLoop = null;

let mariahNPC = null;
let gwennoNPC = null;
let smithyNPC = null;
const input = new InputController(window);

const worldAdapter = {
  map,
  showMessage: (text) => messageDisplay.log(text),
  showFloatingDamage: (x, y, amount) => {
    effectsRenderer?.createFloatingText(x ?? 0, y ?? 0, amount, '#ffdf7f');
  },
  createEffect: (name, startX, startY, targetX, targetY) => {
    effectsRenderer?.createEffect(name, startX, startY, targetX, targetY);
  },
  spawnParticles: (type, x, y) => {
    if (type === 'blood') {
      const screen = worldRenderer.worldToScreen(x, y, { align: 'center' });
      if (screen) {
        particleSystem?.createBloodSplatter(screen.x + worldRenderer.tileDisplaySize / 2, screen.y + worldRenderer.tileDisplaySize / 2);
      }
    }
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

function createTownObjects() {
  const objects = [];
  mariahNPC = new NPC('Mariah', 9, 9, NPC_DATA.mariah);
  gwennoNPC = new NPC('Gwenno', 12, 8, NPC_DATA.gwenno);
  smithyNPC = new NPC('Smithy', 6, 13, NPC_DATA.smithy);
  objects.push(mariahNPC, gwennoNPC, smithyNPC);

  const garlicPatch = reagentSystem.createReagent('garlic', 3, {
    id: 'wild_garlic_patch',
    x: 5,
    y: 13,
  });
  const mossPatch = reagentSystem.createReagent('blood_moss', 2, {
    id: 'wild_moss_patch',
    x: 14,
    y: 11,
  });
  objects.push(garlicPatch, mossPatch);

  return objects;
}

function syncTownNPCs() {
  mariahNPC = map.findObjectById('npc_mariah', 'forest') ?? mariahNPC;
  gwennoNPC = map.findObjectById('npc_gwenno', 'forest') ?? gwennoNPC;
  smithyNPC = map.findObjectById('npc_smithy', 'forest') ?? smithyNPC;
}

map.setObjects('starter-room', createStarterObjects());
map.setObjects('forest', createTownObjects());
syncTownNPCs();

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
worldRenderer.setParty(party);
worldRenderer.setCameraTargetResolver(() => party?.leader ?? party?.members?.[0] ?? null);
let partyInventory = new PartyInventory(party);
let partyMovement = new PartyMovement(party, map, { followSpacing: 0.9, speed: 3.6 });
let combat = new RealTimeCombat(party, [], worldAdapter, {
  inventory: partyInventory,
  onUpdate: () => partyUI?.updateCombatDisplay(),
  onVictory: () => messageDisplay.log('The foes lie defeated.'),
  onInventoryChange: () => {
    partyUI?.renderInventory();
    updateWeightLabels();
    spellMixingUI?.refreshReagents();
  },
});
worldRenderer.setCombat(combat);
let partyUI = null;
let interactionSystem = null;
let selectedMember = party.leader;
let spellSystem = null;
let spellMixingUI = null;
let dialogueEngine = null;
let magicShop = null;
let lastTransitionKey = null;

function refreshModernUI() {
  if (!modernUI) {
    modernUI = new ModernUI(canvas, spriteRenderer, party, {
      map,
      inventory: partyInventory,
      messageDisplay,
    });
  } else {
    modernUI.party = party;
    modernUI.setInventoryManager(partyInventory);
  }
  if (gameState) {
    gameState.ui = modernUI;
  }
}

refreshModernUI();

const isSpellMixingOpen = () => Boolean(spellMixingUI?.isOpen?.() ?? spellMixingUI?.isVisible);
const isConversationActive = () => Boolean(dialogueEngine?.conversationActive);
const isMagicShopOpen = () => Boolean(magicShop?.isOpen?.());

const closeSpellMixing = () => {
  if (isSpellMixingOpen() && spellMixingUI?.closeMixingInterface) {
    spellMixingUI.closeMixingInterface();
  }
};

const closeConversationOverlay = () => {
  if (isConversationActive()) {
    dialogueEngine.endConversation();
  }
};

const closeMagicShopOverlay = () => {
  if (isMagicShopOpen()) {
    magicShop.close();
  }
};

const closeOtherOverlays = (except = null) => {
  if (except !== 'mixing') {
    closeSpellMixing();
  }
  if (except !== 'conversation') {
    closeConversationOverlay();
  }
  if (except !== 'shop') {
    closeMagicShopOverlay();
  }
};

spellSystem = new SpellSystem(party, reagentSystem, {
  inventory: partyInventory,
  world: worldAdapter,
  map,
  combat,
  onAfterCast: () => {
    partyUI?.updateCombatDisplay();
    spellMixingUI?.refreshReagents();
  },
});

spellMixingUI = new SpellMixingUI(spellSystem, party, {
  getSelectedMember: () => selectedMember,
  onOpen: () => closeOtherOverlays('mixing'),
});
spellSystem.setMixingInterface(spellMixingUI);

dialogueEngine = new DialogueEngine(worldAdapter, {
  onKeyword: handleDialogueKeyword,
  onStart: () => closeOtherOverlays('conversation'),
});

magicShop = new MagicShop(gwennoNPC, party, {
  reagentSystem,
  inventory: partyInventory,
  showMessage: (text) => messageDisplay.log(text),
  onTransaction: () => {
    partyUI?.renderInventory();
    updateWeightLabels();
    spellMixingUI?.refreshReagents();
  },
  onOpen: () => closeOtherOverlays('shop'),
});
magicShop.renderInventory();
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

function offerHealerService() {
  if (!mariahNPC) return;
  const target = selectedMember ?? party.leader ?? null;
  if (!target?.health) {
    messageDisplay.log('Mariah cannot aid thee at the moment.');
    return;
  }
  if (target.health.current >= target.health.max) {
    messageDisplay.log('Mariah says, "Thou art already whole."');
    return;
  }
  const cost = 5;
  if (!party.spendGold(cost)) {
    messageDisplay.log('Mariah says, "Thou hast not the gold I require."');
    return;
  }
  target.health.current = target.health.max;
  messageDisplay.log(`Mariah lays gentle hands upon ${target.name}, and their wounds vanish.`);
  magicShop?.renderInventory();
}

function handleDialogueKeyword(keyword, npc) {
  if (!npc) return;
  const normalized = (keyword ?? '').toLowerCase();
  if (gwennoNPC && npc.id === gwennoNPC.id && normalized === 'buy') {
    magicShop?.open();
  }
  if (mariahNPC && npc.id === mariahNPC.id && (normalized === 'heal' || normalized === 'donation')) {
    offerHealerService();
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
    objectRenderer: worldRenderer,
    onInventoryChange: () => {
      partyUI?.renderInventory();
      updateWeightLabels();
      spellMixingUI?.refreshReagents();
    },
    onEnemyTarget: (enemy) => {
      combat?.setPartyTarget(selectedMember, enemy);
      partyUI?.updateCombatDisplay();
    },
    getSelectedMember: () => selectedMember,
    dialogueEngine,
  });
  messageDisplay.setStatus('Moving freely. Use L/G/U/T to interact, M to mix reagents.');
}

function resizeCanvas() {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(rect.width * deviceRatio));
  canvas.height = Math.max(1, Math.round(rect.height * deviceRatio));
  ctx.setTransform(deviceRatio, 0, 0, deviceRatio, 0, 0);
  lightingSystem?.setupLightCanvas();
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

function checkAreaTransition() {
  const leader = party.leader;
  if (!leader) return;
  const tileX = Math.floor(leader.x);
  const tileY = Math.floor(leader.y);
  const transition = map.checkTransition(tileX, tileY);
  if (!transition) {
    lastTransitionKey = null;
    return;
  }
  const key = `${map.currentAreaId}:${tileX},${tileY}`;
  if (lastTransitionKey === key) return;
  lastTransitionKey = key;
  if (!transition.to) return;
  const spawn = transition.spawn ?? { x: tileX, y: tileY };
  if (!map.setArea(transition.to, spawn)) return;
  const spawnX = (spawn.x ?? tileX) + 0.5;
  const spawnY = (spawn.y ?? tileY) + 0.5;
  party.members.forEach((member, index) => {
    member.setPosition(spawnX - index * 0.6, spawnY + index * 0.4);
  });
  leaderProxy.position.x = party.leader?.x ?? spawnX;
  leaderProxy.position.y = party.leader?.y ?? spawnY;
  syncTownNPCs();
  magicShop?.renderInventory();
  restoreCombatEnemies({ startCombat: false });
  updateWeightLabels();
  updateWorldInfo();
  interactionSystem?.clearMode?.();
  messageDisplay.log(`You arrive at ${map.getAreaName()}.`);
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

function applyAreaLighting(areaId) {
  if (!lightingSystem) return;
  switch (areaId) {
    case 'cave':
      lightingSystem.ambientLight = 0.18;
      lightingSystem.addLightSource(10.5, 12.5, 2.8, 0.45, '#ff8844');
      break;
    case 'starter-room':
      lightingSystem.ambientLight = 0.32;
      lightingSystem.addLightSource(5.5, 5.5, 2.2, 0.4, '#ffcc88');
      break;
    default:
      lightingSystem.ambientLight = 0.48;
      lightingSystem.addLightSource(12.5, 8.5, 3.2, 0.3, '#a0c4ff');
      break;
  }
}

function updateDynamicLights() {
  if (!lightingSystem) return;
  lightingSystem.clearLights();
  applyAreaLighting(map.currentAreaId);
  party?.members?.forEach((member, index) => {
    if (!member) return;
    const intensity = index === 0 ? 0.85 : 0.5;
    lightingSystem.addTorchLight(member.x ?? 0, member.y ?? 0);
    lightingSystem.lightSources[lightingSystem.lightSources.length - 1].intensity = intensity;
  });
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
  checkAreaTransition();
  checkCombatTriggers();
  updateWorldInfo();
  updateDynamicLights();
}

function saveGame() {
  const triggerStates = combatTriggers.map((trigger) => trigger.triggered);
  const success = saveManager.save(
    buildSaveData({ party, map, inventory: partyInventory, triggers: triggerStates, magic: spellSystem?.toJSON?.() ?? null })
  );
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
      spellMixingUI?.refreshReagents();
    },
  });
  worldRenderer.setParty(party);
  worldRenderer.setCombat(combat);
  refreshModernUI();
  spellSystem.party = party;
  spellSystem.setInventory(partyInventory);
  spellSystem.setCombat(combat);
  spellSystem.setMap(map);
  spellSystem.setWorld(worldAdapter);
  spellSystem.loadFrom(data.magic ?? {});
  spellMixingUI?.refreshReagents();
  syncTownNPCs();
  if (magicShop) {
    magicShop.npc = gwennoNPC;
    magicShop.party = party;
    magicShop.inventoryManager = partyInventory;
    magicShop.renderInventory();
  }
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
  map.updateTileInfo(leaderProxy.position.x, leaderProxy.position.y);
  initializeUI();
  rebuildInteractionSystem();
  updateWeightLabels();
  updateWorldInfo();
  updateDynamicLights();
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
    modernUI?.toggleInventory();
  } else if (event.key === 'M' || event.key === 'm') {
    event.preventDefault();
    if (isSpellMixingOpen()) {
      closeSpellMixing();
    } else {
      closeOtherOverlays('mixing');
      spellMixingUI?.openMixingInterface();
    }
  } else if (event.key === 'C' || event.key === 'c') {
    event.preventDefault();
    const caster = selectedMember ?? party.leader ?? null;
    if (!spellSystem.castPreparedSpell(caster)) {
      messageDisplay.log('No spell is prepared. Mix reagents first.');
    }
  }
});

initializeUI();
rebuildInteractionSystem();
messageDisplay.log('You awaken in a small chamber within Britannia.');
updateWorldInfo();

gameState = {
  update,
  worldRenderer,
  animationSystem,
  effectsRenderer,
  particleSystem,
  lightingSystem,
  spriteRenderer,
  ui: modernUI,
  canvas,
};

gameLoop = new GameLoop(gameState);
spriteRenderer.whenReady().then(() => {
  updateDynamicLights();
  gameLoop.start();
});

window.addEventListener('beforeunload', () => input.destroy());
