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

function runAuditOnCallActivity(calledAttrs, outputs = []) {
  const defs = new MockElement('definitions', parser.NS.BPMN);
  const proc = new MockElement('process', parser.NS.BPMN, { id: 'cdd-lp-test-proc', name: 'CDD LP Test Proc', isExecutable: 'true' });
  const extP = new MockElement('extensionElements', parser.NS.BPMN);
  extP.appendChild(new MockElement('versionTag', parser.NS.ZEEBE, { value: '1.0.0' }));
  proc.appendChild(extP);

  const callAct = new MockElement('callActivity', parser.NS.BPMN, { id: 'test-call', name: 'Test Call' });
  const ext = new MockElement('extensionElements', parser.NS.BPMN);
  if (outputs.length > 0) {
    const ioMapping = new MockElement('ioMapping', parser.NS.ZEEBE);
    outputs.forEach(o => ioMapping.appendChild(new MockElement('output', parser.NS.ZEEBE, o)));
    ext.appendChild(ioMapping);
  }
  const calledEl = new MockElement('calledElement', parser.NS.ZEEBE, { processId: 'sub-proc', propagateAllParentVariables: 'false', ...calledAttrs });
  ext.appendChild(calledEl);
  callAct.appendChild(ext);

  const start = new MockElement('startEvent', parser.NS.BPMN, { id: 'start', name: 'Début' });
  const end = new MockElement('endEvent', parser.NS.BPMN, { id: 'end', name: 'Fin' });
  proc.appendChild(start);
  proc.appendChild(callAct);
  proc.appendChild(end);
  proc.appendChild(new MockElement('sequenceFlow', parser.NS.BPMN, { id: 'f1', sourceRef: 'start', targetRef: 'test-call' }));
  proc.appendChild(new MockElement('sequenceFlow', parser.NS.BPMN, { id: 'f2', sourceRef: 'test-call', targetRef: 'end' }));
  defs.appendChild(proc);

  return window.auditBpmnLintFile({
    fileName: 'test.bpmn',
    isParent: true,
    xmlDoc: { documentElement: defs, getElementsByTagName: (n) => [defs, ...defs.getElementsByTagName(n)] }
  });
}

window.loadBpmnLintRules();

console.log('=== TEST 1: User case dci-sp-realiser-audit-dci (outputs defined, childProp omitted) ===');
const res1 = runAuditOnCallActivity({}, [{ source: '=typeSt', target: 'typeSt' }]);
const iss1 = res1.issues.filter(i => i.ruleId === 'call-activity-output-propagation-off');
console.log('Issues trouvées (attendu: 0):', iss1.length);
if (iss1.length !== 0) throw new Error('Test 1 failed');

console.log('\n=== TEST 2: True positive - No outputs and childProp omitted (leaks child vars) ===');
const res2 = runAuditOnCallActivity({}, []);
const iss2 = res2.issues.filter(i => i.ruleId === 'call-activity-output-propagation-off');
console.log('Issues trouvées (attendu: 1):', iss2.length);
if (iss2.length !== 1) throw new Error('Test 2 failed');

console.log('\n=== TEST 3: True positive - Explicit propagateAllChildVariables="true" ===');
const res3 = runAuditOnCallActivity({ propagateAllChildVariables: 'true' }, [{ source: '=x', target: 'x' }]);
const iss3 = res3.issues.filter(i => i.ruleId === 'call-activity-output-propagation-off');
console.log('Issues trouvées (attendu: 1):', iss3.length);
if (iss3.length !== 1) throw new Error('Test 3 failed');

console.log('\n=== TEST 4: Explicit propagateAllChildVariables="false" without outputs ===');
const res4 = runAuditOnCallActivity({ propagateAllChildVariables: 'false' }, []);
const iss4 = res4.issues.filter(i => i.ruleId === 'call-activity-output-propagation-off');
console.log('Issues trouvées (attendu: 0):', iss4.length);
if (iss4.length !== 0) throw new Error('Test 4 failed');

console.log('\n🎉 TOUS LES 4 TESTS SONT VALIDÉS AVEC SUCCÈS !');
