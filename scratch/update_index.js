const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

// Replace table header
const target1 = '<th>Processus</th>\r\n                  <th>État du XML</th>';
const rep1 = '<th>Processus</th>\r\n                  <th style="text-align:center;">Rôle (Processus Parent)</th>\r\n                  <th>État du XML</th>';

if (html.includes(target1)) {
  html = html.replace(target1, rep1);
} else {
  // Try with \n
  const target1_lf = '<th>Processus</th>\n                  <th>État du XML</th>';
  const rep1_lf = '<th>Processus</th>\n                  <th style="text-align:center;">Rôle (Processus Parent)</th>\n                  <th>État du XML</th>';
  html = html.replace(target1_lf, rep1_lf);
}

// Replace note
const target2 = '<p class="bpmn-lint-scope-note">Audit statique complet de structure, qualité sémantique et nommage BPMN.</p>';
const rep2 = '<p class="bpmn-lint-scope-note">Audit statique complet de structure, qualité sémantique et nommage BPMN. Vous pouvez cocher/décocher le statut <strong>Processus Parent</strong> pour chaque fichier (les sous-processus <em>SP</em> sont détectés automatiquement).</p>';
html = html.replace(target2, rep2);

// Bump version
html = html.replace('js/bpmn_lint.js?v=2026_c8_v3.0.2', 'js/bpmn_lint.js?v=2026_c8_v3.0.3');

fs.writeFileSync('index.html', html, 'utf8');
console.log('Update complete!');

