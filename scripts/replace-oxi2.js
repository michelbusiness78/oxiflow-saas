const fs = require('fs');
const path = require('path');

const roots = [
  path.join(__dirname, '../src/components'),
  path.join(__dirname, '../src/app/(dashboard)'),
];

const exclude = ['marketing', 'LegalLayout'];

const replacements = [
  // Fix corrupted classes from previous run
  [/text-slate-700-secondary/g, 'text-slate-500'],
  [/bg-blue-600-light/g, 'bg-blue-50'],

  // Remaining focus ring patterns (without ring-2 prefix)
  [/focus:ring-oxi-primary/g, 'focus:ring-blue-200'],

  // hover:bg-oxi-border → hover:bg-slate-100 (used as button filter toggles)
  [/hover:bg-oxi-border/g, 'hover:bg-slate-100'],

  // divide-oxi-border → divide-slate-200
  [/divide-oxi-border/g, 'divide-slate-200'],

  // border-l-oxi-border → border-l-slate-200
  [/border-l-oxi-border/g, 'border-l-slate-200'],

  // border-oxi-primary (tabs active, focus) → border-blue-600
  [/border-oxi-primary/g, 'border-blue-600'],

  // bg-oxi-border (progress bars, dividers) → bg-slate-200
  [/bg-oxi-border/g, 'bg-slate-200'],

  // accent-oxi-primary → accent-blue-600
  [/accent-oxi-primary/g, 'accent-blue-600'],

  // bg-oxi-text-secondary, bg-oxi-text-muted (dots, etc.)
  [/bg-oxi-text-secondary/g, 'bg-slate-400'],
  [/bg-oxi-text-muted/g, 'bg-slate-300'],
  [/bg-oxi-success/g, 'bg-green-500'],

  // oxi-primary/20 (faint blue borders)
  [/border-oxi-primary\/20/g, 'border-blue-200'],

  // kanban/tabs: border-oxi-primary already replaced, catch text-blue-600 (oxi already done)
];

let totalFiles = 0;
let totalReplacements = 0;
const changed = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!exclude.includes(entry.name)) walk(full);
    } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
      processFile(full);
    }
  }
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;
  let count = 0;
  for (const [pattern, replacement] of replacements) {
    const before = content;
    content = content.replace(pattern, replacement);
    if (content !== before) count++;
  }
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    totalFiles++;
    totalReplacements += count;
    changed.push(path.relative(path.join(__dirname, '..'), filePath) + ` (${count} patterns)`);
  }
}

for (const root of roots) walk(root);

console.log(`\nDone: ${totalFiles} files modified, ${totalReplacements} pattern matches replaced.\n`);
changed.forEach(f => console.log('  ✓', f));
