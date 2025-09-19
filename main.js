import { createDemoWorld, drawWorld } from './world.js';
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

const ui = setupUI({
  party,
  inventory,
  spellbook,
  combat,
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
  }
});

ui.log('The Avatar stands before Castle Britannia, seat of Lord British.');
ui.showToast("Welcome to the castle keep of Lord British.");

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
      updateStatus('Exploring the castle grounds...');
    } else {
      updateStatus('Use WASD or the arrow keys to tour the castle courtyard.');
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
  updateCamera(true);
  lastTime = performance.now();
  requestAnimationFrame(frame);
}

init();

window.addEventListener('beforeunload', () => input.destroy());
