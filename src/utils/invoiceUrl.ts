import type { InvoiceSnapshot } from '../types'

export function encodeInvoiceUrl(snapshot: InvoiceSnapshot): string {
  const json = JSON.stringify(snapshot)
  const b64 = btoa(unescape(encodeURIComponent(json)))
  return `${window.location.origin}/#${b64}`
}

export function decodeInvoiceUrl(): InvoiceSnapshot | null {
  const hash = window.location.hash.slice(1)
  if (!hash) return null
  try {
    const json = decodeURIComponent(escape(atob(hash)))
    return JSON.parse(json) as InvoiceSnapshot
  } catch {
    return null
  }
}
