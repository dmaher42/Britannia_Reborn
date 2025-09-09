export async function talkToNPC(npc, worldState, playerState, questState, playerInput){
  const payload = {
    persona: `You are ${npc.name}, a ${npc.profession} in the town of ${npc.town}. Your personality is ${npc.personality}.`,
    worldState, playerState, questState, playerInput, conversation: []
  };
  try{
    const resp = await fetch('/api/ai', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    if(!resp.ok) throw new Error('AI endpoint unavailable');
    const data = await resp.json();
    return { text: data.text || '...'};
  }catch(e){
    const mock = `Bandits prowl the northern bridge. If thou hast the courage, speak to Captain Rowe at the barracks. Bring proof of thy deeds.`;
    return { text: mock };
  }
}
