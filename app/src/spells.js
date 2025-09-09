export class Spellbook {
  constructor(inventory, party){ this.inventory = inventory; this.party = party; }
  get(spellId){ return spells.find(s=>s.id===spellId); }
  canCast(spellId, caster){
    const s = this.get(spellId);
    if(!s) return false;
    if((caster.mp||0) < s.mpCost) return false;
    for(const [rid, qty] of Object.entries(s.reagents)) if(this.inventory.count(rid) < qty) return false;
    return true;
  }
  payCosts(spellId, caster){
    const s = this.get(spellId);
    caster.mp -= s.mpCost;
    for(const [rid, qty] of Object.entries(s.reagents)) this.inventory.consume(rid, qty);
  }
}

export const spells = [
  { id:'fire_dart', name:'Fire Dart', mpCost:4, reagents:{ 'sulfur_ash':1, 'black_pearl':1 }, range:6, power: (caster)=> 8 + Math.floor(caster.INT/3) },
];

export function castFireDart(caster, combat, ctx, fx, inventory, spellbook){
  const s = spellbook.get('fire_dart');
  if(!spellbook.canCast('fire_dart', caster)) return;
  spellbook.payCosts('fire_dart', caster);
  const target = combat.active ? (combat.enemies[0]||null) : null;
  const proj = { x: caster.x, y: caster.y, life:0.42, speed:360, to: target? {x:target.x, y:target.y} : {x: caster.x+360, y: caster.y} };
  const start = performance.now();
  function step(now){
    const p = Math.min(1, (now-start)/ (proj.life*1000));
    const x = proj.x + (proj.to.x - proj.x)*p;
    const y = proj.y + (proj.to.y - proj.y)*p;
    fx.save(); fx.globalCompositeOperation='lighter';
    fx.fillStyle='#ffd080'; fx.beginPath(); fx.arc(x - combat.view.camX, y - combat.view.camY, 7, 0, Math.PI*2); fx.fill();
    fx.fillStyle='#ff9d40aa'; fx.fillRect(x - combat.view.camX - 18, y - combat.view.camY - 2, 14, 4);
    fx.restore();
    if(p<1) requestAnimationFrame(step);
    else {
      for(let i=0;i<30;i++){
        const a = Math.random()*Math.PI*2, r= Math.random()*1;
        const px = x + Math.cos(a)*r, py = y + Math.sin(a)*r;
        fx.save(); fx.globalAlpha = .9 - i/30; fx.fillStyle='rgba(255,120,90,.9)';
        fx.beginPath(); fx.arc(px - combat.view.camX, py - combat.view.camY, 2+Math.random()*2, 0, Math.PI*2); fx.fill(); fx.restore();
      }
      if(target){
        target.hp = Math.max(0, target.hp - s.power(caster));
        if(target.hp<=0) combat.removeEnemy(target);
      }
      combat.flash = 8;
    }
  }
  requestAnimationFrame(step);
}
