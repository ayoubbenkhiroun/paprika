const fs = require('fs');
const path = 'c:/Users/mohamed.soltan_amari/paprika/vdr ajout de couche/Process VDR AvecAjoutDeCouche.bpmn';
const xml = fs.readFileSync(path, 'utf8');

function decode(s) {
  return String(s || '').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
}
function isBypass(text) { return /bypass\s*migration/i.test(String(text || '')); }

const flows = [];
let m;
const flowRe = /<bpmn:sequenceFlow\b([^>]*)\/?>/g;
while ((m = flowRe.exec(xml))) {
  const attrs = m[1];
  const get = (k) => { const mm = attrs.match(new RegExp('\\b' + k + '="([^"]*)"')); return mm ? decode(mm[1]) : ''; };
  flows.push({ id: get('id'), name: get('name'), source: get('sourceRef'), target: get('targetRef') });
}

const gatewayNames = new Map();
const gatewayDefault = new Map();
const parallelGatewayIds = new Set();
const activityNodeNames = new Map();
const nodeRe = /<bpmn:(parallelGateway|exclusiveGateway|inclusiveGateway|complexGateway|eventBasedGateway|callActivity|userTask|serviceTask|scriptTask|task|manualTask|subProcess|businessRuleTask|sendTask|receiveTask)\b([^>]*)\/?>/g;
while ((m = nodeRe.exec(xml))) {
  const type = m[1], attrs = m[2];
  const idM = attrs.match(/\bid="([^"]*)"/);
  const nameM = attrs.match(/\bname="([^"]*)"/);
  const defM = attrs.match(/\bdefault="([^"]*)"/);
  if (!idM) continue;
  const id = idM[1];
  const name = decode(nameM ? nameM[1] : '') || id;
  if (type === 'parallelGateway') parallelGatewayIds.add(id);
  else if (type.includes('Gateway')) {
    gatewayNames.set(id, name);
    if (defM) gatewayDefault.set(id, defM[1]);
  } else activityNodeNames.set(id, name);
}

const reverseAdj = new Map();
flows.forEach((f) => {
  if (!f.source || !f.target) return;
  const fromGateway = gatewayNames.has(f.source);
  const gwLabel = fromGateway ? gatewayNames.get(f.source) : '';
  const isDefault = fromGateway && gatewayDefault.get(f.source) === f.id;
  const isBypassEdge = fromGateway && isBypass(gwLabel);
  let composedCond = '';
  if (fromGateway && gwLabel && f.name) composedCond = `Si [${gwLabel}] = "${f.name}"`;
  else if (fromGateway && gwLabel && isDefault) composedCond = `Si [${gwLabel}] = "défaut"`;
  else if (fromGateway && gwLabel) composedCond = `Si [${gwLabel}]`;
  if (!reverseAdj.has(f.target)) reverseAdj.set(f.target, []);
  reverseAdj.get(f.target).push({ sourceRef: f.source, composedCond, fromGateway, gwLabel, isBypass: isBypassEdge, branchLabel: f.name });
});

function formatPart(c) { return String(c || '').replace(/^Si\s+/i, '').trim(); }
function isMeaningful(c, branchLabel) {
  if (isBypass(c) || isBypass(branchLabel)) return false;
  if (!c) return false;
  if (branchLabel && String(branchLabel).trim()) return true;
  return /=\s*["']/.test(c);
}
function buildLabel(conds, names) {
  const parts = (conds || []).map(formatPart).filter(Boolean);
  const ns = (names || []).filter(Boolean).filter((n, i, a) => a.indexOf(n) === i);
  if (ns.length === 1) parts.push(`l'activité "${ns[0]}" est réalisée !`);
  else if (ns.length > 1) parts.push(`les activités ${ns.map(n => `"${n}"`).join(' et ')} sont réalisées en parallèle !`);
  return parts.join(' et ');
}

function collectActivitiesFromParallelJoin(joinId, blocked) {
  const names = [];
  const seenNames = new Set();
  const addName = (n) => { const name = String(n || '').trim(); if (!name || seenNames.has(name)) return; seenNames.add(name); names.push(name); };
  const isNamedDecisionGateway = (nodeId) => {
    if (!gatewayNames.has(nodeId) || parallelGatewayIds.has(nodeId)) return false;
    const label = String(gatewayNames.get(nodeId) || '').trim();
    if (!label || /^Gateway_/i.test(label)) return false;
    return !isBypass(label);
  };
  const exploreFrontier = function(nodeId, localBlocked) {
    if (!nodeId || localBlocked.has(nodeId)) return;
    const blockedNow = new Set(localBlocked); blockedNow.add(nodeId);
    if (activityNodeNames.has(nodeId)) { addName(activityNodeNames.get(nodeId)); return; }
    if (parallelGatewayIds.has(nodeId)) {
      const incs = reverseAdj.get(nodeId) || [];
      if (!incs.length) return;
      if (incs.length > 1) incs.forEach(e => exploreFrontier(e.sourceRef, blockedNow));
      else exploreFrontier(incs[0].sourceRef, blockedNow);
      return;
    }
    let cur = nodeId; let guard = 0;
    while (cur && guard < 100) {
      guard++;
      if (activityNodeNames.has(cur)) { addName(activityNodeNames.get(cur)); return; }
      if (parallelGatewayIds.has(cur)) { exploreFrontier(cur, blockedNow); return; }
      if (blockedNow.has(cur) && cur !== nodeId) return;
      blockedNow.add(cur);
      const incs = reverseAdj.get(cur) || [];
      if (!incs.length) return;
      const nonBypass = incs.filter(e => !e.isBypass);
      const pool = nonBypass.length ? nonBypass : incs;
      const poolActs = pool.filter(e => activityNodeNames.has(e.sourceRef));
      const poolPar = pool.filter(e => parallelGatewayIds.has(e.sourceRef));
      if (poolActs.length || poolPar.length) {
        poolActs.forEach(e => addName(activityNodeNames.get(e.sourceRef)));
        poolPar.forEach(e => exploreFrontier(e.sourceRef, blockedNow));
        pool.filter(e => !activityNodeNames.has(e.sourceRef) && !parallelGatewayIds.has(e.sourceRef))
          .forEach(e => { if (!isNamedDecisionGateway(e.sourceRef)) exploreFrontier(e.sourceRef, blockedNow); });
        return;
      }
      if (pool.length === 1) { cur = pool[0].sourceRef; continue; }
      pool.forEach(e => { if (!isNamedDecisionGateway(e.sourceRef)) exploreFrontier(e.sourceRef, blockedNow); });
      if (![...pool].some(e => !isNamedDecisionGateway(e.sourceRef))) { cur = pool[0].sourceRef; continue; }
      return;
    }
  };
  (reverseAdj.get(joinId) || []).forEach(edge => exploreFrontier(edge.sourceRef, blocked || new Set()));
  return names;
}

function collectUpstreamApplicableContext(nodeId) {
  const conditions = [];
  let precedingActivityNames = [];
  const visited = new Set();
  let current = nodeId;
  let guard = 0;
  while (current && guard < 120) {
    guard++;
    if (visited.has(current)) break;
    visited.add(current);
    const incomings = reverseAdj.get(current) || [];
    if (!incomings.length) break;
    if (parallelGatewayIds.has(current) && incomings.length > 1) {
      precedingActivityNames = collectActivitiesFromParallelJoin(current, visited);
      break;
    }
    const actEdges = incomings.filter(e => activityNodeNames.has(e.sourceRef));
    if (actEdges.length > 1) { precedingActivityNames = actEdges.map(e => activityNodeNames.get(e.sourceRef)).filter(Boolean); break; }
    if (actEdges.length === 1) { precedingActivityNames = [activityNodeNames.get(actEdges[0].sourceRef)].filter(Boolean); break; }
    let edge = null;
    if (incomings.length === 1) edge = incomings[0];
    else {
      const decisionEdges = incomings.filter(e => e.fromGateway && e.composedCond && !e.isBypass);
      if (decisionEdges.length === 1) edge = decisionEdges[0];
      else {
        const bypassEdges = incomings.filter(e => e.fromGateway && e.isBypass);
        if (bypassEdges.length === 1 && decisionEdges.length === 0) edge = bypassEdges[0];
        else {
          const branchActs = collectActivitiesFromParallelJoin(current, visited);
          if (branchActs.length) { precedingActivityNames = branchActs; break; }
          break;
        }
      }
    }
    if (!edge) break;
    if (activityNodeNames.has(edge.sourceRef)) { precedingActivityNames = [activityNodeNames.get(edge.sourceRef)].filter(Boolean); break; }
    if (parallelGatewayIds.has(edge.sourceRef)) {
      if (isMeaningful(edge.composedCond, edge.branchLabel)) conditions.unshift(edge.composedCond);
      const joinIncs = reverseAdj.get(edge.sourceRef) || [];
      if (joinIncs.length > 1) { precedingActivityNames = collectActivitiesFromParallelJoin(edge.sourceRef, visited); break; }
      current = edge.sourceRef; continue;
    }
    if (isMeaningful(edge.composedCond, edge.branchLabel)) conditions.unshift(edge.composedCond);
    current = edge.sourceRef;
  }
  return { conditions, precedingActivityNames };
}

['VDR_transfererLexploitation', 'VDR_verifierAccordComsisBytel', 'VDR_verifierLaQualiteDesDonnees3'].forEach(id => {
  const ctx = collectUpstreamApplicableContext(id);
  console.log('\n====', activityNodeNames.get(id) || id, '====');
  console.log('conditions:', ctx.conditions.map(formatPart));
  console.log('preceding (' + ctx.precedingActivityNames.length + '):');
  ctx.precedingActivityNames.forEach(n => console.log(' -', n));
  console.log('LABEL:', buildLabel(ctx.conditions, ctx.precedingActivityNames));
});
