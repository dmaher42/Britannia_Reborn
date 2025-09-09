import { TILE } from './world.js';

export class CombatSystem {
  constructor(party, inventory, spells, gameC, ctx, fx, grid){
    this.party=party; this.inventory=inventory; this.spells=spells;
    this.gameC=gameC; this.ctx=ctx; this.fx=fx; this.grid=grid;
    this.active=false; this.turn='player';
    this.enemies=[]; this.flash=0; this.view={camX:0, camY:0, W:innerWidth, H:innerHeight};
  }
  startSkirmish(){
    if(this.active) return;
    this.active=true; this.turn='player'; this.enemies = [];
    this.enemies.push({ name:'Bandit', x:this.party.leader.x+180, y:this.party.leader.y+40, hp:24, hpMax:24, step:0, hood:true });
    drawGrid(this.grid, true);
    document.getElementById('btnEndTurn').disabled = false;
  }
  removeEnemy(e){ this.enemies = this.enemies.filter(x=>x!==e); if(this.enemies.length===0){ this.endCombat(); } }
  endCombat(){
    this.active=false; drawGrid(this.grid,false);
    document.getElementById('btnEndTurn').disabled = true;
  }
  endPlayerTurn(){ if(!this.active) return; this.turn='enemy'; }

  update(dt){
    this.view = { camX: this.party.leader.x - innerWidth/2, camY: this.party.leader.y - innerHeight/2, W:innerWidth, H:innerHeight };
    if(this.turn==='enemy'){
      for(const e of this.enemies){
        const dx = this.party.leader.x - e.x, dy = this.party.leader.y - e.y;
        const dist = Math.hypot(dx,dy);
        if(dist>72){ const ang=Math.atan2(dy,dx); e.x += Math.cos(ang)*100*dt; e.y += Math.sin(ang)*100*dt; e.step += 100*dt*0.5; }
      }
      this.turn='player';
    }
    if(this.flash>0) this.flash *= 0.9;
  }
  draw(ctx, fx, view){
    this.view = view;
    for(const e of this.enemies){
      this.party.leader.draw(ctx, view);
      const pal = {base:'#e0d0b8', hair:'#333', armor:'#3a2c2c', trim:'#a66', cloak:'#2b1b1b', blade:'#cfd8e6', boot:'#2a1d1d'};
      const fake = { x:e.x, y:e.y, step:e.step, lastAng:Math.PI, draw: this.party.leader.draw };
      fake.draw(ctx, view, pal, true);
      const sx = e.x - view.camX, sy = e.y - view.camY;
      ctx.save(); ctx.strokeStyle='#ff5a6b'; ctx.lineWidth=3;
      const arc = (e.hp/e.hpMax)*Math.PI*2;
      ctx.beginPath(); ctx.arc(sx, sy-22, 12, -Math.PI/2, -Math.PI/2 + arc); ctx.stroke(); ctx.restore();
    }
  }
  drawLighting(fx, view, focus){
    fx.globalCompositeOperation='multiply';
    const grd = fx.createRadialGradient(focus.x - view.camX, focus.y - view.camY, 24, focus.x - view.camX, focus.y - view.camY, 360);
    grd.addColorStop(0, 'rgba(80,120,160,0.0)'); grd.addColorStop(1, 'rgba(0,0,0,0.45)');
    fx.fillStyle = grd; fx.fillRect(0,0,view.W,view.H);
    if(this.flash>1){
      fx.globalAlpha = Math.min(.5, this.flash/8); fx.fillStyle='#fff'; fx.fillRect(0,0,view.W,view.H); fx.globalAlpha=1;
    }
    fx.globalCompositeOperation='source-over';
  }
  compositeBloom(gameC, fxC, W, H){
    this.fx.save(); this.fx.globalCompositeOperation='lighter'; this.fx.filter='blur(6px)';
    this.fx.drawImage(gameC,0,0,W,H); this.fx.drawImage(fxC,0,0,W,H);
    this.fx.filter='none'; this.fx.restore();
  }
}

function drawGrid(svg, show){
  svg.innerHTML=''; if(!show) return;
  const s=TILE;
  for(let x=0;x<innerWidth;x+=s){ const v = document.createElementNS('http://www.w3.org/2000/svg','line'); v.setAttribute('x1',x); v.setAttribute('y1',0); v.setAttribute('x2',x); v.setAttribute('y2',innerHeight); v.setAttribute('stroke','#2a3b4f'); v.setAttribute('stroke-width','1'); svg.appendChild(v); }
  for(let y=0;y<innerHeight;y+=s){ const h = document.createElementNS('http://www.w3.org/2000/svg','line'); h.setAttribute('x1',0); h.setAttribute('y1',y); h.setAttribute('x2',innerWidth); h.setAttribute('y2',y); h.setAttribute('stroke','#2a3b4f'); h.setAttribute('stroke-width','1'); svg.appendChild(h); }
}
