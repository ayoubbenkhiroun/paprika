const fs = require('fs');
const { DOMParser } = require('@xmldom/xmldom');
global.window = global;
global.localStorage = { getItem: () => null, setItem: () => {} };
const parser = require('../js/bpmn_parser.js');
global.BpmnZeebeParser = parser;
global.bpmnExtractFeelVariables = parser.extractFeelVariables;
global.bpmnGetProcessContract = parser.getProcessContract;
const linter = require('../js/bpmn_lint.js');

const p = 'C:/Users/ayoub.benkhiroun_ama/.gemini/antigravity/brain/85b59ca5-4ab8-4d10-8a38-f2df5db7ede8/.user_uploaded/media_1793782607598_ac1d1466.xml';
const xmlStr = fs.readFileSync(p, 'utf8');
const doc = new DOMParser().parseFromString(xmlStr, 'application/xml');

const fileObj = {
  fileName: 'CDD LP68.05 Migration MO Prov vers MO Cible (1).bpmn',
  isParent: true,
  xmlDoc: doc
};

window.loadBpmnLintRules();
const res = window.auditBpmnLintFile(fileObj);

console.log('Total issues:', res.issues.length);
const outputPropIssues = res.issues.filter(i => i.ruleId === 'call-activity-output-propagation-off');
console.log('Output propagation issues count:', outputPropIssues.length);
outputPropIssues.forEach(i => console.log('  ->', i.elementId, i.message));

