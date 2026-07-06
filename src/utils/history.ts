import * as XLSX from 'xlsx'
import type { HistoryEntry } from '../types'

const HISTORY_KEY = 'wht-invoice-history'
const WEBHOOK_KEY = 'wht-invoice-sheet-webhook'

/** โหลดประวัติทั้งหมดจาก localStorage ของเบราว์เซอร์ */
export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : []
  } catch {
    return []
  }
}

function persistHistory(entries: HistoryEntry[]): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries))
}

/** บันทึกใบแจ้งหนี้ปัจจุบันเป็นประวัติรายการใหม่ (เพิ่มไว้บนสุด) */
export function addHistoryEntry(entry: Omit<HistoryEntry, 'id' | 'savedAt'>): HistoryEntry {
  const full: HistoryEntry = {
    ...entry,
    id: (crypto as any).randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    savedAt: new Date().toISOString()
  }
  const history = loadHistory()
  history.unshift(full)
  persistHistory(history)
  return full
}

export function deleteHistoryEntry(id: string): HistoryEntry[] {
  const history = loadHistory().filter((h) => h.id !== id)
  persistHistory(history)
  return history
}

export function clearHistory(): void {
  persistHistory([])
}

/** เก็บ/อ่าน URL ของ Google Apps Script Web App ที่ผูกกับ Google Sheet ปลายทาง */
export function getSheetWebhookUrl(): string {
  return localStorage.getItem(WEBHOOK_KEY) || ''
}

export function setSheetWebhookUrl(url: string): void {
  localStorage.setItem(WEBHOOK_KEY, url)
}

/** Export ประวัติทั้งหมดเป็นไฟล์ Excel (.xlsx) ให้ดาวน์โหลดทันที */
export function exportHistoryToXlsx(entries: HistoryEntry[]): void {
  const rows = entries.map((e) => ({
    'วันที่บันทึก': new Date(e.savedAt).toLocaleString('th-TH'),
    'เลขที่ใบแจ้งหนี้': e.invoiceNo,
    'วันที่ในใบแจ้งหนี้': e.invoiceDate,
    'ประเภท': e.clientType === 'corporate' ? 'นิติบุคคล' : 'บุคคลธรรมดา',
    'ชื่อลูกค้า': e.clientName,
    'Subtotal': e.subtotal,
    'ส่วนลด': e.discount,
    '% WHT': e.whtRate,
    'ยอด WHT': e.whtAmount,
    'TOTAL': e.total
  }))
  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'ประวัติใบแจ้งหนี้')
  XLSX.writeFile(workbook, `wht-invoice-history-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

/**
 * ส่งข้อมูลไปยัง Google Sheet ผ่าน Google Apps Script Web App (ดูวิธีตั้งค่าใน README)
 * หมายเหตุ: Apps Script Web App บางการตั้งค่าจะบล็อก CORS จนอ่าน response ไม่ได้
 * ฟังก์ชันนี้จึงถือว่า "ส่งสำเร็จ" ถ้า fetch ไม่ throw error แม้ตัว response จะอ่านไม่ได้ก็ตาม
 */
export async function syncEntryToGoogleSheet(url: string, entry: HistoryEntry): Promise<boolean> {
  if (!url) return false
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(entry)
    })
    return true
  } catch {
    return false
  }
}

export async function syncAllHistoryToGoogleSheet(url: string, entries: HistoryEntry[]): Promise<boolean> {
  if (!url) return false
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ bulk: true, entries })
    })
    return true
  } catch {
    return false
  }
}
