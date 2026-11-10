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

function createProcessFile(fileName, processAttrs = {}, extensionChildren = [], flowNodes = true) {
  const defs = new MockElement('definitions', parser.NS.BPMN);
  const proc = new MockElement('process', parser.NS.BPMN, {
    id: 'test-proc',
    name: 'Test Process',
    isExecutable: 'true',
    ...processAttrs
  });
  if (extensionChildren.length) {
    const ext = new MockElement('extensionElements', parser.NS.BPMN);
    extensionChildren.forEach(c => ext.appendChild(c));
    proc.appendChild(ext);
  }
  if (flowNodes) {
    const start = new MockElement('startEvent', parser.NS.BPMN, { id: 'start', name: 'Début' });
    const end = new MockElement('endEvent', parser.NS.BPMN, { id: 'end', name: 'Fin' });
    const flow = new MockElement('sequenceFlow', parser.NS.BPMN, { id: 'f1', sourceRef: 'start', targetRef: 'end' });
    proc.appendChild(start);
    proc.appendChild(end);
    proc.appendChild(flow);
  }
  defs.appendChild(proc);
  return {
    fileName,
    xmlDoc: {
      documentElement: defs,
      getElementsByTagName: (n) => [defs, ...defs.getElementsByTagName(n)]
    }
  };
}

window.loadBpmnLintRules();

console.log('=== TEST 1: Process sans Version Tag ===');
const f1 = createProcessFile('proc_no_tag.bpmn');
const res1 = window.auditBpmnLintFile(f1);
const issue1 = res1.issues.find(i => i.ruleId === 'process-version-tag');
console.log('Issue trouvée:', !!issue1, '| Message:', issue1 ? issue1.message : 'NONE');
if (!issue1 || !issue1.message.includes('ne possède aucun Version Tag')) throw new Error('Test 1 failed');

console.log('\n=== TEST 2: Process avec Version Tag invalide (ex: 1.0 ou v1.0.0 ou draft) ===');
const f2 = createProcessFile('proc_invalid_tag.bpmn', { 'versionTag': 'v1.0' });
const res2 = window.auditBpmnLintFile(f2);
const issue2 = res2.issues.find(i => i.ruleId === 'process-version-tag');
console.log('Issue trouvée:', !!issue2, '| Message:', issue2 ? issue2.message : 'NONE');
if (!issue2 || !issue2.message.includes('ne respecte pas le format x.X.x')) throw new Error('Test 2 failed');

console.log('\n=== TEST 3: Process avec attribut camunda:versionTag="1.0.0" (Camunda 7) ===');
const f3 = createProcessFile('proc_c7_tag.bpmn', { 'camunda:versionTag': '1.0.0' });
const res3 = window.auditBpmnLintFile(f3);
const issue3 = res3.issues.find(i => i.ruleId === 'process-version-tag');
console.log('Issue trouvée (attendu: false):', !!issue3);
if (issue3) throw new Error('Test 3 failed');

console.log('\n=== TEST 4: Process avec attribut zeebe:versionTag="2.14.0" (Zeebe attr) ===');
const f4 = createProcessFile('proc_c8_attr.bpmn', { 'zeebe:versionTag': '2.14.0' });
const res4 = window.auditBpmnLintFile(f4);
const issue4 = res4.issues.find(i => i.ruleId === 'process-version-tag');
console.log('Issue trouvée (attendu: false):', !!issue4);
if (issue4) throw new Error('Test 4 failed');

console.log('\n=== TEST 5: Process avec extension <zeebe:versionTag value="1.0.0" /> (Camunda 8 standard) ===');
const zeebeVTag = new MockElement('versionTag', parser.NS.ZEEBE, { value: '1.0.0' });
const f5 = createProcessFile('proc_c8_ext.bpmn', {}, [zeebeVTag]);
const res5 = window.auditBpmnLintFile(f5);
const issue5 = res5.issues.find(i => i.ruleId === 'process-version-tag');
console.log('Issue trouvée (attendu: false):', !!issue5);
if (issue5) throw new Error('Test 5 failed');

console.log('\n=== TEST 6: Black-box Pool externe vide sans flowNodes et isExecutable=false ===');
const f6 = createProcessFile('blackbox_pool.bpmn', { isExecutable: 'false' }, [], false);
const res6 = window.auditBpmnLintFile(f6);
const issue6 = res6.issues.find(i => i.ruleId === 'process-version-tag');
console.log('Issue trouvée sur blackbox pool (attendu: false):', !!issue6);
if (issue6) throw new Error('Test 6 failed');

console.log('\n🎉 TOUS LES TESTS DE VERSION TAG SONT VALIDÉS AVEC SUCCÈS (6/6) !');
