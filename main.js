import { drawSky, drawWorld, TERRAIN, TILE } from './world.js';
import { Party, CharacterClass, Character } from './party.js';
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
  const cx = innerWidth/2, cy = innerHeight/2;
  if(npcs[0]){ npcs[0].x = cx + 80; npcs[0].y = cy - 40; }
  if(npcs[1]){ npcs[1].x = cx - 80; npcs[1].y = cy + 40; }
}
placeNPCs();

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
    const now = performance.now(), dt = (now-last)/1000; last = now;
    // Clear canvases that accumulate drawing each frame.
    // Without clearing, the fx layer's lights compound and the screen
    // quickly washes out.
    ctx.clearRect(0,0,innerWidth,innerHeight);
    fx.clearRect(0,0,innerWidth,innerHeight);
    back.clearRect(0,0,innerWidth,innerHeight); sky.clearRect(0,0,innerWidth,innerHeight);
    drawSky(sky, back, dt, innerWidth, innerHeight);

  let mvx=0,mvy=0;
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
  npcs.forEach(n=>n.draw(ctx, view));
  party.draw(ctx, view);
  // Draw Hero Marker and nameplate after party
  drawHeroMarker(ctx, view, party.leader);
  }catch(err){
    console.error('party.draw failed', err && err.stack ? err.stack : err);
  }
  combat.draw(ctx, fx, view);
  if (DEBUG && now - _lastDebugLog > 1000) {
    console.info('Key listeners attached:', window);
    console.info('Party size:', party.size, 'Leader coords:', party.leader.x, party.leader.y);
    _lastDebugLog = now;
  }

  if (showKeyOverlay) updateKeyOverlay();

  // no debug overlay in production

    combat.drawLighting(fx, view, party.leader);
    } catch (err) {
    console.error('loop iteration failed', err);
  }
}
requestAnimationFrame(loop);
