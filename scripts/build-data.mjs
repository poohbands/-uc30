// สร้าง data-<ปี>.js สำหรับ dashboard จาก cache/raw-<ปี>.json + lookups/*.json
// ใช้: node scripts/build-data.mjs [ปีงบ พ.ศ. ...]   (ค่าเริ่มต้น = ทุกปีที่มีใน cache)
import fs from 'fs';
import path from 'path';

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const load = n => JSON.parse(fs.readFileSync(path.join(ROOT, 'lookups', `${n}.json`), 'utf8'));
const drugs = load('drugs'), drug24 = load('drug24'), hospitals = load('hospitals'), mfrs = load('manufacturers'), names11 = load('names11');

const years = process.argv.slice(2).length ? process.argv.slice(2)
  : fs.readdirSync(path.join(ROOT, 'cache')).map(f => (f.match(/^raw-(\d{4})\.json$/) || [])[1]).filter(Boolean);

const dict = () => { const list = [], idx = new Map(); return { list, id: v => { if (!idx.has(v)) { idx.set(v, list.length); list.push(v); } return idx.get(v); } }; };
const round2 = n => Math.round(n * 100) / 100;

for (const year of years) {
  const { rows, dateCom } = JSON.parse(fs.readFileSync(path.join(ROOT, 'cache', `raw-${year}.json`), 'utf8'));
  // rows: [hospcode, areacode, didstd, vs_all, vs_uc, am_all, am_uc, pri_all, pri_uc]

  // ประเภทรหัส: ED = ยา 11 หลักอยู่ในรายการ ED และที่มาของรหัส (ฐานรหัสยา 24 หลัก) = "1-"
  //             NONED = รหัสถูกต้อง (มีในฐานรหัสยา) แต่ไม่ใช่ ED,  INVALID = ไม่พบในฐานรหัสยา
  const kindOf = c => drug24[c] ? (drugs[c.slice(0, 11)] && drug24[c].src === '1-' ? 1 : 2) : 0;

  // ราคาต่อคอร์สของยา NONED = ราคาขายเฉลี่ยต่อครั้ง (ทุกสิทธิ) ของยา 11 หลักนั้นทั้งประเทศ
  const nonedAgg = new Map();
  for (const r of rows) {
    if (kindOf(r[2]) !== 2) continue;
    const k = r[2].slice(0, 11), a = nonedAgg.get(k) || nonedAgg.set(k, [0, 0]).get(k);
    a[0] += r[3]; a[1] += r[7];
  }
  const nonedPrice = k => { const a = nonedAgg.get(k); return a && a[0] ? a[1] / a[0] : 0; };

  // GMP: 1 = GMP หรือ ยกเว้น (ผลิตโดยโรงพยาบาล/ได้รับยกเว้น), 2 = ยังไม่พบข้อมูล GMP ("-"), 3 = ไม่พบข้อมูลผู้ผลิต
  const gmpOf = c => { const s = mfrs[String(+c.slice(-5))]?.std; return s === 'GMP' || s === 'ยกเว้น' ? 1 : s === '-' ? 2 : 3; };

  const D = { type: dict(), sangkat: dict(), province: dict(), amphoe: dict(), tambon: dict(), drug: dict(), name: dict(), mfr: dict() };
  const hospIdx = new Map(), hosp = [];
  const codeIdx = new Map(), codes = [];
  const F = { h: [], c: [], uc: [], all: [], pri: [] };
  const unknownHosp = new Set();

  for (const r of rows) {
    const [hc, , did, vsAll, vsUc, , , priAll] = r;
    if (!vsAll && !vsUc) continue;

    if (!hospIdx.has(hc)) {
      const h = hospitals[hc];
      if (!h) unknownHosp.add(hc);
      const x = h || { name: hc, type: 'ไม่ทราบ', sangkat: 'ไม่ทราบ', region: '', province: 'ไม่ทราบ', amphoe: 'ไม่ทราบ', tambon: 'ไม่ทราบ' };
      hospIdx.set(hc, hosp.length);
      hosp.push([hc, x.name, D.type.id(x.type), D.sangkat.id(x.sangkat), +(x.region.match(/\d+/) || [0])[0],
        D.province.id(x.province), D.amphoe.id(`${x.province}|${x.amphoe}`), D.tambon.id(`${x.province}|${x.amphoe}|${x.tambon}`)]);
    }

    if (!codeIdx.has(did)) {
      const kind = kindOf(did), k11 = did.slice(0, 11);
      const m = mfrs[String(+did.slice(-5))];
      codeIdx.set(did, codes.length);
      // [didstd, kind, ชื่อยา ED (-1 = ไม่ใช่ ED), ราคาต่อคอร์ส, GMP, ชื่อยาตามรหัส 11 หลัก, ผู้ผลิต]
      codes.push([did, kind, kind === 1 ? D.drug.id(drugs[k11].name) : -1,
        round2(kind === 1 ? drugs[k11].price : kind === 2 ? nonedPrice(k11) : 0),
        kind === 1 ? gmpOf(did) : 0,
        D.name.id(kind === 1 ? drugs[k11].name : names11[k11] || 'ไม่พบชื่อยา'),
        D.mfr.id(m?.name || 'ไม่พบข้อมูล')]);
    }

    F.h.push(hospIdx.get(hc)); F.c.push(codeIdx.get(did));
    F.uc.push(vsUc); F.all.push(vsAll); F.pri.push(round2(priAll));
  }

  const d = dateCom; // yyyymmddhhmm (ว่างถ้า API ยังไม่มีข้อมูลปีนี้)
  const data = {
    year,
    dataDate: d ? `${d.slice(6, 8)}/${d.slice(4, 6)}/${+d.slice(0, 4) + 543} ${d.slice(8, 10)}:${d.slice(10, 12)}` : '-',
    builtAt: new Date().toISOString(),
    dict: Object.fromEntries(Object.entries(D).map(([k, v]) => [k, v.list])),
    hosp, codes, facts: F,
  };
  const out = path.join(ROOT, `data-${year}.js`);
  fs.writeFileSync(out, `(window.DATASETS = window.DATASETS || {})['${year}'] = ${JSON.stringify(data)};\n`);

  // สรุปเทียบกับ Data Studio
  let ucVs = 0, ucVal = 0;
  F.c.forEach((c, i) => { if (codes[c][1] === 1) { ucVs += F.uc[i]; ucVal += F.uc[i] * codes[c][3]; } });
  console.log(`[${year}] แถว ${F.h.length} | หน่วยบริการ ${hosp.length} (ไม่พบชื่อ ${unknownHosp.size}) | รหัสยา ${codes.length}`);
  console.log(`[${year}] UC: vs_uc ${ucVs.toLocaleString()} | มูลค่า ${ucVal.toLocaleString()} บาท | ร้อยละ ${(ucVal / 2e7).toFixed(2)}`);
  console.log(`[${year}] เขียน ${path.basename(out)} (${(fs.statSync(out).size / 1e6).toFixed(1)} MB)`);
}

// สารบัญปีที่มีข้อมูล (data-index.js) ให้ dashboard สร้างตัวเลือกปีงบ
const index = fs.readdirSync(ROOT).map(f => (f.match(/^data-(\d{4})\.js$/) || [])[1]).filter(Boolean).sort().reverse().map(y => {
  const txt = fs.readFileSync(path.join(ROOT, `data-${y}.js`), 'utf8');
  const rows = (txt.match(/"h":\[([^\]]*)\]/) || [, ''])[1];
  return { year: y, dataDate: (txt.match(/"dataDate":"([^"]*)"/) || [])[1] || '-', rows: rows ? rows.split(',').length : 0 };
});
fs.writeFileSync(path.join(ROOT, 'data-index.js'), `window.DATA_INDEX = ${JSON.stringify(index)};
`);
console.log('data-index.js', index.map(x => `${x.year}:${x.rows}`).join(' '));
