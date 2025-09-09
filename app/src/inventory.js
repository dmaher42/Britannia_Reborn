export class Inventory {
  constructor(){ this.gold=0; this.items=[]; }
  add(it){
    const ex = this.items.find(x=>x.id===it.id);
    if(ex){ ex.qty=(ex.qty||0)+(it.qty||1); }
    else { this.items.push({...it, qty:it.qty||1}); }
  }
  totalWeight(){
    return this.items.reduce((s,i)=> s + (i.weight||0)*(i.qty||1), 0);
  }
  summary(){
    return this.items.map(i=> `${i.name}×${i.qty}`).join(', ');
  }
  count(id){ return (this.items.find(i=>i.id===id)?.qty)||0; }
  consume(id, n){
    const it = this.items.find(i=>i.id===id);
    if(!it || it.qty<n) return false;
    it.qty -= n; if(it.qty<=0) this.items = this.items.filter(x=>x!==it);
    return true;
  }
}
