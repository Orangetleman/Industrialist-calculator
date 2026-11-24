const zlib=require('zlib');const R=require(process.cwd()+'/data/recipes.json');const recs=(Array.isArray(R)?R:R.recipes);
const ids=recs.map(r=>r.id);let seed=7;const rnd=n=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed%n};
function design(nN,nB,nW){const nodes=[],edges=[];for(let i=1;i<=nN;i++)nodes.push({id:'n'+i,recipeId:ids[rnd(ids.length)],machines:1+rnd(40)/4,x:(i%8)*260,y:Math.floor(i/8)*180});
for(let i=2;i<=nN;i++){const f='n'+i,t='n'+(1+rnd(i-1));const item=Object.keys(recs[rnd(recs.length)].outputs)[0];edges.push({id:`${f}>${t}:${item}`,from:f,to:t,item})}
const blocks=[];for(let u=1;u<=nB;u++)blocks.push({u,id:['pipe-t1','conveyor','craft-assembler','roller','smelter'][rnd(5)],x:rnd(60),y:rnd(60),r:rnd(4)});
const wires=[];for(let i=0;i<nW;i++)wires.push({a:1+rnd(nB),ia:rnd(4),b:1+rnd(nB),ib:rnd(4),t:'p'});
return {v:1,settings:{goal:'objet',item:'crankshaft',mode:'rate',rate:60,rateUnit:'s',criteria:['area','machines','energy']},graph:{nodes,edges,target:{node:'n1',item:'crankshaft'},rate:60},layout:{blocks,wires}}}
// binaire maison : varint, index d'id, deltas
function bin(d){const o=[];const vi=n=>{n=Math.round(n);n=(n<<1)^(n>>31);do{let b=n&127;n>>>=7;o.push(n?b|128:b)}while(n)};
const dict=new Map(ids.map((x,i)=>[x,i]));const items=new Map();const it=s=>{if(!items.has(s))items.set(s,items.size);return items.get(s)};
const g=d.graph;vi(g.nodes.length);let px=0,py=0;for(const n of g.nodes){vi(dict.get(n.recipeId));vi(n.machines*4);vi((n.x-px)/10);vi((n.y-py)/10);px=n.x;py=n.y}
vi(g.edges.length);for(const e of g.edges){vi(+e.from.slice(1));vi(+e.to.slice(1));vi(it(e.item))}
const L=d.layout;vi(L.blocks.length);let bx=0,by=0;const bids=new Map();for(const b of L.blocks){if(!bids.has(b.id))bids.set(b.id,bids.size);vi(bids.get(b.id)*4+b.r);vi(b.x-bx);vi(b.y-by);bx=b.x;by=b.y}
vi(L.wires.length);for(const w of L.wires){vi(w.a);vi(w.ia*2+(w.t=='g'?1:0));vi(w.b-w.a);vi(w.ib)}return Buffer.from(o)}
for(const [nom,a,b,c] of [['petit',5,30,10],['moyen',25,250,80],['gros',80,900,300]]){const d=design(a,b,c);const j=Buffer.from(JSON.stringify(d));
const jz=zlib.deflateRawSync(j,{level:9});const bz=zlib.deflateRawSync(bin(d),{level:9});const b64=x=>Math.ceil(x.length*4/3);
console.log(nom,'JSON',j.length,'JSON+deflate',jz.length,'lien',b64(jz)+40,'| binaire',bin(d).length,'+deflate',bz.length,'lien',b64(bz)+40)}
