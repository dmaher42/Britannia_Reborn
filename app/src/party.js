import { TILE } from './world.js';

export const CharacterClass = {
  Avatar:'Avatar', Bard:'Bard', Ranger:'Ranger',
  Fighter:'Fighter', Mage:'Mage', Druid:'Druid', Tinker:'Tinker', Paladin:'Paladin'
};

export class Character {
  constructor({name, cls, STR, DEX, INT, hpMax=20}){
    this.name=name; this.cls=cls;
    this.STR=STR; this.DEX=DEX; this.INT=INT;
    this.hpMax=hpMax; this.hp=hpMax;
    this.mpMax=this.computeMPMax(); this.mp=this.mpMax;
    this.baseSpeed=240;
    this.poisoned=false; this.poisonTurns=0;
    this.x=0; this.y=0; this.step=0; this.lastAng=0;
    this.equippedWeight=0;
  }
  computeMPMax(){
    if(this.cls===CharacterClass.Avatar) return this.INT*2;
    if(this.cls===CharacterClass.Bard || this.cls===CharacterClass.Ranger) return Math.floor(this.INT/2);
    return 0;
  }
  canEquip(totalWeight){ return totalWeight <= this.STR; }
  packLimit(){ return this.STR*2; }
  applyPoison(turns){ this.poisoned=true; this.poisonTurns=Math.min(5, (this.poisonTurns||0)+turns); }
  tick(dt){ if(this.poisoned && Math.random()<0.015){ this.hp = Math.max(0, this.hp-1); } }
  draw(ctx, view, palette={base:'#f0e0c8',hair:'#d9b36c',armor:'#2c3f57',trim:'#9ec3ff',cloak:'#17324f',blade:'#cfd8e6',boot:'#203041'}, hood=false){
    const {camX, camY}=view;
    const sx = this.x - camX, sy = this.y - camY;
    const bob = Math.sin(this.step*0.22)*1.6;
    ctx.save();
    ctx.globalAlpha=.4; ctx.fillStyle='#000';
    ctx.beginPath(); ctx.ellipse(sx, sy+12, 16, 8, 0, 0, Math.PI*2); ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(sx, sy+bob);
    ctx.save(); ctx.fillStyle=palette.cloak; ctx.globalAlpha=.95;
    ctx.beginPath(); ctx.moveTo(-9,-10);
    ctx.bezierCurveTo(-16,6+Math.sin(this.step*0.5)*2,-4,14,0,18);
    ctx.bezierCurveTo(8,12-Math.sin(this.step*0.5)*2,16,4,9,-10);
    ctx.closePath(); ctx.fill(); ctx.restore();
    const w1=Math.sin(this.step*0.5), w2=Math.sin(this.step*0.5+Math.PI);
    const rr=(x,y,w,h,r)=>{ const k=Math.min(r,Math.min(w,h)/2); ctx.beginPath(); ctx.moveTo(x+k,y); ctx.arcTo(x+w,y,x+w,y+h,k); ctx.arcTo(x+w,y+h,x,y+h,k); ctx.arcTo(x,y+h,x,y,k); ctx.arcTo(x,y,x+w,y,k); ctx.closePath(); };
    ctx.save(); ctx.translate(0,8); ctx.fillStyle=palette.boot;
    ctx.save(); ctx.rotate(w1*0.25); rr(-6,-2,5,14,2); ctx.fill(); ctx.restore();
    ctx.save(); ctx.rotate(w2*0.25); rr(1,-2,5,14,2); ctx.fill(); ctx.restore();
    ctx.restore();
    ctx.save(); ctx.fillStyle=palette.armor; ctx.strokeStyle=palette.trim; ctx.lineWidth=1.6;
    rr(-8,-14,16,20,5); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,-14); ctx.lineTo(0,6); ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.save(); ctx.translate(-8,-10); ctx.rotate(w1*0.35); rr(-2,0,4,12,2); ctx.fillStyle=palette.armor; ctx.fill(); ctx.restore();
    ctx.save(); ctx.translate(8,-10); ctx.rotate(w2*0.45); rr(-2,0,4,12,2); ctx.fillStyle=palette.armor; ctx.fill();
    ctx.save(); ctx.translate(1,10); ctx.rotate(this.lastAng); ctx.fillStyle=palette.blade; rr(0,-2,20,4,2); ctx.fill();
    ctx.restore(); ctx.restore();
    ctx.save(); ctx.translate(0,-18);
    ctx.fillStyle=palette.base; rr(-2,2,4,4,2); ctx.fill();
    ctx.beginPath(); ctx.arc(0,0,7,0,Math.PI*2); ctx.fillStyle=palette.base; ctx.fill();
    if(hood){ ctx.fillStyle='#1b1313'; ctx.globalAlpha=.95; ctx.beginPath(); ctx.arc(0,0,8,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1; }
    else { ctx.fillStyle=palette.hair; ctx.beginPath(); ctx.arc(-1,-2,7, Math.PI*0.1, Math.PI*0.95); ctx.fill(); }
    ctx.globalAlpha=.08; ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(-2,-2,5,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
    ctx.restore();
    ctx.restore();
  }
}

export class Party {
  constructor(membersData=[]){
    this.members = membersData.map(d=>new Character(d));
    this.leader = this.members[0];
    this.karma = 0;
    this.activeQuests = [];
    this.members.forEach((m,i)=>{ m.x = i*10; m.y = i*6; });
  }
  get size(){ return this.members.length; }
  move(dx,dy){
    for(const m of this.members){
      m.x += dx; m.y += dy; m.step += Math.hypot(dx,dy)*0.5/TILE;
      if(dx||dy) m.lastAng = Math.atan2(dy, dx);
      m.tick(1/60);
    }
  }
  acceptQuest(q){ if(!this.activeQuests.find(x=>x.id===q.id)) this.activeQuests.push(q); }
  draw(ctx, view){
    this.members.slice(1).forEach(m=> m.draw(ctx, view, undefined, false));
    this.leader.draw(ctx, view, undefined, false);
  }
}
