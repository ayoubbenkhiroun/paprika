const fs = require('fs');

let code = fs.readFileSync('js/bpmn_lint.js', 'utf8');

// 1. Bump version key
code = code.replace(/const BPMN_LINT_RULES_KEY = 'auditflow_bpmn_lint_rules_v\d+';/, "const BPMN_LINT_RULES_KEY = 'auditflow_bpmn_lint_rules_v9';");

// 2. Add rules to DEFAULT_BPMN_LINT_RULES
const targetRuleSection = "  // Conventions de Nommage BPMN 2.0 & Sémantique\n  { id: 'process-id-kebab'";
const targetRuleSectionCRLF = "  // Conventions de Nommage BPMN 2.0 & Sémantique\r\n  { id: 'process-id-kebab'";

const newRules = `  // Conventions de Nommage BPMN 2.0 & Sémantique
  { id: 'process-id-convention', label: 'Process ID : Formalisme d’entité et LP/SP ([entité]-[lp(s)/sp]-[nom])', category: 'Nommage', severity: 'error', enabled: true },
  { id: 'process-name-convention', label: 'Nom de processus : Formalisme d’entité et LP/SP ([ENTITÉ] [LP(s)/SP] [Nom])', category: 'Nommage', severity: 'error', enabled: true },
  { id: 'process-no-version', label: 'Processus : Interdiction de numéro de version (v1, v2...) dans l’ID et le nom', category: 'Nommage', severity: 'error', enabled: true },
  { id: 'process-id-kebab'`;

if (code.includes(targetRuleSectionCRLF)) {
  code = code.replace(targetRuleSectionCRLF, newRules.replace(/\n/g, '\r\n'));
} else if (code.includes(targetRuleSection)) {
  code = code.replace(targetRuleSection, newRules);
} else {
  console.error('Target 2 not found');
  process.exit(1);
}

// 3. Add lintDetermineProcessRole helper before lintDescendants
const targetDescendants = 'function lintDescendants(element, localNames) {';
const helperRole = `function lintDetermineProcessRole(process, file) {
  // 1. Statut explicite du fichier (configuré par l'utilisateur ou pré-détecté par le nom de fichier)
  if (file && file.isParent === true) return 'parent';
  if (file && (file.isParent === false || file.isSubProcess === true)) return 'subprocess';
  if (file && /\\bsp\\b|[-_]sp[-_]|^sp[-_]|sous[-_]?processus|subprocess/i.test(file.fileName || file.name || '')) return 'subprocess';

  // 2. Détection par préfixe d'ID
  const id = (lintAttribute(process, ['id']) || '').trim().toLowerCase();
  if (/-sp-|^[a-z0-9]+-sp\\b/.test(id)) return 'subprocess';
  if (/-lps?-|^[a-z0-9]+-lps?\\b/.test(id)) return 'parent';

  // 3. Détection par nom
  const name = (lintAttribute(process, ['name']) || '').trim();
  if (/\\bSP\\b/i.test(name)) return 'subprocess';
  if (/\\bLPs?\\b/i.test(name)) return 'parent';

  return 'parent';
}

function lintDescendants(element, localNames) {`;

if (!code.includes(targetDescendants)) {
  console.error('Target 3 not found');
  process.exit(1);
}
code = code.replace(targetDescendants, code.includes('\r\n') ? helperRole.replace(/\n/g, '\r\n') : helperRole);

// 4. Update isProcessLevel
const targetProcessLevel = "'process-executable', 'process-version-tag'";
const repProcessLevel = "'process-executable', 'process-version-tag', 'process-id-convention', 'process-name-convention', 'process-no-version'";
if (!code.includes(targetProcessLevel)) {
  console.error('Target 4 not found');
  process.exit(1);
}
code = code.replace(targetProcessLevel, repProcessLevel);

// 5. Update lintRemediationPlan
const targetRemediation = "'process-version-tag': ['Renseigner le champ Version Tag du processus avec une version sémantique au format x.X.x (ex: 1.0.0).', 'Équipe Camunda', 'Vérifier dans le Camunda Modeler que le Version Tag est renseigné au format x.X.x et correspond à la version livrée.'],";
const repRemediation = `'process-version-tag': ['Renseigner le champ Version Tag du processus avec une version sémantique au format x.X.x (ex: 1.0.0).', 'Équipe Camunda', 'Vérifier dans le Camunda Modeler que le Version Tag est renseigné au format x.X.x et correspond à la version livrée.'],
    'process-id-convention': ['Renommer l’ID technique du processus selon le formalisme attendu ([entité]-[lp]-[nom] ou [entité]-[sp]-[nom]).', 'Équipe modélisation', 'Vérifier dans le Camunda Modeler que l’ID est en kebab-case et respecte la nomenclature des LPs/SPs.'],
    'process-name-convention': ['Renommer le libellé du processus selon le formalisme attendu ([ENTITÉ] [LP(s)] [Nom] ou [ENTITÉ] SP [Nom]).', 'Product Owner + Camunda', 'Faire confirmer le libellé du processus par les équipes métier et respecter le préfixe d’entité.'],
    'process-no-version': ['Supprimer le numéro de version (v1, v2...) de l’ID et du nom du processus, et renseigner le Version Tag dédié.', 'Équipe Camunda', 'Vérifier que l’ID et le nom restent pérennes et que le versioning est porté par le Version Tag (x.X.x).'],`;

if (!code.includes(targetRemediation)) {
  console.error('Target 5 not found');
  process.exit(1);
}
code = code.replace(targetRemediation, code.includes('\r\n') ? repRemediation.replace(/\n/g, '\r\n') : repRemediation);

// 6. In processes.forEach in auditBpmnLintFile
const targetAuditVersionTag = `      } else if (!/^\\d+\\.\\d+\\.\\d+$/.test(versionTag)) {
        lintAddIssue(issues, 'process-version-tag', process, \`Le Version Tag « \${versionTag} » du processus « \${processName || processId || 'Processus'} » ne respecte pas le format x.X.x (ex: 1.0.0).\`, file.fileName);
      }
    }`;

const auditLogicAddition = `      } else if (!/^\\d+\\.\\d+\\.\\d+$/.test(versionTag)) {
        lintAddIssue(issues, 'process-version-tag', process, \`Le Version Tag « \${versionTag} » du processus « \${processName || processId || 'Processus'} » ne respecte pas le format x.X.x (ex: 1.0.0).\`, file.fileName);
      }
    }

    const isRealProcess = isExec || processFlowNodes.length > 0;
    if (isRealProcess) {
      // 1. Règle : Interdiction de numéro de version (v1, v2...) dans processId ou processName
      if (lintRule('process-no-version')) {
        if (processId) {
          const vMatchId = processId.match(/(?:^|-)(v\\d+(\\.\\d+)*|version-?\\d+)(?:-|$)/i);
          if (vMatchId) {
            lintAddIssue(issues, 'process-no-version', process, \`L’ID de processus « \${processId} » intègre un numéro de version (« \${vMatchId[1]} »). N’intégrez jamais de version dans l’identifiant : le versioning est géré nativement par le moteur via le Version Tag.\`, file.fileName);
          }
        }
        if (processName) {
          const vMatchName = processName.match(/(?:\\b|_|\\()(v\\d+(\\.\\d+)*|version\\s*\\d+)(?:\\b|_|\\))/i);
          if (vMatchName) {
            lintAddIssue(issues, 'process-no-version', process, \`Le nom du processus « \${processName} » intègre un numéro de version (« \${vMatchName[1]} »). N’intégrez jamais de version dans le libellé : le versioning est géré nativement par le moteur via le Version Tag.\`, file.fileName);
          }
        }
      }

      // Détermination du rôle : Processus Parent vs Sous-processus
      const processRole = lintDetermineProcessRole(process, file);

      // Regex de validation des conventions
      const PARENT_ID_REGEX = /^([a-z0-9]+)-(lps|lp(-[0-9]+)+|lp[0-9]+(-[0-9]+)*|lp)-([a-z0-9]+(-[a-z0-9]+)*)$/;
      const PARENT_NAME_REGEX = /^([A-Z0-9]{2,10})\\s+(LPs|LPS|LP\\s*\\d+(\\.\\d+)*|LP\\s*\\d+([-_]\\d+)*|LP)\\s+(.+)$/;
      const SP_ID_REGEX = /^([a-z0-9]+)-sp-([a-z0-9]+(-[a-z0-9]+)*)$/;
      const SP_NAME_REGEX = /^([A-Z0-9]{2,10})\\s*(?:\\|\\s*|\\-\\s*|\\s+)(SP|sp)\\s*(?:\\|\\s*|\\-\\s*|\\s+)(.+)$/;

      // 2. Règle : Format de l'ID (processId)
      let parsedEntityId = null;
      if (lintRule('process-id-convention') && processId) {
        if (processRole === 'parent') {
          const matchId = processId.match(PARENT_ID_REGEX);
          if (!matchId) {
            lintAddIssue(issues, 'process-id-convention', process, \`L’ID du processus parent « \${processId} » ne respecte pas le formalisme attendu [entité]-[lp]-[nom-metier-en-kebab] (ex: cdd-lps-vdr-avec-ajout-de-couche ou cdd-lp-5-1-di-crozon).\`, file.fileName);
          } else {
            parsedEntityId = matchId[1];
          }
        } else {
          const matchId = processId.match(SP_ID_REGEX);
          if (!matchId) {
            lintAddIssue(issues, 'process-id-convention', process, \`L’ID du sous-processus « \${processId} » ne respecte pas le formalisme attendu [entité]-[sp]-[nom-metier-en-kebab] (ex: cdd-sp-autorisation-administrative).\`, file.fileName);
          } else {
            parsedEntityId = matchId[1];
          }
        }
      }

      // 3. Règle : Format du Nom (Display Name)
      if (lintRule('process-name-convention') && processName) {
        let parsedEntityName = null;
        if (processRole === 'parent') {
          const matchName = processName.trim().match(PARENT_NAME_REGEX);
          if (!matchName) {
            lintAddIssue(issues, 'process-name-convention', process, \`Le nom du processus parent « \${processName} » ne respecte pas le formalisme attendu [ENTITÉ] [LP(s)] [Nom du processus] (ex: CDD LPs VDR avec ajout de couche ou CDD LP5.1 DI Crozon).\`, file.fileName);
          } else {
            parsedEntityName = matchName[1];
          }
        } else {
          const matchName = processName.trim().match(SP_NAME_REGEX);
          if (!matchName) {
            lintAddIssue(issues, 'process-name-convention', process, \`Le nom du sous-processus « \${processName} » ne respecte pas le formalisme attendu [ENTITÉ] SP [Nom du SP] (ex: CDD SP Autorisation administrative ou CDD | SP | Autorisation administrative).\`, file.fileName);
          } else {
            parsedEntityName = matchName[1];
          }
        }

        // Contrôle de cohérence entre l'entité de l'ID et l'entité du Nom
        if (parsedEntityId && parsedEntityName && parsedEntityId.toLowerCase() !== parsedEntityName.toLowerCase()) {
          lintAddIssue(issues, 'process-name-convention', process, \`Incohérence d’entité : l’entité du nom (« \${parsedEntityName} ») ne correspond pas à l’entité de l’ID technique (« \${parsedEntityId.toUpperCase()} »).\`, file.fileName);
        }
      }
    }`;

const targetAuditCRLF = targetAuditVersionTag.replace(/\n/g, '\r\n');
if (code.includes(targetAuditCRLF)) {
  code = code.replace(targetAuditCRLF, auditLogicAddition.replace(/\n/g, '\r\n'));
} else if (code.includes(targetAuditVersionTag)) {
  code = code.replace(targetAuditVersionTag, auditLogicAddition);
} else {
  console.error('Target 6 not found');
  process.exit(1);
}

// 7. Add rule knowledge to BPMN_LINT_RULE_KNOWLEDGE
const targetKnowledge = `  "process-version-tag": {`;
const newKnowledge = `  "process-id-convention": {
    "standard": "Charte d'Architecture & Nommage Processus",
    "badge": "Convention ID Processus",
    "explanation": "L'identifiant technique du processus (processId) doit refléter l'entité et le niveau d'orchestration : [entité]-[lp]-[nom-metier-en-kebab] pour un processus parent (ex: cdd-lps-vdr-avec-ajout-de-couche, cdd-lp-5-1-di-crozon), ou [entité]-[sp]-[nom-metier-en-kebab] pour un sous-processus (ex: cdd-sp-autorisation-administrative).",
    "badDesc": "ID de processus sans préfixe d'entité ou sans distinction LP/SP.",
    "badSnippet": "<!-- ❌ Mauvaise Pratique : ID sans formalisme entité/LP/SP -->\\n<bpmn:process id=\\"process-commande\\" isExecutable=\\"true\\">",
    "goodDesc": "ID conforme en kebab-case avec entité et LP/SP.",
    "goodSnippet": "<!-- ✅ Bonne Pratique : ID parent ou sous-processus conforme -->\\n<bpmn:process id=\\"cdd-lp-68-05-migration-mo-prov-vers-mo-cible\\" isExecutable=\\"true\\">\\n<!-- ou pour un SP : id=\\"cdd-sp-autorisation-administrative\\" -->",
    "impact": "🚨 Conflits de déploiement dans le cluster Zeebe, rupture de traçabilité inter-applicative et gouvernance dégradée.",
    "autoFixable": false
  },
  "process-name-convention": {
    "standard": "Charte d'Architecture & Nommage Processus",
    "badge": "Convention Nom Processus",
    "explanation": "Le nom métier (Display Name) doit identifier clairement l'entité et le périmètre : [ENTITÉ] [LP(s)] [Nom du processus] pour un processus parent (ex: CDD LPs VDR avec ajout de couche, CDD LP5.1 DI Crozon), ou [ENTITÉ] SP [Nom du SP] pour un sous-processus (ex: CDD SP Autorisation administrative).",
    "badDesc": "Nom de processus sans entité ou sans mention LP/SP.",
    "badSnippet": "<!-- ❌ Mauvaise Pratique : Nom sans formalisme d'entité -->\\n<bpmn:process id=\\"cdd-sp-changement\\" name=\\"Changement de module\\" isExecutable=\\"true\\">",
    "goodDesc": "Nom de processus conforme avec entité et LP/SP.",
    "goodSnippet": "<!-- ✅ Bonne Pratique : Nom avec entité et LP ou SP -->\\n<bpmn:process id=\\"cdd-sp-changement\\" name=\\"CDD SP Changement module\\" isExecutable=\\"true\\">",
    "impact": "🟡 Manque de lisibilité et confusion dans les tableaux de bord Operate et les rapports métier.",
    "autoFixable": false
  },
  "process-no-version": {
    "standard": "Gouvernance Versioning Camunda 8",
    "badge": "Interdiction Version dans Nom/ID",
    "explanation": "N'intégrez jamais de numéro de version (v1, v2, etc.) dans le processId ou le nom du processus. Le versioning est géré nativement par le moteur Zeebe/Camunda lors du déploiement. Utilisez le champ Version Tag (x.X.x) pour assurer le suivi.",
    "badDesc": "Numéro de version présent dans l'ID ou le nom (ex: cdd-sp-v1, Processus V2).",
    "badSnippet": "<!-- ❌ Mauvaise Pratique : Numéro de version dans l'ID ou le nom -->\\n<bpmn:process id=\\"cdd-sp-autorisation-v1\\" name=\\"CDD SP Autorisation V1\\" isExecutable=\\"true\\">",
    "goodDesc": "Nom et ID stables dans le temps, versioning délégué au Version Tag.",
    "goodSnippet": "<!-- ✅ Bonne Pratique : ID et nom stables + Version Tag -->\\n<bpmn:process id=\\"cdd-sp-autorisation\\" name=\\"CDD SP Autorisation\\" isExecutable=\\"true\\">\\n  <bpmn:extensionElements>\\n    <zeebe:versionTag value=\\"1.0.0\\" />\\n  </bpmn:extensionElements>\\n</bpmn:process>",
    "impact": "🚨 Rupture des historiques dans Optimize et Operate lors des montées de version, prolifération d'identifiants éphémères.",
    "autoFixable": false
  },
  "process-version-tag": {`;

if (!code.includes(targetKnowledge)) {
  console.error('Target 7 not found');
  process.exit(1);
}
code = code.replace(targetKnowledge, code.includes('\r\n') ? newKnowledge.replace(/\n/g, '\r\n') : newKnowledge);

fs.writeFileSync('js/bpmn_lint.js', code, 'utf8');
console.log('Successfully updated js/bpmn_lint.js with all 3 naming convention rules!');

