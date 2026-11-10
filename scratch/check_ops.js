const fs = require('fs');
const p = 'C:/Users/ayoub.benkhiroun_ama/.gemini/antigravity/brain/85b59ca5-4ab8-4d10-8a38-f2df5db7ede8/.user_uploaded/media_1793782607598_ac1d1466.xml';
const content = fs.readFileSync(p, 'utf8');
const id = 'ops-sp-mettre-a-jour-bases-post-migration';
const start = content.indexOf(`id="${id}"`);
const end = content.indexOf('</bpmn:callActivity>', start) + '</bpmn:callActivity>'.length;
console.log(content.slice(start - 25, end));

