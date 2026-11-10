const fs = require('fs');

let code = fs.readFileSync('js/bpmn_lint.js', 'utf8');

const targetSection = `    const parentProp = zeebeCalled ? lintAttribute(zeebeCalled, ['propagateAllParentVariables']) : '';
    const childProp = zeebeCalled ? lintAttribute(zeebeCalled, ['propagateAllChildVariables']) : '';
    const isInputPropOff = parentProp === 'false';
    const isOutputPropOff = childProp === 'false';

    if (zeebeCalled) {
      if (parentProp !== 'false') {
        lintAddIssue(issues, 'call-activity-input-propagation-off', activity, \`La Call Activity « \${actName} » a « Input propagation » activé (propagateAllParentVariables="\${parentProp || 'true (par défaut)'}"). Vous devez désactiver « Propagate all parent process variables » (Off) pour isoler les variables d’entrée.\`, file.fileName);
      }
      if (childProp !== 'false') {
        lintAddIssue(issues, 'call-activity-output-propagation-off', activity, \`La Call Activity « \${actName} » a « Output propagation » activé (propagateAllChildVariables="\${childProp || 'true (par défaut)'}"). Vous devez désactiver « Propagate all child process variables » (Off) pour éviter l’écrasement des variables du processus parent.\`, file.fileName);
      }
    }

    // Camunda 7 legacy check
    const inVarsAll = lintDescendants(activity, ['in']).some(el => lintAttribute(el, ['variables']) === 'all');
    if (inVarsAll) {
      lintAddIssue(issues, 'call-activity-input-propagation-off', activity, \`La Call Activity « \${actName} » propage toutes les variables parentes (<camunda:in variables="all">). Supprimez cette directive et déclarez des mappings de variables explicites.\`, file.fileName);
    }
    const outVarsAll = lintDescendants(activity, ['out']).some(el => lintAttribute(el, ['variables']) === 'all');
    if (outVarsAll) {
      lintAddIssue(issues, 'call-activity-output-propagation-off', activity, \`La Call Activity « \${actName} » propage toutes les variables filles (<camunda:out variables="all">). Supprimez cette directive et déclarez des mappings de variables explicites.\`, file.fileName);
    }

    // Extraction des balises ioMapping Zeebe
    const ioMappingEl = lintDescendants(activity, ['iomapping']).find(el => {
      const p = (el.prefix || '').toLowerCase();
      const tn = (el.tagName || '').toLowerCase();
      return p === 'zeebe' || tn.includes('zeebe:iomapping') || lintLocalName(el) === 'iomapping';
    });

    if (ioMappingEl) {
      lintDescendants(ioMappingEl, ['input']).forEach(inp => {
        const src = lintAttribute(inp, ['source']);
        const tgt = lintAttribute(inp, ['target']);
        if (src || tgt) inputMappings.push({ source: src, target: tgt, element: inp });
      });
      lintDescendants(ioMappingEl, ['output']).forEach(out => {
        const src = lintAttribute(out, ['source']);
        const tgt = lintAttribute(out, ['target']);
        if (src || tgt) outputMappings.push({ source: src, target: tgt, element: out });
      });
    }

    // Extraction des mappings Camunda 7
    lintDescendants(activity, ['in']).forEach(el => {
      const src = lintAttribute(el, ['source', 'sourceExpression']);
      const tgt = lintAttribute(el, ['target']);
      if (src || tgt) inputMappings.push({ source: src, target: tgt, element: el });
    });
    lintDescendants(activity, ['out']).forEach(el => {
      const src = lintAttribute(el, ['source', 'sourceExpression']);
      const tgt = lintAttribute(el, ['target']);
      if (src || tgt) outputMappings.push({ source: src, target: tgt, element: el });
    });`;

const newSection = `    const parentProp = zeebeCalled ? lintAttribute(zeebeCalled, ['propagateAllParentVariables']) : '';
    const childProp = zeebeCalled ? lintAttribute(zeebeCalled, ['propagateAllChildVariables']) : '';

    // Extraction préalable des balises ioMapping Zeebe
    const ioMappingEl = lintDescendants(activity, ['iomapping']).find(el => {
      const p = (el.prefix || '').toLowerCase();
      const tn = (el.tagName || '').toLowerCase();
      return p === 'zeebe' || tn.includes('zeebe:iomapping') || lintLocalName(el) === 'iomapping';
    });

    if (ioMappingEl) {
      lintDescendants(ioMappingEl, ['input']).forEach(inp => {
        const src = lintAttribute(inp, ['source']);
        const tgt = lintAttribute(inp, ['target']);
        if (src || tgt) inputMappings.push({ source: src, target: tgt, element: inp });
      });
      lintDescendants(ioMappingEl, ['output']).forEach(out => {
        const src = lintAttribute(out, ['source']);
        const tgt = lintAttribute(out, ['target']);
        if (src || tgt) outputMappings.push({ source: src, target: tgt, element: out });
      });
    }

    // Extraction des mappings Camunda 7
    lintDescendants(activity, ['in']).forEach(el => {
      const src = lintAttribute(el, ['source', 'sourceExpression']);
      const tgt = lintAttribute(el, ['target']);
      if (src || tgt) inputMappings.push({ source: src, target: tgt, element: el });
    });
    lintDescendants(activity, ['out']).forEach(el => {
      const src = lintAttribute(el, ['source', 'sourceExpression']);
      const tgt = lintAttribute(el, ['target']);
      if (src || tgt) outputMappings.push({ source: src, target: tgt, element: el });
    });

    // En Zeebe / Camunda 8, définir des mappings explicites désactive la propagation automatique globale dans le Modeler et le moteur
    const isInputPropOff = parentProp === 'false' || (inputMappings.length > 0 && parentProp !== 'true');
    const isOutputPropOff = childProp === 'false' || (outputMappings.length > 0 && childProp !== 'true');

    if (zeebeCalled) {
      if (!isInputPropOff) {
        lintAddIssue(issues, 'call-activity-input-propagation-off', activity, \`La Call Activity « \${actName} » a « Input propagation » activé (propagateAllParentVariables="\${parentProp || 'true (par défaut)'}"). Vous devez désactiver « Propagate all parent process variables » (Off) pour isoler les variables d’entrée.\`, file.fileName);
      }
      if (!isOutputPropOff) {
        lintAddIssue(issues, 'call-activity-output-propagation-off', activity, \`La Call Activity « \${actName} » a « Output propagation » activé (propagateAllChildVariables="\${childProp || 'true (par défaut)'}"). Vous devez désactiver « Propagate all child process variables » (Off) pour éviter l’écrasement des variables du processus parent.\`, file.fileName);
      }
    }

    // Camunda 7 legacy check
    const inVarsAll = lintDescendants(activity, ['in']).some(el => lintAttribute(el, ['variables']) === 'all');
    if (inVarsAll) {
      lintAddIssue(issues, 'call-activity-input-propagation-off', activity, \`La Call Activity « \${actName} » propage toutes les variables parentes (<camunda:in variables="all">). Supprimez cette directive et déclarez des mappings de variables explicites.\`, file.fileName);
    }
    const outVarsAll = lintDescendants(activity, ['out']).some(el => lintAttribute(el, ['variables']) === 'all');
    if (outVarsAll) {
      lintAddIssue(issues, 'call-activity-output-propagation-off', activity, \`La Call Activity « \${actName} » propage toutes les variables filles (<camunda:out variables="all">). Supprimez cette directive et déclarez des mappings de variables explicites.\`, file.fileName);
    }`;

const targetCRLF = targetSection.replace(/\n/g, '\r\n');
if (code.includes(targetCRLF)) {
  code = code.replace(targetCRLF, newSection.replace(/\n/g, '\r\n'));
} else if (code.includes(targetSection)) {
  code = code.replace(targetSection, newSection);
} else {
  console.error('Target not found in js/bpmn_lint.js');
  process.exit(1);
}

fs.writeFileSync('js/bpmn_lint.js', code, 'utf8');
console.log('Propagation fix applied successfully to js/bpmn_lint.js!');

