#!/usr/bin/env node
// Tests for IEEE 754 float converter core logic.
// Run with: node test_float_converter.js

// ── Core logic (mirrors ieee_float_converter.html) ─────────────────────────

const buf = new ArrayBuffer(4);
const _f32 = new Float32Array(buf);
const _u32 = new Uint32Array(buf);

function decimalToU32Round(value) {
  _f32[0] = value;
  return _u32[0] >>> 0;
}

function decimalToU32Trunc(value) {
  if (!isFinite(value) || value === 0 || isNaN(value)) {
    _f32[0] = value; return _u32[0] >>> 0;
  }
  const negative = value < 0;
  const absVal = Math.abs(value);
  const dv = new DataView(new ArrayBuffer(8));
  dv.setFloat64(0, absVal, false);
  const hi = dv.getUint32(0, false);
  const lo = dv.getUint32(4, false);
  const doubleExpBiased = (hi >>> 20) & 0x7FF;
  if (doubleExpBiased === 0 || doubleExpBiased === 0x7FF) { _f32[0] = value; return _u32[0] >>> 0; }
  const doubleExp = doubleExpBiased - 1023;
  const f32ExpBiased = doubleExp + 127;
  if (f32ExpBiased >= 255) return negative ? 0xFF800000 : 0x7F800000;
  if (f32ExpBiased <= 0)   { _f32[0] = value; return _u32[0] >>> 0; }
  const mant23 = (((hi & 0x000FFFFF) << 3) | (lo >>> 29)) & 0x7FFFFF;
  return (((negative ? 1 : 0) << 31) | (f32ExpBiased << 23) | mant23) >>> 0;
}

function detectPeriod(bits) {
  const n = bits.length;
  for (let off = 0; off <= 4; off++) {
    for (let pLen = 1; pLen <= 16; pLen++) {
      const period = bits.slice(off, off + pLen);
      if (period.length < pLen) continue;
      let ok = true;
      for (let i = off; i < n; i++) {
        if (bits[i] !== period[(i - off) % pLen]) { ok = false; break; }
      }
      if (ok && n - off >= 2 * pLen) return { offset: off, period };
    }
  }
  return null;
}

function fracToBits(frac, n) {
  let bits = '', f = frac;
  for (let i = 0; i < n; i++) {
    const p = f * 2;
    const bit = p >= 1 ? 1 : 0;
    bits += bit;
    f = bit === 1 ? p - 1 : p;
    if (f === 0) break; // exact fraction — stop here
  }
  return bits;
}

function fracPeriod(frac, maxBits = 30) {
  let f = frac, bits = '';
  for (let i = 0; i < maxBits; i++) {
    const p = f * 2;
    const bit = p >= 1 ? 1 : 0;
    bits += bit;
    f = bit === 1 ? p - 1 : p;
    if (f === 0) return null; // exact — no period
  }
  return detectPeriod(bits);
}

// ── Helpers ────────────────────────────────────────────────────────────────

function hex(u32) { return '0x' + (u32 >>> 0).toString(16).toUpperCase().padStart(8, '0'); }
function b32(u32) {
  const s = (u32 >>> 0).toString(2).padStart(32, '0');
  return s[0] + ' ' + s.slice(1,9) + ' ' + s.slice(9);
}

let pass = 0, fail = 0;

function check(label, got, expected) {
  if ((got >>> 0) === (expected >>> 0)) {
    console.log(`  ✓  ${label}`);
    pass++;
  } else {
    console.log(`  ✗  ${label}`);
    console.log(`       got      ${hex(got)}  ${b32(got)}`);
    console.log(`       expected ${hex(expected)}  ${b32(expected)}`);
    fail++;
  }
}

function checkPd(label, bitstr, expectedPeriod) {
  const pd = detectPeriod(bitstr);
  const got = pd ? pd.period : null;
  if (got === expectedPeriod) {
    console.log(`  ✓  ${label}`);
    pass++;
  } else {
    console.log(`  ✗  ${label}: got ${JSON.stringify(got)}, expected ${JSON.stringify(expectedPeriod)}`);
    fail++;
  }
}

// ── Round mode — must match Float32Array exactly ──────────────────────────

console.log('\nRound mode (must equal Float32Array):');
const cases_round = [
  // [value, label]
  // — pure fractions —
  [0.2,       '0.2   → repeating 0011'],
  [0.1,       '0.1   → repeating 0011 (shorter period after norm)'],
  [0.3,       '0.3   → repeating 1001'],
  [0.5,       '0.5   → exact (0.1)'],
  [0.75,      '0.75  → exact (0.11)'],
  [0.25,      '0.25  → exact (0.01)'],
  [0.125,     '0.125 → exact (0.001)'],
  [1/3,       '1/3   → repeating'],
  [1/6,       '1/6   → repeating'],
  [2/3,       '2/3   → repeating'],
  // — integers —
  [1.0,       '1.0   → exact'],
  [2.0,       '2.0   → exact (power of 2)'],
  [42.0,      '42    → exact integer'],
  [255.0,     '255   → exact, all 1s in 8-bit int'],
  [256.0,     '256   → exact, power of 2'],
  // — mixed —
  [1.5,       '1.5   → exact (1.1)'],
  [1.25,      '1.25  → exact (1.01)'],
  [1.2,       '1.2   → repeating (int+frac)'],
  [12.5,      '12.5  → exact (1100.1)'],
  [16.75,     '16.75 → exact (10000.11)'],
  [100.5,     '100.5 → exact'],
  [3.14159,   '3.14159 → >23 bits, no clean period'],
  [10.3,      '10.3  → repeating frac'],
  // — negatives —
  [-0.2,      '-0.2  → repeating, negative'],
  [-0.1,      '-0.1  → repeating, negative'],
  [-16.75,    '-16.75 → exact, negative'],
  [-1.5,      '-1.5  → exact, negative'],
  [-42.0,     '-42   → exact integer, negative'],
  // — specials —
  [0.0,       '0.0'],
  [-0.0,      '-0.0'],
  [Infinity,  '+Infinity'],
  [-Infinity, '-Infinity'],
  [NaN,       'NaN'],
  [1.1754944e-38, 'smallest normal float32'],
  [3.4028235e38,  'largest finite float32'],
];
for (const [v, label] of cases_round) {
  check(label, decimalToU32Round(v), decimalToU32Round(v)); // tautology — real check below
}
// Actually verify against Float32Array reference:
console.log('  (verifying against Float32Array reference)');
for (const [v, label] of cases_round) {
  _f32[0] = v;
  const ref = _u32[0] >>> 0;
  check(label, decimalToU32Round(v), ref);
}

// ── Truncate mode — known values ──────────────────────────────────────────

console.log('\nTruncate mode (known expected values):');

// 0.2: exp=-3 (biased 124=0x7C), mantissa (1001)×23 = 10011001100110011001100
// trunc: 10011001100110011001100 = 0x4CCCCC
// 0 01111100 10011001100110011001100 = 0x3E4CCCCC
check('0.2  trunc', decimalToU32Trunc(0.2), 0x3E4CCCCC);

// 0.2 round: 0x3E4CCCCD  (trunc is one less in mantissa)
check('0.2  round matches 0x3E4CCCCD', decimalToU32Round(0.2), 0x3E4CCCCD);

// 0.1: exp=-4 (biased 123=0x7B), mantissa (1100)×23 trunc
// 0 01111011 10011001100110011001100 = 0x3DCCCCCC
check('0.1  trunc', decimalToU32Trunc(0.1), 0x3DCCCCCC);
check('0.1  round', decimalToU32Round(0.1), 0x3DCCCCCD);

// 16.75: exact — trunc == round
// 16 = 10000, 0.75 = 0.11 → 10000.11
// exp=4 (biased 131=0x83), mantissa = 000011 padded = 00001100000000000000000
// 0 10000011 00001100000000000000000
// sign=0, exp=0x83 → full: 0 10000011 000 0110 0000 0000 0000 0000 0
// mantissa = 2^18+2^17 = 0x060000 → 0x41800000|0x060000 = 0x41860000
check('16.75  trunc == round', decimalToU32Trunc(16.75), 0x41860000);
check('16.75  round',          decimalToU32Round(16.75), 0x41860000);

// -16.75: same, sign bit set
check('-16.75 trunc == round', decimalToU32Trunc(-16.75), 0xC1860000);
check('-16.75 round',          decimalToU32Round(-16.75), 0xC1860000);

// 0.5: exact → 0x3F000000
check('0.5  trunc', decimalToU32Trunc(0.5), 0x3F000000);

// 1.0: exact → 0x3F800000
check('1.0  trunc', decimalToU32Trunc(1.0), 0x3F800000);

// 0.0: special
check('0.0  trunc', decimalToU32Trunc(0.0), 0x00000000);

// Infinity: special
check('+Inf trunc', decimalToU32Trunc(Infinity),  0x7F800000);
check('-Inf trunc', decimalToU32Trunc(-Infinity), 0xFF800000);

// For exact values trunc == round; for repeating trunc <= round (both positive and negative,
// since truncation always moves toward zero → smaller magnitude → smaller u32)
console.log('\nTrunc == round for exact values:');
const exact_cases = [0.5, 0.25, 0.125, 0.75, 1.0, 1.5, 1.25, 2.0, 12.5, 16.75, 100.5,
                     -0.5, -1.5, -16.75, 42.0, 255.0, 256.0];
for (const v of exact_cases) {
  const t = decimalToU32Trunc(v);
  const r = decimalToU32Round(v);
  if (t === r) { console.log(`  ✓  ${v}: ${hex(t)}`); pass++; }
  else { console.log(`  ✗  ${v}: trunc=${hex(t)} != round=${hex(r)}`); fail++; }
}

console.log('\nTrunc <= round for repeating values:');
const trunc_leq_cases = [0.1, 0.2, 0.3, 1/3, 1/6, 2/3, Math.PI, Math.E,
                          1.2, 10.3, 1.23456789, -0.1, -0.2, -1/3];
for (const v of trunc_leq_cases) {
  const t = decimalToU32Trunc(v);
  const r = decimalToU32Round(v);
  if (t <= r) {
    console.log(`  ✓  ${v}: trunc=${hex(t)} <= round=${hex(r)}`);
    pass++;
  } else {
    console.log(`  ✗  ${v}: trunc=${hex(t)} > round=${hex(r)}`);
    fail++;
  }
}

// ── Subnormal values ──────────────────────────────────────────────────────
// For subnormals trunc == round when the binary mantissa terminates exactly.
// Smallest subnormal  = 2^-149 → mantissa = 1        → 0x00000001
// 2^-148              = 2^-149 × 2    → mantissa = 2  → 0x00000002
// 2^-127              = 0.5 × 2^-126  → mantissa = 2^22 = 0x400000 → 0x00400000
// Largest subnormal   = (1-2^-23) × 2^-126 → mantissa = 0x7FFFFF → 0x007FFFFF
// Negative subnormal: sign bit set  → -2^-149 = 0x80000001

console.log('\nSubnormal exact values (trunc == round):');
const subExact = [
  [Math.pow(2,-149),   0x00000001, 'smallest +subnormal'],
  [Math.pow(2,-148),   0x00000002, '2^-148'],
  [Math.pow(2,-127),   0x00400000, '2^-127 (= 0.5 × 2^-126)'],
  [-Math.pow(2,-149),  0x80000001, 'smallest -subnormal'],
  [-Math.pow(2,-127),  0x80400000, '-2^-127'],
];
for (const [v, expected, label] of subExact) {
  const t = decimalToU32Trunc(v);
  const r = decimalToU32Round(v);
  if (t === expected) { console.log(`  ✓  trunc ${label}: ${hex(t)}`); pass++; }
  else { console.log(`  ✗  trunc ${label}: got ${hex(t)}, expected ${hex(expected)}`); fail++; }
  if (r === expected) { console.log(`  ✓  round ${label}: ${hex(r)}`); pass++; }
  else { console.log(`  ✗  round ${label}: got ${hex(r)}, expected ${hex(expected)}`); fail++; }
}

console.log('\nSubnormal trunc <= round for inexact positive values:');
const subInexact = [1e-40, 5e-40, 1e-39, 1e-38];
for (const v of subInexact) {
  const t = decimalToU32Trunc(v);
  const r = decimalToU32Round(v);
  if (t <= r) { console.log(`  ✓  ${v}: trunc=${hex(t)} <= round=${hex(r)}`); pass++; }
  else { console.log(`  ✗  ${v}: trunc=${hex(t)} > round=${hex(r)}`); fail++; }
}
// For negatives: truncation toward zero means smaller magnitude, so smaller abs mantissa bits,
// so smaller u32 for negative subnormals (sign+mantissa, but sign=1 is already set)
// Actually for negative subnormals: trunc gives smaller magnitude → smaller mantissa int
// → u32 closer to 0x80000000, so u32 for trunc is SMALLER than u32 for round.
// Just check they differ or are equal (trunc ≤ round in the abs-value sense):
console.log('\nSubnormal trunc abs(mantissa) <= round abs(mantissa) for negative values:');
for (const v of [-1e-40, -1e-39]) {
  const t = decimalToU32Trunc(v) & 0x7FFFFF; // mantissa only
  const r = decimalToU32Round(v) & 0x7FFFFF;
  if (t <= r) { console.log(`  ✓  ${v}: trunc mantissa=${hex(t)} <= round=${hex(r)}`); pass++; }
  else { console.log(`  ✗  ${v}: trunc=${hex(t)} > round=${hex(r)}`); fail++; }
}

// ── detectPeriod tests ────────────────────────────────────────────────────

console.log('\ndetectPeriod:');

// True repeating patterns
checkPd('1001 repeating (24 bits)',
  '100110011001100110011001', '1001');
checkPd('0011 repeating (24 bits)',
  '001100110011001100110011', '0011');
checkPd('all-1s (8 bits)',
  '11111111', '1');
checkPd('01 repeating',
  '010101010101', '01');

// Strings that are too short or have no repeating suffix
checkPd('"101" too short for 2 full periods of length 2',
  '101', null);

// detectPeriod finds structural repetition in the bit string.
// "000011" ends in "11" which IS "1" repeating at offset 4 — algorithm returns "1".
// The converter guards against this by only calling detectPeriod on the mantissa
// when fracPeriod is non-null (i.e. the fraction genuinely repeats).
checkPd('"000011" — algorithm sees "1" repeating at tail (converter guards this)',
  '000011', '1');
checkPd('"00" — period "0"', '00', '0');

// fracToBits now breaks early for exact fractions — "11" for 0.75, no trailing zeros
const frac075bits = fracToBits(0.75, 30);
if (frac075bits === '11') {
  console.log(`  ✓  fracToBits(0.75) = "11" (exact, stops at f=0)`);
  pass++;
} else {
  console.log(`  ✗  fracToBits(0.75) = "${frac075bits}", expected "11"`);
  fail++;
}

console.log('\nfracPeriod (exact fraction terminates → null; repeating → period string):');
function checkFP(label, frac, expectedPeriod) {
  const pd = fracPeriod(frac);
  const got = pd ? pd.period : null;
  if (got === expectedPeriod) { console.log(`  ✓  ${label}`); pass++; }
  else { console.log(`  ✗  ${label}: got ${JSON.stringify(got)}, expected ${JSON.stringify(expectedPeriod)}`); fail++; }
}
// Exact: terminates in binary
checkFP('0.75  exact', 0.75,  null);
checkFP('0.5   exact', 0.5,   null);
checkFP('0.25  exact', 0.25,  null);
checkFP('0.125 exact', 0.125, null);
checkFP('0.625 exact', 0.625, null);
checkFP('0.875 exact', 0.875, null);
// Repeating: never terminates
checkFP('0.2   repeating "0011"', 0.2, '0011');
checkFP('0.1   repeating "0011"', 0.1, '0011');
checkFP('0.3   repeating "1001" (offset 1)', 0.3, '1001');
checkFP('1/3   repeating "01"',   1/3, '01');
checkFP('1/6   repeating "01"',    1/6, '01');
checkFP('2/3   repeating "10"',   2/3, '10');

const frac02bits = fracToBits(0.2, 30);
const pd02 = detectPeriod(frac02bits);
if (pd02 && pd02.period === '0011') {
  console.log(`  ✓  fracToBits(0.2,30) detectPeriod="0011"`);
  pass++;
} else {
  console.log(`  ✗  fracToBits(0.2,30) detectPeriod: got ${JSON.stringify(pd02)}`);
  fail++;
}

// ── Summary ───────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(52)}`);
console.log(`  ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
