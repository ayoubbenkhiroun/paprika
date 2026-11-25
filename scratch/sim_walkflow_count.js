/**
 * Simulation locale du walkFlow (compte outs/ins + sync merge)
 * sur Process VDR AvecAjoutDeCouche.bpmn
 */
const fs = require('fs');
const path = require('path');
const { DOMParser } = require('@xmldom/xmldom');

const bpmnPath = path.join(
  __dirname,
  '..',
  'vdr ajout de couche',
  'Process VDR AvecAjoutDeCouche.bpmn'
);
const xml = fs.readFileSync(bpmnPath, 'utf8');
const doc = new DOMParser().parseFromString(xml, 'text/xml');

function localName(el) {
  if (!el || el.nodeType !== 1) return '';
  return (el.localName || el.nodeName || '').replace(/^.*:/, '').toLowerCase();
}

function allElements(root) {
  const out = [];
  const walk = (n) => {
    if (!n) return;
    if (n.nodeType === 1) out.push(n);
    for (let c = n.firstChild; c; c = c.nextSibling) walk(c);
  };
  walk(root);
  return out;
}

const processes = allElements(doc).filter((el) => localName(el) === 'process');
const procEl =
  processes.find((p) => (p.getAttribute('id') || '').includes('AvecAjout') || p.getAttribute('isExecutable') === 'true') ||
  processes[0];
if (!procEl) {
  console.error('No process found');
  process.exit(1);
}
console.log('Process:', procEl.getAttribute('id'));

const activityNodeNames = new Map();
const parallelGatewayIds = new Set();
const endEventIds = new Set();
const gatewayNames = new Map();
const shapeMap = new Map();

allElements(procEl).forEach((el) => {
  const ln = localName(el);
  const id = el.getAttribute('id');
  if (!id) return;
  if (ln === 'parallelgateway') {
    parallelGatewayIds.add(id);
    return;
  }
  if (ln === 'endevent') {
    endEventIds.add(id);
    return;
  }
  if (['exclusivegateway', 'inclusivegateway', 'complexgateway', 'eventbasedgateway'].includes(ln)) {
    gatewayNames.set(id, el.getAttribute('name') || id);
    return;
  }
  if (
    [
      'usertask',
      'servicetask',
      'manualtask',
      'scripttask',
      'sendtask',
      'receivetask',
      'businessruletask',
      'task',
      'callactivity',
      'subprocess'
    ].includes(ln)
  ) {
    activityNodeNames.set(id, el.getAttribute('name') || id);
  }
});

// BPMNDI shapes (document-wide)
allElements(doc).forEach((el) => {
  if (localName(el) !== 'bpmnshape') return;
  const bpmnEl = el.getAttribute('bpmnElement');
  if (!bpmnEl) return;
  const bounds = Array.from(el.childNodes || []).find((c) => localName(c) === 'bounds');
  if (!bounds) return;
  shapeMap.set(bpmnEl, {
    x: parseFloat(bounds.getAttribute('x') || '0'),
    y: parseFloat(bounds.getAttribute('y') || '0')
  });
});

const flowAdj = new Map();
const reverseAdj = new Map();
allElements(procEl).forEach((el) => {
  if (localName(el) !== 'sequenceflow') return;
  const sourceRef = el.getAttribute('sourceRef');
  const targetRef = el.getAttribute('targetRef');
  if (!sourceRef || !targetRef) return;
  if (!flowAdj.has(sourceRef)) flowAdj.set(sourceRef, []);
  flowAdj.get(sourceRef).push(targetRef);
  if (!reverseAdj.has(targetRef)) reverseAdj.set(targetRef, []);
  reverseAdj.get(targetRef).push({ sourceRef, id: el.getAttribute('id') });
});

const decisionGatewayIds = new Set(gatewayNames.keys());
const flowRank = new Map();
const visitedFlow = new Set();
const resumedPoints = new Set();
let currentRank = 1;

const outDeg = (id) => (flowAdj.get(id) || []).length;
const inDeg = (id) => (reverseAdj.get(id) || []).length;
const isParallelGateway = (id) => parallelGatewayIds.has(id);
const isParallelSplit = (id) => parallelGatewayIds.has(id) && outDeg(id) > 1;
const isParallelMerge = (id) => parallelGatewayIds.has(id) && inDeg(id) > 1;
const isDecisionSplit = (id) => decisionGatewayIds.has(id) && outDeg(id) > 1;
const isDecisionJoin = (id) => decisionGatewayIds.has(id) && inDeg(id) > 1;
const isEndEvent = (id) => endEventIds.has(id);

const parallelPredIds = (gwId) =>
  (reverseAdj.get(gwId) || []).map((e) => (e && e.sourceRef) || e).filter(Boolean);

const mergeInputsSatisfied = (mergeId) => {
  const preds = parallelPredIds(mergeId);
  if (!preds.length) return true;
  return preds.every((p) => visitedFlow.has(p));
};

const sortFlowTargets = (targets) =>
  [...targets].sort((a, b) => {
    const sa = shapeMap.get(a) || {};
    const sb = shapeMap.get(b) || {};
    const ya = sa.y != null ? sa.y : 99999;
    const yb = sb.y != null ? sb.y : 99999;
    if (Math.abs(ya - yb) > 15) return ya - yb;
    const xa = sa.x != null ? sa.x : 99999;
    const xb = sb.x != null ? sb.x : 99999;
    if (Math.abs(xa - xb) > 15) return xa - xb;
    return String(a).localeCompare(String(b));
  });

const findMatchingDecisionMerge = (splitId, hardStops) => {
  const outs = flowAdj.get(splitId) || [];
  if (outs.length < 2) return null;
  const mergeCounts = new Map();
  const mergeDist = new Map();
  outs.forEach((start) => {
    const q = [{ id: start, d: 0 }];
    const seen = new Set([splitId]);
    while (q.length) {
      const { id: n, d } = q.shift();
      if (seen.has(n)) continue;
      seen.add(n);
      if (hardStops && hardStops.has(n)) continue;
      if (isParallelGateway(n)) continue;
      if (isDecisionJoin(n)) {
        mergeCounts.set(n, (mergeCounts.get(n) || 0) + 1);
        mergeDist.set(n, Math.min(mergeDist.get(n) ?? 99999, d));
        continue;
      }
      (flowAdj.get(n) || []).forEach((t) => {
        if (!seen.has(t)) q.push({ id: t, d: d + 1 });
      });
    }
  });
  let best = null;
  let bestCount = 1;
  let bestD = 99999;
  mergeCounts.forEach((cnt, mid) => {
    if (cnt < 2) return;
    const d = mergeDist.get(mid) ?? 99999;
    if (cnt > bestCount || (cnt === bestCount && d < bestD)) {
      best = mid;
      bestCount = cnt;
      bestD = d;
    }
  });
  return best;
};

const assignFlowNode = (id) => {
  if (!id || visitedFlow.has(id)) return;
  visitedFlow.add(id);
  flowRank.set(id, currentRank++);
};

const pushUnique = (arr, id) => {
  if (!id || arr.includes(id)) return;
  arr.push(id);
};

let handleParallelSplit;
let walkFlow;

const resumeParallelPoint = (gwId) => {
  if (!gwId || resumedPoints.has(gwId)) return;
  resumedPoints.add(gwId);
  if (isParallelSplit(gwId)) {
    handleParallelSplit(gwId, null);
    return;
  }
  if (!visitedFlow.has(gwId)) assignFlowNode(gwId);
  sortFlowTargets(flowAdj.get(gwId) || []).forEach((t) => walkFlow(t, null, null));
};

const tryResumeMerge = (mergeId) => {
  if (!mergeId || resumedPoints.has(mergeId)) return;
  if (!mergeInputsSatisfied(mergeId)) return;
  resumeParallelPoint(mergeId);
};

handleParallelSplit = (splitId, stopAt) => {
  if (!visitedFlow.has(splitId)) assignFlowNode(splitId);
  const outs = sortFlowTargets(flowAdj.get(splitId) || []);
  const resumePts = [];
  outs.forEach((t) => {
    walkFlow(t, stopAt, { untilMerge: true, resumePts, splitOutCount: outs.length });
  });
  sortFlowTargets(resumePts).forEach((id) => {
    if (isParallelMerge(id)) tryResumeMerge(id);
    else resumeParallelPoint(id);
  });
};

walkFlow = (nodeId, stopAt, ctx) => {
  if (!nodeId || visitedFlow.has(nodeId)) return;
  if (stopAt && stopAt.has(nodeId)) return;

  if (ctx && ctx.untilMerge && isEndEvent(nodeId)) {
    assignFlowNode(nodeId);
    return;
  }
  if (ctx && ctx.untilMerge && isParallelGateway(nodeId)) {
    pushUnique(ctx.resumePts, nodeId);
    return;
  }
  if (isParallelSplit(nodeId)) {
    handleParallelSplit(nodeId, stopAt);
    return;
  }
  if (isParallelGateway(nodeId)) {
    if (isParallelMerge(nodeId)) {
      tryResumeMerge(nodeId);
      return;
    }
    assignFlowNode(nodeId);
    sortFlowTargets(flowAdj.get(nodeId) || []).forEach((t) => walkFlow(t, stopAt, ctx));
    return;
  }
  if (isDecisionSplit(nodeId)) {
    assignFlowNode(nodeId);
    const hardStops = new Set(stopAt || []);
    if (ctx && ctx.resumePts) ctx.resumePts.forEach((j) => hardStops.add(j));
    const mergeId = findMatchingDecisionMerge(nodeId, hardStops);
    const branchStop = new Set(hardStops);
    if (mergeId) branchStop.add(mergeId);
    sortFlowTargets(flowAdj.get(nodeId) || []).forEach((t) => walkFlow(t, branchStop, ctx));
    if (mergeId) walkFlow(mergeId, stopAt, ctx);
    return;
  }
  assignFlowNode(nodeId);
  sortFlowTargets(flowAdj.get(nodeId) || []).forEach((t) => walkFlow(t, stopAt, ctx));
};

const startEvents = [];
allElements(procEl).forEach((el) => {
  if (localName(el) !== 'startevent') return;
  const sId = el.getAttribute('id');
  if (!sId) return;
  let p = el.parentNode;
  while (p && p !== procEl) {
    if (localName(p) === 'subprocess') return;
    p = p.parentNode;
  }
  startEvents.push(sId);
});

startEvents.forEach((s) => walkFlow(s, null, null));

let guard = 0;
while (guard++ < 50) {
  let progressed = false;
  parallelGatewayIds.forEach((id) => {
    if (resumedPoints.has(id)) return;
    if (!isParallelMerge(id)) return;
    if (!mergeInputsSatisfied(id)) return;
    if (!parallelPredIds(id).some((p) => visitedFlow.has(p))) return;
    tryResumeMerge(id);
    progressed = true;
  });
  flowAdj.forEach((_, id) => {
    if (!visitedFlow.has(id) && !isParallelGateway(id)) {
      walkFlow(id, null, null);
      if (visitedFlow.has(id)) progressed = true;
    }
  });
  if (!progressed) break;
}
flowAdj.forEach((_, id) => {
  if (!visitedFlow.has(id)) walkFlow(id, null, null);
});

const activities = [...activityNodeNames.entries()]
  .map(([id, name]) => ({ id, name, rank: flowRank.get(id) ?? 999999 }))
  .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));

console.log('\n=== Activity order (flowRank) ===');
activities.forEach((a, i) => {
  console.log(`${String(i + 1).padStart(3)} | #${String(a.rank).padStart(4)} | ${a.name} (${a.id})`);
});

const focus = [
  'VDR_verifierEtParametrerInstance',
  'VDR_recupererLesEvolutionsDemandees',
  'VDR_verifierEtatDuProjet',
  'VDR_planificationVerifierMigrationCsg',
  'VDR_verifierMigrationCsg',
  'VDR_verifierLaQualiteDesDonnees',
  'VDR_realiserLaVisiteTechnique',
  'Activity_0kuin4a',
  'Gateway_11vyw6v',
  'Gateway_146gkue',
  'Gateway_0uzh8cg',
  'Gateway_0ouyvky'
];

console.log('\n=== Focus ranks ===');
focus.forEach((id) => {
  const name = activityNodeNames.get(id) || id;
  console.log(
    `${id} | ${name} | rank=${flowRank.get(id)} visited=${visitedFlow.has(id)} resumed=${resumedPoints.has(id)}`
  );
});

console.log('\n=== Gateway_11vyw6v preds ===');
console.log(
  parallelPredIds('Gateway_11vyw6v').map((p) => `${p} visited=${visitedFlow.has(p)}`)
);
console.log('mergeInputsSatisfied:', mergeInputsSatisfied('Gateway_11vyw6v'));
console.log('out/in Gateway_0ouyvky:', outDeg('Gateway_0ouyvky'), inDeg('Gateway_0ouyvky'));
console.log('out/in Gateway_0uzh8cg:', outDeg('Gateway_0uzh8cg'), inDeg('Gateway_0uzh8cg'));
console.log('out/in Gateway_11vyw6v:', outDeg('Gateway_11vyw6v'), inDeg('Gateway_11vyw6v'));
console.log('out/in Gateway_146gkue:', outDeg('Gateway_146gkue'), inDeg('Gateway_146gkue'));

const csg = activities.find((a) => /migration CSG/i.test(a.name));
const spOps = activities.find((a) => a.id === 'Activity_0kuin4a');
if (csg && spOps) {
  console.log(`\nCSG (#${csg.rank}) ${csg.rank < spOps.rank ? 'BEFORE' : 'AFTER'} SP OPS (#${spOps.rank})`);
}
