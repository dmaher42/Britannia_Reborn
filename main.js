import { drawSky, drawWorld, TERRAIN, TILE } from './world.js';
import { Party, CharacterClass } from './party.js';
import { Inventory } from './inventory.js';
import { Spellbook, castFireDart } from './spells.js';
import { CombatSystem } from './combat.js';
import { pushBubble, pushActions, showToast, updatePartyUI, updateInventoryUI, gridLayer } from './ui.js';
import { getSelectedText } from './selection.js';
import { talkToNPC } from './ai.js';

const dpr = Math.min(window.devicePixelRatio||1, 2);
const skyC = document.getElementById('sky'), sky = skyC.getContext('2d');
const backC = document.getElementById('back'), back = backC.getContext('2d');
const gameC = document.getElementById('game'), ctx = gameC.getContext('2d',{alpha:false});
const fxC = document.getElementById('fx'), fx = fxC.getContext('2d');
function sizeCanvas(c){ c.width = innerWidth * dpr; c.height = innerHeight * dpr; c.style.width = innerWidth+'px'; c.style.height = innerHeight+'px'; c.getContext('2d').setTransform(dpr,0,0,dpr,0,0); }
function onResize(){ [skyC,backC,gameC,fxC].forEach(sizeCanvas); }
addEventListener('resize', onResize);

let camX = -innerWidth/2, camY = -innerHeight/2;
let heroMarkerVisible = true;
let firstMoveMade = false;
let _loggedBoot = false;
const DEBUG = false;
let _lastDebugLog = 0;

// Debug System Bootstrap
function initDebugSystem() {
  // Parse URL for debug=1 parameter
  const urlParams = new URLSearchParams(window.location.search);
  const debugEnabled = urlParams.get('debug') === '1';
  
  // Initialize debug object
  window.__DBG = {
    ENABLED: debugEnabled,
    FORCE_MOVE: false,
    FORCE_CAMERA: false,
    TEST_SPEED: 120,
    PRINT_FREQ: 30,
    lastSnapshot: null,
    frameCounter: 0
  };
  
  // Guard against early access
  if (!window.__DBG) return;
  
  console.info('[DEBUG] Debug system initialized. ENABLED:', window.__DBG.ENABLED);
  if (window.__DBG.ENABLED) {
    console.info('[DEBUG] Use ` key to toggle, window.enableDebug(), window.disableDebug()');
  }
}

// Initialize debug system immediately
initDebugSystem();

const party = new Party([
  { name:'Avatar', cls:CharacterClass.Avatar, STR:12, DEX:10, INT:9, hpMax:30, mpClass:true },
  { name:'Iolo', cls:CharacterClass.Bard, STR:9, DEX:12, INT:8,  hpMax:22 },
  { name:'Shamino', cls:CharacterClass.Ranger, STR:11, DEX:12, INT:10, hpMax:24 }
]);

// place party near screen center so leader is visible at boot
function placePartyAtScreenCenter(){
  const cx = innerWidth/2;
  const cy = innerHeight/2;
  const mid = (party.members.length - 1) / 2;
  party.members.forEach((m,i)=>{
    m.x = cx + (i - mid) * 28; // small side-by-side offsets
    m.y = cy + (i % 2 ? 8 : -8);
  });
}
placePartyAtScreenCenter();

const inventory = new Inventory();
inventory.gold = 125;
inventory.add({ id:'sulfur_ash', name:'Sulfur Ash', weight:0.1, qty:3, tag:'reagent' });
inventory.add({ id:'black_pearl', name:'Black Pearl', weight:0.1, qty:3, tag:'reagent' });
inventory.add({ id:'healing_potion', name:'Potion of Healing', weight:0.2, qty:1, tag:'consumable' });

const spells = new Spellbook(inventory, party);

const combat = new CombatSystem(party, inventory, spells, gameC, ctx, fx, gridLayer);

// Debug Helper Functions
function enableDebug() {
  if (!window.__DBG) return;
  window.__DBG.ENABLED = true;
  console.info('[DEBUG] Debug mode enabled. Snapshot logging active.');
}

function disableDebug() {
  if (!window.__DBG) return;
  window.__DBG.ENABLED = false;
  console.info('[DEBUG] Debug mode disabled.');
}

function forceMove(on) {
  if (!window.__DBG) return;
  window.__DBG.FORCE_MOVE = !!on;
  console.info('[DEBUG] Force move:', window.__DBG.FORCE_MOVE ? 'ON' : 'OFF');
}

function forceCamera(on) {
  if (!window.__DBG) return;
  window.__DBG.FORCE_CAMERA = !!on;
  console.info('[DEBUG] Force camera:', window.__DBG.FORCE_CAMERA ? 'ON' : 'OFF');
}

// Export debug helpers to window
window.enableDebug = enableDebug;
window.disableDebug = disableDebug;
window.forceMove = forceMove;
window.forceCamera = forceCamera;

// Keyboard input: bind to window
export const keys = Object.create(null);

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

// Prevent default browser behavior (e.g., page scrolling) on key events
function isRefreshCombo(e) {
  return e.key.startsWith('F') ||
    (e.key.toLowerCase() === 'r' && (e.ctrlKey || e.metaKey));
}

window.addEventListener('keydown', e => {
  const key = normalizeKey(e.key);
  keys[key] = true;
  if (!isRefreshCombo(e)) e.preventDefault();
});
window.addEventListener('keyup', e => {
  const key = normalizeKey(e.key);
  keys[key] = false;
  if (!isRefreshCombo(e)) e.preventDefault();
});
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

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
    overlay.textContent = 'Keys: ' + Object.entries(keys).filter(([k,v])=>v).map(([k])=>k).join(', ');
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
const gameCanvas = document.getElementById('game');
const focusOverlay = document.getElementById('focusOverlay');
function showFocusOverlay() {
  focusOverlay.style.display = 'block';
  focusOverlay.textContent = 'Click to refocus · Use WASD/Arrows to move';
}
function hideFocusOverlay() {
  focusOverlay.style.display = 'none';
}
function checkFocus() {
  if (!document.hasFocus() || document.activeElement !== gameCanvas) {
    showFocusOverlay();
  } else {
    hideFocusOverlay();
  }
}
gameCanvas.addEventListener('mousedown', () => { gameCanvas.focus(); });
gameCanvas.addEventListener('touchstart', () => { gameCanvas.focus(); });
window.addEventListener('focus', checkFocus);
window.addEventListener('blur', checkFocus);
document.addEventListener('DOMContentLoaded', () => {
  gameCanvas.focus();
  checkFocus();
});
setTimeout(checkFocus, 500);

document.getElementById('btnTalk').onclick = async () => {
  const npc = { name:'Britain Guard', profession:'Guard', town:'Britain', personality:'formal, dutiful' };
  const worldState = { trinsicSiege:false, time: Date.now() };
  const questState = party.activeQuests;
  const playerState = { name: party.members[0].name, karma: party.karma, items: inventory.summary() };
  pushBubble('Britain Guard', 'Halt! State thy business in Britain.');
  const playerInput = getSelectedText(window.getSelection()) || 'We seek news and work.';
  const { text } = await talkToNPC(npc, worldState, playerState, questState, playerInput);
  pushBubble('Britain Guard', text);
  pushActions([
    {label:'Accept Quest', fn:()=>{ pushBubble('System','Quest Accepted: Clear bandits by the northern bridge.'); party.acceptQuest({id:'bandits_bridge', name:'Clear the Bandits'}); updatePartyUI(party);}}
  ]);
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

// Export core references for debugging (development only)
if (window.__DBG) {
  window.__DBG_REFS = {
    party,
    combat,
    keys,
    inventory,
    spells
  };
  console.info('[DEBUG] Core references exported to window.__DBG_REFS');
}

// Center camera on leader at boot and ensure leader is within view
function centerCameraOnLeader(){
  if(!party.leader) return;
  camX = party.leader.x - innerWidth/2;
  camY = party.leader.y - innerHeight/2;
  console.info('Boot: party size=', party.size, 'leader=', party.leader.name, 'coords=', Math.round(party.leader.x), Math.round(party.leader.y));
}
onResize();
centerCameraOnLeader();

// Ensure party members have sensible world coordinates (place near screen center)
// Keep party positions as initialized by Party constructor; no forced repositioning here.

// Hero Marker drawing helper
function drawHeroMarker(ctx, view, leader){
  if(!heroMarkerVisible || !leader) return;
  const {camX, camY} = view;
  const sx = leader.x - camX, sy = leader.y - camY;
  ctx.save();
  ctx.strokeStyle = '#8fd3ff'; ctx.lineWidth = 3; ctx.globalAlpha = 0.95;
  ctx.beginPath(); ctx.ellipse(sx, sy+6, 22, 8, 0, 0, Math.PI*2); ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(sx-28, sy-36, 56, 18);
  ctx.fillStyle = '#bfeaff'; ctx.font = '12px sans-serif'; ctx.textAlign='center'; ctx.fillText(leader.name || 'Avatar', sx, sy-24);
  ctx.restore();
}

// Dev toggle: press H to hide/show hero marker
addEventListener('keydown', (e)=>{ if(e.key==='h' || e.key==='H'){ heroMarkerVisible = !heroMarkerVisible; console.info('Hero marker visible=', heroMarkerVisible); } });

// Debug toggle: press backtick (`) to toggle debug mode
addEventListener('keydown', (e) => {
  if (e.key === '`' || e.key === '~') {
    if (!window.__DBG) return;
    window.__DBG.ENABLED = !window.__DBG.ENABLED;
    console.info('[DEBUG] Debug toggled:', window.__DBG.ENABLED ? 'ON' : 'OFF');
  }
});

// First-move hint
function showFirstMoveHint(){
  const hint = document.createElement('div');
  hint.id = 'firstMoveHint'; hint.style.position='fixed'; hint.style.left='12px'; hint.style.bottom='12px'; hint.style.padding='8px 12px';
  hint.style.background='rgba(0,0,0,0.6)'; hint.style.color='#fff'; hint.style.borderRadius='6px'; hint.style.zIndex=9999;
  hint.textContent = 'Use WASD/Arrows to move'; document.body.appendChild(hint);
  setTimeout(()=>{ hint.style.transition='opacity 700ms'; hint.style.opacity='0'; setTimeout(()=>hint.remove(),800); },4000);
}
showFirstMoveHint();

function updateTerrainPill() {
  const terr = TERRAIN.at(Math.floor(party.leader.x/TILE), Math.floor(party.leader.y/TILE));
  const pill = document.getElementById('terrainPill');
  pill.textContent = 'Terrain: ' + terr.name;
}

let last = performance.now();
function loop(){
  requestAnimationFrame(loop);
  try {
    const now = performance.now(), dt = (now-last)/1000; last = now;
    
    // Debug: Increment frame counter
    if (window.__DBG) {
      window.__DBG.frameCounter++;
    }
    
    // Clear canvases that accumulate drawing each frame.
    // Without clearing, the fx layer's bloom/lights compound and the screen
    // quickly washes out or turns black when bloom is toggled.
    ctx.clearRect(0,0,innerWidth,innerHeight);
    fx.clearRect(0,0,innerWidth,innerHeight);
    back.clearRect(0,0,innerWidth,innerHeight); sky.clearRect(0,0,innerWidth,innerHeight);
    drawSky(sky, back, dt, innerWidth, innerHeight);

  // Debug: Apply forced movement and camera BEFORE normal input processing
  let debugMvx = 0, debugMvy = 0, debugCamDx = 0;
  if (window.__DBG) {
    if (window.__DBG.FORCE_MOVE) {
      debugMvx = 1; // Move right steadily
      console.info('[DEBUG] Forcing movement right');
    }
    if (window.__DBG.FORCE_CAMERA) {
      debugCamDx = window.__DBG.TEST_SPEED * dt; // Scroll camera horizontally
      console.info('[DEBUG] Forcing camera scroll, dx:', debugCamDx);
    }
  }

  let mvx=0,mvy=0;
  if(keys['ArrowLeft']||keys['a']) mvx-=1;
  if(keys['ArrowRight']||keys['d']) mvx+=1;
  if(keys['ArrowUp']||keys['w']) mvy-=1;
  if(keys['ArrowDown']||keys['s']) mvy+=1;
  
  // Apply debug movement (forced movement combines with normal input)
  mvx += debugMvx;
  mvy += debugMvy;
  // Only move if not in enemy turn
  if((mvx||mvy) && (!combat.active || combat.turn !== 'enemy')){
    const len=Math.hypot(mvx,mvy)||1; mvx/=len; mvy/=len;
    const terr = TERRAIN.at(Math.floor(party.leader.x/TILE), Math.floor(party.leader.y/TILE));
    let s = party.leader.speed();
    if(terr.key==='SWAMP'){ s*=0.7; if(Math.random()<0.02){ party.leader.applyPoison(1); } }
    if(terr.key==='FOREST'){ s*=0.86; }
    if(terr.key==='ROAD'){ s*=1.22; }
    if(terr.key==='WATER'){ s*=0.5; }
    if(terr.key==='SAND'){ s*=0.92; }
    party.move(mvx*s*dt, mvy*s*dt);
    camX = party.leader.x - innerWidth/2;
    camY = party.leader.y - innerHeight/2;
    updateTerrainPill();
  }
  
  // Debug: Apply forced camera movement
  if (window.__DBG && window.__DBG.FORCE_CAMERA) {
    camX += debugCamDx;
  }
  if(combat.active){
    combat.update(dt);
  }
  const gameW = innerWidth, gameH = innerHeight;
  const view = {camX, camY, W:gameW, H:gameH};
  // Debug: draw a small red crosshair at screen center to ensure game canvas is visible
    // normal rendering
  const terrVisPenalty = TERRAIN.at(Math.floor(party.leader.x/TILE), Math.floor(party.leader.y/TILE)).key==='FOREST' ? .08 : 0;
  drawWorld(ctx, view, dt, terrVisPenalty);
  // Draw world then party (ensure leader visible)
  try{
    if(!_loggedBoot){
      console.info('Render loop starting. party.size=', party.size, 'leader=', party.leader && {x:Math.round(party.leader.x), y:Math.round(party.leader.y)} );
      _loggedBoot = true;
    }
  party.draw(ctx, view);
  // Draw Hero Marker and nameplate after party
  drawHeroMarker(ctx, view, party.leader);
  }catch(err){
    console.error('party.draw failed', err && err.stack ? err.stack : err);
  }
  combat.draw(ctx, fx, view);
  
  // Debug: Periodic snapshot logging
  if (window.__DBG && (window.__DBG.ENABLED || window.__DBG.FORCE_MOVE || window.__DBG.FORCE_CAMERA)) {
    if (window.__DBG.frameCounter % window.__DBG.PRINT_FREQ === 0) {
      const pressedKeys = Object.keys(keys).filter(k => keys[k]);
      const snapshot = {
        frame: window.__DBG.frameCounter,
        leader: { x: Math.round(party.leader.x), y: Math.round(party.leader.y) },
        camera: { camX: Math.round(camX), camY: Math.round(camY) },
        combat: { active: combat.active, turn: combat.turn },
        pressedKeys,
        dt: dt.toFixed(3)
      };
      window.__DBG.lastSnapshot = snapshot;
      console.info('[DEBUG] Snapshot:', snapshot);
    }
  }
  
  // Legacy debug logging (keeping for compatibility)
  if (DEBUG && now - _lastDebugLog > 1000) {
    console.info('Key listeners attached:', window);
    console.info('Party size:', party.size, 'Leader coords:', party.leader.x, party.leader.y);
    _lastDebugLog = now;
  }

  if (showKeyOverlay) updateKeyOverlay();

  // Debug: Draw crosshair at screen center when debug enabled
  if (window.__DBG && window.__DBG.ENABLED) {
    ctx.save();
    ctx.strokeStyle = '#ff4040';
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const centerX = innerWidth / 2;
    const centerY = innerHeight / 2;
    // Draw small crosshair
    ctx.moveTo(centerX - 10, centerY);
    ctx.lineTo(centerX + 10, centerY);
    ctx.moveTo(centerX, centerY - 10);
    ctx.lineTo(centerX, centerY + 10);
    ctx.stroke();
    ctx.restore();
  }

  combat.drawLighting(fx, view, party.leader);
    if(document.getElementById('bloom').checked) combat.compositeBloom(gameC, fxC, innerWidth, innerHeight);
  } catch (err) {
    console.error('loop iteration failed', err);
  }
}
requestAnimationFrame(loop);
