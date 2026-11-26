// Test propagation logic with both explicit attribute and output mappings
function testPropagation(parentProp, childProp, inputMappingsCount, outputMappingsCount) {
  const isInputPropOff = parentProp === 'false' || (inputMappingsCount > 0 && parentProp !== 'true');
  const isOutputPropOff = childProp === 'false' || (outputMappingsCount > 0 && childProp !== 'true');
  return { isInputPropOff, isOutputPropOff };
}

console.log('Case 1: User case dci-sp-realiser-audit-dci (childProp omitted, 4 outputs)');
const c1 = testPropagation('false', '', 16, 4);
console.log('  isOutputPropOff:', c1.isOutputPropOff, '(expected: true)');

console.log('Case 2: Explicit childProp="false"');
const c2 = testPropagation('false', 'false', 2, 2);
console.log('  isOutputPropOff:', c2.isOutputPropOff, '(expected: true)');

console.log('Case 3: Explicit childProp="true" with outputs (should fail)');
const c3 = testPropagation('false', 'true', 2, 2);
console.log('  isOutputPropOff:', c3.isOutputPropOff, '(expected: false)');

console.log('Case 4: childProp omitted and NO outputs (should fail)');
const c4 = testPropagation('false', '', 2, 0);
console.log('  isOutputPropOff:', c4.isOutputPropOff, '(expected: false)');

console.log('Case 5: childProp="false" and NO outputs (should pass)');
const c5 = testPropagation('false', 'false', 2, 0);
console.log('  isOutputPropOff:', c5.isOutputPropOff, '(expected: true)');

if (c1.isOutputPropOff && c2.isOutputPropOff && !c3.isOutputPropOff && !c4.isOutputPropOff && c5.isOutputPropOff) {
  console.log('\nALL 5 TEST CASES PASSED PERFECTLY!');
} else {
  console.error('\nFAILED!');
  process.exit(1);
}

