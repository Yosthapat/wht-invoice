import type { InvoiceItem, ClientType, PriceMode } from '../types'

/** ปัดเศษ 2 ตำแหน่งแบบปลอดภัยจาก floating point */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export interface InvoiceTotals {
  itemsAmount: { id: string; amount: number }[]
  subtotal: number
  discount: number
  subtotalAfterDiscount: number
  whtRate: number
  whtAmount: number
  total: number
}

/**
 * คำนวณยอดใบแจ้งหนี้
 *
 * กติกา:
 * - นิติบุคคล (corporate): หัก WHT จากยอดหลังหักส่วนลด
 * - บุคคลธรรมดา (individual): ไม่มีการหัก WHT, ไม่มีการ gross-up
 *
 * priceMode:
 * - 'gross' : ราคาต่อหน่วยที่กรอกคือยอดก่อนหักภาษี (ปกติ) → amount = qty * unitPrice
 * - 'net'   : ราคาต่อหน่วยที่กรอกคือยอดสุทธิที่ต้องการให้ได้รับต่อหน่วย → ต้อง gross-up กลับ
 *             ยอดก่อนหัก/หน่วย = ยอดสุทธิที่ต้องการ/หน่วย ÷ (1 - อัตรา WHT)
 *             (สูตรเดียวกับ: ยอดก่อนหัก = ยอดที่ต้องการได้รับ ÷ (1 - 0.03))
 *
 * ลำดับการคำนวณ: (gross-up ถ้าจำเป็น) -> Subtotal -> หักส่วนลด -> หัก WHT -> Total
 */
export function calcInvoiceTotals(
  items: InvoiceItem[],
  clientType: ClientType,
  whtRate: number,
  discount: number,
  priceMode: PriceMode = 'gross'
): InvoiceTotals {
  const effectiveMode: PriceMode = clientType === 'corporate' ? priceMode : 'gross'
  const rateFraction = whtRate / 100

  // เก็บยอดต่อรายการแบบไม่ปัดเศษไว้ก่อน เพื่อรวมเป็น subtotal ให้ตรง แล้วค่อยปัดครั้งเดียว
  // (ถ้าปัดเศษทีละรายการก่อนรวม จะเกิดความเพี้ยนสะสมได้ ทำให้ Total ไม่ตรงยอดสุทธิที่ต้องการ)
  const rawAmounts = items.map((i) => {
    if (effectiveMode === 'net' && rateFraction < 1) {
      const grossUnitPrice = i.unitPrice / (1 - rateFraction)
      return { id: i.id, raw: i.qty * grossUnitPrice }
    }
    return { id: i.id, raw: i.qty * i.unitPrice }
  })

  const itemsAmount = rawAmounts.map((i) => ({ id: i.id, amount: round2(i.raw) }))
  const subtotal = round2(rawAmounts.reduce((sum, i) => sum + i.raw, 0))
  const safeDiscount = round2(Math.min(Math.max(discount, 0), subtotal))
  const subtotalAfterDiscount = round2(subtotal - safeDiscount)

  const effectiveWhtRate = clientType === 'corporate' ? whtRate : 0
  const whtAmount = round2(subtotalAfterDiscount * (effectiveWhtRate / 100))
  const total = round2(subtotalAfterDiscount - whtAmount)

  return {
    itemsAmount,
    subtotal,
    discount: safeDiscount,
    subtotalAfterDiscount,
    whtRate: effectiveWhtRate,
    whtAmount,
    total
  }
}

export function formatBaht(value: number): string {
  return value.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function newId(): string {
  return (crypto as any).randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
}
