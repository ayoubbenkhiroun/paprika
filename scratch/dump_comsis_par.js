const fs = require('fs');
const xml = fs.readFileSync('c:/Users/mohamed.soltan_amari/paprika/vdr ajout de couche/Process VDR AvecAjoutDeCouche.bpmn', 'utf8');
function decode(s){return String(s||'').replace(/&#39;/g,"'").replace(/&amp;/g,'&');}
const flows=[];
let m; const re=/<bpmn:sequenceFlow\b([^>]*)\/?>/g;
while((m=re.exec(xml))){
  const a=m[1]; const g=k=>(a.match(new RegExp('\\b'+k+'="([^"]*)"'))||[])[1]||'';
  flows.push({name:decode(g('name')),source:g('sourceRef'),target:g('targetRef')});
}
const names=new Map();
const par=new Set();
const nre=/<bpmn:(parallelGateway|exclusiveGateway|callActivity|userTask|serviceTask|scriptTask|task|manualTask|subProcess)\b([^>]*)\/?>/g;
while((m=nre.exec(xml))){
  const t=m[1],a=m[2]; const id=(a.match(/\bid="([^"]*)"/)||[])[1]; if(!id)continue;
  const nm=decode((a.match(/\bname="([^"]*)"/)||[])[1]||'')||id;
  names.set(id,nm); if(t==='parallelGateway') par.add(id);
}
function L(id){return (par.has(id)?'[P] ':'')+(names.get(id)||id);}
const fwd=new Map(), rev=new Map();
flows.forEach(f=>{
  if(!fwd.has(f.source))fwd.set(f.source,[]); fwd.get(f.source).push(f);
  if(!rev.has(f.target))rev.set(f.target,[]); rev.get(f.target).push(f);
});
['Gateway_0xwajjh','Gateway_1gk8iw3','Gateway_1o8ehsg','Gateway_03zo3zn','Gateway_1v8yasd'].forEach(id=>{
  console.log('\n'+L(id));
  console.log('  IN:', (rev.get(id)||[]).map(f=>L(f.source)+' "'+f.name+'"').join(' | '));
  console.log('  OUT:', (fwd.get(id)||[]).map(f=>'"'+f.name+'" -> '+L(f.target)).join(' | '));
});
// path from qualité to 0xwajjh
console.log('\nReverse from Gateway_0xwajjh depth 6:');
function dump(id,d,v){
  if(d>6||v.has(id))return; v.add(id);
  (rev.get(id)||[]).forEach(f=>{console.log('  '.repeat(d)+L(f.source)+' -> '+L(id)); dump(f.source,d+1,v);});
}
dump('Gateway_0xwajjh',0,new Set());
