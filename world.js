export const TILE = 36;

let waterPhase = 0;

export const LORD_BRITISH_CASTLE_CENTER = { x: 0, y: 0 };

const CASTLE_WIDTH = TILE * 14;
const CASTLE_HEIGHT = TILE * 12;
const CASTLE_HALF_WIDTH = CASTLE_WIDTH / 2;
const CASTLE_HALF_HEIGHT = CASTLE_HEIGHT / 2;
const CASTLE_WALL_THICKNESS = TILE;
const CASTLE_MOAT_PADDING = TILE * 1.6;
const CASTLE_WALKWAY_WIDTH = TILE * 4;
const CASTLE_WALKWAY_LENGTH = TILE * 5;
const CASTLE_TOWER_RADIUS = TILE * 1.2;
const CASTLE_KEEP_WIDTH = TILE * 6;
const CASTLE_KEEP_HEIGHT = TILE * 5.2;
const CASTLE_KEEP_OFFSET_Y = -TILE * 0.4;

const CASTLE_LEFT = LORD_BRITISH_CASTLE_CENTER.x - CASTLE_HALF_WIDTH;
const CASTLE_TOP = LORD_BRITISH_CASTLE_CENTER.y - CASTLE_HALF_HEIGHT;
const CASTLE_RIGHT = CASTLE_LEFT + CASTLE_WIDTH;
const CASTLE_BOTTOM = CASTLE_TOP + CASTLE_HEIGHT;

const WALKWAY_LEFT = LORD_BRITISH_CASTLE_CENTER.x - CASTLE_WALKWAY_WIDTH / 2;
const WALKWAY_RIGHT = WALKWAY_LEFT + CASTLE_WALKWAY_WIDTH;
const WALKWAY_TOP = CASTLE_BOTTOM - CASTLE_WALL_THICKNESS * 0.4;
const WALKWAY_BOTTOM = WALKWAY_TOP + CASTLE_WALKWAY_LENGTH;

export const LORD_BRITISH_CASTLE_BOUNDS = {
  left: CASTLE_LEFT,
  top: CASTLE_TOP,
  right: CASTLE_RIGHT,
  bottom: CASTLE_BOTTOM
};

export const LORD_BRITISH_CASTLE_ENTRANCE = {
  x: LORD_BRITISH_CASTLE_CENTER.x,
  y: WALKWAY_TOP + TILE * 1.5
};

export const LORD_BRITISH_THRONE_POS = {
  x: LORD_BRITISH_CASTLE_CENTER.x,
  y: LORD_BRITISH_CASTLE_CENTER.y - TILE * 2
};

export const GARGOYLE_STANDING_POS = {
  x: LORD_BRITISH_CASTLE_CENTER.x - TILE * 2.5,
  y: LORD_BRITISH_CASTLE_CENTER.y + TILE * 1.1
};

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

function drawLordBritishCastle(ctx, view){
  const { camX, camY, W, H } = view;
  const moatLeft = CASTLE_LEFT - CASTLE_MOAT_PADDING;
  const moatTop = CASTLE_TOP - CASTLE_MOAT_PADDING;
  const moatRight = CASTLE_RIGHT + CASTLE_MOAT_PADDING;
  const moatBottom = CASTLE_BOTTOM + CASTLE_MOAT_PADDING;

  const boundingLeft = Math.min(moatLeft, WALKWAY_LEFT);
  const boundingTop = moatTop;
  const boundingRight = Math.max(moatRight, WALKWAY_RIGHT);
  const boundingBottom = Math.max(moatBottom, WALKWAY_BOTTOM);

  if (boundingRight - camX < 0 ||
      boundingBottom - camY < 0 ||
      boundingLeft - camX > W ||
      boundingTop - camY > H) {
    return;
  }

  ctx.save();
  ctx.translate(-camX, -camY);

  const moatWidth = moatRight - moatLeft;
  const moatHeight = moatBottom - moatTop;
  ctx.fillStyle = '#102236';
  ctx.fillRect(moatLeft, moatTop, moatWidth, moatHeight);
  ctx.fillStyle = 'rgba(86,143,186,0.18)';
  ctx.fillRect(moatLeft, moatTop + moatHeight * 0.16, moatWidth, moatHeight * 0.14);
  ctx.fillRect(moatLeft, moatBottom - moatHeight * 0.24, moatWidth, moatHeight * 0.18);

  const bermPadding = TILE * 0.9;
  ctx.fillStyle = '#2d4a34';
  ctx.fillRect(
    CASTLE_LEFT - bermPadding,
    CASTLE_TOP - bermPadding,
    CASTLE_WIDTH + bermPadding * 2,
    CASTLE_HEIGHT + bermPadding * 2
  );

  ctx.fillStyle = '#2b2736';
  ctx.fillRect(CASTLE_LEFT, CASTLE_TOP, CASTLE_WIDTH, CASTLE_HEIGHT);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(CASTLE_LEFT, CASTLE_TOP, CASTLE_WIDTH, CASTLE_WALL_THICKNESS * 0.55);
  ctx.fillRect(
    CASTLE_LEFT,
    CASTLE_BOTTOM - CASTLE_WALL_THICKNESS * 0.55,
    CASTLE_WIDTH,
    CASTLE_WALL_THICKNESS * 0.55
  );

  const courtyardLeft = CASTLE_LEFT + CASTLE_WALL_THICKNESS * 0.9;
  const courtyardTop = CASTLE_TOP + CASTLE_WALL_THICKNESS * 0.9;
  const courtyardRight = CASTLE_RIGHT - CASTLE_WALL_THICKNESS * 0.9;
  const courtyardBottom = CASTLE_BOTTOM - CASTLE_WALL_THICKNESS * 0.9;
  ctx.fillStyle = '#6b583d';
  ctx.fillRect(
    courtyardLeft,
    courtyardTop,
    courtyardRight - courtyardLeft,
    courtyardBottom - courtyardTop
  );

  ctx.strokeStyle = 'rgba(0,0,0,0.14)';
  ctx.lineWidth = 2;
  for(let y = courtyardTop + TILE; y < courtyardBottom; y += TILE){
    ctx.beginPath();
    ctx.moveTo(courtyardLeft, y);
    ctx.lineTo(courtyardRight, y);
    ctx.stroke();
  }
  for(let x = courtyardLeft + TILE * 1.2; x < courtyardRight; x += TILE * 1.2){
    ctx.beginPath();
    ctx.moveTo(x, courtyardTop);
    ctx.lineTo(x, courtyardBottom);
    ctx.stroke();
  }

  const keepLeft = LORD_BRITISH_CASTLE_CENTER.x - CASTLE_KEEP_WIDTH / 2;
  const keepTop = (LORD_BRITISH_CASTLE_CENTER.y - CASTLE_KEEP_HEIGHT / 2) + CASTLE_KEEP_OFFSET_Y;
  const keepBottom = keepTop + CASTLE_KEEP_HEIGHT;
  ctx.fillStyle = '#3b384c';
  ctx.fillRect(keepLeft, keepTop, CASTLE_KEEP_WIDTH, CASTLE_KEEP_HEIGHT);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(keepLeft, keepTop, CASTLE_KEEP_WIDTH, TILE * 0.45);

  const bannerWidth = TILE * 0.6;
  const bannerHeight = TILE * 1.6;
  const bannerOffset = TILE * 2.2;
  [['#b01f2d', -1], ['#1f4f8d', 1]].forEach(([color, dir]) => {
    const bx = LORD_BRITISH_CASTLE_CENTER.x + dir * bannerOffset - bannerWidth / 2;
    const by = keepTop + TILE * 0.9;
    ctx.fillStyle = color;
    ctx.fillRect(bx, by, bannerWidth, bannerHeight);
    ctx.beginPath();
    ctx.moveTo(bx, by + bannerHeight);
    ctx.lineTo(bx + bannerWidth / 2, by + bannerHeight + TILE * 0.34);
    ctx.lineTo(bx + bannerWidth, by + bannerHeight);
    ctx.closePath();
    ctx.fill();
  });

  const windowWidth = TILE * 0.35;
  const windowHeight = TILE * 0.7;
  const windowBaseY = keepTop + TILE * 1.6;
  const windowSpacing = TILE * 1.6;
  for(let i=-1; i<=1; i++){
    const wx = LORD_BRITISH_CASTLE_CENTER.x + i * windowSpacing - windowWidth / 2;
    ctx.fillStyle = '#1b2738';
    ctx.fillRect(wx, windowBaseY, windowWidth, windowHeight);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(wx + 2, windowBaseY + 2, windowWidth - 4, windowHeight * 0.45);
  }

  const daisWidth = CASTLE_KEEP_WIDTH * 0.78;
  const daisHeight = TILE * 1.8;
  const daisLeft = LORD_BRITISH_CASTLE_CENTER.x - daisWidth / 2;
  const daisTop = LORD_BRITISH_THRONE_POS.y - TILE * 1.1;
  ctx.fillStyle = '#641824';
  ctx.fillRect(daisLeft, daisTop, daisWidth, daisHeight);
  ctx.fillStyle = '#95232f';
  ctx.fillRect(
    daisLeft + TILE * 0.18,
    daisTop + TILE * 0.14,
    daisWidth - TILE * 0.36,
    daisHeight - TILE * 0.28
  );
  ctx.fillStyle = '#c84f3c';
  ctx.fillRect(LORD_BRITISH_CASTLE_CENTER.x - TILE * 0.6, daisTop, TILE * 1.2, daisHeight);
  const walkwayInnerTop = keepBottom - TILE * 0.5;
  const walkwayInnerBottom = WALKWAY_TOP + CASTLE_WALL_THICKNESS * 0.4;
  const carpetTop = daisTop + daisHeight;
  if(walkwayInnerTop > carpetTop){
    ctx.fillRect(
      LORD_BRITISH_CASTLE_CENTER.x - TILE * 0.6,
      carpetTop,
      TILE * 1.2,
      walkwayInnerTop - carpetTop
    );
  }

  const walkwayOuterHeight = WALKWAY_BOTTOM - WALKWAY_TOP;
  ctx.fillStyle = '#bca375';
  ctx.fillRect(WALKWAY_LEFT, WALKWAY_TOP, CASTLE_WALKWAY_WIDTH, walkwayOuterHeight);
  ctx.fillStyle = '#9d845c';
  ctx.fillRect(WALKWAY_LEFT, WALKWAY_BOTTOM - TILE * 0.9, CASTLE_WALKWAY_WIDTH, TILE * 0.9);

  ctx.fillStyle = '#d2bd8e';
  ctx.fillRect(
    WALKWAY_LEFT - TILE * 0.8,
    WALKWAY_BOTTOM - TILE * 0.8,
    CASTLE_WALKWAY_WIDTH + TILE * 1.6,
    TILE * 0.6
  );

  ctx.fillStyle = '#c8b07f';
  ctx.fillRect(WALKWAY_LEFT, walkwayInnerTop, CASTLE_WALKWAY_WIDTH, walkwayInnerBottom - walkwayInnerTop);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(WALKWAY_LEFT + TILE * 0.2, walkwayInnerTop, CASTLE_WALKWAY_WIDTH - TILE * 0.4, TILE * 0.28);
  ctx.fillStyle = '#a98c5c';
  ctx.fillRect(
    WALKWAY_LEFT + TILE * 0.2,
    walkwayInnerBottom - TILE * 0.5,
    CASTLE_WALKWAY_WIDTH - TILE * 0.4,
    TILE * 0.5
  );

  const hedgeWidth = TILE * 1.8;
  const hedgeHeight = TILE * 2.4;
  const hedgeY = walkwayInnerTop + TILE * 0.3;
  ctx.fillStyle = '#2f4b33';
  ctx.fillRect(WALKWAY_LEFT - hedgeWidth - TILE * 0.2, hedgeY, hedgeWidth, hedgeHeight);
  ctx.fillRect(WALKWAY_RIGHT + TILE * 0.2, hedgeY, hedgeWidth, hedgeHeight);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(WALKWAY_LEFT - hedgeWidth - TILE * 0.2, hedgeY + 6, hedgeWidth, 8);
  ctx.fillRect(WALKWAY_RIGHT + TILE * 0.2, hedgeY + 6, hedgeWidth, 8);

  ctx.fillStyle = '#c84f3c';
  ctx.fillRect(
    LORD_BRITISH_CASTLE_CENTER.x - TILE * 0.6,
    walkwayInnerTop - TILE * 1.4,
    TILE * 1.2,
    TILE * 1.4
  );

  ctx.strokeStyle = 'rgba(64,47,29,0.55)';
  ctx.lineWidth = 4;
  ctx.strokeRect(WALKWAY_LEFT + 6, WALKWAY_TOP + 4, CASTLE_WALKWAY_WIDTH - 12, walkwayOuterHeight - 8);

  const postHeight = TILE * 0.65;
  const postWidth = TILE * 0.22;
  const postOffset = CASTLE_WALKWAY_WIDTH / 2 - TILE * 0.4;
  [-1, 1].forEach(dir => {
    const px = LORD_BRITISH_CASTLE_CENTER.x + dir * postOffset - postWidth / 2;
    ctx.fillStyle = '#d8c48e';
    ctx.fillRect(px, walkwayInnerTop + TILE * 0.6, postWidth, postHeight);
    ctx.fillStyle = '#f8e5b3';
    ctx.fillRect(px + 1, walkwayInnerTop + TILE * 0.6 + 1, postWidth - 2, postHeight * 0.48);
  });

  ctx.fillStyle = 'rgba(15,12,20,0.45)';
  ctx.fillRect(WALKWAY_LEFT, WALKWAY_TOP - TILE * 0.6, CASTLE_WALKWAY_WIDTH, TILE * 0.6);

  const brazierRadius = TILE * 0.22;
  const brazierY = walkwayInnerTop + TILE * 0.65;
  const brazierOffset = TILE * 1.2;
  [ -1, 1 ].forEach(dir => {
    const bx = LORD_BRITISH_CASTLE_CENTER.x + dir * brazierOffset;
    ctx.fillStyle = '#423321';
    ctx.beginPath();
    ctx.arc(bx, brazierY + TILE * 0.2, brazierRadius * 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f7d486';
    ctx.beginPath();
    ctx.arc(bx, brazierY, brazierRadius, 0, Math.PI * 2);
    ctx.fill();
  });

  const towerPositions = [
    { x: CASTLE_LEFT + CASTLE_WALL_THICKNESS * 0.6, y: CASTLE_TOP + CASTLE_WALL_THICKNESS * 0.6 },
    { x: CASTLE_RIGHT - CASTLE_WALL_THICKNESS * 0.6, y: CASTLE_TOP + CASTLE_WALL_THICKNESS * 0.6 },
    { x: CASTLE_LEFT + CASTLE_WALL_THICKNESS * 0.6, y: CASTLE_BOTTOM - CASTLE_WALL_THICKNESS * 0.6 },
    { x: CASTLE_RIGHT - CASTLE_WALL_THICKNESS * 0.6, y: CASTLE_BOTTOM - CASTLE_WALL_THICKNESS * 0.6 }
  ];
  towerPositions.forEach(pos => {
    ctx.fillStyle = '#41405a';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, CASTLE_TOWER_RADIUS, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#aa2330';
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y - CASTLE_TOWER_RADIUS - TILE * 0.5);
    ctx.lineTo(pos.x + TILE * 0.5, pos.y - CASTLE_TOWER_RADIUS + TILE * 0.2);
    ctx.lineTo(pos.x, pos.y - CASTLE_TOWER_RADIUS + TILE * 0.4);
    ctx.closePath();
    ctx.fill();
  });

  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 3;
  ctx.strokeRect(CASTLE_LEFT + 4, CASTLE_TOP + 4, CASTLE_WIDTH - 8, CASTLE_HEIGHT - 8);

  ctx.restore();
}

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
  drawLordBritishCastle(ctx, view);
  if(forestDim>0){
    ctx.globalAlpha = forestDim;
    ctx.fillStyle='#000'; ctx.fillRect(0,0,W,H);
    ctx.globalAlpha = 1;
  }
}
