<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { ClientType, InvoiceItem, PriceMode } from './types'
import { WHT_RATE_PRESETS } from './types'
import { calcInvoiceTotals, formatBaht, newId } from './utils/calc'
import {
  loadHistory,
  addHistoryEntry,
  deleteHistoryEntry,
  exportHistoryToXlsx,
  getSheetWebhookUrl,
  setSheetWebhookUrl,
  syncEntryToGoogleSheet,
  syncAllHistoryToGoogleSheet
} from './utils/history'
import type { HistoryEntry } from './types'

// ---- Tab: ประเภทลูกค้า ----
const clientType = ref<ClientType>('corporate')

// ---- ข้อมูลใบแจ้งหนี้ ----
const invoiceNo = ref('0024')
const invoiceDate = ref(new Date().toISOString().slice(0, 10))
const validUntil = ref('')

// ---- ผู้ออกใบแจ้งหนี้ ----
const sellerName = ref('')
const sellerPhone = ref('')
const sellerEmail = ref('')

// ---- ลูกค้า (bill to) ----
const clientName = ref('')
const clientTaxId = ref('')
const clientAddress = ref('')
const clientPhone = ref('')
const clientEmail = ref('')

// ---- รายการสินค้า/บริการ ----
const items = ref<InvoiceItem[]>([{ id: newId(), name: '', qty: 1, unitPrice: 0 }])

function addItem() {
  items.value.push({ id: newId(), name: '', qty: 1, unitPrice: 0 })
}
function removeItem(id: string) {
  if (items.value.length === 1) return
  items.value = items.value.filter((i) => i.id !== id)
}

// ---- WHT & ส่วนลด ----
const whtRate = ref<number>(3)
const useCustomRate = ref(false)
const discount = ref<number>(0)
const priceMode = ref<PriceMode>('gross')

// ---- ข้อมูลรับเงิน ----
const bankName = ref('')
const accountNo = ref('')
const accountName = ref('')
const note = ref('')

// ---- คำนวณ ----
const totals = computed(() => calcInvoiceTotals(items.value, clientType.value, whtRate.value, discount.value, priceMode.value))

function itemAmount(id: string): number {
  return totals.value.itemsAmount.find((i) => i.id === id)?.amount ?? 0
}

function printInvoice() {
  window.print()
}

// ---- หน้า (page navigation): สร้างใบแจ้งหนี้ / ประวัติ ----
const currentPage = ref<'invoice' | 'history'>('invoice')
const historySearch = ref('')

const filteredHistory = computed(() => {
  const q = historySearch.value.trim().toLowerCase()
  if (!q) return history.value
  return history.value.filter(
    (h) =>
      h.invoiceNo.toLowerCase().includes(q) ||
      h.clientName.toLowerCase().includes(q)
  )
})

// ---- ประวัติ (History) + Google Sheet sync ----
const history = ref<HistoryEntry[]>([])
const sheetWebhookUrl = ref('')
const syncStatus = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')

onMounted(() => {
  history.value = loadHistory()
  sheetWebhookUrl.value = getSheetWebhookUrl()
})

function onWebhookUrlChange() {
  setSheetWebhookUrl(sheetWebhookUrl.value.trim())
}

async function saveToHistory() {
  const entry = addHistoryEntry({
    invoiceNo: invoiceNo.value,
    invoiceDate: invoiceDate.value,
    clientType: clientType.value,
    clientName: clientName.value,
    subtotal: totals.value.subtotal,
    discount: totals.value.discount,
    whtRate: totals.value.whtRate,
    whtAmount: totals.value.whtAmount,
    total: totals.value.total
  })
  history.value = loadHistory()

  if (sheetWebhookUrl.value) {
    syncStatus.value = 'saving'
    const ok = await syncEntryToGoogleSheet(sheetWebhookUrl.value, entry)
    syncStatus.value = ok ? 'saved' : 'error'
    setTimeout(() => (syncStatus.value = 'idle'), 2500)
  }
}

function removeHistoryEntry(id: string) {
  history.value = deleteHistoryEntry(id)
}

function exportExcel() {
  exportHistoryToXlsx(history.value)
}

async function syncAllToSheet() {
  if (!sheetWebhookUrl.value) return
  syncStatus.value = 'saving'
  const ok = await syncAllHistoryToGoogleSheet(sheetWebhookUrl.value, history.value)
  syncStatus.value = ok ? 'saved' : 'error'
  setTimeout(() => (syncStatus.value = 'idle'), 2500)
}
</script>

<template>
  <div class="page">
    <header class="hero">
      <div class="hero-marks">
        <svg style="left:14px; top:10px;" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#161414" stroke-width="2.6" stroke-linecap="round"><path d="M12 2v20M4.5 6l15 12M19.5 6l-15 12" /></svg>
        <svg style="left:14px; top:52px;" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#161414" stroke-width="2.6" stroke-linecap="round"><path d="M12 2v20M4.5 6l15 12M19.5 6l-15 12" /></svg>
        <svg style="left:14px; top:94px;" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#161414" stroke-width="2.6" stroke-linecap="round"><path d="M12 2v20M4.5 6l15 12M19.5 6l-15 12" /></svg>
        <svg style="right:120px; bottom:-16px; opacity:.25;" width="70" height="70" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"><path d="M12 2v20M4.5 6l15 12M19.5 6l-15 12" /></svg>
      </div>
      <span class="hero-brand">raw.</span>
      <div class="hero-inner">
        <div class="hero-title"><h1>ระบบออกใบแจ้งหนี้</h1></div>

        <div class="pagebar" role="tablist">
          <button
            class="page-tab"
            :class="{ active: currentPage === 'invoice' }"
            @click="currentPage = 'invoice'"
          >
            📝 สร้างใบแจ้งหนี้
          </button>
          <button
            class="page-tab"
            :class="{ active: currentPage === 'history' }"
            @click="currentPage = 'history'"
          >
            📋 ประวัติ ({{ history.length }})
          </button>
        </div>

        <div v-if="currentPage === 'invoice'" class="tabbar" role="tablist">
          <button
            class="tab"
            :class="{ active: clientType === 'corporate' }"
            @click="clientType = 'corporate'"
          >
            นิติบุคคล
          </button>
          <button
            class="tab"
            :class="{ active: clientType === 'individual' }"
            @click="clientType = 'individual'"
          >
            บุคคลธรรมดา
          </button>
        </div>
      </div>
    </header>

    <main v-if="currentPage === 'invoice'" class="layout">
      <!-- ฟอร์มกรอกข้อมูล -->
      <section class="panel form-panel">
        <fieldset>
          <legend>ข้อมูลใบแจ้งหนี้</legend>
          <div class="grid2">
            <label>เลขที่ใบแจ้งหนี้
              <input v-model="invoiceNo" type="text" />
            </label>
            <label>วันที่
              <input v-model="invoiceDate" type="date" />
            </label>
            <label>Valid Until
              <input v-model="validUntil" type="date" />
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>ผู้ออกใบแจ้งหนี้</legend>
          <label>ชื่อ / นามแฝง
            <input v-model="sellerName" type="text" placeholder="เช่น RAVV" />
          </label>
          <div class="grid2">
            <label>เบอร์โทร
              <input v-model="sellerPhone" type="tel" />
            </label>
            <label>อีเมล
              <input v-model="sellerEmail" type="email" />
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>ข้อมูลลูกค้า (Bill To)</legend>
          <label>ชื่อบริษัท / ชื่อ-นามสกุล
            <input v-model="clientName" type="text" />
          </label>
          <label>เลขประจำตัวผู้เสียภาษี
            <input v-model="clientTaxId" type="text" />
          </label>
          <label>ที่อยู่
            <textarea v-model="clientAddress" rows="2"></textarea>
          </label>
          <div class="grid2">
            <label>เบอร์โทร
              <input v-model="clientPhone" type="tel" />
            </label>
            <label>อีเมล
              <input v-model="clientEmail" type="email" />
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>รายการสินค้า / บริการ</legend>

          <div v-if="clientType === 'corporate'" class="mode-toggle">
            <button
              type="button"
              class="chip small"
              :class="{ active: priceMode === 'gross' }"
              @click="priceMode = 'gross'"
            >
              กรอกเป็นยอดก่อนหักภาษี
            </button>
            <button
              type="button"
              class="chip small"
              :class="{ active: priceMode === 'net' }"
              @click="priceMode = 'net'"
            >
              กรอกเป็นยอดสุทธิที่ต้องการได้รับ
            </button>
          </div>
          <p v-if="clientType === 'corporate' && priceMode === 'net'" class="mode-hint">
            ระบบจะคำนวณย้อนกลับให้: ยอดก่อนหัก = ยอดสุทธิที่ต้องการ ÷ (1 - {{ whtRate }}%)
          </p>

          <div v-for="(item, idx) in items" :key="item.id" class="item-row">
            <input v-model="item.name" type="text" placeholder="ชื่อรายการ" class="item-name" />
            <input v-model.number="item.qty" type="number" min="0" step="1" placeholder="จำนวน" class="item-qty" />
            <input
              v-model.number="item.unitPrice"
              type="number"
              min="0"
              step="0.01"
              :placeholder="clientType === 'corporate' && priceMode === 'net' ? 'ยอดสุทธิ/หน่วย' : 'ราคา/หน่วย'"
              class="item-price"
            />
            <span class="item-amount">{{ formatBaht(itemAmount(item.id)) }}</span>
            <button type="button" class="btn-remove" @click="removeItem(item.id)" :disabled="items.length === 1">✕</button>
          </div>
          <div v-if="clientType === 'corporate' && priceMode === 'net'" class="item-row item-row-label">
            <span></span><span></span><span></span>
            <span class="item-amount-label">ยอดก่อนหักภาษี (ที่ต้องออกใบแจ้งหนี้)</span>
            <span></span>
          </div>
          <button type="button" class="btn-add" @click="addItem">+ เพิ่มรายการ</button>
        </fieldset>

        <fieldset v-if="clientType === 'corporate'">
          <legend>อัตราหัก ณ ที่จ่าย (WHT)</legend>
          <div class="wht-presets">
            <button
              v-for="rate in WHT_RATE_PRESETS"
              :key="rate"
              type="button"
              class="chip"
              :class="{ active: !useCustomRate && whtRate === rate }"
              @click="whtRate = rate; useCustomRate = false"
            >
              {{ rate }}%
            </button>
            <button
              type="button"
              class="chip"
              :class="{ active: useCustomRate }"
              @click="useCustomRate = true"
            >
              กำหนดเอง
            </button>
          </div>
          <label v-if="useCustomRate" class="custom-rate">
            % WHT ที่กำหนดเอง
            <input v-model.number="whtRate" type="number" min="0" max="100" step="0.1" />
          </label>
        </fieldset>

        <fieldset>
          <legend>ส่วนลด</legend>
          <label>ส่วนลด (บาท)
            <input v-model.number="discount" type="number" min="0" step="0.01" />
          </label>
        </fieldset>

        <fieldset>
          <legend>หมายเหตุ (Note)</legend>
          <label>ข้อความหมายเหตุที่จะแสดงในใบแจ้งหนี้
            <textarea v-model="note" rows="2" placeholder="เช่น หากมีการเพิ่ม/แก้ไขงานเพิ่มเติมจากเงื่อนไขในการทำงาน คิดเรทราคาตามจริงตามเงื่อนไขที่แจ้งไป"></textarea>
          </label>
        </fieldset>

        <fieldset>
          <legend>ข้อมูลรับเงิน</legend>
          <div class="grid2">
            <label>ธนาคาร
              <input v-model="bankName" type="text" />
            </label>
            <label>เลขที่บัญชี
              <input v-model="accountNo" type="text" />
            </label>
          </div>
          <label>ชื่อบัญชี
            <input v-model="accountName" type="text" />
          </label>
        </fieldset>
      </section>

      <!-- พรีวิวใบแจ้งหนี้ -->
      <section class="panel preview-panel">
        <div class="invoice-preview" id="invoice-preview">
          <img src="/invoice-header.jpeg" alt="Invoice header" class="inv-banner" />
          <div class="inv-header">
            <h2>INVOICE</h2>
          </div>

          <div class="inv-meta">
            <div><b>เลขที่:</b> {{ invoiceNo }}</div>
            <div><b>วันที่:</b> {{ invoiceDate }}</div>
            <div v-if="validUntil"><b>Valid Until:</b> {{ validUntil }}</div>
          </div>

          <div class="inv-parties">
            <div>
              <b>จาก</b><br />
              {{ sellerName }}<br />
              <span v-if="sellerPhone">{{ sellerPhone }}<br /></span>
              <span v-if="sellerEmail">{{ sellerEmail }}</span>
            </div>
            <div>
              <b>ถึง</b><br />
              {{ clientName }}<br />
              <span v-if="clientTaxId">เลขผู้เสียภาษี: {{ clientTaxId }}<br /></span>
              <span v-if="clientAddress">{{ clientAddress }}<br /></span>
              <span v-if="clientPhone">{{ clientPhone }}<br /></span>
              <span v-if="clientEmail">{{ clientEmail }}</span>
            </div>
          </div>

          <table class="inv-table">
            <thead>
              <tr>
                <th>รายการ</th>
                <th>จำนวน</th>
                <th>ราคา/หน่วย</th>
                <th>ยอดรวม</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in items" :key="item.id">
                <td>{{ item.name || '-' }}</td>
                <td class="num">{{ item.qty }}</td>
                <td class="num">{{ formatBaht(item.unitPrice) }}</td>
                <td class="num">{{ formatBaht(itemAmount(item.id)) }}</td>
              </tr>
              <tr v-if="clientType === 'corporate'" class="wht-row">
                <td>หัก ณ ที่จ่าย ({{ totals.whtRate }}%)</td>
                <td class="num">1</td>
                <td class="num">-{{ formatBaht(totals.whtAmount) }}</td>
                <td class="num">-{{ formatBaht(totals.whtAmount) }}</td>
              </tr>
            </tbody>
          </table>

          <p v-if="note" class="inv-note"><b>Note:</b> {{ note }}</p>

          <div class="inv-summary">
            <div class="row"><span>Subtotal</span><span>{{ formatBaht(totals.subtotal) }}</span></div>
            <div class="row" v-if="totals.discount > 0"><span>ส่วนลด</span><span>-{{ formatBaht(totals.discount) }}</span></div>
            <div class="row" v-if="clientType === 'corporate'">
              <span>หัก ณ ที่จ่าย ({{ totals.whtRate }}%)</span><span>-{{ formatBaht(totals.whtAmount) }}</span>
            </div>
            <div class="row total"><span>TOTAL</span><span>{{ formatBaht(totals.total) }} บาท</span></div>
          </div>

          <div class="inv-payment" v-if="bankName || accountNo || accountName">
            <b>ข้อมูลการโอนเงิน</b><br />
            <span v-if="bankName">{{ bankName }} </span>
            <span v-if="accountNo">{{ accountNo }}</span><br />
            <span v-if="accountName">{{ accountName }}</span>
          </div>
        </div>

        <button type="button" class="btn-print" @click="printInvoice">พิมพ์ / บันทึกเป็น PDF</button>
        <button type="button" class="btn-save" @click="saveToHistory">💾 บันทึกใบนี้ลงประวัติ</button>
      </section>
    </main>

    <main v-else class="history-page">
      <section class="panel">
        <fieldset>
          <legend>เชื่อมต่อ Google Sheet (ไม่บังคับ)</legend>
          <label>Google Apps Script Web App URL
            <input
              v-model="sheetWebhookUrl"
              @change="onWebhookUrlChange"
              type="text"
              placeholder="https://script.google.com/macros/s/xxxxx/exec"
            />
          </label>
          <p class="hint-text">
            ใส่ URL แล้วทุกครั้งที่กด "บันทึกใบนี้ลงประวัติ" ระบบจะส่งข้อมูลไปเพิ่มแถวใน Google Sheet ให้อัตโนมัติ
            (ดูวิธีสร้าง Web App นี้ใน README ของโปรเจกต์)
          </p>
          <span v-if="syncStatus === 'saving'" class="sync-status saving">กำลังส่งไป Google Sheet...</span>
          <span v-if="syncStatus === 'saved'" class="sync-status saved">✓ ส่งไป Google Sheet สำเร็จ</span>
          <span v-if="syncStatus === 'error'" class="sync-status error">✕ ส่งไม่สำเร็จ ตรวจสอบ URL อีกครั้ง</span>
        </fieldset>
      </section>

      <section class="panel">
        <div class="history-header">
          <legend class="history-title">ประวัติใบแจ้งหนี้ ({{ filteredHistory.length }}{{ historySearch ? ` จาก ${history.length}` : '' }} รายการ)</legend>
          <input
            v-model="historySearch"
            type="text"
            class="history-search"
            placeholder="ค้นหาเลขที่ใบแจ้งหนี้ หรือชื่อลูกค้า..."
          />
        </div>

        <div class="history-actions">
          <button type="button" class="btn-add" @click="exportExcel" :disabled="history.length === 0">
            📊 Export เป็น Excel (.xlsx)
          </button>
          <button
            type="button"
            class="btn-add"
            @click="syncAllToSheet"
            :disabled="history.length === 0 || !sheetWebhookUrl"
          >
            🔄 ซิงค์ทั้งหมดไป Google Sheet
          </button>
        </div>

        <div v-if="history.length === 0" class="history-empty">ยังไม่มีประวัติที่บันทึกไว้ — ไปที่ "สร้างใบแจ้งหนี้" แล้วกด "บันทึกใบนี้ลงประวัติ" เพื่อเริ่มเก็บประวัติ</div>
        <div v-else-if="filteredHistory.length === 0" class="history-empty">ไม่พบรายการที่ตรงกับคำค้นหา</div>
        <table v-else class="history-table">
          <thead>
            <tr>
              <th>วันที่บันทึก</th>
              <th>เลขที่</th>
              <th>ลูกค้า</th>
              <th>ประเภท</th>
              <th class="num">Subtotal</th>
              <th class="num">WHT</th>
              <th class="num">TOTAL</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="h in filteredHistory" :key="h.id">
              <td>{{ new Date(h.savedAt).toLocaleDateString('th-TH') }}</td>
              <td>{{ h.invoiceNo }}</td>
              <td>{{ h.clientName || '-' }}</td>
              <td>{{ h.clientType === 'corporate' ? 'นิติบุคคล' : 'บุคคลธรรมดา' }}</td>
              <td class="num">{{ formatBaht(h.subtotal) }}</td>
              <td class="num">{{ h.whtRate > 0 ? formatBaht(h.whtAmount) : '-' }}</td>
              <td class="num">{{ formatBaht(h.total) }}</td>
              <td><button type="button" class="btn-remove" @click="removeHistoryEntry(h.id)">✕</button></td>
            </tr>
          </tbody>
        </table>
      </section>
    </main>
  </div>
</template>

<style scoped src="./App.css"></style>
