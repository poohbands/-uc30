// สร้างตารางแปลงรหัส (lookups/*.json) จากไฟล์ "106 รายการ-KPI มูลค่ายา_ตรวจราชการ.xlsb"
// ใช้: node scripts/build-lookups.mjs <path-to-xlsb>
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const file = process.argv[2];
if (!file) { console.error('usage: node scripts/build-lookups.mjs <file.xlsb>'); process.exit(1); }
const out = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..', 'lookups');
fs.mkdirSync(out, { recursive: true });

const wb = XLSX.readFile(file, { dense: true, bookVBA: false });
const rows = name => XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1 });
const S = v => v == null ? '' : String(v).trim();
const clean = s => S(s).replace(/\s*\n\s*/g, ' ');
const rowdataSheet = wb.SheetNames.find(n => n.startsWith('rowdata69'));

// 1) รายการยา ED 11 หลัก -> ชื่อ + ราคาต่อคอร์ส (คอลัมน์ G..K = รายการที่ใช้ทำ KPI)
const drugs = {};
for (const r of rows('ฐานยา 11 หลัก').slice(1)) {
  if (r[7]) drugs[S(r[7])] = { name: clean(r[9]), price: +r[10] || 0 };
}
// rowdata69 คือสิ่งที่ KPI ใช้คำนวณจริง -> ให้ค่าจากชีตนี้ทับ (เช่น ฟ้าทะลายโจร 92 บาท)
for (const r of rows(rowdataSheet).slice(1)) {
  const code = S(r[13]), name = clean(r[15]);
  if (code && name && name !== 'ไม่ทราบประเภท') drugs[code] = { name, price: +r[18] || 0 };
}

// 2) รหัสยา 24 หลัก -> ที่มาของรหัส (Excel ใช้ VLOOKUP จึงยึดแถวแรก)
const drug24 = {};
for (const r of rows('ฐานรหัสยา').slice(1)) {
  const c = S(r[12]);
  if (c && !(c in drug24)) drug24[c] = { src: S(r[13]), mfr: S(r[11]) };
}

// 3) ผู้ผลิตยา (5 หลักท้ายของ didstd, เก็บเป็นตัวเลขไม่เติม 0) -> มาตรฐาน: GMP / - / ยกเว้น / ไม่พบข้อมูล
const manufacturers = {};
for (const r of rows('แหล่งผู้ผลิตยาที่พบในระบบ')) {
  if (r[1]) manufacturers[String(+r[1])] = { name: S(r[0]), std: S(r[2]) };
}
// rowdata69 คือสิ่งที่ KPI ใช้จริง -> ให้ทับ
for (const r of rows(rowdataSheet).slice(1)) {
  if (r[26] != null && r[26] !== '') manufacturers[String(+r[26])] = { name: S(r[27]), std: S(r[28]) };
}

// 4) หน่วยบริการ
const hospitals = {};
for (const r of rows('หน่วยบริการ').slice(1)) {
  const c = S(r[1]);
  if (c) hospitals[c.padStart(5, '0')] = {
    name: S(r[0]), type: S(r[3]), sangkat: S(r[4]), region: S(r[5]),
    province: S(r[6]), amphoe: S(r[7]), tambon: S(r[8]),
  };
}

// 5) ชื่อยาสมุนไพรทุกรายการตามรหัส 11 หลัก (รวมยานอกบัญชี) ใช้แสดงในหน้าตรวจสอบรหัสยา
const names11 = {};
for (const r of rows('11 หลัก').slice(1)) {
  if (r[1]) names11[S(r[1])] = clean(r[0]);
}

for (const [n, o] of Object.entries({ drugs, drug24, manufacturers, hospitals, names11 })) {
  fs.writeFileSync(path.join(out, `${n}.json`), JSON.stringify(o));
  console.log(`${n}.json`, Object.keys(o).length);
}
