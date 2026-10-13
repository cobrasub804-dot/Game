const system=`You are the narrator of Scot: The Mansion, an open-ended interactive romantic drama. Scot is an adult man at a luxurious mansion with eight adult women: Scarlett Vale (24), Vivian Cross (23), Elena Brooks (22), Natasha Reed (25), Jade Monroe (23), Isabelle Hart (24), Mia Bennett (21), Alexandra Quinn (26). All characters have agency and boundaries. Write vivid second-person scenes with dialogue and continuity. No affection meters, forced endings, or graphic sexual detail. Output only valid JSON: {"chapter":"short title","scene":"2-4 paragraphs","choices":["first action","second action"]}.`;
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const access=process.env.GAME_ACCESS_CODE;
  if(!access)return res.status(503).json({error:'AI is disabled. Free demo mode is available; configure GAME_ACCESS_CODE and a provider API key to enable AI.'});
  if(req.headers['x-game-access-code']!==access)return res.status(401).json({error:'Invalid access code'});
  const data=typeof req.body==='string'?JSON.parse(req.body):req.body;
  if(!data||!['openai','xai'].includes(data.engine)||!Array.isArray(data.history)||data.history.length>24)return res.status(400).json({error:'Invalid request'});
  const xai=data.engine==='xai';const key=process.env[xai?'XAI_API_KEY':'OPENAI_API_KEY'];
  if(!key)return res.status(503).json({error:'Selected AI provider is not configured'});
  const endpoint=xai?'https://api.x.ai/v1/chat/completions':'https://api.openai.com/v1/chat/completions';
  const model=xai?(process.env.XAI_MODEL||'grok-4'):(process.env.OPENAI_MODEL||'gpt-4.1-mini');
  const history=data.history.map(x=>({scene:String(x.scene||'').slice(0,2500),action:String(x.action||'').slice(0,500)}));
  try{
    const upstream=await fetch(endpoint,{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model,max_tokens:900,messages:[{role:'system',content:system},{role:'user',content:JSON.stringify({history,request:'Continue based on the latest action. Keep continuity.'})}]}) ,signal:AbortSignal.timeout(25000)});
    if(!upstream.ok)return res.status(502).json({error:'AI provider returned an error',status:upstream.status});
    const result=await upstream.json();const raw=result.choices?.[0]?.message?.content||'';
    const parsed=JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g,''));
    if(typeof parsed.scene!=='string'||!Array.isArray(parsed.choices))throw Error('Unexpected AI output');
    return res.status(200).json({chapter:String(parsed.chapter||'The Mansion').slice(0,80),scene:parsed.scene.slice(0,8000),choices:parsed.choices.slice(0,2).map(x=>String(x).slice(0,220))});
  }catch{return res.status(502).json({error:'Could not generate this scene. Try again or continue in demo mode.'})}
}
