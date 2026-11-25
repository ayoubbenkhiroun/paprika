const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'index.html');
let s = fs.readFileSync(p, 'utf8');

if (s.includes('id="pmgPlatformVersionStep"')) {
  console.log('already present');
  process.exit(0);
}

const marker = '<label class="input-label">Acronymes / Badges projet (En-tête Excel)</label>';
const mi = s.indexOf(marker);
if (mi < 0) {
  console.error('marker not found');
  process.exit(1);
}

const formGroupStart = s.lastIndexOf('<div class="form-group" style="margin:0">', mi);
if (formGroupStart < 0) {
  console.error('form-group start not found');
  process.exit(1);
}

const block = `                      <div class="form-group" style="margin:0">
                        <label class="input-label">Version plateforme Camunda</label>
                        <div class="pmg-editable-wrap">
                          <input type="text" id="pmgPlatformVersionStep" class="pmg-input-field" value=""
                            placeholder="Ex: Camunda Cloud 8.8.0" readonly onblur="lockPmgEditableField(this)" oninput="syncPmgStep1Metadata()"
                            title="modeler:executionPlatform + modeler:executionPlatformVersion">
                          <button type="button" class="pmg-edit-toggle" onclick="event.preventDefault(); togglePmgEditableField(this);" title="modifier ce champ" aria-label="modifier ce champ">✏️</button>
                        </div>
                      </div>
`;

s = s.slice(0, formGroupStart) + block + s.slice(formGroupStart);
fs.writeFileSync(p, s);
console.log('inserted ok at', formGroupStart);
