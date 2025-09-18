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
// Quick boot diagnostics: log sizes and paint small test rectangles so we can
// confirm the file loaded and each canvas is visible in the browser.
console.info('main.js loaded', {dpr, w: innerWidth, h: innerHeight});
try{
  sky.save(); sky.fillStyle='magenta'; sky.fillRect(8,8,80,40); sky.restore();
  ctx.save(); ctx.fillStyle='rgba(0,255,0,0.18)'; ctx.fillRect(12,60,80,40); ctx.restore();
  fx.save(); fx.fillStyle='rgba(255,255,0,0.12)'; fx.fillRect(20,120,40,40); fx.restore();
}catch(e){ console.warn('boot diag draw failed', e); }
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

// small on-screen debug panel (shows coords & canvas sizes) to help verify
// the game is running and where the camera/leader are. Visible in prod for
// now until we confirm visuals.
const _debugPanel = document.createElement('div');
_debugPanel.id = 'debugPanel';
_debugPanel.style.position = 'fixed';
_debugPanel.style.right = '12px';
_debugPanel.style.top = '72px';
_debugPanel.style.padding = '8px 10px';
_debugPanel.style.background = 'rgba(0,0,0,0.6)';
_debugPanel.style.color = '#9fe8ff';
_debugPanel.style.border = '1px solid rgba(80,140,180,0.12)';
_debugPanel.style.borderRadius = '8px';
_debugPanel.style.zIndex = 99999;
_debugPanel.style.fontSize = '12px';
_debugPanel.style.lineHeight = '1.4';
document.body.appendChild(_debugPanel);

const inventory = new Inventory();
inventory.gold = 125;
inventory.add({ id:'sulfur_ash', name:'Sulfur Ash', weight:0.1, qty:3, tag:'reagent' });
inventory.add({ id:'black_pearl', name:'Black Pearl', weight:0.1, qty:3, tag:'reagent' });
inventory.add({ id:'healing_potion', name:'Potion of Healing', weight:0.2, qty:1, tag:'consumable' });

const spells = new Spellbook(inventory, party);

const combat = new CombatSystem(party, inventory, spells, gameC, ctx, fx, gridLayer);

const keys={};
addEventListener('keydown', e=>keys[e.key]=true);
addEventListener('keyup', e=>keys[e.key]=false);

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
  drawWorld(ctx, view, dt, terrVisPenalty);
  // Temporary visual aid: draw a bright marker at leader screen position so we
  // can confirm characters render even on very dark terrain. Remove when not
  // needed.
  try{
    if(party && party.leader){
      const sx = Math.round(party.leader.x - camX);
      const sy = Math.round(party.leader.y - camY);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,0,255,0.85)'; ctx.beginPath(); ctx.arc(sx, sy, 10, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2; ctx.strokeRect(sx-18, sy-18, 36, 36);
      ctx.restore();
    }
  }catch(e){ console.warn('leader highlight failed', e); }
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

// Update debug panel regularly (in case user opens outside devtools)
setInterval(()=>{
  if(!_debugPanel) return;
  const leader = party && party.leader ? `${Math.round(party.leader.x)},${Math.round(party.leader.y)}` : 'none';
  _debugPanel.innerHTML = `cam: ${Math.round(camX)},${Math.round(camY)}<br>leader: ${leader}<br>canvas: ${innerWidth}×${innerHeight}`;
}, 250);
