/**
 * Master Phase 2 Cross-Platform Verification Runner.
 *
 * Runs all Phase 2 integration verifications sequentially:
 * 1. Markdown AST Serializer & Block Registry Round-Trip
 * 2. Client SQLite Offline Database Engine
 * 3. Real-Time Delta Sync Engine State Machine
 * 4. Pastel Tile Design System & WCAG 2.1 Contrast Ratios
 * 5. Delta Sync Resilience & Multi-Device Conflict Ingestion
 */

import { execSync } from 'child_process';

const steps = [
  { name: 'Extended Markdown AST Serializer', script: 'npx tsx src/core/verify_ast.ts' },
  { name: 'Client Offline SQLite Engine', script: 'npx tsx src/db/verify_db.ts' },
  { name: 'Delta Sync State Machine', script: 'npx tsx src/sync/verify_sync.ts' },
  { name: 'Pastel Tile Design System & Contrast Ratios', script: 'npx tsx src/theme/verify_theme_contrast.ts' },
  { name: 'Delta Sync Resilience & Conflict Ingestion', script: 'npx tsx src/sync/verify_sync_resilience.ts' },
];

console.log('================================================================');
console.log('   SCRIBEX PHASE 2: MASTER CROSS-PLATFORM VERIFICATION SUITE   ');
console.log('================================================================\n');

let passed = 0;
const total = steps.length;

for (const step of steps) {
  process.stdout.write(`Executing: ${step.name}... `);
  try {
    execSync(step.script, { stdio: 'pipe' });
    console.log('[PASSED]');
    passed++;
  } catch (err: any) {
    console.log('[FAILED]');
    console.error(err.stdout?.toString() || err.message);
    process.exit(1);
  }
}

console.log('\n================================================================');
console.log(`   ALL PHASE 2 FRONTEND VERIFICATIONS PASSED (${passed}/${total})   `);
console.log('================================================================\n');
