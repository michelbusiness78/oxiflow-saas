const fs = require('fs');
const path = require('path');

const roots = [
  path.join(__dirname, '../src/components'),
  path.join(__dirname, '../src/app/(dashboard)'),
];

const exclude = ['marketing', 'LegalLayout'];

const replacements = [
  // Inputs — bg white instead of oxi-bg
  [/bg-oxi-bg([^-])/g, 'bg-white$1'],
  [/bg-oxi-bg$/g, 'bg-white'],
  // Focus rings — thicker + more visible
  [/focus:ring-1 focus:ring-oxi-primary\/20/g, 'focus:ring-2 focus:ring-blue-200'],
  [/focus:ring-oxi-primary\/20/g, 'focus:ring-blue-200'],
  [/focus:ring-1/g, 'focus:ring-2'],
  [/focus:border-oxi-primary/g, 'focus:border-blue-500'],
  // Labels — bolder
  [/\bfont-medium text-oxi-text\b/g, 'font-semibold text-slate-700'],
  [/\btext-sm font-medium text-oxi-text-secondary\b/g, 'text-sm font-semibold text-slate-700'],
  [/\btext-xs font-medium text-oxi-text-secondary\b/g, 'text-xs font-semibold text-slate-700'],
  [/\bfont-medium text-oxi-text-secondary\b/g, 'font-semibold text-slate-700'],
  // Table row hover
  [/hover:bg-oxi-bg\/50/g, 'hover:bg-blue-50'],
  [/hover:bg-oxi-bg/g, 'hover:bg-blue-50'],
  // Primary buttons — direct blue
  [/bg-oxi-primary hover:bg-oxi-primary-hover/g, 'bg-blue-600 hover:bg-blue-700'],
  [/bg-oxi-primary-hover/g, 'bg-blue-700'],
  [/bg-oxi-primary/g, 'bg-blue-600'],
  // Cards — add shadow and explicit borders
  [/border-oxi-border bg-oxi-surface/g, 'border-slate-200 bg-white shadow-sm'],
  [/border-oxi-border-light/g, 'border-slate-100'],
  [/border-oxi-border/g, 'border-slate-200'],
  // Text tokens
  [/text-oxi-primary/g, 'text-blue-600'],
  [/text-oxi-text-muted/g, 'text-slate-400'],
  [/text-oxi-text-secondary/g, 'text-slate-500'],
  [/\btext-oxi-text\b/g, 'text-slate-800'],
  // Surface
  [/bg-oxi-surface/g, 'bg-white'],
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
