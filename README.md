# ระบบออกใบแจ้งหนี้ + คำนวณ WHT

Vue 3 + TypeScript + Vite. รองรับ 2 โหมด: นิติบุคคล (ไม่หัก WHT) และบุคคลธรรมดา (หัก WHT)

## สูตรคำนวณ

```
ยอดต่อรายการ        = จำนวน × ราคาต่อหน่วย
Subtotal            = รวมยอดทุกรายการ
ยอดหลังหักส่วนลด     = Subtotal - ส่วนลด
WHT (เฉพาะบุคคลธรรมดา) = ยอดหลังหักส่วนลด × %WHT
Total                = ยอดหลังหักส่วนลด - WHT
```

นิติบุคคล: WHT = 0 เสมอ, Total = ยอดหลังหักส่วนลด

## รันบนเครื่อง

```bash
npm install
npm run dev
```

เปิด http://localhost:5173

## Build

```bash
npm run build
```

ไฟล์ output อยู่ที่ `dist/`

## Deploy

### Netlify
1. Push โค้ดขึ้น GitHub repo
2. เข้า Netlify > Add new site > Import from Git
3. Build command: `npm run build`, Publish directory: `dist` (มี `netlify.toml` ตั้งไว้แล้ว)

### Cloudflare Pages
1. Push โค้ดขึ้น GitHub repo
2. เข้า Cloudflare Pages > Create project > Connect to Git
3. Framework preset: Vite, Build command: `npm run build`, Output directory: `dist`
   (มีไฟล์ `public/_redirects` ไว้รองรับ SPA routing แล้ว)

## เก็บประวัติ (History) + เชื่อมต่อ Google Sheet / Excel

แอปเก็บประวัติใบแจ้งหนี้ที่กด "บันทึกใบนี้ลงประวัติ" ไว้ใน `localStorage` ของเบราว์เซอร์ (เครื่องใครเครื่องมัน)
จากนั้นเลือกได้ 2 ทาง:

### 1. Export เป็น Excel (.xlsx) — ใช้งานได้ทันที ไม่ต้องตั้งค่า
กดปุ่ม "Export เป็น Excel" จะได้ไฟล์ `.xlsx` ของประวัติทั้งหมด ดาวน์โหลดลงเครื่องทันที

### 2. ซิงค์ไป Google Sheet อัตโนมัติ — ต้องตั้งค่าเบื้องต้น 1 ครั้ง

**ขั้นตอน:**
1. สร้าง Google Sheet ใหม่ (หรือใช้ชีทเดิม)
2. เมนู **Extensions > Apps Script**
3. ลบโค้ดเดิม แล้ววางโค้ดนี้แทน:

```javascript
function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);

  if (data.bulk) {
    // ซิงค์ทั้งหมด: ล้างชีทแล้วเขียนใหม่ทั้งหมด
    sheet.clearContents();
    sheet.appendRow(['วันที่บันทึก', 'เลขที่ใบแจ้งหนี้', 'วันที่ในใบแจ้งหนี้', 'ประเภท', 'ชื่อลูกค้า', 'Subtotal', 'ส่วนลด', '% WHT', 'ยอด WHT', 'TOTAL']);
    data.entries.forEach(function (entry) {
      appendEntryRow(sheet, entry);
    });
  } else {
    // ซิงค์ทีละรายการ (เพิ่มหัวตารางถ้ายังไม่มี)
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['วันที่บันทึก', 'เลขที่ใบแจ้งหนี้', 'วันที่ในใบแจ้งหนี้', 'ประเภท', 'ชื่อลูกค้า', 'Subtotal', 'ส่วนลด', '% WHT', 'ยอด WHT', 'TOTAL']);
    }
    appendEntryRow(sheet, data);
  }

  return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function appendEntryRow(sheet, entry) {
  sheet.appendRow([
    entry.savedAt,
    entry.invoiceNo,
    entry.invoiceDate,
    entry.clientType === 'corporate' ? 'นิติบุคคล' : 'บุคคลธรรมดา',
    entry.clientName,
    entry.subtotal,
    entry.discount,
    entry.whtRate,
    entry.whtAmount,
    entry.total
  ]);
}
```

4. กด **Deploy > New deployment**
5. เลือกประเภท **Web app**
6. ตั้งค่า: **Execute as: Me**, **Who has access: Anyone**
7. กด Deploy แล้วคัดลอก **Web app URL** ที่ได้ (ขึ้นต้นด้วย `https://script.google.com/macros/s/.../exec`)
8. เอา URL นี้ไปวางในช่อง "Google Apps Script Web App URL" ในแอป

จากนั้นทุกครั้งที่กด "บันทึกใบนี้ลงประวัติ" จะส่งข้อมูลไปเพิ่มแถวใน Google Sheet ให้อัตโนมัติ หรือกด "ซิงค์ทั้งหมดไป Google Sheet" เพื่อส่งประวัติทั้งหมดทีเดียว

**หมายเหตุ:** Apps Script Web App บางครั้งจะบล็อก CORS จนแอปอ่านผลลัพธ์กลับไม่ได้ (แต่ข้อมูลจะถูกบันทึกลงชีทตามปกติ) แอปจึงจะขึ้นสถานะ "ส่งไม่สำเร็จ" ได้แม้ข้อมูลจะเข้าชีทจริงๆ แล้ว — ถ้าเจอแบบนี้ให้เข้าไปเช็คใน Google Sheet โดยตรง

## โครงสร้างไฟล์

```
src/
  types.ts          — type definitions (InvoiceItem, PartyInfo, HistoryEntry, ฯลฯ)
  utils/calc.ts      — สูตรคำนวณ WHT/Subtotal/Total ทั้งหมดอยู่ที่นี่ที่เดียว
  utils/history.ts   — เก็บประวัติใน localStorage, export Excel, sync Google Sheet
  App.vue            — tab bar + ฟอร์ม + พรีวิวใบแจ้งหนี้ + ประวัติ
  App.css            — สไตล์ responsive (มือถือ/คอม)
```

## จุดที่แก้จากใบแจ้งหนี้เดิม

ใบแจ้งหนี้ต้นแบบใส่ "WHT Compensation" เป็นรายการบวกในตาราง (ทำให้ subtotal ในตารางกลายเป็นยอดสะสมที่ไม่ตรงกับยอดขายจริง)
แอปนี้แยก WHT ออกจากตารางรายการอย่างชัดเจน คิดจากยอดขายจริงหลังหักส่วนลดครั้งเดียว ไม่มีการรวมปนกับรายการสินค้า/บริการ

## ปรับแต่งเพิ่มเติมที่ทำได้ในอนาคต
- Export เป็น PDF จริง (เช่น ใช้ `html2pdf.js` หรือ `pdf-lib`) แทนปุ่ม "พิมพ์" ที่ใช้ browser print ตอนนี้
- Auto-generate เลขที่ใบแจ้งหนี้ต่อจากเลขล่าสุด
