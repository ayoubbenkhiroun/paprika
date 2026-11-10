const fs = require('fs');
const p = 'C:/Users/ayoub.benkhiroun_ama/.gemini/antigravity/brain/85b59ca5-4ab8-4d10-8a38-f2df5db7ede8/.user_uploaded/media_1793782607598_ac1d1466.xml';
const content = fs.readFileSync(p, 'utf8');
const start = content.indexOf('<bpmn:callActivity id="dci-sp-realiser-audit-dci"');
const end = content.indexOf('</bpmn:callActivity>', start) + '</bpmn:callActivity>'.length;
console.log(content.slice(start, end));

