export type ClientType = 'corporate' | 'individual'
export type PriceMode = 'gross' | 'net'

export interface InvoiceItem {
  id: string
  name: string
  qty: number
  unitPrice: number
}

export interface PartyInfo {
  name: string
  taxId: string
  address: string
  phone: string
  email: string
}

export interface PaymentInfo {
  bankName: string
  accountNo: string
  accountName: string
}

export interface HistoryEntry {
  id: string
  savedAt: string
  invoiceNo: string
  invoiceDate: string
  clientType: ClientType
  clientName: string
  subtotal: number
  discount: number
  whtRate: number
  whtAmount: number
  total: number
  invoiceLink?: string
}

export interface InvoiceSnapshot {
  invoiceNo: string
  invoiceDate: string
  validUntil: string
  sellerName: string
  sellerPhone: string
  sellerEmail: string
  clientType: ClientType
  clientName: string
  clientTaxId: string
  clientAddress: string
  clientPhone: string
  clientEmail: string
  items: InvoiceItem[]
  whtRate: number
  discount: number
  priceMode: PriceMode
  bankName: string
  accountNo: string
  accountName: string
  note: string
}

/** อัตราหัก ณ ที่จ่ายที่พบบ่อยสำหรับบุคคลธรรมดา (แก้ไข/เพิ่มได้เอง) */
export const WHT_RATE_PRESETS = [3] as const
