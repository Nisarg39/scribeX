import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const fe = path.join(root, 'frontend');
const reportPath = path.join(root, 'docs', 'UI_UX_Cross_Platform_Inconsistencies_Report.md');
const read = (...p) => {
  const f = path.join(fe, ...p);
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf-8') : '';
};

console.log('=================================================================');
console.log('🎨 SCRIBEX UI/UX CROSS-PLATFORM AUDIT (Web / iOS / Android)');
console.log('   Viewports: 360, 390, 412 (mobile) · 768 (tablet) · 1280+ (desktop)');
console.log('   Method: static source analysis (no device/browser rendering)');
console.log('=================================================================\n');

const issues = [];
const passes = [];
const add = (i) => { issues.push(i); console.log(`  ❌ [${i.id}] ${i.title}`); };
const ok = (id, msg) => { passes.push({ id, msg }); console.log(`  ✓ [${id}] ${msg}`); };

function walk(dir) {
  let out = [];
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    const st = fs.statSync(full);
    if (st.isDirectory() && f !== 'node_modules') out = out.concat(walk(full));
    else if (/\.tsx?$/.test(f)) out.push(full);
  }
  return out;
}
const files = walk(path.join(fe, 'src')).concat(walk(path.join(fe, 'app')));

// STAGE 1: full-bleed shells
console.log('▶ STAGE 1: Full-bleed screen shells');
const home = read('app', 'home.tsx');
const note = read('app', 'note', '[id].tsx');
if (/rounded-3xl[^"]*border/.test(home)) add({ id: 'UIUX-001', component: 'home.tsx', platforms: ['Web', 'iOS', 'Android'], severity: 'MAJOR', title: 'Card container wraps Home screen', fix: 'Remove rounded/bordered wrapper.' });
else ok('UIUX-001', 'Home screen is full-bleed');
if (/rounded-3xl[^"]*border/.test(note)) add({ id: 'UIUX-002', component: '[id].tsx', platforms: ['Web', 'iOS', 'Android'], severity: 'MAJOR', title: 'Card container wraps Note editor', fix: 'Remove rounded/bordered wrapper.' });
else ok('UIUX-002', 'Note editor is full-bleed');

// STAGE 2: responsive toolbars & safe areas
console.log('\n▶ STAGE 2: Mobile geometry, safe areas, keyboard');
const header = read('src', 'components', 'editor', 'components', 'EditorHeader.tsx');
if (!/useWindowDimensions/.test(header)) add({ id: 'UIUX-003', component: 'EditorHeader', platforms: ['iOS', 'Android'], severity: 'CRITICAL', title: 'Header needs ~670px; Delete/Done clipped on 360–390px phones', fix: 'Compact mode with overflow menu under 640px.' });
else ok('UIUX-003', 'EditorHeader has compact (<640px) mode with overflow menu');

const bar = read('src', 'components', 'editor', 'components', 'EditorCommandBar.tsx');
if (!/<ScrollView[^>]*horizontal/.test(bar)) add({ id: 'UIUX-004', component: 'EditorCommandBar', platforms: ['iOS', 'Android'], severity: 'MAJOR', title: 'Command bar (~660px) overflows phones', fix: 'Wrap in horizontal ScrollView.' });
else ok('UIUX-004', 'EditorCommandBar scrolls horizontally on narrow screens');

const tpl = read('src', 'components', 'editor', 'components', 'TemplatePicker.tsx');
if (/flex-wrap/.test(tpl) && !/ScrollView/.test(tpl)) add({ id: 'UIUX-005', component: 'TemplatePicker', platforms: ['iOS', 'Android'], severity: 'MODERATE', title: 'Template pills wrap to ~4 rows on phones', fix: 'Horizontal swipe track.' });
else ok('UIUX-005', 'TemplatePicker is a single-row swipe track');

const dock = read('src', 'components', 'BottomDock.tsx');
if (!/useSafeAreaInsets/.test(dock)) add({ id: 'UIUX-006', component: 'BottomDock', platforms: ['iOS', 'Android'], severity: 'MAJOR', title: 'Dock ignores bottom safe area / home indicator', fix: 'Offset by insets.bottom.' });
else ok('UIUX-006', 'BottomDock respects safe-area insets');

const editor = read('src', 'components', 'editor', 'BlockEditor.tsx');
if (!/KeyboardAvoidingView/.test(editor)) add({ id: 'UIUX-011', component: 'BlockEditor', platforms: ['iOS', 'Android'], severity: 'MAJOR', title: 'No KeyboardAvoidingView; keyboard hides content', fix: 'Wrap editor in KeyboardAvoidingView.' });
else ok('UIUX-011', 'BlockEditor uses KeyboardAvoidingView');

// STAGE 3: touch targets
console.log('\n▶ STAGE 3: Touch targets (44px) without hitSlop');
let small = 0;
const smallList = [];
for (const f of files) {
  const c = fs.readFileSync(f, 'utf-8');
  for (const m of c.match(/<Pressable[\s\S]*?>/g) || []) {
    const cls = (m.match(/className=(?:"([^"]*)"|\{`([^`]*)`\})/) || [])[1] || (m.match(/className=\{`([^`]*)`\}/) || [])[1] || '';
    if (/\b(w|h)-(3\.5|6|7|8|9)\b/.test(cls) && !/hitSlop/.test(m)) {
      small++;
      smallList.push(path.relative(root, f));
    }
  }
}
console.log(`  Undersized touch targets without hitSlop: ${small}`);
if (small > 0) add({ id: 'UIUX-007', component: 'Various', platforms: ['iOS', 'Android'], severity: 'MODERATE', title: `${small} Pressables <44px without hitSlop`, fix: 'Add hitSlop or enlarge.', detail: [...new Set(smallList)].join(', ') });
else ok('UIUX-007', 'All small Pressables have hitSlop');

// STAGE 4: desktop-only artifacts
console.log('\n▶ STAGE 4: Desktop-only styling artifacts');
let cursor = 0, hoverOnly = 0;
for (const f of files) {
  const c = fs.readFileSync(f, 'utf-8');
  cursor += (c.match(/cursor-pointer/g) || []).length;
  for (const p of c.match(/<Pressable[\s\S]*?>/g) || []) if (/hover:/.test(p) && !/active:|pressed/.test(p)) hoverOnly++;
}
if (cursor > 0) add({ id: 'UIUX-008', component: 'Various', platforms: ['iOS', 'Android'], severity: 'MINOR', title: `${cursor} cursor-pointer classes`, fix: 'Remove.' });
else ok('UIUX-008', 'No cursor-pointer artifacts');
if (hoverOnly > 0) add({ id: 'UIUX-009', component: 'Various', platforms: ['iOS', 'Android'], severity: 'MODERATE', title: `${hoverOnly} Pressables with hover-only feedback`, fix: 'Add active: / pressed feedback.' });
else ok('UIUX-009', 'All hover styles have active/pressed counterpart');

const nv = read('src', 'components', 'NotesView.tsx');
if (/min-h-\[(1[5-9]\d|2\d\d)px\]/.test(nv)) add({ id: 'UIUX-010', component: 'NotesView cards', platforms: ['Web', 'iOS', 'Android'], severity: 'MODERATE', title: 'Note cards taller than 150px', fix: 'Compact layout.' });
else ok('UIUX-010', 'Note cards use compact heights');

// STAGE 4B: native layout-collapse / stretch hazards
console.log('\n▶ STAGE 4B: Native flex hazards (stretching / collapsing layouts)');
let hScrollClass = 0, flexInAuto = 0;
for (const f of files) {
  const c = fs.readFileSync(f, 'utf-8');
  for (const m of c.match(/<ScrollView[^>]*horizontal[^>]*>/g) || []) {
    if (/className="[^"]*(flex-row|\bmb-|\bgap-)/.test(m)) hScrollClass++;
  }
  // flex-1 wrapper inside a card using min-h/justify-between (auto-height) collapses on native
  if (/<View className="flex-1 mb-\d/.test(c) && /justify-between[^"]*shadow/.test(c)) flexInAuto++;
}
if (hScrollClass > 0) add({ id: 'UIUX-012', component: 'Horizontal ScrollViews', platforms: ['iOS', 'Android'], severity: 'MAJOR', title: `${hScrollClass} horizontal ScrollView(s) styled via className (children stretch to tall ovals)`, fix: 'Use style={{flexGrow:0}} + contentContainerStyle for row/gap.' });
else ok('UIUX-012', 'Horizontal ScrollViews use contentContainerStyle and flexGrow:0');
if (flexInAuto > 0) add({ id: 'UIUX-013', component: 'Auto-height cards', platforms: ['iOS', 'Android'], severity: 'MAJOR', title: 'flex-1 content wrapper inside auto-height card collapses and clips text on native', fix: 'Use flexGrow:1 + flexShrink:0.' });
else ok('UIUX-013', 'No flex-1 wrappers inside auto-height cards');

// STAGE 5: report
const status = issues.length === 0 ? 'ALL CLEAR' : `${issues.length} OPEN`;
let md = `# ScribeX UI/UX Cross-Platform Audit Report\n\n> Generated: ${new Date().toISOString()}\n> Method: static source analysis (layout widths are estimates, not rendered measurements)\n> Status: **${status}** · ${passes.length} checks passing\n\n## Open inconsistencies\n\n`;
md += issues.length
  ? '| ID | Component | Platforms | Severity | Issue | Fix |\n|---|---|---|---|---|---|\n' +
    issues.map((i) => `| ${i.id} | ${i.component} | ${i.platforms.join(', ')} | ${i.severity} | ${i.title} | ${i.fix} |`).join('\n') + '\n'
  : '_None._\n';
md += `\n## Passing checks\n\n${passes.map((p) => `- ✅ **${p.id}** ${p.msg}`).join('\n')}\n`;
fs.writeFileSync(reportPath, md);
console.log(`\n▶ STAGE 5: Report written to ${reportPath}`);
console.log(`\n${issues.length === 0 ? '🎉' : '⚠️'} ${issues.length} open · ${passes.length} passing\n`);

