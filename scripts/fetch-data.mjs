// ดาวน์โหลด s_ttm4 ดิบจาก MOPH Open Data ครบ 77 จังหวัด เก็บไว้ที่ cache/raw-<ปี>.json
// แล้วสร้าง data ให้ dashboard ต่อด้วย build-data.mjs
// ใช้: node scripts/fetch-data.mjs [ปีงบ พ.ศ. ...]   (ค่าเริ่มต้น = ปีงบปัจจุบันและปีงบก่อนหน้า)
import fs from 'fs';
import path from 'path';

// ปีงบประมาณไทยเริ่ม 1 ต.ค. -> ต.ค.-ธ.ค. นับเป็นปีงบถัดไป (คิดตามเวลาไทย)
const now = new Date(Date.now() + 7 * 3600e3);
const currentFY = now.getUTCFullYear() + 543 + (now.getUTCMonth() >= 9 ? 1 : 0);
const YEARS = process.argv.slice(2).filter(Boolean).length ? process.argv.slice(2).filter(Boolean) : [String(currentFY), String(currentFY - 1)];
const API = 'https://opendata.moph.go.th/api/report_data';
const PAGE = 10000;
const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const PROVINCES = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 30, 31, 32, 33, 34, 35,
  36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 60, 61, 62, 63, 64,
  65, 66, 67, 70, 71, 72, 73, 74, 75, 76, 77, 80, 81, 82, 83, 84, 85, 86, 90, 91, 92, 93, 94, 95, 96];

const sleep = ms => new Promise(res => setTimeout(res, ms));

// API จำกัดอัตราการเรียก (HTTP 429) -> ยิงทีละคำขอ เว้นระยะ และรอนานขึ้นเมื่อโดนจำกัด
async function post(body, tries = 8) {
  for (let i = 1; ; i++) {
    let wait = 3000 * i;
    try {
      const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (r.ok) { await sleep(800); return await r.json(); }
      if (r.status === 429) wait = (+r.headers.get('retry-after') || 15 * i) * 1000;
      if (i >= tries) throw new Error(`HTTP ${r.status}`);
    } catch (e) {
      if (i >= tries) throw e;
    }
    console.log(`  รอ ${wait / 1000} วินาทีแล้วลองใหม่ (ครั้งที่ ${i})`);
    await sleep(wait);
  }
}

async function fetchProvince(year, code) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE) {
    const j = await post({ tableName: 's_ttm4', year, province: String(code), type: 'json', limit: PAGE, offset });
    rows.push(...j.data);
    if (!j.data.length || rows.length >= +j.total) return rows;
  }
}

fs.mkdirSync(path.join(ROOT, 'cache'), { recursive: true });
for (const year of YEARS) {
  // เก็บเฉพาะคอลัมน์ที่ใช้: [hospcode, areacode, didstd, vs_all, vs_uc, am_all, am_uc, pri_all, pri_uc]
  const rows = [];
  let maxDate = '', done = 0;
  for (const p of PROVINCES) {
    const data = await fetchProvince(year, p);
    for (const r of data) {
      if (r.date_com > maxDate) maxDate = r.date_com;
      rows.push([r.hospcode, r.areacode, r.didstd, +r.vs_all || 0, +r.vs_uc || 0, +r.am_all || 0, +r.am_uc || 0, +r.pri_all || 0, +r.pri_uc || 0]);
    }
    console.log(`[${year}] [${++done}/${PROVINCES.length}] จังหวัด ${p}: ${data.length} แถว`);
  }
  const file = path.join(ROOT, 'cache', `raw-${year}.json`);
  fs.writeFileSync(file, JSON.stringify({ year, dateCom: maxDate, fetchedAt: new Date().toISOString(), rows }));
  console.log(`[${year}] เขียน ${file} (${rows.length} แถว)`);
}
