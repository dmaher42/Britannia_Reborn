export const dialogueEl = document.getElementById('dialogue');
export const toast = document.getElementById('toast');
export const gridLayer = document.getElementById('gridOverlay');

export function showToast(msg, ms=1400){ toast.textContent=msg; toast.style.display='inline-block'; clearTimeout(showToast._t); showToast._t=setTimeout(()=>toast.style.display='none', ms); }
export function pushBubble(who, text){
  const el = document.createElement('div');
  el.className='bubble'; el.innerHTML = `<div class="who">${who}</div><div class="text"></div>`;
  dialogueEl.appendChild(el); dialogueEl.scrollTop = dialogueEl.scrollHeight;
  const textEl = el.querySelector('.text');
  let i=0; const id=setInterval(()=>{ textEl.textContent=text.slice(0,++i); dialogueEl.scrollTop = dialogueEl.scrollHeight; if(i>=text.length) clearInterval(id); },10);
  return el;
}
export function pushActions(actions){
  const a = document.createElement('div'); a.className='actions';
  actions.forEach(({label,fn})=>{ const b=document.createElement('button'); b.className='btn'; b.textContent=label; b.onclick=fn; a.appendChild(b); });
  const last = dialogueEl.lastElementChild; (last? last: dialogueEl).appendChild(a);
  dialogueEl.scrollTop = dialogueEl.scrollHeight;
}

export function updatePartyUI(party){
  const node = document.getElementById('partyList'); node.innerHTML='';
  party.members.forEach(m=>{
    const hpPct = Math.max(0, Math.min(1, m.hp/m.hpMax))*100;
    const mpPct = m.mpMax? Math.max(0, Math.min(1, m.mp/m.mpMax))*100 : 0;
    const row = document.createElement('div'); row.className='row';
    row.innerHTML = `<div>${m.name} (Class: ${m.cls}, STR:${m.STR} DEX:${m.DEX} INT:${m.INT})</div>
      <div style="display:flex;gap:10px;min-width:180px">
        <div class="meter" style="width:100px"><span class="hp" style="display:block;height:10px;background:linear-gradient(90deg,#ff6b6b,#ff3b57);width:${hpPct}%"></span></div>
        <div class="meter" style="width:100px"><span class="mp" style="display:block;height:10px;background:linear-gradient(90deg,#6bc7ff,#39c2ff);width:${mpPct}%"></span></div>
      </div>`;
    node.appendChild(row);
  });
}

export function updateInventoryUI(inv, party){
  document.getElementById('reagents').textContent = `Sulfur Ash: ${inv.count('sulfur_ash')} · Black Pearl: ${inv.count('black_pearl')}`;
  document.getElementById('totalWeight').textContent = inv.totalWeight().toFixed(1) + ' wt';
  document.getElementById('equipRule').textContent = 'equip ≤ STR';
  document.getElementById('packRule').textContent = 'pack ≤ STR×2';
}
