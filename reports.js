// รายการรายงาน ใช้ร่วมกันระหว่าง index.html และ admin.html
// รายงาน (ใช้ได้กับทุกปีงบ) -> URL: #<รายงาน>/<ปีงบ>
window.REPORTS = {
  uc:      {nav: 'มูลค่ายาสมุนไพร สิทธิ UC', icon: 'coin', kind: 'value', vs: 'uc', target: true, title: y => `มูลค่าการใช้ยาสมุนไพร สิทธิ UC ปีงบ ${y}`},
  valid:   {nav: 'ตรวจสอบความถูกต้องของรหัสยา', icon: 'check', kind: 'valid', title: y => `ความถูกต้องของรหัสยาสมุนไพร 24 หลัก ปีงบ ${y}`},
  invalid: {nav: 'รายการรหัสยาที่ไม่ถูกต้อง', icon: 'alert', kind: 'invalid', title: y => `รายการรหัสยาที่ไม่ถูกต้อง ปีงบ ${y} — ติดตามตามช่วงวันที่`},
  gmp:     {nav: 'ยา ED ที่ผลิตจากโรงงาน GMP', icon: 'shield', kind: 'gmp', title: y => `ยาสมุนไพร ED ที่ผลิตจากโรงงาน GMP ปีงบ ${y}`},
  edcount: {nav: 'ยา ED ที่มีการสั่งจ่าย', icon: 'list', kind: 'edcount', title: y => `จำนวนรายการยาสมุนไพร ED ที่มีการสั่งจ่าย ปีงบ ${y}`},
  all:     {nav: 'มูลค่ายาสมุนไพร ทุกสิทธิ', icon: 'users', kind: 'value', vs: 'all', target: false, title: y => `มูลค่าการใช้ยาสมุนไพร ทุกสิทธิ ปีงบ ${y}`},
  noned:   {nav: 'ED + NONED ทุกสิทธิ', icon: 'layers', kind: 'noned', title: y => `มูลค่าการใช้ยาสมุนไพร ทุกสิทธิ รวม ED และ NONED ปีงบ ${y}`},
};