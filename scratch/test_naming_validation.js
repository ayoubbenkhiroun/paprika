global.window = global;
global.localStorage = { getItem: () => null, setItem: () => {} };
const parser = require('../js/bpmn_parser.js');
global.BpmnZeebeParser = parser;
global.bpmnExtractFeelVariables = parser.extractFeelVariables;
global.bpmnGetProcessContract = parser.getProcessContract;
const linter = require('../js/bpmn_lint.js');

class MockElement {
  constructor(localName, namespaceURI = parser.NS.BPMN, attrs = {}, textContent = '') {
    this.localName = localName;
    this.tagName = (namespaceURI === parser.NS.ZEEBE ? 'zeebe:' : namespaceURI === 'http://camunda.org/schema/1.0/bpmn' ? 'camunda:' : 'bpmn:') + localName;
    this.prefix = namespaceURI === parser.NS.ZEEBE ? 'zeebe' : namespaceURI === 'http://camunda.org/schema/1.0/bpmn' ? 'camunda' : 'bpmn';
    this.namespaceURI = namespaceURI;
    this._attrs = attrs;
    this.attributes = Object.entries(attrs).map(([name, value]) => ({
      name, value, localName: name.split(':').pop()
    }));
    this.textContent = textContent;
    this.children = [];
    this.parentElement = null;
    this.nodeType = 1;
  }
  getAttribute(name) { return this._attrs[name] !== undefined ? this._attrs[name] : null; }
  hasAttribute(name) { return this._attrs[name] !== undefined; }
  appendChild(child) { child.parentElement = this; this.children.push(child); return child; }
  getElementsByTagName(name) {
    const res = [];
    const walk = (node) => {
      for (const ch of node.children) {
        if (name === '*' || ch.localName.toLowerCase() === name.toLowerCase()) res.push(ch);
        walk(ch);
      }
    };
    walk(this);
    return res;
  }
}

function createMockFile(fileName, isParent, processId, processName) {
  const defs = new MockElement('definitions', parser.NS.BPMN);
  const proc = new MockElement('process', parser.NS.BPMN, {
    id: processId,
    name: processName,
    isExecutable: 'true'
  });
  const ext = new MockElement('extensionElements', parser.NS.BPMN);
  ext.appendChild(new MockElement('versionTag', parser.NS.ZEEBE, { value: '1.0.0' }));
  proc.appendChild(ext);
  const start = new MockElement('startEvent', parser.NS.BPMN, { id: 'start', name: 'Début' });
  const end = new MockElement('endEvent', parser.NS.BPMN, { id: 'end', name: 'Fin' });
  const flow = new MockElement('sequenceFlow', parser.NS.BPMN, { id: 'f1', sourceRef: 'start', targetRef: 'end' });
  proc.appendChild(start);
  proc.appendChild(end);
  proc.appendChild(flow);
  defs.appendChild(proc);
  return {
    fileName,
    isParent,
    xmlDoc: {
      documentElement: defs,
      getElementsByTagName: (n) => [defs, ...defs.getElementsByTagName(n)]
    }
  };
}

window.loadBpmnLintRules();

console.log('=== TEST 1: Valid Parent Processes ===');
[
  { id: 'cdd-lps-vdr-avec-ajout-de-couche', name: 'CDD LPs VDR avec ajout de couche' },
  { id: 'cdd-lp-5-1-di-crozon', name: 'CDD LP5.1 DI Crozon' },
  { id: 'cdd-lp-68-05-migration-mo-prov-vers-mo-cible', name: 'CDD LP68.05 Migration MO Prov vers MO Cible' }
].forEach(tc => {
  const file = createMockFile('parent.bpmn', true, tc.id, tc.name);
  const res = window.auditBpmnLintFile(file);
  const errs = res.issues.filter(i => ['process-id-convention', 'process-name-convention', 'process-no-version'].includes(i.ruleId));
  console.log(`Parent [${tc.id}] => issues: ${errs.length}`);
  if (errs.length > 0) {
    console.error(errs);
    throw new Error('Test 1 failed');
  }
});

console.log('\n=== TEST 2: Invalid Parent Processes ===');
{
  const file = createMockFile('parent_bad.bpmn', true, 'process-invalide', 'Nom Invalide Sans LP');
  const res = window.auditBpmnLintFile(file);
  const idIssue = res.issues.find(i => i.ruleId === 'process-id-convention');
  const nameIssue = res.issues.find(i => i.ruleId === 'process-name-convention');
  console.log('Bad parent ID issue found:', !!idIssue, '| Msg:', idIssue?.message);
  console.log('Bad parent Name issue found:', !!nameIssue, '| Msg:', nameIssue?.message);
  if (!idIssue || !nameIssue) throw new Error('Test 2 failed');
}

console.log('\n=== TEST 3: Valid Sub-Processes ===');
[
  { id: 'cdd-sp-autorisation-administrative', name: 'CDD SP Autorisation administrative' },
  { id: 'cdd-sp-autorisation-administrative-vdr-sans-ajout', name: 'CDD SP Autorisation administrative VDR Sans Ajout' },
  { id: 'cdd-sp-autorisation-administrative-di', name: 'CDD SP Autorisation administrative DI' },
  { id: 'cdd-sp-autorisation-administrative-di-ztd', name: 'CDD SP Autorisation administrative DI ZTD' },
  { id: 'cdd-sp-autorisation-administrative', name: 'CDD | SP | Autorisation administrative' }
].forEach(tc => {
  const file = createMockFile('CDD SP Test.bpmn', false, tc.id, tc.name);
  const res = window.auditBpmnLintFile(file);
  const errs = res.issues.filter(i => ['process-id-convention', 'process-name-convention', 'process-no-version'].includes(i.ruleId));
  console.log(`SP [${tc.id}] => issues: ${errs.length}`);
  if (errs.length > 0) {
    console.error(errs);
    throw new Error('Test 3 failed');
  }
});

console.log('\n=== TEST 4: Invalid Sub-Processes ===');
{
  const file = createMockFile('CDD SP Bad.bpmn', false, 'cdd-autorisation', 'CDD Autorisation');
  const res = window.auditBpmnLintFile(file);
  const idIssue = res.issues.find(i => i.ruleId === 'process-id-convention');
  const nameIssue = res.issues.find(i => i.ruleId === 'process-name-convention');
  console.log('Bad SP ID issue found:', !!idIssue, '| Msg:', idIssue?.message);
  console.log('Bad SP Name issue found:', !!nameIssue, '| Msg:', nameIssue?.message);
  if (!idIssue || !nameIssue) throw new Error('Test 4 failed');
}

console.log('\n=== TEST 5: Prohibition of Version in ID or Name ===');
{
  const file = createMockFile('CDD SP Version.bpmn', false, 'cdd-sp-autorisation-v1', 'CDD SP Autorisation V1');
  const res = window.auditBpmnLintFile(file);
  const vIssues = res.issues.filter(i => i.ruleId === 'process-no-version');
  console.log('Version issues count (attendu: 2):', vIssues.length);
  vIssues.forEach(i => console.log('  ->', i.message));
  if (vIssues.length !== 2) throw new Error('Test 5 failed');
}

console.log('\n=== TEST 6: Entity Mismatch between ID and Name ===');
{
  const file = createMockFile('CDD SP Mismatch.bpmn', false, 'cdd-sp-autorisation', 'OPS SP Autorisation');
  const res = window.auditBpmnLintFile(file);
  const mismatchIssue = res.issues.find(i => i.ruleId === 'process-name-convention' && i.message.includes('Incohérence d’entité'));
  console.log('Mismatch issue found:', !!mismatchIssue, '| Msg:', mismatchIssue?.message);
  if (!mismatchIssue) throw new Error('Test 6 failed');
}

console.log('\n🎉 TOUS LES TESTS DE NOMMAGE ET ID DE PROCESSUS SONT VALIDÉS AVEC SUCCÈS (6/6) !');

