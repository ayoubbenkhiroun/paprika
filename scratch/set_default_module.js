const fs = require('fs');

// 1. Update js/app.js
let appJs = fs.readFileSync('js/app.js', 'utf8');
const targetVarMod = "let currentModule = 'variables';";
const repVarMod = "let currentModule = 'bpmn-lint';";

if (!appJs.includes(targetVarMod)) {
  console.error('Target in js/app.js not found!');
  process.exit(1);
}
appJs = appJs.replace(targetVarMod, repVarMod);
fs.writeFileSync('js/app.js', appJs, 'utf8');
console.log('Updated js/app.js: default module is now bpmn-lint');

// 2. Update index.html
let html = fs.readFileSync('index.html', 'utf8');

// Header title
const targetTitle = '<h1 id="pageTitle">Importation des données</h1>';
const repTitle = '<h1 id="pageTitle">Audit &amp; Santé BPMN — Import &amp; Analyse</h1>';
if (!html.includes(targetTitle)) {
  console.error('targetTitle not found!');
  process.exit(1);
}
html = html.replace(targetTitle, repTitle);

// Sidebar menu group
const targetGroup = '<div class="menu-group" id="group-bpmn-lint">';
const repGroup = '<div class="menu-group expanded" id="group-bpmn-lint">';
html = html.replace(targetGroup, repGroup);

const targetBtnHeader = '<button id="btn-mod-bpmn-lint" class="menu-header" onclick="switchModule(\'bpmn-lint\')">';
const repBtnHeader = '<button id="btn-mod-bpmn-lint" class="menu-header active" onclick="switchModule(\'bpmn-lint\')">';
html = html.replace(targetBtnHeader, repBtnHeader);

const targetImportTab = '<button class="tab" id="bpmnLintImportTab" onclick="switchTab(\'bpmn-lint-import\')" style="display:none">';
const repImportTab = '<button class="tab active" id="bpmnLintImportTab" onclick="switchTab(\'bpmn-lint-import\')">';
html = html.replace(targetImportTab, repImportTab);

const targetRulesTab = '<button class="tab" id="bpmnLintRulesTab" onclick="switchTab(\'bpmn-lint-rules\')" style="display:none">';
const repRulesTab = '<button class="tab" id="bpmnLintRulesTab" onclick="switchTab(\'bpmn-lint-rules\')">';
html = html.replace(targetRulesTab, repRulesTab);

// Active panel
const targetPanelImport = '<div class="panel active" id="panel-import">';
const repPanelImport = '<div class="panel" id="panel-import">';
html = html.replace(targetPanelImport, repPanelImport);

const targetPanelLint = '<div class="panel" id="panel-bpmn-lint-import">';
const repPanelLint = '<div class="panel active" id="panel-bpmn-lint-import">';
html = html.replace(targetPanelLint, repPanelLint);

// Bump app.js script tag version
html = html.replace('js/app.js?v=2026_c8_v3.0.0', 'js/app.js?v=2026_c8_v3.0.1');

fs.writeFileSync('index.html', html, 'utf8');
console.log('Updated index.html: default active panel and menu are now bpmn-lint-import');

