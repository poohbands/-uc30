// ติดตามรหัสยาที่ไม่ถูกต้อง (ไม่พบในฐานรหัสยา 24 หลัก) แบบ snapshot รายวัน -> history-<ปี>.js
//
// API s_ttm4 เป็นยอดสะสมทั้งปีงบ ไม่มีวันที่สั่งจ่าย จึงจดว่า "รหัสยา × หน่วยบริการ" แต่ละรายการ
// ถูกพบครั้งแรก/ครั้งล่าสุดเมื่อไร จากการรันทุกวัน
//
// ใช้:
//   node scripts/track-invalid.mjs [ปีงบ ...]                    ใช้ cache/raw-<ปี>.json (ค่าเริ่มต้น = ทุกปีใน cache) วันที่ = วันนี้
//   node scripts/track-invalid.mjs 2569 --excel <file.xlsx> --date 2026-01-09
//                                                               เติมประวัติย้อนหลังจากชีต rowdata<yy> ของไฟล์ Excel
import fs from 'fs';
import path from 'path';

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const load = n => JSON.parse(fs.readFileSync(path.join(ROOT, 'lookups', `${n}.json`), 'utf8'));
const drug24 = load('drug24'), names11 = load('names11'), hospitals = load('hospitals');

const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : null; };
const excel = opt('--excel');
const today = opt('--date') || new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);   // วันที่ตามเวลาไทย
const years = args.length ? args
  : fs.readdirSync(path.join(ROOT, 'cache')).map(f => (f.match(/^raw-(\d{4})\.json$/) || [])[1]).filter(Boolean);

const PREFIX = y => `(window.HISTORY = window.HISTORY || {})['${y}'] = `;

// รายการรหัสไม่ถูกต้อง ณ snapshot: Map("hospcode|didstd" -> [vs_all, vs_uc])
async function snapshot(year) {
  const m = new Map();
  const add = (hc, did, vsAll, vsUc) => {
    if (!did || drug24[did]) return;
    const k = `${hc}|${did}`, a = m.get(k) || m.set(k, [0, 0]).get(k);
    a[0] += vsAll; a[1] += vsUc;
  };
  if (excel) {
    const { default: XLSX } = await import('xlsx');
    const wb = XLSX.readFile(excel, { dense: true, bookVBA: false });
    const sheet = wb.SheetNames.find(n => n.startsWith(`rowdata${year.slice(2)}`));
    if (!sheet) throw new Error(`ไม่พบชีต rowdata${year.slice(2)} ใน ${excel}`);
    // คอลัมน์: hospcode(1), didstd(5), vs_all(6), vs_uc(7), didstd_edit(12) — ไฟล์บางฉบับมีแต่ didstd_edit
    for (const r of XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1 }).slice(1)) {
      const s = v => v == null ? '' : String(v).trim();
      add(s(r[1]).padStart(5, '0'), s(r[5]) || s(r[12]), +r[6] || 0, +r[7] || 0);
    }
  } else {
    const { rows } = JSON.parse(fs.readFileSync(path.join(ROOT, 'cache', `raw-${year}.json`), 'utf8'));
    for (const r of rows) add(r[0], r[2], r[3], r[4]);
  }
  return m;
}

for (const year of years) {
  const file = path.join(ROOT, `history-${year}.js`);
  // h = { year, snapshots: [{d, present, added, gone, src}], items: {"hosp|code": [first, last, vs_all, vs_uc]}, names: {...} }
  const h = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, 'utf8').slice(PREFIX(year).length).replace(/;\s*$/, ''))
    : { year, snapshots: [], items: {}, hosp: {} };

  const now = await snapshot(year);
  const prevDates = h.snapshots.map(s => s.d).filter(d => d < today);
  const prev = prevDates.length ? prevDates[prevDates.length - 1] : null;

  let added = 0, gone = 0;
  for (const [k, [vsAll, vsUc]] of now) {
    const it = h.items[k];
    if (!it) { h.items[k] = [today, today, vsAll, vsUc]; added++; }
    else {
      if (today < it[0]) it[0] = today;                       // เติมย้อนหลัง: วันที่เก่ากว่าเป็นวันพบครั้งแรก
      if (today >= it[1]) { it[1] = today; it[2] = vsAll; it[3] = vsUc; }
    }
    const hc = k.split('|')[0];
    if (!h.hosp[hc]) { const x = hospitals[hc]; h.hosp[hc] = x ? [x.name, x.province] : [hc, 'ไม่ทราบ']; }
  }
  if (prev) for (const [k, it] of Object.entries(h.items)) if (it[1] === prev && !now.has(k)) gone++;

  h.snapshots = h.snapshots.filter(s => s.d !== today);
  h.snapshots.push({ d: today, present: now.size, added, gone, src: excel ? 'excel' : 'api' });
  h.snapshots.sort((a, b) => a.d.localeCompare(b.d));

  // ชื่อยาตามรหัส 11 หลัก (เก็บเฉพาะที่ใช้)
  h.names = {};
  for (const k of Object.keys(h.items)) { const c = k.split('|')[1].slice(0, 11); h.names[c] ??= names11[c] || 'ไม่พบชื่อยา'; }

  fs.writeFileSync(file, PREFIX(year) + JSON.stringify(h) + ';\n');
  console.log(`[${year}] ${today}: พบ ${now.size} รายการ | ใหม่ ${added} | หายไปจากครั้งก่อน ${gone} | สะสม ${Object.keys(h.items).length} -> ${path.basename(file)}`);
}
