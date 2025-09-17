import {
  drawSky,
  drawWorld,
  TERRAIN,
  TILE,
  LORD_BRITISH_CASTLE_SWAMP_EDGE,
  LORD_BRITISH_THRONE_POS,
  GARGOYLE_STANDING_POS
} from './world.js';
import { Party, CharacterClass, Character } from './party.js';
import { Inventory } from './inventory.js';
import { Spellbook, castFireDart } from './spells.js';
import { CombatSystem } from './combat.js';
import { pushBubble, pushActions, showToast, updatePartyUI, updateInventoryUI, gridLayer } from './ui.js';
import * as uiModule from './ui.js';
import { getSelectedText } from './selection.js';
import { talkToNPC } from './ai.js';
import { initRenderer, renderer, scene, camera, render } from './renderer.js';
import { initWorld3D, updateWorld3D, raycastTileFromScreen, setHighlightGrid, hideHighlight, moveHeroToTile } from './world3d.js';
import { initControls, updateControls } from './controls.js';

const showBootError = (typeof window !== 'undefined' && window.__britanniaShowBootError)
  ? window.__britanniaShowBootError
  : ((message, error) => console.error('[Boot]', message, error));

const rootElement = document.getElementById('root') || document.body;
const dpr = Math.min(window.devicePixelRatio || 1, 2);

function ensureCanvasElement(id, { tabIndex } = {}) {
  let element = document.getElementById(id);
  if (!element) {
    element = document.createElement('canvas');
    element.id = id;
    if (typeof tabIndex === 'number') {
      element.tabIndex = tabIndex;
    }
    const anchor = rootElement && (rootElement.querySelector('#focusOverlay') || rootElement.firstChild);
    if (rootElement) {
      rootElement.insertBefore(element, anchor || null);
    } else {
      document.body.appendChild(element);
    }
  } else if (!(element instanceof HTMLCanvasElement)) {
    const err = new Error(`Element with id "${id}" is not a <canvas>.`);
    showBootError(`Expected a <canvas> element with id "${id}".`, err);
    throw err;
  } else if (typeof tabIndex === 'number' && element.tabIndex !== tabIndex) {
    element.tabIndex = tabIndex;
  }
  return element;
}

function ensure2dContext(canvas, options) {
  const context = canvas.getContext('2d', options);
  if (!context) {
    const err = new Error(`Unable to acquire a 2D context for canvas #${canvas.id}.`);
    showBootError('Failed to initialise the rendering surface. Your browser may not support HTML5 Canvas.', err);
    throw err;
  }
  return context;
}

function ensureCanvasAndContext(id, contextOptions, extra = {}) {
  const canvas = ensureCanvasElement(id, extra);
  const context = ensure2dContext(canvas, contextOptions);
  return [canvas, context];
}

const [skyC, sky] = ensureCanvasAndContext('sky');
const [backC, back] = ensureCanvasAndContext('back');
const [gameC, ctx] = ensureCanvasAndContext('game', { alpha: false }, { tabIndex: 0 });
const [fxC, fx] = ensureCanvasAndContext('fx');

function sizeCanvas(canvas, context) {
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  canvas.style.width = `${innerWidth}px`;
  canvas.style.height = `${innerHeight}px`;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function onResize() {
  sizeCanvas(skyC, sky);
  sizeCanvas(backC, back);
  sizeCanvas(gameC, ctx);
  sizeCanvas(fxC, fx);
  if (!party.leader) {
    debugCircle.x = innerWidth / 2;
    debugCircle.y = innerHeight / 2;
  }
}

addEventListener('resize', onResize);

let camX = -innerWidth/2, camY = -innerHeight/2;
let heroMarkerVisible = true;
let firstMoveMade = false;
let _loggedBoot = false;
let _firstPartyDrawAt = 0;
let _watchdogShown = false;
let _bootWatchdogTimer = 0;
const DEBUG = false;
let _lastDebugLog = 0;
const LOOK_SPEED = 240; // pixels per second for camera look
const debugCircle = { x: innerWidth / 2, y: innerHeight / 2, radius: 18, speed: 180 };

// Lord British's castle layout is defined in world.js so rendering and gameplay
// stay in sync. Use the shared coordinates for spawning the party and NPCs.
const PARTY_SPREAD_X = 28;
const PARTY_SPREAD_Y = 8;

const party = new Party([
  { name:'Avatar', cls:CharacterClass.Avatar, STR:12, DEX:10, INT:9, hpMax:30, mpClass:true },
  { name:'Iolo', cls:CharacterClass.Bard, STR:9, DEX:12, INT:8,  hpMax:22 },
  { name:'Shamino', cls:CharacterClass.Ranger, STR:11, DEX:12, INT:10, hpMax:24 }
]);

// Place the party in the swamp just outside the castle walls.
function placePartyAt(location){
  const mid = (party.members.length - 1) / 2;
  party.members.forEach((m,i)=>{
    m.x = location.x + (i - mid) * PARTY_SPREAD_X;
    const verticalOffset = i === 0 ? 0 : (i % 2 ? PARTY_SPREAD_Y : -PARTY_SPREAD_Y);
    m.y = location.y + verticalOffset;
  });
}
placePartyAt(LORD_BRITISH_CASTLE_SWAMP_EDGE);

// NPCs present at Lord British's castle
const npcs = [
  Object.assign(
    new Character({ name:'Lord British', cls:CharacterClass.Paladin, STR:15, DEX:12, INT:15, hpMax:40 }),
    {
      profession:'Monarch',
      town:'Britain',
      personality:'regal and wise'
    }
  ),
  Object.assign(
    new Character({ name:'Gargoyle', cls:CharacterClass.Fighter, STR:13, DEX:9, INT:8, hpMax:30 }),
    {
      profession:'Warrior',
      town:'Unknown',
      personality:'stern and enigmatic'
    }
  )
];
function placeNPCs(){
  if(npcs[0]){ npcs[0].x = LORD_BRITISH_THRONE_POS.x; npcs[0].y = LORD_BRITISH_THRONE_POS.y; }
  if(npcs[1]){ npcs[1].x = GARGOYLE_STANDING_POS.x; npcs[1].y = GARGOYLE_STANDING_POS.y; }
}
placeNPCs();

const inventory = new Inventory();
inventory.gold = 125;
inventory.add({ id:'sulfur_ash', name:'Sulfur Ash', weight:0.1, qty:3, tag:'reagent' });
inventory.add({ id:'black_pearl', name:'Black Pearl', weight:0.1, qty:3, tag:'reagent' });
inventory.add({ id:'healing_potion', name:'Potion of Healing', weight:0.2, qty:1, tag:'consumable' });

const spells = new Spellbook(inventory, party);

const combat = new CombatSystem(party, inventory, spells, gameC, ctx, fx, gridLayer);

const focusOverlayEl = document.getElementById('focusOverlay');

// Keyboard input: bind to window
export const pressedKeys = new Set();

function normalizeKey(k) {
  const map = {
    Left: 'ArrowLeft',
    Right: 'ArrowRight',
    Up: 'ArrowUp',
    Down: 'ArrowDown',
    ' ': ' ',
    Spacebar: ' ',
    Space: ' '
  };
  if (k in map) return map[k];
  return k.length === 1 ? k.toLowerCase() : k;
}

const arrowKeys = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

function handleKeyDown(e) {
  console.debug('Key down:', e.key);
  const key = normalizeKey(e.key);
  if (arrowKeys.has(key)) {
    e.preventDefault();
  }
  pressedKeys.add(key);
  if (showKeyOverlay) updateKeyOverlay();
}

function handleKeyUp(e) {
  console.debug('Key up:', e.key);
  const key = normalizeKey(e.key);
  if (arrowKeys.has(key)) {
    e.preventDefault();
  }
  pressedKeys.delete(key);
  if (showKeyOverlay) updateKeyOverlay();
}

window.addEventListener('keydown', handleKeyDown, { passive: false });
window.addEventListener('keyup', handleKeyUp, { passive: false });
window.addEventListener('blur', () => {
  pressedKeys.clear();
  if (showKeyOverlay) updateKeyOverlay();
});

// Overlay for pressed keys (toggle with '?')
let showKeyOverlay = false;
function updateKeyOverlay() {
  let overlay = document.getElementById('keyOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'keyOverlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '8px';
    overlay.style.right = '8px';
    overlay.style.background = 'rgba(0,0,0,0.7)';
    overlay.style.color = '#fff';
    overlay.style.font = '12px monospace';
    overlay.style.padding = '4px 8px';
    overlay.style.borderRadius = '6px';
    overlay.style.zIndex = 9999;
    document.body.appendChild(overlay);
  }
  overlay.style.display = showKeyOverlay ? 'block' : 'none';
  if (showKeyOverlay) {
    overlay.textContent = 'Keys: ' + Array.from(pressedKeys).join(', ');
  }
}
window.addEventListener('keydown', e => {
  if (e.key === '?') {
    showKeyOverlay = !showKeyOverlay;
    updateKeyOverlay();
  }
});
setInterval(() => { if (showKeyOverlay) updateKeyOverlay(); }, 100);

// Focus logic
const gameCanvas = gameC;

function updateFocusOverlayVisibility() {
  if (!focusOverlayEl) return;
  const windowHasFocus = typeof document.hasFocus === 'function' ? document.hasFocus() : true;
  const isFocused = windowHasFocus && document.activeElement === gameCanvas;
  focusOverlayEl.classList.toggle('visible', !isFocused);
}

function focusGameCanvas() {
  if (!gameCanvas) return;
  if (typeof gameCanvas.focus === 'function') {
    gameCanvas.focus({ preventScroll: true });
  }
  requestAnimationFrame(updateFocusOverlayVisibility);
}

if (gameCanvas) {
  gameCanvas.addEventListener('focus', updateFocusOverlayVisibility);
  gameCanvas.addEventListener('blur', updateFocusOverlayVisibility);
  gameCanvas.addEventListener('pointerdown', () => {
    if (document.activeElement !== gameCanvas) {
      focusGameCanvas();
    }
  });
}

function startFocusManagement() {
  focusGameCanvas();
  updateFocusOverlayVisibility();
}

if (document.readyState === 'loading') {
  window.addEventListener('load', startFocusManagement, { once: true });
} else {
  requestAnimationFrame(startFocusManagement);
}

document.addEventListener('pointerdown', () => {
  if (document.activeElement !== gameCanvas) {
    focusGameCanvas();
  }
});

window.addEventListener('focus', updateFocusOverlayVisibility);
window.addEventListener('blur', updateFocusOverlayVisibility);
document.addEventListener('visibilitychange', updateFocusOverlayVisibility);

function showBootWatchdog(){
  if (_watchdogShown) return;
  _watchdogShown = true;
  const toast = document.createElement('div');
  toast.innerHTML = `Starting renderer… If the screen is blank/blue:<br>• Click the game area to focus<br>• Try ?dev=1 to bypass service worker<br>• Check DevTools console for import errors`;
  toast.style.position = 'fixed';
  toast.style.top = '16px';
  toast.style.left = '50%';
  toast.style.transform = 'translateX(-50%)';
  toast.style.zIndex = '10000';
  toast.style.background = 'rgba(20,24,32,0.9)';
  toast.style.color = '#fff';
  toast.style.padding = '12px 18px';
  toast.style.borderRadius = '10px';
  toast.style.boxShadow = '0 12px 32px rgba(0,0,0,0.35)';
  toast.style.font = '14px/1.4 sans-serif';
  toast.style.maxWidth = 'min(420px, 92vw)';
  toast.style.textAlign = 'left';
  toast.style.opacity = '0';
  toast.style.transition = 'opacity 320ms ease';
  document.body.appendChild(toast);
  requestAnimationFrame(() => { toast.style.opacity = '1'; });
  setTimeout(() => {
    toast.style.transition = 'opacity 700ms ease';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 720);
  }, 7000);
}

function scheduleBootWatchdog(){
  if (_bootWatchdogTimer) return;
  requestAnimationFrame(() => {
    if (_bootWatchdogTimer) return;
    _bootWatchdogTimer = window.setTimeout(() => {
      if (_firstPartyDrawAt === 0) {
        showBootWatchdog();
      }
      _bootWatchdogTimer = 0;
    }, 2000);
  });
}

document.getElementById('btnTalk').onclick = async () => {
  const player = party.leader;
  let closest=null, dist=Infinity;
  for(const n of npcs){
    const d = Math.hypot(n.x - player.x, n.y - player.y);
    if(d < dist){ dist=d; closest=n; }
  }
  if(!closest || dist>120){
    return pushBubble('System','No one nearby to talk to.');
  }
  const npc = { name: closest.name, profession: closest.profession, town: closest.town, personality: closest.personality };
  const worldState = { location:"Lord British's Castle", time: Date.now() };
  const questState = party.activeQuests;
  const playerState = { name: player.name, karma: party.karma, items: inventory.summary() };
  const greeting = closest.name === 'Gargoyle' ? 'Grrr... Avatar...' : 'Welcome to my castle, Avatar.';
  pushBubble(closest.name, greeting);
  const playerInput = getSelectedText(window.getSelection()) || 'Greetings.';
  const { text } = await talkToNPC(npc, worldState, playerState, questState, playerInput);
  pushBubble(closest.name, text);
};
document.getElementById('btnCombat').onclick = ()=>combat.startSkirmish();
document.getElementById('btnCast').onclick = ()=>{
  if(combat.active && combat.turn !== 'player') return showToast('Wait for your turn');
  const caster = party.members[0];
  if(!spells.canCast('fire_dart', caster)) return showToast('Need Sulfur Ash + Black Pearl and MP');
  castFireDart(caster, combat, ctx, fx, inventory, spells);
};
document.getElementById('btnEndTurn').onclick = ()=> combat.endPlayerTurn();
document.getElementById('btnAddLoot').onclick = ()=>{
  inventory.add({ id:'spider_silk', name:'Spider Silk', weight:0.4, qty:5, tag:'loot' });
  inventory.add({ id:'chain_mail', name:'Chain Mail', weight:6.0, qty:1, tag:'armor', equip:'torso', restricted:['Mage','Druid'] });
  updateInventoryUI(inventory, party);
};

updatePartyUI(party);
updateInventoryUI(inventory, party);

// Center camera on leader at boot and ensure leader is within view
function centerCameraOnLeader(){
  if(!party.leader) return;
  camX = party.leader.x - innerWidth/2;
  camY = party.leader.y - innerHeight/2;
  updateTerrainPill();
  console.info('Boot: party size=', party.size, 'leader=', party.leader.name, 'coords=', Math.round(party.leader.x), Math.round(party.leader.y));
}
onResize();
centerCameraOnLeader();

// Ensure party members have sensible world coordinates (place near screen center)
// Keep party positions as initialized by Party constructor; no forced repositioning here.

// Hero Marker drawing helper
function drawHeroMarker(ctx, view, leader){
  if(!heroMarkerVisible || !leader) return;
  const { camX, camY } = view;
  const sx = leader.x - camX, sy = leader.y - camY;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(sx, sy+6, 22, 8, 0, 0, Math.PI*2);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(sx-28, sy-36, 56, 18);
  ctx.fillStyle = '#ffffff';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(leader.name || 'Avatar', sx, sy-24);
  ctx.restore();
}

// Dev toggle: press H to hide/show hero marker
addEventListener('keydown', (e)=>{ if(e.key==='h' || e.key==='H'){ heroMarkerVisible = !heroMarkerVisible; console.info('Hero marker visible=', heroMarkerVisible); } });

// First-move hint
function showFirstMoveHint(){
  const hint = document.createElement('div');
  hint.id = 'firstMoveHint';
  hint.style.position='fixed'; hint.style.left='12px'; hint.style.bottom='12px'; hint.style.padding='8px 12px';
  hint.style.background='rgba(0,0,0,0.6)'; hint.style.color='#fff'; hint.style.borderRadius='6px'; hint.style.zIndex=9999;
  hint.textContent = 'Move with WASD or Arrows · Hold Shift to look';
  document.body.appendChild(hint);
  setTimeout(()=>{ hint.style.transition='opacity 700ms'; hint.style.opacity='0'; setTimeout(()=>hint.remove(),800); },4000);
}
showFirstMoveHint();

function updateTerrainPill() {
  const pill = document.getElementById('terrainPill');
  if (!pill) return;
  const leader = party.leader;
  if (!leader) {
    pill.textContent = 'Terrain: Unknown';
    return;
  }
  const terr = TERRAIN.at(Math.floor(leader.x / TILE), Math.floor(leader.y / TILE));
  pill.textContent = 'Terrain: ' + terr.name;
}

let last = performance.now();
function loop(){
  requestAnimationFrame(loop);
  try {
    const now = performance.now(), dt = (now-last)/1000; last = now;
    // Clear canvases that accumulate drawing each frame.
    // Without clearing, the fx layer's lights compound and the screen
    // quickly washes out.
    ctx.clearRect(0,0,innerWidth,innerHeight);
    fx.clearRect(0,0,innerWidth,innerHeight);
    back.clearRect(0,0,innerWidth,innerHeight); sky.clearRect(0,0,innerWidth,innerHeight);
    drawSky(sky, back, dt, innerWidth, innerHeight);

  const leader = party.leader || null;
  const left = pressedKeys.has('a') || pressedKeys.has('ArrowLeft');
  const right = pressedKeys.has('d') || pressedKeys.has('ArrowRight');
  const up = pressedKeys.has('w') || pressedKeys.has('ArrowUp');
  const down = pressedKeys.has('s') || pressedKeys.has('ArrowDown');
  let mvx = 0;
  let mvy = 0;
  if (left) mvx -= 1;
  if (right) mvx += 1;
  if (up) mvy -= 1;
  if (down) mvy += 1;
  const arrowActive = pressedKeys.has('ArrowLeft') || pressedKeys.has('ArrowRight') || pressedKeys.has('ArrowUp') || pressedKeys.has('ArrowDown');
  const looking = pressedKeys.has('Shift') && arrowActive;

  if (leader && !combat.active) {
    if ((mvx || mvy) && !looking) {
      const len = Math.hypot(mvx, mvy) || 1;
      mvx /= len;
      mvy /= len;
      const terr = TERRAIN.at(Math.floor(leader.x / TILE), Math.floor(leader.y / TILE));
      let s = leader.speed();
      if (terr.key === 'SWAMP') { s *= 0.7; if (Math.random() < 0.02) { leader.applyPoison(1); } }
      if (terr.key === 'FOREST') { s *= 0.86; }
      if (terr.key === 'ROAD') { s *= 1.22; }
      if (terr.key === 'WATER') { s *= 0.5; }
      if (terr.key === 'SAND') { s *= 0.92; }
      party.move(mvx * s * dt, mvy * s * dt);
      camX = leader.x - innerWidth / 2;
      camY = leader.y - innerHeight / 2;
      updateTerrainPill();
    } else if (!looking) {
      camX = leader.x - innerWidth / 2;
      camY = leader.y - innerHeight / 2;
    }
  } else if (!leader) {
    if (mvx || mvy) {
      const len = Math.hypot(mvx, mvy) || 1;
      mvx /= len;
      mvy /= len;
      debugCircle.x = Math.max(0, Math.min(innerWidth, debugCircle.x + mvx * debugCircle.speed * dt));
      debugCircle.y = Math.max(0, Math.min(innerHeight, debugCircle.y + mvy * debugCircle.speed * dt));
    }
    if (!looking) {
      camX = debugCircle.x - innerWidth / 2;
      camY = debugCircle.y - innerHeight / 2;
    }
  } else if (!looking) {
    camX = leader.x - innerWidth / 2;
    camY = leader.y - innerHeight / 2;
  }

  if (looking) {
    let lookX = 0;
    let lookY = 0;
    if (pressedKeys.has('ArrowLeft')) lookX -= 1;
    if (pressedKeys.has('ArrowRight')) lookX += 1;
    if (pressedKeys.has('ArrowUp')) lookY -= 1;
    if (pressedKeys.has('ArrowDown')) lookY += 1;
    if (lookX || lookY) {
      const len = Math.hypot(lookX, lookY) || 1;
      lookX /= len;
      lookY /= len;
      camX += lookX * LOOK_SPEED * dt;
      camY += lookY * LOOK_SPEED * dt;
    }
  }
  if (combat.active) {
    combat.update(dt);
  }
  const gameW = innerWidth, gameH = innerHeight;
  const view = {camX, camY, W:gameW, H:gameH};
  // Debug: draw a small red crosshair at screen center to ensure game canvas is visible
    // normal rendering
  const terrVisPenalty = leader
    ? (TERRAIN.at(Math.floor(leader.x / TILE), Math.floor(leader.y / TILE)).key === 'FOREST' ? 0.08 : 0)
    : 0;
  drawWorld(ctx, view, dt, terrVisPenalty);
  // Draw world then party (ensure leader visible)
  try{
    npcs.forEach(n=>n.draw(ctx, view));
    party.draw(ctx, view);
    if (_firstPartyDrawAt === 0) {
      _firstPartyDrawAt = performance.now();
      if (_bootWatchdogTimer) {
        clearTimeout(_bootWatchdogTimer);
        _bootWatchdogTimer = 0;
      }
    }
    if(!_loggedBoot){
      console.info('Render loop started', {
        partySize: party.size,
        leaderPosition: leader ? {
          x: Math.round(leader.x),
          y: Math.round(leader.y)
        } : null
      });
      _loggedBoot = true;
    }
    drawHeroMarker(ctx, view, leader);
    if (!leader) {
      const screenX = debugCircle.x - camX;
      const screenY = debugCircle.y - camY;
      ctx.save();
      ctx.fillStyle = 'rgba(64, 128, 255, 0.9)';
      ctx.beginPath();
      ctx.arc(screenX, screenY, debugCircle.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    uiModule.draw?.(ctx);
  }catch(err){
    console.error('party.draw failed', err);
  }
  combat.draw(ctx, fx, view);
  if (DEBUG && now - _lastDebugLog > 1000) {
    console.info('Key listeners attached:', window);
    console.info('Party size:', party.size, 'Leader coords:', leader ? `${leader.x}, ${leader.y}` : 'none');
    _lastDebugLog = now;
  }

  if (showKeyOverlay) updateKeyOverlay();

  // no debug overlay in production

  combat.drawLighting(fx, view, leader);
  } catch (err) {
    console.error('loop iteration failed', err);
  }
}
requestAnimationFrame(loop);

const bootWatchdogStarter = () => scheduleBootWatchdog();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootWatchdogStarter, { once: true });
} else {
  bootWatchdogStarter();
}

// 3D tile demo
let cameraRig = null;
let rendererBoot = null;
try {
  rendererBoot = initRenderer();
  cameraRig = rendererBoot.cameraRig;
} catch (err) {
  console.error('[3D] Failed to initialise renderer', err);
  showToast('3D renderer unavailable — continuing without the showcase.');
}

let world3D = null;
if (cameraRig) {
  try {
    world3D = initWorld3D(8, 8);
    scene.add(world3D.world);
    initControls({ width: 8, depth: 8, cameraRig });
  } catch (err) {
    console.error('[3D] Failed to initialise world preview', err);
    showToast('3D showcase failed to start. Core gameplay is still available.');
    world3D = null;
  }
}

if (rendererBoot && world3D) {
  let last3d = performance.now();
  function loop3d(now){
    requestAnimationFrame(loop3d);
    const dt = (now - last3d)/1000; last3d = now;
    updateControls(dt);
    updateWorld3D(dt);
    render();
  }
  requestAnimationFrame(loop3d);

  const threeCanvas = renderer && renderer.domElement;
  if (threeCanvas) {
    threeCanvas.addEventListener('pointermove', e=>{
      const hit = raycastTileFromScreen(e.clientX, e.clientY, camera);
      if(hit) setHighlightGrid(hit.gridX, hit.gridZ);
      else hideHighlight();
    });
    threeCanvas.addEventListener('click', e=>{
      const hit = raycastTileFromScreen(e.clientX, e.clientY, camera);
      if(hit) moveHeroToTile(hit.gridX, hit.gridZ);
    });
  }
} else {
  console.info('[3D] Preview disabled; running 2D mode only.');
}
