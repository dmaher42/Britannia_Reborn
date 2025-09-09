import { drawSky, drawWorld, TERRAIN, TILE } from './world.js';
import { Party, CharacterClass } from './party.js';
import { Inventory } from './inventory.js';
import { Spellbook, castFireDart } from './spells.js';
import { CombatSystem } from './combat.js';
import { talkToNPC } from './ai.js';
import { pushBubble, pushActions, showToast, updatePartyUI, updateInventoryUI, gridLayer } from './ui.js';

const dpr = Math.min(window.devicePixelRatio||1, 2);
const skyC = document.getElementById('sky'), sky = skyC.getContext('2d');
const backC = document.getElementById('back'), back = backC.getContext('2d');
const gameC = document.getElementById('game'), ctx = gameC.getContext('2d',{alpha:false});
const fxC = document.getElementById('fx'), fx = fxC.getContext('2d');
function sizeCanvas(c){ c.width = innerWidth * dpr; c.height = innerHeight * dpr; c.style.width = innerWidth+'px'; c.style.height = innerHeight+'px'; c.getContext('2d').setTransform(dpr,0,0,dpr,0,0); }
function onResize(){ [skyC,backC,gameC,fxC].forEach(sizeCanvas); }
addEventListener('resize', onResize); onResize();

let camX = -innerWidth/2, camY = -innerHeight/2;

const party = new Party([
  { name:'Avatar', cls:CharacterClass.Avatar, STR:12, DEX:10, INT:9, hpMax:30, mpClass:true },
  { name:'Iolo', cls:CharacterClass.Bard, STR:9, DEX:12, INT:8,  hpMax:22 },
  { name:'Shamino', cls:CharacterClass.Ranger, STR:11, DEX:12, INT:10, hpMax:24 }
]);

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
  const terrVisPenalty = TERRAIN.at(Math.floor(party.leader.x/TILE), Math.floor(party.leader.y/TILE)).key==='FOREST' ? .08 : 0;
  drawWorld(ctx, view, dt, terrVisPenalty);
  party.draw(ctx, view);
  combat.draw(ctx, fx, view);

  combat.drawLighting(fx, view, party.leader);
  if(document.getElementById('bloom').checked) combat.compositeBloom(gameC, fxC, innerWidth, innerHeight);

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
