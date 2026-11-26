/**
 * Simulation walkFlow unifié (// → OR → XOR, compte outs/ins + sync merge)
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
  processes.find((p) => (p.getAttribute('id') || '').includes('AvecAjout')) || processes[0];
console.log('Process:', procEl.getAttribute('id'));

const activityNodeNames = new Map();
const parallelGatewayIds = new Set();
const exclusiveGatewayIds = new Set();
const inclusiveGatewayIds = new Set();
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
  if (ln === 'exclusivegateway') {
    exclusiveGatewayIds.add(id);
    gatewayNames.set(id, el.getAttribute('name') || '');
    return;
  }
  if (ln === 'inclusivegateway') {
    inclusiveGatewayIds.add(id);
    gatewayNames.set(id, el.getAttribute('name') || '');
    return;
  }
  if (['complexgateway', 'eventbasedgateway'].includes(ln)) {
    gatewayNames.set(id, el.getAttribute('name') || '');
    return;
  }
  if (ln === 'endevent') {
    endEventIds.add(id);
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

const flowRank = new Map();
const visitedFlow = new Set();
const resumedPoints = new Set();
let currentRank = 1;

const outDeg = (id) => (flowAdj.get(id) || []).length;
const inDeg = (id) => (reverseAdj.get(id) || []).length;
const isEndEvent = (id) => endEventIds.has(id);

const gatewayKind = (id) => {
  if (parallelGatewayIds.has(id)) return 'parallel';
  if (inclusiveGatewayIds.has(id)) return 'inclusive';
  if (exclusiveGatewayIds.has(id)) return 'exclusive';
  return null;
};
const isStructGateway = (id) => gatewayKind(id) != null;
const isStructSplit = (id) => isStructGateway(id) && outDeg(id) > 1;
const isStructMerge = (id) => isStructGateway(id) && inDeg(id) > 1;

const isLegacyDecisionSplit = (id) =>
  gatewayNames.has(id) && !isStructGateway(id) && outDeg(id) > 1;
const isLegacyDecisionJoin = (id) =>
  gatewayNames.has(id) && !isStructGateway(id) && inDeg(id) > 1;

const structPredIds = (gwId) =>
  (reverseAdj.get(gwId) || []).map((e) => (e && e.sourceRef) || e).filter(Boolean);

const mergeInputsSatisfied = (mergeId) => {
  const preds = structPredIds(mergeId);
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

const findMatchingLegacyMerge = (splitId, hardStops) => {
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
      if (isStructGateway(n)) continue;
      if (isLegacyDecisionJoin(n)) {
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

let handleStructSplit;
let walkFlow;

const resumeStructPoint = (gwId, stopAt, outerCtx) => {
  if (!gwId || resumedPoints.has(gwId)) return;
  resumedPoints.add(gwId);
  if (isStructSplit(gwId)) {
    handleStructSplit(gwId, stopAt, outerCtx);
    return;
  }
  if (!visitedFlow.has(gwId)) assignFlowNode(gwId);
  sortFlowTargets(flowAdj.get(gwId) || []).forEach((t) => walkFlow(t, stopAt, outerCtx || null));
};

const tryResumeMerge = (mergeId, stopAt, outerCtx) => {
  if (!mergeId || resumedPoints.has(mergeId)) return;
  if (!mergeInputsSatisfied(mergeId)) return;
  resumeStructPoint(mergeId, stopAt, outerCtx);
};

handleStructSplit = (splitId, stopAt, outerCtx) => {
  if (!visitedFlow.has(splitId)) assignFlowNode(splitId);
  const kind = gatewayKind(splitId);
  const outs = sortFlowTargets(flowAdj.get(splitId) || []);
  const resumePts = [];
  const branchCtx = {
    untilMerge: true,
    resumePts,
    splitKind: kind,
    splitOutCount: outs.length,
    parentCtx: outerCtx || null
  };
  outs.forEach((t) => walkFlow(t, stopAt, branchCtx));
  sortFlowTargets(resumePts).forEach((id) => {
    if (isStructMerge(id)) tryResumeMerge(id, stopAt, outerCtx);
    else resumeStructPoint(id, stopAt, outerCtx);
  });
};

const stopBranchAtStructGateway = (nodeId, ctx) => {
  if (!ctx || !ctx.untilMerge || !ctx.resumePts) return false;
  if (!isStructGateway(nodeId)) return false;
  const kind = gatewayKind(nodeId);
  if (kind === ctx.splitKind) {
    pushUnique(ctx.resumePts, nodeId);
    return true;
  }
  let p = ctx.parentCtx;
  while (p) {
    if (p.untilMerge && p.splitKind === kind && p.resumePts) {
      pushUnique(p.resumePts, nodeId);
      return true;
    }
    p = p.parentCtx;
  }
  return false;
};

walkFlow = (nodeId, stopAt, ctx) => {
  if (!nodeId || visitedFlow.has(nodeId)) return;
  if (stopAt && stopAt.has(nodeId)) return;

  if (ctx && ctx.untilMerge && isEndEvent(nodeId)) {
    assignFlowNode(nodeId);
    return;
  }
  if (stopBranchAtStructGateway(nodeId, ctx)) return;

  if (isStructSplit(nodeId)) {
    handleStructSplit(nodeId, stopAt, ctx || null);
    return;
  }
  if (isStructGateway(nodeId)) {
    if (isStructMerge(nodeId)) {
      tryResumeMerge(nodeId, stopAt, ctx || null);
      return;
    }
    assignFlowNode(nodeId);
    sortFlowTargets(flowAdj.get(nodeId) || []).forEach((t) => walkFlow(t, stopAt, ctx));
    return;
  }
  if (isLegacyDecisionSplit(nodeId)) {
    assignFlowNode(nodeId);
    const hardStops = new Set(stopAt || []);
    if (ctx && ctx.resumePts) ctx.resumePts.forEach((j) => hardStops.add(j));
    const mergeId = findMatchingLegacyMerge(nodeId, hardStops);
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

const allStruct = new Set([...parallelGatewayIds, ...inclusiveGatewayIds, ...exclusiveGatewayIds]);
const blockedByPendingMerge = (id) => {
  const preds = structPredIds(id);
  return preds.some((p) => isStructMerge(p) && !resumedPoints.has(p));
};
let guard = 0;
while (guard++ < 50) {
  let progressed = false;
  allStruct.forEach((id) => {
    if (resumedPoints.has(id)) return;
    if (!isStructMerge(id)) return;
    if (!mergeInputsSatisfied(id)) return;
    if (!structPredIds(id).some((p) => visitedFlow.has(p))) return;
    tryResumeMerge(id, null, null);
    progressed = true;
  });
  flowAdj.forEach((_, id) => {
    if (visitedFlow.has(id) || isStructGateway(id)) return;
    if (blockedByPendingMerge(id)) return;
    walkFlow(id, null, null);
    if (visitedFlow.has(id)) progressed = true;
  });
  if (!progressed) break;
}
flowAdj.forEach((_, id) => {
  if (visitedFlow.has(id)) return;
  if (blockedByPendingMerge(id)) return;
  walkFlow(id, null, null);
});
flowAdj.forEach((_, id) => {
  if (!visitedFlow.has(id)) walkFlow(id, null, null);
});

const activities = [...activityNodeNames.entries()]
  .map(([id, name]) => ({ id, name, rank: flowRank.get(id) ?? 999999 }))
  .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));

console.log('\n=== Top activities ===');
activities.slice(0, 15).forEach((a, i) => {
  console.log(`${String(i + 1).padStart(3)} | #${String(a.rank).padStart(4)} | ${a.name}`);
});

const csg = activities.find((a) => a.id === 'VDR_verifierMigrationCsg');
const spOps = activities.find((a) => a.id === 'Activity_0kuin4a');
const visite = activities.find((a) => a.id === 'VDR_realiserLaVisiteTechnique');
console.log('\n=== Focus ===');
console.log('parallel/inclusive/exclusive counts:', parallelGatewayIds.size, inclusiveGatewayIds.size, exclusiveGatewayIds.size);
console.log('CSG', csg && csg.rank, 'Visite', visite && visite.rank, 'SP OPS', spOps && spOps.rank);
console.log('Gateway_11vyw6v resumed', resumedPoints.has('Gateway_11vyw6v'), 'rank', flowRank.get('Gateway_11vyw6v'));
console.log('preds 11vyw6v', structPredIds('Gateway_11vyw6v').map((p) => `${p}:${visitedFlow.has(p)}`));
if (csg && spOps) console.log(`CSG ${csg.rank < spOps.rank ? 'BEFORE' : 'AFTER'} SP OPS`);
