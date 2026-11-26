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
    this.tagName = (namespaceURI === parser.NS.ZEEBE ? 'zeebe:' : 'bpmn:') + localName;
    this.prefix = namespaceURI === parser.NS.ZEEBE ? 'zeebe' : 'bpmn';
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

const defs = new MockElement('definitions', parser.NS.BPMN);
const proc = new MockElement('process', parser.NS.BPMN, { id: 'cdd-sp-changement-modules', name: 'CDD SP Changement module', isExecutable: 'true' });
const start = new MockElement('startEvent', parser.NS.BPMN, { id: 'start', name: 'Dossier reçu' });
const userTask = new MockElement('userTask', parser.NS.BPMN, { id: 'ut-changer-module-perimetre-entreprise', name: 'Changer le module pour le Périmètre Entreprise' });
const ext = new MockElement('extensionElements', parser.NS.BPMN);
const zeebeUserTask = new MockElement('userTask', parser.NS.ZEEBE);
const assignDef = new MockElement('assignmentDefinition', parser.NS.ZEEBE, { candidateGroups: '=["DTF", "BUILD_FIXE"]' });
ext.appendChild(zeebeUserTask);
ext.appendChild(assignDef);
userTask.appendChild(ext);
const end = new MockElement('endEvent', parser.NS.BPMN, { id: 'end', name: 'Module changé' });

proc.appendChild(start);
proc.appendChild(userTask);
proc.appendChild(end);
proc.appendChild(new MockElement('sequenceFlow', parser.NS.BPMN, { id: 'f1', sourceRef: 'start', targetRef: 'ut-changer-module-perimetre-entreprise' }));
proc.appendChild(new MockElement('sequenceFlow', parser.NS.BPMN, { id: 'f2', sourceRef: 'ut-changer-module-perimetre-entreprise', targetRef: 'end' }));
defs.appendChild(proc);

window.loadBpmnLintRules();

console.log('--- TEST 1: Sub-process with SP filename ---');
const fileObjSP = { fileName: 'CDD SP Changement module.bpmn', xmlDoc: { documentElement: defs, getElementsByTagName: (n) => [defs, ...defs.getElementsByTagName(n)] } };
const resSP = window.auditBpmnLintFile(fileObjSP);
console.log('SP file isParent:', fileObjSP.isParent);
console.log('SP issues count:', resSP.issues.length);
resSP.issues.forEach(i => console.log('  Issue:', i.ruleId, i.message));

console.log('\n--- TEST 2: Processus Parent explicit (isParent: true) ---');
const fileObjParent = { fileName: 'CDD LP68.05 Migration MO Prov vers MO Cible.bpmn', isParent: true, xmlDoc: { documentElement: defs, getElementsByTagName: (n) => [defs, ...defs.getElementsByTagName(n)] } };
const resParent = window.auditBpmnLintFile(fileObjParent);
console.log('Parent file isParent:', fileObjParent.isParent);
console.log('Parent issues count:', resParent.issues.length);
resParent.issues.forEach(i => console.log('  Issue:', i.ruleId, i.message));
