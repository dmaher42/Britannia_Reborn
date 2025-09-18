let waterPhase = 0;

export const TERRAIN = {
  list:[
    {key:'WATER', name:'Water', color:'#0a2a4a'},
    {key:'SAND',  name:'Sand',  color:'#947842'},
    {key:'GRASS', name:'Grass', color:'#24434e'},
    {key:'FOREST',name:'Forest',color:'#133829'},
    {key:'SWAMP', name:'Swamp', color:'#27483b'},
    {key:'ROAD',  name:'Road',  color:'#2b3c4b'},
  ],
  at(tx,ty){ return this.list[genTerrain(tx,ty)]; }
};

function genTerrain(tx,ty){
  const n = Math.sin(tx*0.12)+Math.cos(ty*0.1)*0.6;
  if(ty > 10 + n*2) {
    if((tx+ty)%21===0) return 5;
    const v = (tx*13 + ty*7) % 101;
    if(v<8)  return 4;
    if(v<22) return 3;
    return 2;
  } else {
    if(ty > 8 + n*2) return 1;
    return 0;
  }
}

export function drawSky(sky, back, dt, W, H){
  drawParallaxSky(sky, dt, W, H);
  mountainRange(back, H*0.64, 0.35, '#0a1627', 0.6, W, H);
  mountainRange(back, H*0.70, 0.5,  '#081425', 0.85, W, H);
}
let tCloud=0, tDay=0;
function drawParallaxSky(sky, dt, W, H){
  tCloud += dt*0.02; tDay += dt*0.002;
  const day = (Math.sin(tDay)+1)/2;
  const g = sky.createLinearGradient(0,0,0,H);
  g.addColorStop(0, `hsl(${205+20*day}, 75%, ${20+12*day}%)`);
  g.addColorStop(1, `hsl(${215+10*day}, 70%, ${8+8*day}%)`);
  sky.fillStyle = g; sky.fillRect(0,0,W,H);
  const cx = W*0.15, cy = H*0.16;
  sky.globalCompositeOperation='lighter';
  sky.fillStyle = `hsla(${50+20*day}, 90%, ${70+10*day}%, .6)`;
  sky.beginPath(); sky.arc(cx, cy + Math.sin(tDay)*32, 48, 0, Math.PI*2); sky.fill();
  sky.globalCompositeOperation='source-over';
  sky.fillStyle = 'rgba(255,255,255,0.08)';
  for(let i=0;i<8;i++){
    const x = ((i*340 + tCloud*140) % (W+680)) - 340;
    const y = 120 + i*26 + Math.sin(tCloud+i)*9;
    cloud(sky, x,y, 220, 0.6);
  }
}
function cloud(sky,x,y,w,alpha){
  sky.globalAlpha = alpha;
  sky.beginPath();
  sky.ellipse(x, y, w*0.6, w*0.28, 0, 0, Math.PI*2);
  sky.ellipse(x+ w*0.4, y+5, w*0.5, w*0.22, 0, 0, Math.PI*2);
  sky.ellipse(x- w*0.4, y+8, w*0.45, w*0.2, 0, 0, Math.PI*2);
  sky.fill();
  sky.globalAlpha = 1;
}
function mountainRange(ctx2, baseY, scale, color, alpha, W, H){
  ctx2.globalAlpha = alpha;
  ctx2.fillStyle = color;
  ctx2.beginPath();
  ctx2.moveTo(0, H);
  for(let x=0;x<=W;x+=14){
    const y = baseY - (noise(x*0.005) * 120 * scale + Math.sin(x*0.002)*30*scale);
    ctx2.lineTo(x,y);
  }
  ctx2.lineTo(W,H);
  ctx2.closePath();
  ctx2.fill();
  ctx2.globalAlpha = 1;
}
function noise(v){ return Math.sin(v*12.9898)*43758.5453 % 1; }

export function drawWorld(ctx, view, dt, forestDim=0){
  waterPhase += dt*3;
  const {camX, camY, W, H} = view;
  const startX = Math.floor(camX/TILE)-1, startY = Math.floor(camY/TILE)-1;
  const endX = Math.floor((camX+W)/TILE)+1, endY = Math.floor((camY+H)/TILE)+1;
  for(let ty=startY; ty<=endY; ty++){
    for(let tx=startX; tx<=endX; tx++){
      const i = genTerrain(tx, ty);
      const t = TERRAIN.list[i];
      const px = tx*TILE - camX, py = ty*TILE - camY;
      ctx.fillStyle = t.color;
      ctx.fillRect(px,py,TILE,TILE);
      ctx.globalAlpha = .08;
      ctx.fillStyle = '#0b1624';
      ctx.fillRect(px,py,TILE,1);
      ctx.fillRect(px,py,1,TILE);
      ctx.globalAlpha = 1;
      if(t.key==='WATER'){
        ctx.globalAlpha = .20;
        ctx.fillStyle = '#5fd7ff';
        const y = py + (Math.sin(waterPhase*0.1 + tx*0.8)*3);
        ctx.fillRect(px, y, TILE, 2);
        ctx.globalAlpha = 1;
      }
      if(t.key==='SAND'){
        ctx.fillStyle='#c8b47633';
        ctx.fillRect(px,py, TILE, 3);
      }
    }
  }
  if(forestDim>0){
    ctx.globalAlpha = forestDim;
    ctx.fillStyle='#000'; ctx.fillRect(0,0,W,H);
    ctx.globalAlpha = 1;
  }
  // subtle ambient lighten to avoid completely black tiles; keeps contrast
  // low so the overall mood remains dark but characters/FX pop better.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = 'rgba(255,255,255,0.02)';
  ctx.fillRect(0,0,W,H);
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}
export const TILE = 36;
