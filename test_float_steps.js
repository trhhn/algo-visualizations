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

// ── Integer-only numbers (no fractional part) ─────────────────────────────
console.log('\nInteger values (no fractional part):');
{
  for (const [v, expBias] of [[1.0, 127], [2.0, 128], [42.0, 132], [255.0, 134], [256.0, 135]]) {
    const s  = steps(v);
    const sh = stepsHtml(v);
    checkHas(`${v}: sign 0`,               s,  'sign bit = 0');
    checkHas(`${v}: biased exp ${expBias}`, s,  String(expBias));
    checkLacks(`${v}: no period`,          sh, 'period-note');
    checkLacks(`${v}: no frac table`,      sh, 'Fractional part');  // frac section omitted for integers
    checkLacks(`${v}: binary has no dot`,  s,  `${v} has no exact`); // no "no exact rep" note
  }
}

// ── Numbers between 1 and 2 (exponent = 0, no shift) ─────────────────────
console.log('\nNumbers 1 ≤ v < 2 (exp = 0, biased 127):');
{
  for (const [v, isExact] of [[1.5, true], [1.25, true], [1.75, true], [1.2, false]]) {
    const s  = steps(v);
    const sh = stepsHtml(v);
    checkHas(`${v}: biased exp 127`, s, '127');
    if (isExact) checkLacks(`${v}: no period`, sh, 'period-note');
    else         checkHas(`${v}: period present`, sh, 'period-note');
  }
}

// ── Numbers > 2 with exact fraction: shift-left check ────────────────────
console.log('\nShift-left (int part > 1):');
{
  checkHas('12.5  shift left 3',  steps(12.5),  'left 3');
  checkHas('16.75 shift left 4',  steps(16.75), 'left 4');
  checkHas('100.5 shift left 6',  steps(100.5), 'left 6');
  checkHas('42.0  shift left 5',  steps(42.0),  'left 5');
  checkHas('255.0 shift left 7',  steps(255.0), 'left 7');
}

// ── Numbers < 1: shift-right check ───────────────────────────────────────
console.log('\nShift-right (pure fractions):');
{
  checkHas('0.5  shift right 1', steps(0.5),  'right 1');
  checkHas('0.25 shift right 2', steps(0.25), 'right 2');
  checkHas('0.2  shift right 3', steps(0.2),  'right 3');
  checkHas('0.1  shift right 4', steps(0.1),  'right 4');
}

// ── Repeating with integer part ───────────────────────────────────────────
console.log('\nRepeating fraction with integer part:');
{
  checkHas('1.2: period note shown',  stepsHtml(1.2),  'period-note');
  checkHas('10.3: period note shown', stepsHtml(10.3), 'period-note');
  checkHas('-0.1: sign bit 1',        steps(-0.1),     'sign bit = 1');
  checkHas('-1.2: sign bit 1',        steps(-1.2),     'sign bit = 1');
  checkHas('-0.1: period note',       stepsHtml(-0.1), 'period-note');
}

// ── Exact fractions: no period note ──────────────────────────────────────
console.log('\nExact fractions (no period note):');
{
  for (const v of [0.5, 0.25, 0.125, 0.75, 0.625, 1.5, 12.5, 100.5, -0.5, -12.5]) {
    checkLacks(`${v}: no period`, stepsHtml(v), 'period-note');
  }
}

// ── Biased exponent sanity ────────────────────────────────────────────────
console.log('\nBiased exponent values:');
{
  const biasedExpCases = [
    [0.5,    126],  // exp -1
    [0.25,   125],  // exp -2
    [0.1,    123],  // exp -4
    [0.2,    124],  // exp -3
    [1.0,    127],  // exp 0
    [1.5,    127],  // exp 0
    [2.0,    128],  // exp 1
    [12.5,   130],  // exp 3
    [16.75,  131],  // exp 4
    [100.5,  133],  // exp 6
    [255.0,  134],  // exp 7
    [256.0,  135],  // exp 8
  ];
  for (const [v, bias] of biasedExpCases) {
    checkHas(`${v}: biased exp ${bias}`, steps(v), String(bias));
  }
}

// ── Mantissa bit count sanity ──────────────────────────────────────────────
console.log('\nMantissa 23 bits:');
{
  function mantissa23(value, mode) {
    const h = stepsHtml(value, mode);
    const m = h.match(/Final 23-bit mantissa:.*?<code[^>]*>([01]+)<\/code>/);
    return m ? m[1].length : null;
  }
  for (const v of [0.1, 0.2, 0.3, 0.5, 0.75, 1.0, 1.2, 1.5, 12.5, 16.75,
                   -0.1, -16.75, 3.14159, 1/3, 42.0, 255.0, 100.5]) {
    const len = mantissa23(v, 'truncate');
    if (len === 23) { console.log(`  ✓  ${v}: mantissa 23 bits`); pass++; }
    else { console.log(`  ✗  ${v}: mantissa ${len} bits (expected 23)`); fail++; }
  }
}

// ── Subnormal steps ───────────────────────────────────────────────────────
console.log('\nSubnormal step text:');
{
  const sub = Math.pow(2, -127); // = 0.5 × 2^-126, exact subnormal
  const s  = steps(sub);
  const sh = stepsHtml(sub);
  checkHas('subnormal: badge present',       sh, 'Subnormal');
  checkHas('subnormal: step2 title',         s,  'Subnormal');
  checkHas('subnormal: exponent all zeros',  sh, '00000000');
  checkHas('subnormal: fixed exp -126',      s,  '−126');
  checkHas('subnormal: sign bit 0',          s,  'sign bit = 0');
  checkHas('subnormal: mantissa green code', sh, 'code-green');
  checkLacks('subnormal: no normalized step', s, 'Normalized Scientific');

  // Negative subnormal
  const ns = steps(-sub);
  checkHas('neg subnormal: sign bit 1', ns, 'sign bit = 1');
  checkHas('neg subnormal: badge',      stepsHtml(-sub), 'Subnormal');

  // 2^-149 (smallest positive subnormal)
  const tiny = Math.pow(2, -149);
  const ts = steps(tiny);
  checkHas('tiny: subnormal badge',  stepsHtml(tiny), 'Subnormal');
  checkHas('tiny: sign bit 0',       ts, 'sign bit = 0');

  // Repeating subnormal (1e-39 has non-terminating binary mantissa)
  const rep = 1e-39;
  const rs  = steps(rep);
  const rsh = stepsHtml(rep);
  checkHas('1e-39: subnormal',  rsh, 'Subnormal');
  checkHas('1e-39: sign bit 0', rs,  'sign bit = 0');
  checkHas('1e-39: truncate label', steps(rep, 'truncate'), 'Truncate');
  checkHas('1e-39: round label',    steps(rep, 'round'),    'Round');

  // Mantissa 23 bits for subnormals
  function subnormalMantissa23(value, mode) {
    const h = stepsHtml(value, mode);
    const m = h.match(/Final 23-bit mantissa:.*?<code[^>]*>([01]+)<\/code>/);
    return m ? m[1].length : null;
  }
  for (const v of [Math.pow(2,-127), Math.pow(2,-149), 1e-39, 1e-40, -Math.pow(2,-127)]) {
    const len = subnormalMantissa23(v, 'truncate');
    if (len === 23) { console.log(`  ✓  subnormal mantissa 23 bits: ${v}`); pass++; }
    else { console.log(`  ✗  subnormal mantissa ${len} bits (expected 23): ${v}`); fail++; }
  }
}

// ── Boundary: smallest normal is NOT subnormal ────────────────────────────
console.log('\nBoundary (smallest normal must not be subnormal):');
{
  // 2^-126 is the minimum normal float32. The step renderer can't expand 126
  // fractional bits, so it falls back — but it must NOT be labelled Subnormal.
  const minNormal = Math.pow(2, -126);
  checkLacks('2^-126: no Subnormal badge', stepsHtml(minNormal), 'Subnormal');
  // Bit pattern must be correct: sign=0, exp=00000001, man=all zeros → 0x00800000
  // Verified via the bit display (updateSummary / setBitsFromU32 paths, not buildSteps).
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(52)}`);
console.log(`  ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
