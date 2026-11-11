const fs = require('fs');
const path = 'c:/Users/mohamed.soltan_amari/paprika/vdr ajout de couche/Process VDR AvecAjoutDeCouche.bpmn';
const xml = fs.readFileSync(path, 'utf8');

function decode(s) {
  return String(s || '')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

const flows = [];
const flowRe = /<bpmn:sequenceFlow\b([^>]*)\/?>/g;
let m;
while ((m = flowRe.exec(xml))) {
  const attrs = m[1];
  const get = (k) => {
    const mm = attrs.match(new RegExp('\\b' + k + '="([^"]*)"'));
    return mm ? decode(mm[1]) : '';
  };
  flows.push({ id: get('id'), name: get('name'), source: get('sourceRef'), target: get('targetRef') });
}

const rev = new Map();
flows.forEach((f) => {
  if (!f.target || !f.source) return;
  if (!rev.has(f.target)) rev.set(f.target, []);
  rev.get(f.target).push(f);
});

const names = new Map();
const parallel = new Set();
const exclusive = new Set();
const activityTypes = new Set(['callActivity', 'userTask', 'serviceTask', 'scriptTask', 'task', 'manualTask', 'subProcess', 'businessRuleTask', 'sendTask', 'receiveTask']);

const nodeRe = /<bpmn:(parallelGateway|exclusiveGateway|inclusiveGateway|callActivity|userTask|serviceTask|scriptTask|task|manualTask|subProcess|businessRuleTask|sendTask|receiveTask)\b([^>]*)\/?>/g;
while ((m = nodeRe.exec(xml))) {
  const type = m[1];
  const attrs = m[2];
  const idM = attrs.match(/\bid="([^"]*)"/);
  const nameM = attrs.match(/\bname="([^"]*)"/);
  if (!idM) continue;
  const id = idM[1];
  names.set(id, decode(nameM ? nameM[1] : '') || id);
  if (type === 'parallelGateway') parallel.add(id);
  if (type === 'exclusiveGateway' || type === 'inclusiveGateway') exclusive.add(id);
}

function label(id) {
  const n = names.get(id) || id;
  const tag = parallel.has(id) ? '[PAR]' : exclusive.has(id) ? '[XOR]' : activityTypes ? '' : '';
  let kind = '';
  if (parallel.has(id)) kind = '[PAR] ';
  else if (exclusive.has(id)) kind = '[XOR] ';
  else if ([...names.keys()].includes(id)) kind = '[ACT?] ';
  return kind + n + ' (' + id + ')';
}

function dump(start, depth, visited) {
  if (depth > 14 || visited.has(start)) return;
  visited.add(start);
  const incs = rev.get(start) || [];
  console.log('  '.repeat(depth) + label(start) + ' <- ' + incs.length);
  incs.forEach((f) => {
    console.log('  '.repeat(depth) + '  via "' + (f.name || '') + '" <= ' + label(f.source));
    dump(f.source, depth + 1, visited);
  });
}

console.log('=== Upstream of VDR_transfererLexploitation ===');
dump('VDR_transfererLexploitation', 0, new Set());

// Also list direct predecessors of Gateway_1fc5gaf
console.log('\n=== Direct ins of Gateway_1fc5gaf ===');
(rev.get('Gateway_1fc5gaf') || []).forEach((f) => console.log(label(f.source), 'via', f.name));
