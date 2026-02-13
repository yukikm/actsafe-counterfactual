#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FIXTURES_DIR = path.join(ROOT, 'conformance', 'writereceipt-v0', 'fixtures');

function fail(msg) {
  console.error(`verify:writereceipt-v0: FAIL: ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`verify:writereceipt-v0: ${msg}`);
}

if (!fs.existsSync(FIXTURES_DIR)) {
  fail(`missing fixtures dir: ${FIXTURES_DIR}`);
}

const files = fs.readdirSync(FIXTURES_DIR).filter(f => f.endsWith('.json'));
if (files.length === 0) {
  fail('no fixtures found (expected at least 1)');
}

const requiredReceiptFields = [
  'receiptVersion',
  'requestId',
  'intentHash',
  'policyVersionHash',
  'checkedAtSlot',
  'status',
  'evidence'
];

let count = 0;
for (const file of files) {
  const p = path.join(FIXTURES_DIR, file);
  let obj;
  try {
    obj = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    fail(`${file}: invalid JSON (${e?.message ?? e})`);
  }

  for (const k of ['id', 'title', 'scenario', 'receipt', 'expected']) {
    if (!(k in obj)) fail(`${file}: missing top-level field '${k}'`);
  }

  const r = obj.receipt;
  for (const k of requiredReceiptFields) {
    if (!(k in r)) fail(`${file}: receipt missing field '${k}'`);
  }
  if (typeof r.evidence !== 'object' || r.evidence === null) {
    fail(`${file}: receipt.evidence must be an object`);
  }

  if (r.receiptVersion !== 'writereceipt-v0') {
    fail(`${file}: receipt.receiptVersion must be 'writereceipt-v0'`);
  }

  count++;
}

ok(`OK (${count} fixtures checked)`);
