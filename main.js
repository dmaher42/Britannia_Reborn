import { drawSky, drawWorld, TERRAIN, TILE } from './world.js';
import { Party, CharacterClass } from './party.js';
import { Inventory } from './inventory.js';
import { Spellbook, castFireDart } from './spells.js';
import { CombatSystem } from './combat.js';
import { pushBubble, pushActions, showToast, updatePartyUI, updateInventoryUI, gridLayer } from './ui.js';
import { talkToNPC } from './ai.js';

const dpr = Math.min(window.devicePixelRatio||1, 2);
const skyC = document.getElementById('sky'), sky = skyC.getContext('2d');
const backC = document.getElementById('back'), back = backC.getContext('2d');
const gameC = document.getElementById('game'), ctx = gameC.getContext('2d',{alpha:false});
const fxC = document.getElementById('fx'), fx = fxC.getContext('2d');
console.info('main.js loaded', {dpr, w: innerWidth, h: innerHeight});
// The editor preview sometimes injects a wrapper script (frame.bundle.js)
// which can throw an unhandled promise rejection referencing `selectedText`.
// That's external to this app; swallow that specific error to avoid noisy
// console output while keeping other errors visible.
window.addEventListener('unhandledrejection', (ev)=>{
  try{
    const r = ev && ev.reason;
    if(r && typeof r.message === 'string' && r.message.includes('selectedText')){
      ev.preventDefault();
      console.warn('Suppressed preview wrapper unhandled rejection:', r && r.message);
      return;
    }
  }catch(_){/* ignore */}
  // leave other rejections alone so they surface normally
});

// Also catch global runtime errors coming from the editor preview wrapper
// (frame.bundle.js). Those are external to the app; suppress the known
// 'selectedText' noise and keep other errors visible.
window.addEventListener('error', (e)=>{
  try{
    const src = e && (e.filename || (e.error && e.error.fileName));
    const msg = e && (e.message || (e.error && e.error.message));
    if(src && src.includes('frame.bundle.js')){
      // suppress this external wrapper's errors
      console.warn('Suppressed preview wrapper error from', src, ':', msg);
      e.preventDefault && e.preventDefault();
      return true;
    }
    // Heuristic: some errors reference selectedText in the message
    if(msg && typeof msg === 'string' && msg.includes('selectedText')){
      console.warn('Suppressed selectedText error (likely preview wrapper):', msg);
      e.preventDefault && e.preventDefault();
      return true;
    }
  }catch(_){/* ignore */}
  // otherwise let the error bubble through
  return false;
});
function sizeCanvas(c){ c.width = innerWidth * dpr; c.height = innerHeight * dpr; c.style.width = innerWidth+'px'; c.style.height = innerHeight+'px'; c.getContext('2d').setTransform(dpr,0,0,dpr,0,0); }
function onResize(){ [skyC,backC,gameC,fxC].forEach(sizeCanvas); }
addEventListener('resize', onResize); onResize();

let camX = -innerWidth/2, camY = -innerHeight/2;
let heroMarkerVisible = true;
let firstMoveMade = false;
let _loggedBoot = false;

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

// center camera now that party exists and canvases have been sized
centerCameraOnLeader();

// debug panel removed

const inventory = new Inventory();
inventory.gold = 125;
inventory.add({ id:'sulfur_ash', name:'Sulfur Ash', weight:0.1, qty:3, tag:'reagent' });
inventory.add({ id:'black_pearl', name:'Black Pearl', weight:0.1, qty:3, tag:'reagent' });
inventory.add({ id:'healing_potion', name:'Potion of Healing', weight:0.2, qty:1, tag:'consumable' });

const spells = new Spellbook(inventory, party);

const combat = new CombatSystem(party, inventory, spells, gameC, ctx, fx, gridLayer);

const keys={};
// prevent default scrolling for arrow keys and capture input reliably
addEventListener('keydown', e=>{
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
  keys[e.key]=true;
});
addEventListener('keyup', e=>{ keys[e.key]=false; });

// ensure the root container receives keyboard focus so it captures WASD/Arrows
window.addEventListener('load', ()=>{ const r=document.getElementById('root'); r && r.focus(); });

document.getElementById('btnTalk').onclick = async () => {
  const npc = { name:'Britain Guard', profession:'Guard', town:'Britain', personality:'formal, dutiful' };
  const worldState = { trinsicSiege:false, time: Date.now() };
  const questState = party.activeQuests;
  const playerState = { name: party.members[0].name, karma: party.karma, items: inventory.summary() };
  pushBubble('Britain Guard', 'Halt! State thy business in Britain.');
  const { text } = await talkToNPC(npc, worldState, playerState, questState, 'We seek news and work.');
  pushBubble('Britain Guard', text);
  pushActions([
    {label:'Accept Quest', fn:()=>{ pushBubble('System','Quest Accepted: Clear bandits by the northern bridge.'); party.acceptQuest({id:'bandits_bridge', name:'Clear the Bandits'}); updatePartyUI(party);}}
  ]);
};
document.getElementById('btnCombat').onclick = ()=>combat.startSkirmish();
document.getElementById('btnCast').onclick = ()=>{
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
centerCameraOnLeader();

// Ensure party members have sensible world coordinates (place near screen center)
// Keep party positions as initialized by Party constructor; no forced repositioning here.

// Update the terrain pill once at startup so the UI shows the current terrain
try{ updateTerrainPill(); }catch(e){ /* UI may not be ready yet; ignore */ }

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
  const now = performance.now(), dt = (now-last)/1000; last = now;
  back.clearRect(0,0,innerWidth,innerHeight); sky.clearRect(0,0,innerWidth,innerHeight);
  drawSky(sky, back, dt, innerWidth, innerHeight);

  if(!combat.active){
    let mvx=0,mvy=0;
    if(keys['ArrowLeft']||keys['a']) mvx-=1;
    if(keys['ArrowRight']||keys['d']) mvx+=1;
    if(keys['ArrowUp']||keys['w']) mvy-=1;
    if(keys['ArrowDown']||keys['s']) mvy+=1;
    if(mvx||mvy){
      const len=Math.hypot(mvx,mvy); mvx/=len; mvy/=len;
      const terr = TERRAIN.at(Math.floor(party.leader.x/TILE), Math.floor(party.leader.y/TILE));
      let s = party.leader.baseSpeed;
      if(terr.key==='SWAMP'){ s*=0.7; if(Math.random()<0.02){ party.leader.applyPoison(1); } }
      if(terr.key==='FOREST'){ s*=0.86; }
      if(terr.key==='ROAD'){ s*=1.22; }
      if(terr.key==='WATER'){ s*=0.5; }
      if(terr.key==='SAND'){ s*=0.92; }
      party.move(mvx*s*dt, mvy*s*dt);
      updateTerrainPill();
    }
  } else {
    combat.update(dt);
  }

  camX = party.leader.x - innerWidth/2; camY = party.leader.y - innerHeight/2;

  const gameW = innerWidth, gameH = innerHeight;
  const view = {camX, camY, W:gameW, H:gameH};
  // Debug: draw a small red crosshair at screen center to ensure game canvas is visible
    // normal rendering
  const terrVisPenalty = TERRAIN.at(Math.floor(party.leader.x/TILE), Math.floor(party.leader.y/TILE)).key==='FOREST' ? .08 : 0;
  // ensure the game canvas has a neutral dark base so characters and world
  // elements don't vanish when tiles are very dark
  ctx.save();
  const g = ctx.createLinearGradient(0,0,0,gameH);
  g.addColorStop(0, '#0c1624'); g.addColorStop(1, '#07121a');
  ctx.fillStyle = g; ctx.fillRect(0,0,gameW,gameH); ctx.restore();
  drawWorld(ctx, view, dt, terrVisPenalty);
  // leader highlight removed (debugging only)
  // Draw world then party (ensure leader visible)
  try{
    if(!_loggedBoot){
      console.info('Render loop starting. party.size=', party.size, 'leader=', party.leader && {x:Math.round(party.leader.x), y:Math.round(party.leader.y)} );
      _loggedBoot = true;
    }
  party.draw(ctx, view);
  }catch(err){
    console.error('party.draw failed', err && err.stack ? err.stack : err);
  }
  // Hero marker must be drawn after party so it sits on top
  try{ drawHeroMarker(ctx, view, party.leader); } catch(e){ console.warn('Hero marker draw failed', e); }
  combat.draw(ctx, fx, view);

  // no debug overlay in production

  combat.drawLighting(fx, view, party.leader);
  if(document.getElementById('bloom').checked) combat.compositeBloom(gameC, fxC, innerWidth, innerHeight);

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
