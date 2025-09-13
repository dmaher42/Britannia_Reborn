import { moveHeroToTile, getHeroWorldPos } from './world3d.js';

const keys = Object.create(null);
let bounds = { width:32, depth:32 };
let cameraRig = null;
let moveCooldown = 0;

export function initControls(opts={}){
  bounds.width = opts.width || bounds.width;
  bounds.depth = opts.depth || bounds.depth;
  cameraRig = opts.cameraRig || null;

  window.addEventListener('keydown', e=>{ keys[e.key] = true; });
  window.addEventListener('keyup', e=>{ keys[e.key] = false; });
}

function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }

export function updateControls(dt){
  moveCooldown -= dt;
  const pos = getHeroWorldPos();
  let tx = Math.floor(pos.x);
  let tz = Math.floor(pos.z);
  let moved = false;

  if(moveCooldown<=0){
    if(keys['w'] || keys['ArrowUp']){ tz -=1; moved=true; }
    else if(keys['s'] || keys['ArrowDown']){ tz +=1; moved=true; }
    else if(keys['a'] || keys['ArrowLeft']){ tx -=1; moved=true; }
    else if(keys['d'] || keys['ArrowRight']){ tx +=1; moved=true; }
    if(moved){
      tx = clamp(tx,0,bounds.width-1);
      tz = clamp(tz,0,bounds.depth-1);
      moveHeroToTile(tx, tz);
      moveCooldown = 0.2; // seconds between steps
    }
  }

  if(keys['Shift']){
    const rotSpeed = 1.5 * dt;
    if(keys['ArrowLeft']) cameraRig.rotation.y += rotSpeed;
    if(keys['ArrowRight']) cameraRig.rotation.y -= rotSpeed;
    if(keys['ArrowUp']) cameraRig.rotation.x += rotSpeed;
    if(keys['ArrowDown']) cameraRig.rotation.x -= rotSpeed;
  }
}
