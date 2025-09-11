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

// Comprehensive Debug System
const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
const params = new URLSearchParams(location.search);
const forceDebug = params.get('debug') === '1';

window.__DBG = {
  ENABLED: isLocalhost || forceDebug,
  FORCE_MOVE: false,
  FORCE_CAMERA: false,
  TEST_SPEED: 120,
  PRINT_FREQ: 30,
  _frame: 0,
  last: 0,
  fps: 0,
  frameTimes: [],
  fpsSamples: [],
  inputLog: [],
  MAX_INPUT_LOG: 50,
  AUTO_DISABLED: !isLocalhost && !forceDebug,
  overlayVisible: false,
  crosshairVisible: false
};

const DEBUG = false;  // Legacy debug flag, kept for compatibility
let _lastDebugLog = 0;

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
  
  // Debug: Log input events
  if (window.__DBG && window.__DBG.ENABLED) {
    window.__DBG.inputLog.unshift({
      t: performance.now(),
      type: 'down',
      key: e.key
    });
    if (window.__DBG.inputLog.length > window.__DBG.MAX_INPUT_LOG) {
      window.__DBG.inputLog.pop();
    }
  }
  
  if (!isRefreshCombo(e)) e.preventDefault();
});
window.addEventListener('keyup', e => {
  const key = normalizeKey(e.key);
  keys[key] = false;
  
  // Debug: Log input events  
  if (window.__DBG && window.__DBG.ENABLED) {
    window.__DBG.inputLog.unshift({
      t: performance.now(),
      type: 'up', 
      key: e.key
    });
    if (window.__DBG.inputLog.length > window.__DBG.MAX_INPUT_LOG) {
      window.__DBG.inputLog.pop();
    }
  }
  
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
  
  // Debug: Backtick toggle for debug overlay
  if (e.key === '`') {
    if (window.__DBG) {
      window.__DBG.overlayVisible = !window.__DBG.overlayVisible;
      window.__DBG.crosshairVisible = window.__DBG.overlayVisible;
      updateDebugOverlay();
      console.info('Debug overlay:', window.__DBG.overlayVisible ? 'enabled' : 'disabled');
    }
  }
});
setInterval(() => { if (showKeyOverlay) updateKeyOverlay(); }, 100);

// Debug Helper Functions
window.enableDebug = function() {
  if (!window.__DBG) return;
  window.__DBG.ENABLED = true;
  window.__DBG.overlayVisible = true;
  window.__DBG.crosshairVisible = true;
  updateDebugOverlay();
  console.info('Debug enabled');
};

window.disableDebug = function() {
  if (!window.__DBG) return;
  window.__DBG.ENABLED = false;
  window.__DBG.overlayVisible = false; 
  window.__DBG.crosshairVisible = false;
  window.__DBG.FORCE_MOVE = false;
  window.__DBG.FORCE_CAMERA = false;
  updateDebugOverlay();
  console.info('Debug disabled');
};

window.forceMove = function(enabled) {
  if (!window.__DBG) return;
  window.__DBG.FORCE_MOVE = !!enabled;
  console.info('Force move:', enabled ? 'enabled' : 'disabled');
};

window.forceCamera = function(enabled) {
  if (!window.__DBG) return;
  window.__DBG.FORCE_CAMERA = !!enabled;
  console.info('Force camera:', enabled ? 'enabled' : 'disabled');
};

// Debug Overlay System
function updateDebugOverlay() {
  if (!window.__DBG) return;
  
  let overlay = document.getElementById('debugOverlay');
  
  if (!window.__DBG.overlayVisible) {
    if (overlay) overlay.style.display = 'none';
    return;
  }
  
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'debugOverlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '8px';
    overlay.style.left = '8px';
    overlay.style.background = 'rgba(0,0,0,0.8)';
    overlay.style.color = '#0f0';
    overlay.style.font = '11px monospace';
    overlay.style.padding = '8px';
    overlay.style.borderRadius = '4px';
    overlay.style.zIndex = 9998;
    overlay.style.maxWidth = '300px';
    overlay.style.lineHeight = '1.2';
    document.body.appendChild(overlay);
  }
  
  overlay.style.display = 'block';
  
  // Calculate current terrain and speed info
  const leader = party?.leader;
  let terrainInfo = 'N/A';
  let speedInfo = 'N/A';
  let overweightInfo = '';
  
  if (leader) {
    const terr = TERRAIN.at(Math.floor(leader.x/TILE), Math.floor(leader.y/TILE));
    terrainInfo = `${terr.name} (${terr.key})`;
    
    let baseSpeed = leader.speed();
    let modifier = 1.0;
    
    if (terr.key === 'SWAMP') modifier = 0.7;
    else if (terr.key === 'FOREST') modifier = 0.86;
    else if (terr.key === 'ROAD') modifier = 1.22;
    else if (terr.key === 'WATER') modifier = 0.5;
    else if (terr.key === 'SAND') modifier = 0.92;
    
    const finalSpeed = baseSpeed * modifier;
    speedInfo = `${baseSpeed.toFixed(1)} × ${modifier} = ${finalSpeed.toFixed(1)}`;
    
    // Check overweight status
    const equippedWeight = leader.equippedWeight || 0;
    const packWeight = leader.packWeight || 0;
    const strLimit = leader.STR * 2;
    
    if (equippedWeight > leader.STR) {
      overweightInfo += ' [EQUIP OVERWEIGHT]';
    }
    if (packWeight > strLimit) {
      overweightInfo += ' [PACK OVERWEIGHT]';
    }
  }
  
  // Input log (last 5 events)
  const recentInputs = window.__DBG.inputLog.slice(0, 5).map(input => {
    const time = (input.t / 1000).toFixed(1);
    return `${time}s: ${input.type} ${input.key}`;
  }).join('\n');
  
  overlay.innerHTML = `
<b>DEBUG OVERLAY</b> (toggle: \`)
<b>FPS:</b> ${window.__DBG.fps.toFixed(1)} (${(window.__DBG.last || 0).toFixed(1)}ms)
<b>Frame:</b> ${window.__DBG._frame}
<b>Terrain:</b> ${terrainInfo}
<b>Speed:</b> ${speedInfo}${overweightInfo}
<b>Camera:</b> ${camX.toFixed(0)}, ${camY.toFixed(0)}
${leader ? `<b>Leader:</b> ${leader.x.toFixed(0)}, ${leader.y.toFixed(0)}` : ''}
<b>Input Log:</b>
${recentInputs || 'No recent input'}
<small>Force: move=${window.__DBG.FORCE_MOVE} cam=${window.__DBG.FORCE_CAMERA}</small>
  `.trim();
}

function updateFpsTracking(frameTime) {
  if (!window.__DBG) return;
  
  window.__DBG._frame++;
  window.__DBG.last = frameTime;
  
  // Keep last 60 frame times for averaging
  window.__DBG.frameTimes.push(frameTime);
  if (window.__DBG.frameTimes.length > 60) {
    window.__DBG.frameTimes.shift();
  }
  
  // Calculate FPS every 10 frames
  if (window.__DBG._frame % 10 === 0) {
    const avgFrameTime = window.__DBG.frameTimes.reduce((a,b) => a+b, 0) / window.__DBG.frameTimes.length;
    window.__DBG.fps = avgFrameTime > 0 ? 1000 / avgFrameTime : 0;
  }
}

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
    const now = performance.now(), dt = (now-last)/1000; 
    const frameTime = now - last;
    last = now;
    
    // Debug: FPS tracking
    if (window.__DBG && window.__DBG.ENABLED) {
      updateFpsTracking(frameTime);
    }
    
    // Clear canvases that accumulate drawing each frame.
    // Without clearing, the fx layer's bloom/lights compound and the screen
    // quickly washes out or turns black when bloom is toggled.
    ctx.clearRect(0,0,innerWidth,innerHeight);
    fx.clearRect(0,0,innerWidth,innerHeight);
    back.clearRect(0,0,innerWidth,innerHeight); sky.clearRect(0,0,innerWidth,innerHeight);
    drawSky(sky, back, dt, innerWidth, innerHeight);

  // Debug: Forced movement and camera (before normal input processing)
  let mvx=0,mvy=0;
  
  if (window.__DBG && window.__DBG.FORCE_MOVE) {
    mvx = 1; // Force rightward movement
  }
  
  if (window.__DBG && window.__DBG.FORCE_CAMERA) {
    camX += window.__DBG.TEST_SPEED * dt;
  }
  
  // Normal input processing
  if(keys['ArrowLeft']||keys['a']) mvx-=1;
  if(keys['ArrowRight']||keys['d']) mvx+=1;
  if(keys['ArrowUp']||keys['w']) mvy-=1;
  if(keys['ArrowDown']||keys['s']) mvy+=1;
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
  if(combat.active){
    combat.update(dt);
  }
  const gameW = innerWidth, gameH = innerHeight;
  const view = {camX, camY, W:gameW, H:gameH};
  
  // Debug: draw crosshair at screen center
  if (window.__DBG && window.__DBG.crosshairVisible) {
    ctx.save();
    ctx.strokeStyle = '#ff4040';
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(innerWidth/2 - 10, innerHeight/2);
    ctx.lineTo(innerWidth/2 + 10, innerHeight/2);
    ctx.moveTo(innerWidth/2, innerHeight/2 - 10);
    ctx.lineTo(innerWidth/2, innerHeight/2 + 10);
    ctx.stroke();
    ctx.restore();
  }
  
  // Normal rendering
  const terrVisPenalty = TERRAIN.at(Math.floor(party.leader.x/TILE), Math.floor(party.leader.y/TILE)).key==='FOREST' ? .08 : 0;
  drawWorld(ctx, view, dt, terrVisPenalty);
  
  // Debug: Tile highlight overlay
  if (window.__DBG && window.__DBG.overlayVisible) {
    drawTileOverlay(ctx, view);
  }
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
  if (window.__DBG && window.__DBG.ENABLED && window.__DBG._frame % window.__DBG.PRINT_FREQ === 0) {
    console.info('Debug Snapshot:', {
      frame: window.__DBG._frame,
      leader: party.leader ? {x: Math.round(party.leader.x), y: Math.round(party.leader.y)} : null,
      camera: {camX: Math.round(camX), camY: Math.round(camY)},
      combat: {active: combat.active, turn: combat.turn},
      pressedKeys: Object.entries(keys).filter(([k,v])=>v).map(([k])=>k),
      dt: dt.toFixed(3)
    });
  }
  
  if (DEBUG && now - _lastDebugLog > 1000) {
    console.info('Key listeners attached:', window);
    console.info('Party size:', party.size, 'Leader coords:', party.leader.x, party.leader.y);
    _lastDebugLog = now;
  }

  if (showKeyOverlay) updateKeyOverlay();
  
  // Debug: Update overlay every few frames
  if (window.__DBG && window.__DBG.overlayVisible && window.__DBG._frame % 10 === 0) {
    updateDebugOverlay();
  }

  // no debug overlay in production

  combat.drawLighting(fx, view, party.leader);
    if(document.getElementById('bloom').checked) combat.compositeBloom(gameC, fxC, innerWidth, innerHeight);
  } catch (err) {
    console.error('loop iteration failed', err);
  }
}
requestAnimationFrame(loop);

// Debug: Tile overlay function
function drawTileOverlay(ctx, view) {
  if (!window.__DBG || !window.__DBG.overlayVisible) return;
  
  const {camX, camY, W, H} = view;
  const startTileX = Math.floor(camX / TILE);
  const startTileY = Math.floor(camY / TILE);
  const endTileX = Math.ceil((camX + W) / TILE);
  const endTileY = Math.ceil((camY + H) / TILE);
  
  ctx.save();
  ctx.strokeStyle = '#ffff00';
  ctx.globalAlpha = 0.3;
  ctx.lineWidth = 1;
  
  // Draw tile grid
  for (let tx = startTileX; tx <= endTileX; tx++) {
    for (let ty = startTileY; ty <= endTileY; ty++) {
      const sx = tx * TILE - camX;
      const sy = ty * TILE - camY;
      
      ctx.strokeRect(sx, sy, TILE, TILE);
    }
  }
  
  // Highlight leader's current tile
  if (party?.leader) {
    const leaderTileX = Math.floor(party.leader.x / TILE);
    const leaderTileY = Math.floor(party.leader.y / TILE);
    const sx = leaderTileX * TILE - camX;
    const sy = leaderTileY * TILE - camY;
    
    ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
    ctx.fillRect(sx, sy, TILE, TILE);
  }
  
  ctx.restore();
}

// Debug: Export core references for debugging (guarded)
if (window.__DBG && window.__DBG.ENABLED) {
  window.__DBG_REFS = {
    party,
    combat, 
    keys,
    inventory,
    spells
  };
}
