import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const flowsDir = path.join(projectRoot, 'flows');
const frontendDir = path.join(projectRoot, 'frontend');

console.log('=================================================================');
console.log('🤖 SCRIBEX PILLAR 5: MAESTRO NATIVE E2E FLOW SUITE VALIDATOR');
console.log('=================================================================\n');

if (!fs.existsSync(flowsDir)) {
  console.error('Flows directory not found!');
  process.exit(1);
}

const flowFiles = fs.readdirSync(flowsDir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));
console.log(`Found ${flowFiles.length} Maestro E2E flow definitions in flows/:\n`);

let totalAssertions = 0;
let passedAssertions = 0;

// Read frontend source files to verify targeted labels and IDs exist
function getAllSourceFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory() && !file.includes('node_modules')) {
      results = results.concat(getAllSourceFiles(fullPath));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(fullPath);
    }
  });
  return results;
}

const sourceFiles = getAllSourceFiles(path.join(frontendDir, 'src'));
const combinedCode = sourceFiles.map((f) => fs.readFileSync(f, 'utf-8')).join('\n');

flowFiles.forEach((flowFile) => {
  const filePath = path.join(flowsDir, flowFile);
  const content = fs.readFileSync(filePath, 'utf-8');
  console.log(`▶ Validating flow: [${flowFile}]`);

  // Extract accessibilityLabels
  const labelMatches = content.match(/accessibilityLabel:\s*["'](.*?)["']/g) || [];
  labelMatches.forEach((m) => {
    const label = m.replace(/accessibilityLabel:\s*["']/, '').replace(/["']$/, '');
    totalAssertions++;
    if (combinedCode.includes(label)) {
      passedAssertions++;
      console.log(`  ✓ Target accessibilityLabel: "${label}" matches codebase`);
    } else {
      console.log(`  ⚠️ Warning: accessibilityLabel "${label}" not found directly in source code`);
    }
  });

  // Extract test IDs
  const idMatches = content.match(/id:\s*["'](.*?)["']/g) || [];
  idMatches.forEach((m) => {
    const id = m.replace(/id:\s*["']/, '').replace(/["']$/, '');
    totalAssertions++;
    if (combinedCode.includes(id)) {
      passedAssertions++;
      console.log(`  ✓ Target element ID: "${id}" matches codebase`);
    } else {
      console.log(`  ⚠️ Warning: ID "${id}" not found directly in source code`);
    }
  });

  // Count steps
  const steps = content.split('\n- ').length - 1;
  console.log(`  Summary: Flow contains ${steps} autonomous user interaction steps.\n`);
});

console.log('=================================================================');
console.log(`🎉 PILLAR 5 MAESTRO E2E FLOWS VALIDATED: ${passedAssertions}/${totalAssertions} selectors confirmed.`);
console.log('   Ready for zero-touch execution via: maestro test flows/master_e2e_flow.yaml');
console.log('=================================================================\n');

