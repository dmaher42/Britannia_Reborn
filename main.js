import { createDemoWorld, drawWorld, RoomLibrary } from './world.js';
import { Party, CharacterClass } from './party.js';
import { Inventory } from './inventory.js';
import { Spellbook, castFireDart } from './spells.js';
import { CombatSystem } from './combat.js';
import { InputController } from './controls.js';
import { setupUI } from './ui.js';
import { clamp } from './utils.js';
import { drawCharacterModel } from './character-models.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const world = createDemoWorld();

const roomIds = Object.keys(RoomLibrary);
let currentRoomId = 'lordBritishCastle';
if (!RoomLibrary[currentRoomId]) {
  currentRoomId = RoomLibrary.meadow ? 'meadow' : roomIds[0];
}
if (!RoomLibrary[currentRoomId] && roomIds.length > 0) {
  currentRoomId = roomIds[0];
}
const travelDestinations = roomIds.map((id) => ({
  id,
  name: RoomLibrary[id]?.name ?? id
}));

const party = new Party(
  [
    { name: 'Avatar', cls: CharacterClass.Avatar, STR: 12, DEX: 10, INT: 10, hpMax: 32, baseSpeed: 110 },
    { name: 'Iolo', cls: CharacterClass.Bard, STR: 9, DEX: 12, INT: 8, hpMax: 24, baseSpeed: 108 },
    { name: 'Shamino', cls: CharacterClass.Ranger, STR: 11, DEX: 11, INT: 10, hpMax: 26, baseSpeed: 112 }
  ],
  { followSpacing: 42, collisionRadius: 14 }
);

const inventory = new Inventory();
inventory.gold = 125;
inventory.add({ id: 'sulfur_ash', name: 'Sulfur Ash', weight: 0.1, qty: 3, tag: 'reagent' });
inventory.add({ id: 'black_pearl', name: 'Black Pearl', weight: 0.1, qty: 3, tag: 'reagent' });
inventory.add({ id: 'healing_potion', name: 'Healing Potion', weight: 0.3, qty: 2, tag: 'consumable' });
party.members[0].addToBackpack({ id: 'bedroll', name: 'Bedroll', weight: 1.2, qty: 1 });

const spellbook = new Spellbook(inventory, party);
const combat = new CombatSystem(party);
const input = new InputController(window);

function getActiveCharacter() {
  return party.leader ?? null;
}

function handleEquipItem(itemId) {
  const actor = getActiveCharacter();
  if (!actor) {
    ui.showToast('No party member is ready to equip that item.');
    ui.log('No one steps forward to claim the gear.');
    return;
  }

  const item = inventory.items.find((entry) => entry.id === itemId);
  if (!item) {
    ui.showToast('That item is not in the party inventory.');
    ui.log(`${actor.name} searches the packs but finds nothing matching that description.`);
    return;
  }

  if (!item.equip) {
    ui.showToast(`${item.name} cannot be equipped.`);
    ui.log(`${actor.name} examines the ${item.name}, but it cannot be worn.`);
    return;
  }

  if (Array.isArray(item.restricted) && item.restricted.length > 0 && !item.restricted.includes(actor.cls)) {
    const allowed = item.restricted.join(', ');
    ui.showToast(`${item.name} is restricted to ${allowed}.`);
    ui.log(`${actor.name} cannot equip the ${item.name}. Allowed classes: ${allowed}.`);
    return;
  }

  const previous = actor.equipment[item.equip];
  if (!actor.equip(item)) {
    ui.showToast(`${actor.name} cannot equip the ${item.name}; it would overburden them.`);
    ui.log(`${actor.name} struggles with the ${item.name}, but lacks the strength to wear it.`);
    return;
  }

  const removed = inventory.remove(item.id, 1);
  if (!removed) {
    actor.equipment[item.equip] = previous ? { ...previous } : null;
    ui.showToast(`The ${item.name} slips back into the pack.`);
    ui.log(`The party fumbles for the ${item.name}, but it remains in storage.`);
    return;
  }

  if (previous) {
    const previousQty = typeof previous.qty === 'number' ? previous.qty : 1;
    inventory.add({ ...previous, qty: previousQty });
  }

  const itemName = item.name ?? item.id;
  ui.log(`${actor.name} equips the ${itemName}.`);
  if (previous) {
    ui.log(`The ${previous.name ?? previous.id} is returned to the party inventory.`);
  }
  ui.showToast(`${actor.name} equips ${itemName}.`);
  ui.refreshParty();
  ui.refreshInventory();
}

function handleUseItem(itemId) {
  const actor = getActiveCharacter();
  if (!actor) {
    ui.showToast('No party member is ready to use that item.');
    ui.log('The party hesitates, unsure who should use the item.');
    return;
  }

  const item = inventory.items.find((entry) => entry.id === itemId);
  if (!item) {
    ui.showToast('That item is not in the party inventory.');
    ui.log(`${actor.name} cannot find the requested item among the supplies.`);
    return;
  }

  if (item.tag !== 'consumable') {
    ui.showToast(`${item.name} cannot be used right now.`);
    ui.log(`${actor.name} cannot find a use for the ${item.name}.`);
    return;
  }

  const itemName = item.name ?? item.id;
  if (!inventory.consume(item.id, 1)) {
    ui.showToast(`The party has no ${itemName} left to use.`);
    ui.log(`${actor.name} searches the packs for ${itemName}, but finds none.`);
    return;
  }

  ui.log(`${actor.name} uses ${itemName}.`);
  ui.showToast(`${itemName} consumed.`);
  ui.refreshParty();
  ui.refreshInventory();
}

const ui = setupUI({
  party,
  inventory,
  spellbook,
  combat,
  destinations: travelDestinations,
  currentDestinationId: currentRoomId,
  onTravel: travelTo,
  onTalk: () => {
    const speaker = party.leader;
    ui.log(`${speaker.name} trades words with a wary villager.`);
    ui.showToast('The townsfolk wish you safe travels.');
  },
  onCast: () => {
    const caster = party.leader;
    if (!spellbook.canCast('fire_dart', caster)) {
      ui.showToast('You lack the reagents or focus for Fire Dart.');
      return;
    }
    castFireDart(caster, spellbook);
    ui.log(`${caster.name} looses a dart of flame into the twilight.`);
    ui.refreshInventory();
    ui.refreshParty();
  },
  onStartCombat: () => {
    if (combat.startSkirmish()) {
      ui.showToast('A skirmish erupts!');
    } else {
      ui.showToast('The skirmish is already underway.');
    }
  },
  onAddLoot: () => {
    inventory.add({ id: 'chain_mail', name: 'Chain Mail', weight: 6, qty: 1, equip: 'torso', tag: 'armor' });
    inventory.add({ id: 'spider_silk', name: 'Spider Silk', weight: 0.4, qty: 2, tag: 'reagent' });
    party.members[1].addToBackpack({ id: 'field_rations', name: 'Field Rations', weight: 0.5, qty: 2 });
    ui.refreshInventory();
    ui.refreshParty();
    ui.showToast('New supplies have been stowed.');
  },
  onEquipItem: handleEquipItem,
  onUseItem: handleUseItem
});

ui.log('The Avatar steps into the expanded courtyard of Castle Britannia, its new wings bustling with life.');
ui.showToast('Castle Britannia opens new wings to explore. Select a destination to travel.');

const camera = { x: 0, y: 0, width: 0, height: 0, deadzone: { width: 320, height: 220 } };
const deviceRatio = Math.min(window.devicePixelRatio || 1, 2);

function resize() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * deviceRatio;
  canvas.height = rect.height * deviceRatio;
  ctx.setTransform(deviceRatio, 0, 0, deviceRatio, 0, 0);
  camera.width = rect.width;
  camera.height = rect.height;
  updateCamera(true);
}

function ensureCanvasSize() {
  const parent = canvas.parentElement;
  if (!parent) return;
  const width = parent.clientWidth;
  const height = parent.clientHeight;
  if (canvas.style.width !== `${width}px` || canvas.style.height !== `${height}px`) {
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }
}

window.addEventListener('resize', () => {
  ensureCanvasSize();
  resize();
});
ensureCanvasSize();
resize();

let lastStatus = '';
let lastTerrain = '';

const areaName = () => world.currentRoom?.name ?? 'the wilds';
const areaNameWithArticle = () => {
  const name = areaName();
  return name.toLowerCase().startsWith('the ') ? name : `the ${name}`;
};

function updateStatus(text) {
  if (text !== lastStatus) {
    ui.setStatus(text);
    lastStatus = text;
  }
}

function updateTerrain(name) {
  if (name !== lastTerrain) {
    ui.setTerrain(name);
    lastTerrain = name;
  }
}

function updateCamera(forceCenter = false) {
  const leader = party.leader;
  if (!leader) return;
  const halfW = camera.width / 2;
  const halfH = camera.height / 2;
  const targetX = leader.x;
  const targetY = leader.y;

  if (forceCenter) {
    camera.x = targetX - halfW;
    camera.y = targetY - halfH;
  } else {
    const dead = camera.deadzone;
    const left = camera.x + (camera.width - dead.width) / 2;
    const right = left + dead.width;
    const top = camera.y + (camera.height - dead.height) / 2;
    const bottom = top + dead.height;

    if (targetX < left) {
      camera.x -= left - targetX;
    } else if (targetX > right) {
      camera.x += targetX - right;
    }

    if (targetY < top) {
      camera.y -= top - targetY;
    } else if (targetY > bottom) {
      camera.y += targetY - bottom;
    }
  }

  const { width, height } = world.getPixelSize();
  camera.x = clamp(camera.x, 0, Math.max(0, width - camera.width));
  camera.y = clamp(camera.y, 0, Math.max(0, height - camera.height));
}

async function travelTo(roomId) {
  if (!roomId) return;
  if (roomId === currentRoomId) {
    const hereName = RoomLibrary[currentRoomId]?.name ?? areaName();
    ui.showToast(`You are already exploring ${hereName}.`);
    ui.setActiveDestination?.(currentRoomId);
    return;
  }

  const destination = RoomLibrary[roomId];
  if (!destination) {
    ui.showToast('That destination has not yet been charted.');
    return;
  }

  ui.setTravelBusy?.(true);
  const destinationName = destination.name ?? destination.terrain ?? 'a distant locale';
  ui.log(`Preparations begin for the journey to ${destinationName}.`);

  try {
    await world.loadRoom(destination);
    currentRoomId = roomId;
    party.placeAt(world.spawn.x, world.spawn.y);
    updateCamera(true);
    lastStatus = '';
    lastTerrain = '';
    const terrainInfo = world.terrainAtWorld();
    updateTerrain(terrainInfo?.name ?? '-');
    const arrivalName = destination.name ?? destination.terrain ?? 'a new locale';
    updateStatus(`Arrived at ${arrivalName}.`);
    ui.setActiveDestination?.(roomId);
    ui.showToast(`Traveled to ${arrivalName}.`);
    ui.log(`The party arrives at ${arrivalName}.`);
  } catch (error) {
    console.error(error);
    ui.showToast('The moongates refuse the journey. Try again soon.');
    ui.log('A tremor in the ether scatters the party, foiling the journey.');
  } finally {
    ui.setTravelBusy?.(false);
  }
}

function update(dt) {
  const direction = input.getDirection();
  party.update(dt, world, direction);
  combat.update(dt);
  updateCamera();

  const leader = party.leader;
  if (leader) {
    const terrain = world.terrainAtWorld(leader.x, leader.y);
    updateTerrain(terrain?.name ?? '-');
    if (leader.isOverweight()) {
      updateStatus(`${leader.name} is slowed by the weight of their gear.`);
    } else if (direction.x !== 0 || direction.y !== 0) {
      updateStatus(`Exploring ${areaName()}...`);
    } else {
      updateStatus(`Use WASD or the arrow keys to explore ${areaNameWithArticle()}.`);
    }
  }
}

function drawParty(ctx, party, cam) {
  const radius = 19;
  party.members.forEach((member, index) => {
    const sx = member.x - cam.x;
    const sy = member.y - cam.y;
    drawCharacterModel(ctx, member, {
      x: sx,
      y: sy,
      radius,
      isLeader: index === party.leaderIndex
    });

    ctx.save();
    ctx.font = '12px "Inter", system-ui';
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.lineWidth = 3;
    ctx.strokeText(member.name, sx, sy - radius * 1.55);
    ctx.fillStyle = '#f6edd6';
    ctx.fillText(member.name, sx, sy - radius * 1.55);
    ctx.restore();
  });
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawWorld(ctx, world, camera);
  drawParty(ctx, party, camera);
}

let lastTime = performance.now();

function frame(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.25);
  lastTime = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

async function init() {
  await world.ready;
  party.placeAt(world.spawn.x, world.spawn.y);
  const terrainInfo = world.terrainAtWorld();
  updateTerrain(terrainInfo?.name ?? '-');
  ui.setActiveDestination?.(currentRoomId);
  updateCamera(true);
  lastTime = performance.now();
  requestAnimationFrame(frame);
}

init();

window.addEventListener('beforeunload', () => input.destroy());
