const VERSION_IN_ID_REGEX = /(?:^|-)(v\d+(\.\d+)*|version-?\d+)(?:-|$)/i;
const VERSION_IN_NAME_REGEX = /(?:\b|_|\()(v\d+(\.\d+)*|version\s*\d+)(?:\b|_|\))/i;

const PARENT_ID_REGEX = /^([a-z0-9]+)-(lps|lp(-[0-9]+)+|lp[0-9]+(-[0-9]+)*|lp)-([a-z0-9]+(-[a-z0-9]+)*)$/;
const PARENT_NAME_REGEX = /^([A-Z0-9]{2,10})\s+(LPs|LPS|LP\s*\d+(\.\d+)*|LP\s*\d+([-_]\d+)*|LP)\s+(.+)$/;

const SP_ID_REGEX = /^([a-z0-9]+)-sp-([a-z0-9]+(-[a-z0-9]+)*)$/;
const SP_NAME_REGEX = /^([A-Z0-9]{2,10})\s*(?:\|\s*|\-\s*|\s+)(SP|sp)\s*(?:\|\s*|\-\s*|\s+)(.+)$/;

console.log('--- TEST PARENT IDS ---');
[
  'cdd-lps-vdr-avec-ajout-de-couche',
  'cdd-lp-5-1-di-crozon',
  'cdd-lp-68-05-migration-mo-prov-vers-mo-cible',
  'cdd-lp5-1-di-crozon',
  'cdd-lp-di-crozon'
].forEach(id => {
  console.log(id, '=>', PARENT_ID_REGEX.test(id));
});

console.log('--- TEST PARENT NAMES ---');
[
  'CDD LPs VDR avec ajout de couche',
  'CDD LP5.1 DI Crozon',
  'CDD LP 5.1 DI Crozon',
  'CDD LP68.05 Migration MO Prov vers MO Cible',
  'CDD LP DI Crozon'
].forEach(name => {
  console.log(name, '=>', PARENT_NAME_REGEX.test(name));
});

console.log('--- TEST SP IDS ---');
[
  'cdd-sp-autorisation-administrative',
  'cdd-sp-autorisation-administrative-vdr-sans-ajout',
  'cdd-sp-autorisation-administrative-di',
  'cdd-sp-autorisation-administrative-di-ztd',
  'cdd-sp-changement-module',
  'ops-sp-mettre-a-jour-bases-post-migration'
].forEach(id => {
  console.log(id, '=>', SP_ID_REGEX.test(id));
});

console.log('--- TEST SP NAMES ---');
[
  'CDD SP Autorisation administrative',
  'CDD | SP | Autorisation administrative',
  'CDD - SP - Autorisation administrative',
  'CDD SP Autorisation administrative VDR Sans Ajout',
  'CDD SP Autorisation administrative DI',
  'CDD SP Autorisation administrative DI ZTD',
  'CDD SP Changement module',
  'OPS SP Mettre à jour bases post migration'
].forEach(name => {
  console.log(name, '=>', SP_NAME_REGEX.test(name));
});

console.log('--- TEST VERSION DETECTION ---');
console.log('Should detect version in ID:');
[
  'cdd-lps-vdr-v1',
  'cdd-sp-autorisation-v2',
  'cdd-lp-5-1-di-crozon-version-1',
  'process-v1-0'
].forEach(id => {
  console.log(id, '=>', VERSION_IN_ID_REGEX.test(id));
});

console.log('Should NOT detect version in ID:');
[
  'cdd-lps-vdr-avec-ajout-de-couche',
  'cdd-lp-5-1-di-crozon',
  'cdd-lp-68-05-migration-mo-prov-vers-mo-cible',
  'cdd-sp-autorisation-administrative'
].forEach(id => {
  console.log(id, '=>', !VERSION_IN_ID_REGEX.test(id));
});

console.log('Should detect version in Name:');
[
  'CDD LPs VDR v1',
  'CDD SP Autorisation administrative V2',
  'CDD LP5.1 DI Crozon (v1)',
  'CDD SP Changement module - Version 2',
  'CDD LPs VDR v1.0'
].forEach(name => {
  console.log(name, '=>', VERSION_IN_NAME_REGEX.test(name));
});

console.log('Should NOT detect version in Name:');
[
  'CDD LPs VDR avec ajout de couche',
  'CDD LP5.1 DI Crozon',
  'CDD LP68.05 Migration MO Prov vers MO Cible',
  'CDD SP Autorisation administrative',
  'CDD SP Autorisation administrative VDR Sans Ajout'
].forEach(name => {
  console.log(name, '=>', !VERSION_IN_NAME_REGEX.test(name));
});

