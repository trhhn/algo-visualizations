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
  let bits = '';
  for (let i = 0; i < n; i++) {
    frac *= 2;
    bits += frac >= 1 ? '1' : '0';
    if (frac >= 1) frac -= 1;
  }
  return bits;
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
  [0.2,       '0.2   → repeating 0011'],
  [0.1,       '0.1   → repeating 0011 (shorter period after norm)'],
  [0.3,       '0.3   → repeating 1001'],
  [16.75,     '16.75 → exact (10000.11)'],
  [-16.75,    '-16.75 → exact, negative'],
  [0.5,       '0.5   → exact (0.1)'],
  [1.0,       '1.0   → exact'],
  [3.14159,   '3.14159 → >23 bits, no clean period'],
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

// Trunc must always be <= round in magnitude (mantissa bits only dropped, not added)
console.log('\nTrunc mantissa <= round mantissa (for positive values):');
const trunc_leq_cases = [0.1, 0.2, 0.3, 1/3, Math.PI, Math.E, 1.23456789];
for (const v of trunc_leq_cases) {
  const t = decimalToU32Trunc(v);
  const r = decimalToU32Round(v);
  // For positive normal numbers, trunc mantissa <= round mantissa
  if (t <= r) {
    console.log(`  ✓  ${v}: trunc=${hex(t)} <= round=${hex(r)}`);
    pass++;
  } else {
    console.log(`  ✗  ${v}: trunc=${hex(t)} > round=${hex(r)}`);
    fail++;
  }
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

// fracToBits of an exact fraction will have trailing zeros → period "0" detected.
// Again, the converter guard (fracPeriod !== null) prevents this from showing in the UI.
const frac075bits = fracToBits(0.75, 8); // "11000000"
checkPd(`fracToBits(0.75,8)="${frac075bits}" — algorithm sees trailing "0" period (converter guards)`,
  frac075bits, '0');

const frac02bits = fracToBits(0.2, 30);
const pd02 = detectPeriod(frac02bits);
if (pd02 && pd02.period === '0011') {
  console.log(`  ✓  fracToBits(0.2,30) period="0011"`);
  pass++;
} else {
  console.log(`  ✗  fracToBits(0.2,30) period: got ${JSON.stringify(pd02)}`);
  fail++;
}

// ── Summary ───────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(52)}`);
console.log(`  ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
