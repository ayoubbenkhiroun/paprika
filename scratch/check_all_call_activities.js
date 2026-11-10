const fs = require('fs');
const p = 'C:/Users/ayoub.benkhiroun_ama/.gemini/antigravity/brain/85b59ca5-4ab8-4d10-8a38-f2df5db7ede8/.user_uploaded/media_1793782607598_ac1d1466.xml';
const content = fs.readFileSync(p, 'utf8');

const regex = /<bpmn:callActivity[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/bpmn:callActivity>/g;
let match;
while ((match = regex.exec(content)) !== null) {
  const id = match[1];
  const body = match[2];
  const calledEl = body.match(/<zeebe:calledElement[^>]*\/>/)?.[0] || 'NONE';
  const hasOutputs = body.includes('<zeebe:output ');
  console.log(`ID: ${id}`);
  console.log(`  calledElement: ${calledEl}`);
  console.log(`  hasOutputs: ${hasOutputs}`);
}

