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
const minimapCanvas = document.getElementById('minimap');
const minimapCtx = minimapCanvas?.getContext('2d') ?? null;
const minimapState = { width: 0, height: 0, padding: 12 };

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

function resizeMinimap() {
  if (!minimapCanvas || !minimapCtx) return;
  const rect = minimapCanvas.getBoundingClientRect();
  const width = rect.width || minimapCanvas.clientWidth || minimapCanvas.width || 0;
  const height = rect.height || minimapCanvas.clientHeight || minimapCanvas.height || 0;
  minimapState.width = width;
  minimapState.height = height;
  minimapCanvas.width = Math.max(1, Math.round(width * deviceRatio));
  minimapCanvas.height = Math.max(1, Math.round(height * deviceRatio));
  minimapCtx.setTransform(deviceRatio, 0, 0, deviceRatio, 0, 0);
  minimapCtx.imageSmoothingEnabled = false;
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * deviceRatio;
  canvas.height = rect.height * deviceRatio;
  ctx.setTransform(deviceRatio, 0, 0, deviceRatio, 0, 0);
  camera.width = rect.width;
  camera.height = rect.height;
  resizeMinimap();
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

function drawMinimap(world, party, cam) {
  if (!minimapCtx || !minimapCanvas) return;
  const { width, height, padding } = minimapState;
  if (!width || !height) return;

  minimapCtx.save();
  minimapCtx.setTransform(deviceRatio, 0, 0, deviceRatio, 0, 0);
  minimapCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);

  minimapCtx.fillStyle = 'rgba(5, 12, 20, 0.92)';
  minimapCtx.fillRect(0, 0, width, height);

  const room = world.currentRoom;
  if (!room) {
    minimapCtx.restore();
    return;
  }

  const boundsWidth = room.bounds?.width ?? world.width ?? 0;
  const boundsHeight = room.bounds?.height ?? world.height ?? 0;
  if (!(boundsWidth > 0) || !(boundsHeight > 0)) {
    minimapCtx.restore();
    return;
  }

  const safePadding = typeof padding === 'number' ? Math.max(0, padding) : 0;
  const availableWidth = Math.max(1, width - safePadding * 2);
  const availableHeight = Math.max(1, height - safePadding * 2);
  const scaleCandidate = Math.min(availableWidth / boundsWidth, availableHeight / boundsHeight);
  const scale = Number.isFinite(scaleCandidate) && scaleCandidate > 0 ? scaleCandidate : 1;
  const offsetX = (width - boundsWidth * scale) / 2;
  const offsetY = (height - boundsHeight * scale) / 2;

  const drawRect = (rect, minSize = 2) => {
    if (!rect) return;
    const x = rect.x ?? 0;
    const y = rect.y ?? 0;
    const rawWidth = (rect.width ?? rect.w ?? 0) * scale;
    const rawHeight = (rect.height ?? rect.h ?? 0) * scale;
    const drawWidth = Math.max(minSize, rawWidth);
    const drawHeight = Math.max(minSize, rawHeight);
    const px = offsetX + x * scale + (rawWidth - drawWidth) / 2;
    const py = offsetY + y * scale + (rawHeight - drawHeight) / 2;
    minimapCtx.fillRect(px, py, drawWidth, drawHeight);
  };

  const mapWidth = boundsWidth * scale;
  const mapHeight = boundsHeight * scale;
  minimapCtx.fillStyle = 'rgba(46, 96, 74, 0.72)';
  minimapCtx.fillRect(offsetX, offsetY, mapWidth, mapHeight);
  if (mapWidth > 2 && mapHeight > 2) {
    minimapCtx.strokeStyle = 'rgba(156, 208, 255, 0.35)';
    minimapCtx.lineWidth = 1.5;
    minimapCtx.strokeRect(offsetX + 0.75, offsetY + 0.75, mapWidth - 1.5, mapHeight - 1.5);
  }

  if (Array.isArray(room.obstacles)) {
    for (const obstacle of room.obstacles) {
      const type = typeof obstacle?.type === 'string' ? obstacle.type.toLowerCase() : '';
      if (type === 'water') {
        minimapCtx.fillStyle = 'rgba(58, 132, 188, 0.7)';
      } else {
        minimapCtx.fillStyle = 'rgba(18, 32, 26, 0.82)';
      }
      drawRect(obstacle, 2.4);
    }
  }

  if (Array.isArray(room.props)) {
    for (const prop of room.props) {
      const type = typeof prop?.type === 'string' ? prop.type.toLowerCase() : '';
      let color = 'rgba(86, 142, 112, 0.7)';
      if (type === 'lantern' || type === 'brazier') {
        color = 'rgba(255, 212, 132, 0.78)';
      } else if (type === 'banner') {
        color = 'rgba(198, 104, 98, 0.68)';
      } else if (type === 'tent' || type === 'crate') {
        color = 'rgba(196, 152, 108, 0.68)';
      } else if (type === 'tree') {
        color = 'rgba(72, 136, 94, 0.68)';
      }
      minimapCtx.fillStyle = color;
      drawRect(prop, 2);
    }
  }

  const view = cam ?? { x: 0, y: 0, width: 0, height: 0 };
  const viewWidth = view.width * scale;
  const viewHeight = view.height * scale;
  if (viewWidth > 2 && viewHeight > 2) {
    const vx = offsetX + view.x * scale;
    const vy = offsetY + view.y * scale;
    minimapCtx.fillStyle = 'rgba(140, 196, 255, 0.12)';
    minimapCtx.fillRect(vx, vy, viewWidth, viewHeight);
    minimapCtx.strokeStyle = 'rgba(173, 222, 255, 0.85)';
    minimapCtx.lineWidth = 1;
    minimapCtx.strokeRect(vx + 0.5, vy + 0.5, Math.max(0, viewWidth - 1), Math.max(0, viewHeight - 1));
  }

  if (party && Array.isArray(party.members)) {
    const baseRadius = Math.max(2, Math.min(4, 4 * scale));
    party.members.forEach((member, index) => {
      if (!member) return;
      const px = offsetX + (member.x ?? 0) * scale;
      const py = offsetY + (member.y ?? 0) * scale;
      const radius = index === party.leaderIndex ? baseRadius + 1 : baseRadius;
      minimapCtx.beginPath();
      minimapCtx.arc(px, py, radius, 0, Math.PI * 2);
      minimapCtx.fillStyle = index === party.leaderIndex ? '#ffd76f' : '#7ec8ff';
      minimapCtx.fill();
      minimapCtx.lineWidth = 1;
      minimapCtx.strokeStyle = 'rgba(6, 12, 18, 0.85)';
      minimapCtx.stroke();
    });
  }

  minimapCtx.restore();
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawWorld(ctx, world, camera);
  drawParty(ctx, party, camera);
  drawMinimap(world, party, camera);
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
