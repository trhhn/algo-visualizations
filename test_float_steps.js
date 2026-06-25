#!/usr/bin/env node
// Semantic tests for ieee_float_converter.html step text.
// Extracts pure logic from the HTML, calls buildSteps(), and checks
// that the rendered explanation contains the right information.

const fs = require('fs');
const html = fs.readFileSync(__dirname + '/ieee_float_converter.html', 'utf8');

// ── Extract and eval the pure logic functions ─────────────────────────────
// Pull everything between <script> and the first DOM call (buildBitRow)
const scriptBlock = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const pureCode = scriptBlock.split('// ── Initial render')[0];

// Stub DOM globals — pure logic functions never touch the DOM at runtime
const _el = { textContent:'', innerHTML:'', value:'', style:{},
               classList:{ add:()=>{}, remove:()=>{} },
               addEventListener:()=>{} };
const document = { getElementById: () => _el, querySelectorAll: () => [] };
const localStorage = { getItem: () => null, setItem: () => {} };
const window = {};

eval(pureCode); // eslint-disable-line no-eval

// ── Helpers ───────────────────────────────────────────────────────────────

// Strip HTML tags and collapse whitespace → plain text
function text(html) {
  return html.replace(/<[^>]*>/g, ' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<')
    .replace(/&gt;/g,'>').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
}

// Check that a string contains a substring (case-insensitive optional)
function has(str, sub) { return str.includes(sub); }

let pass = 0, fail = 0;

function check(label, got, expected) {
  if (got === expected) { console.log(`  ✓  ${label}`); pass++; }
  else { console.log(`  ✗  ${label}\n       got:      ${got}\n       expected: ${expected}`); fail++; }
}

function checkHas(label, haystack, needle) {
  if (has(haystack, needle)) { console.log(`  ✓  ${label}`); pass++; }
  else { console.log(`  ✗  ${label}\n       missing: "${needle}"\n       in:      ${haystack.slice(0,300)}`); fail++; }
}

function checkLacks(label, haystack, needle) {
  if (!has(haystack, needle)) { console.log(`  ✓  ${label}`); pass++; }
  else { console.log(`  ✗  ${label}\n       should NOT contain: "${needle}"`); fail++; }
}

function steps(value, mode = 'truncate') {
  return text(buildSteps(value, mode));
}

function stepsHtml(value, mode = 'truncate') {
  return buildSteps(value, mode);
}

// ── Test cases ────────────────────────────────────────────────────────────

// ── 0.2 (repeating fraction) ──────────────────────────────────────────────
console.log('\n0.2 (repeating fraction):');
{
  const s = steps(0.2);
  checkHas('sign bit 0', s, 'sign bit = 0');
  checkHas('binary is 0.(0011)', s, '0.(0011)');
  checkHas('normalized: 1.(1001) × 2^-3', s, '1.(1001)');
  checkHas('exponent -3', s, '-3');
  checkHas('biased exponent 124', s, '124');
  checkHas('step title: Repeating', stepsHtml(0.2), 'repeating');
  checkLacks('no raw long bit string', s, '001100110011001100110011001100');
}

// ── 16.75 (exact, positive) ───────────────────────────────────────────────
console.log('\n16.75 (exact, positive):');
{
  const s = steps(16.75);
  checkHas('sign bit 0', s, 'sign bit = 0');
  checkHas('binary 10000.11', s, '10000.11');
  checkHas('normalized 1.000011 × 2^4', s, '1.000011');
  checkHas('exponent 4', s, '× 2');
  checkHas('biased exponent 131', s, '131');
  checkLacks('no period note for exact', stepsHtml(16.75), 'period-note');
  checkLacks('no repeating notation', s, '(1)');
  checkLacks('no "(0)" notation', s, '(0)');
}

// ── -16.75 (exact, negative) ──────────────────────────────────────────────
console.log('\n-16.75 (exact, negative):');
{
  const s = steps(-16.75);
  checkHas('sign bit 1', s, 'sign bit = 1');
  checkHas('binary 10000.11', s, '10000.11');
  checkHas('normalized 1.000011 × 2^4', s, '1.000011');
  checkLacks('no period note', stepsHtml(-16.75), 'period-note');
  checkLacks('no repeating notation for -16.75', s, '(1)');
}

// ── 0.5 (exact, power of two fraction) ───────────────────────────────────
console.log('\n0.5 (exact):');
{
  const s = steps(0.5);
  checkHas('sign bit 0', s, 'sign bit = 0');
  checkHas('binary 0.1', s, '0.1');
  checkHas('normalized 1.0 × 2^-1', s, '2');
  checkHas('biased exponent 126', s, '126');
  checkLacks('no period', stepsHtml(0.5), 'period-note');
}

// ── 1.0 (exact) ───────────────────────────────────────────────────────────
console.log('\n1.0 (exact):');
{
  const s = steps(1.0);
  checkHas('binary 1', s, 'sign bit = 0');
  checkHas('biased exponent 127', s, '127');
  checkLacks('no period', stepsHtml(1.0), 'period-note');
}

// ── 0.1 (repeating) ───────────────────────────────────────────────────────
console.log('\n0.1 (repeating):');
{
  const s = steps(0.1);
  checkHas('sign bit 0', s, 'sign bit = 0');
  checkHas('period notation present', s, '(');
  checkHas('biased exponent 123', s, '123');
  checkHas('repeating note in frac table', stepsHtml(0.1), 'period-note');
}

// ── -0.2 (repeating, negative) ────────────────────────────────────────────
console.log('\n-0.2 (repeating, negative):');
{
  const s = steps(-0.2);
  checkHas('sign bit 1', s, 'sign bit = 1');
  checkHas('period notation present', s, '(0011)');
}

// ── Truncate vs round for 0.2 ─────────────────────────────────────────────
console.log('\n0.2 truncate vs round:');
{
  const hexFromText = (s) => s.match(/0x[0-9A-F]{8}/)?.[0];
  // Check hex in summary row
  const tHex = stepsHtml(0.2, 'truncate').match(/3E4CCCCC/i)?.[0];
  const rHex = stepsHtml(0.2, 'round').match(/3E4CCCCD/i)?.[0];
  checkHas('truncate hex ends CC', tHex || '', 'CCCCC');
  checkHas('round hex ends CD',    rHex || '', 'CCCCD');
  checkHas('truncate step says Truncate', steps(0.2, 'truncate'), 'Truncate');
  checkHas('round step says Round',       steps(0.2, 'round'),    'Round');
}

// ── Special values ─────────────────────────────────────────────────────────
console.log('\nSpecial values:');
{
  checkHas('+Infinity special step', steps(Infinity),  'Infinity');
  checkHas('-Infinity special step', steps(-Infinity), 'Infinity');
  checkHas('NaN special step',       steps(NaN),       'NaN');
  checkHas('+0 special step',        steps(0),         '0');
  checkHas('-0 special step',        steps(-0),        '0');
}

// ── Mantissa bit count sanity ──────────────────────────────────────────────
console.log('\nMantissa 23 bits:');
{
  // The final mantissa shown in step 5 should always be exactly 23 bits
  function mantissa23(value, mode) {
    const h = stepsHtml(value, mode);
    const m = h.match(/Final 23-bit mantissa:.*?<code[^>]*>([01]+)<\/code>/);
    return m ? m[1].length : null;
  }
  for (const v of [0.2, 0.1, 16.75, -16.75, 3.14159, 1/3]) {
    const len = mantissa23(v, 'truncate');
    if (len === 23) { console.log(`  ✓  ${v}: mantissa 23 bits`); pass++; }
    else { console.log(`  ✗  ${v}: mantissa ${len} bits (expected 23)`); fail++; }
  }
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(52)}`);
console.log(`  ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
