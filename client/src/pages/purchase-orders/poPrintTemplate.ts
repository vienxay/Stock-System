// ─── Types ────────────────────────────────────────────────────
interface POItem {
  id: number; quantity: number; unitPrice: number; receivedQty: number;
  product: { code: string; nameLo: string; unit: { nameLo: string } };
}
interface GR {
  id: number; grNumber: string; status: string; receivedDate: string; note?: string;
  receiver: { fullName: string };
  items: { id: number; orderedQty: number; receivedQty: number; rejectedQty: number; note?: string }[];
}
interface PODetail {
  id: number; poNumber: string; status: string;
  totalAmount: number; createdAt: string; sentAt?: string;
  supplier: { name: string; phone?: string; email?: string; paymentTerm: number };
  creator:  { fullName: string };
  purchaseRequest: { prNumber: string; purpose?: string };
  items:           POItem[];
  goodsReceipts:   GR[];
}
interface CompanySettings {
  companyName?: string; companyNameEn?: string;
  logoUrl?: string; phone?: string; address?: string;
}

// ─── Status labels ────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  open: 'ເປີດ', sent: 'ສົ່ງແລ້ວ',
  partial_received: 'ຮັບບາງສ່ວນ', received: 'ຮັບຄົບ', cancelled: 'ຍົກເລີກ',
};

const statusPillStyle = (status: string) => {
  const map: Record<string, { bg: string; color: string }> = {
    received:         { bg: '#dcfce7', color: '#166534' },
    cancelled:        { bg: '#fee2e2', color: '#991b1b' },
    sent:             { bg: '#dbeafe', color: '#1e40af' },
  };
  const s = map[status] ?? { bg: '#fef9c3', color: '#854d0e' };
  return `background:${s.bg};color:${s.color};`;
};

const watermarkColor = (status: string) =>
  status === 'received' ? '#16a34a' : status === 'cancelled' ? '#dc2626' : 'transparent';

// ─── Row builders ─────────────────────────────────────────────
const buildItemRows = (items: POItem[]) =>
  items.map((item, i) => {
    const rem = item.quantity - item.receivedQty;
    return `
    <tr>
      <td style="text-align:center;color:#64748b">${i + 1}</td>
      <td>
        <div class="product-name">${item.product.nameLo}</div>
        <div class="product-code">${item.product.code}</div>
      </td>
      <td style="text-align:center">${item.quantity.toLocaleString()} <span style="color:#64748b;font-size:10px">${item.product.unit.nameLo}</span></td>
      <td style="text-align:center;color:${item.receivedQty > 0 ? '#16a34a' : '#94a3b8'};font-weight:${item.receivedQty > 0 ? 700 : 400}">${item.receivedQty.toLocaleString()}</td>
      <td style="text-align:center;color:${rem > 0 ? '#d97706' : '#94a3b8'};font-weight:${rem > 0 ? 700 : 400}">${rem.toLocaleString()}</td>
      <td style="text-align:right">${Number(item.unitPrice).toLocaleString()}</td>
      <td style="text-align:right;font-weight:700">${(item.quantity * Number(item.unitPrice)).toLocaleString()}</td>
    </tr>`;
  }).join('');

const buildGrRows = (grs: GR[]) =>
  grs.map(gr => `
    <tr>
      <td class="gr-num">${gr.grNumber}</td>
      <td style="text-align:center">${new Date(gr.receivedDate).toLocaleDateString('lo-LA')}</td>
      <td>${gr.receiver.fullName}</td>
      <td style="color:#64748b">${gr.note ?? '-'}</td>
      <td style="text-align:center">
        <span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700">
          ${gr.status}
        </span>
      </td>
    </tr>`).join('');

// ─── CSS ──────────────────────────────────────────────────────
const buildCss = (po: PODetail) => `
  *  { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Phetsarath OT','Noto Sans Lao','Arial Unicode MS',Arial,sans-serif; font-size:12.5px; color:#1a1a2e; background:#fff; }
  .accent-bar { height:6px; background:linear-gradient(90deg,#1e40af,#3b82f6,#06b6d4); }
  .page { padding:28px 36px 24px; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:22px; }
  .company-logo { height:56px; object-fit:contain; margin-bottom:6px; display:block; }
  .company-name { font-size:17px; font-weight:800; color:#1e40af; }
  .company-sub  { font-size:10.5px; color:#64748b; margin-top:2px; }
  .doc-block { text-align:right; }
  .doc-label  { font-size:10px; font-weight:700; color:#64748b; letter-spacing:1.5px; text-transform:uppercase; }
  .doc-number { font-size:26px; font-weight:900; color:#1e40af; font-family:'Courier New',monospace; line-height:1.1; }
  .status-pill { display:inline-block; padding:4px 14px; border-radius:20px; font-size:10.5px; font-weight:700; letter-spacing:.5px; margin-top:5px; ${statusPillStyle(po.status)} }
  .print-date  { font-size:10px; color:#94a3b8; margin-top:5px; }
  .divider { height:1.5px; background:linear-gradient(90deg,#1e40af,#e2e8f0); margin:0 0 18px; border-radius:2px; }
  .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:22px; }
  .info-card  { border:1.5px solid #e2e8f0; border-radius:10px; overflow:hidden; }
  .info-card-head { background:#1e40af; color:#fff; font-size:10px; font-weight:700; letter-spacing:1px; text-transform:uppercase; padding:6px 14px; }
  .info-card-body { padding:12px 14px; }
  .info-row { display:flex; gap:8px; padding:3.5px 0; border-bottom:1px dashed #f1f5f9; }
  .info-row:last-child { border-bottom:none; }
  .lbl { color:#64748b; font-size:11px; min-width:105px; }
  .val { font-weight:600; font-size:11.5px; color:#0f172a; }
  .val-blue { color:#1e40af; }
  .sec-title { font-size:12px; font-weight:800; color:#1e40af; text-transform:uppercase; letter-spacing:.8px; border-left:4px solid #1e40af; padding-left:10px; margin:20px 0 10px; }
  .items-table { width:100%; border-collapse:collapse; font-size:11.5px; margin-bottom:4px; border:2px solid #1e40af; border-radius:6px; overflow:hidden; }
  .items-table thead tr { background:#1e40af; color:#fff; }
  .items-table th { padding:9px 10px; font-weight:700; font-size:10.5px; letter-spacing:.3px; border-right:1px solid rgba(255,255,255,0.2); }
  .items-table th:last-child { border-right:none; }
  .items-table td { padding:8px 10px; border-bottom:1px solid #e2e8f0; border-right:1px solid #e2e8f0; }
  .items-table td:last-child { border-right:none; }
  .items-table tbody tr:nth-child(even) td { background:#f8fafc; }
  .items-table tbody tr:last-child td { border-bottom:none; }
  .product-name { font-weight:600; color:#0f172a; }
  .product-code { font-size:10px; color:#94a3b8; font-family:'Courier New',monospace; margin-top:1px; }
  .total-band td { background:#1e3a8a !important; color:#fff !important; font-weight:800; font-size:13px; padding:11px 10px !important; border-right:1px solid rgba(255,255,255,0.2) !important; border-bottom:none !important; }
  .total-band td:last-child { border-right:none !important; }
  .gr-table { width:100%; border-collapse:collapse; font-size:11px; border:2px solid #0f172a; border-radius:6px; overflow:hidden; }
  .gr-table thead tr { background:#0f172a; color:#fff; }
  .gr-table th { padding:8px 10px; font-weight:600; font-size:10.5px; border-right:1px solid rgba(255,255,255,0.2); }
  .gr-table th:last-child { border-right:none; }
  .gr-table td { padding:7px 10px; border-bottom:1px solid #e2e8f0; border-right:1px solid #e2e8f0; }
  .gr-table td:last-child { border-right:none; }
  .gr-table tbody tr:nth-child(even) td { background:#f8fafc; }
  .gr-table tbody tr:last-child td { border-bottom:none; }
  .gr-num { color:#16a34a; font-weight:700; font-family:'Courier New',monospace; }
  .sign-row { display:grid; grid-template-columns:1fr 1fr 1fr; gap:20px; margin-top:32px; }
  .sign-box { text-align:center; }
  .sign-line { border-top:1.5px solid #374151; margin-top:44px; padding-top:7px; font-size:11px; color:#374151; font-weight:600; }
  .sign-sub  { font-size:10px; color:#94a3b8; margin-top:2px; }
  .doc-footer { margin-top:20px; padding-top:10px; border-top:1px solid #e2e8f0; display:flex; justify-content:space-between; font-size:10px; color:#94a3b8; }
  .watermark { position:fixed; top:38%; left:12%; transform:rotate(-30deg); font-size:72px; font-weight:900; letter-spacing:4px; color:${watermarkColor(po.status)}; opacity:.07; pointer-events:none; z-index:0; }
  @page { margin:10mm 12mm; size:A4; }
  @media print { * { -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; } .items-table, .gr-table { page-break-inside:avoid; } }
`;

// ─── Main export ──────────────────────────────────────────────
export const buildPOPrintHtml = (po: PODetail, settings?: CompanySettings): string => `<!DOCTYPE html>
<html lang="lo"><head>
  <meta charset="utf-8">
  <title>ໃບສັ່ງຊື້ ${po.poNumber}</title>
  <style>${buildCss(po)}</style>
</head><body>
<div class="accent-bar"></div>
<div class="page">
  <div class="watermark">${STATUS_LABEL[po.status] ?? ''}</div>

  <div class="header">
    <div>
      ${settings?.logoUrl ? `<img src="${settings.logoUrl}" class="company-logo" />` : ''}
      <div class="company-name">${settings?.companyName ?? 'ບໍລິສັດ'}</div>
      ${settings?.companyNameEn ? `<div class="company-sub">${settings.companyNameEn}</div>` : ''}
      ${settings?.phone   ? `<div class="company-sub">📞 ${settings.phone}</div>` : ''}
      ${settings?.address ? `<div class="company-sub">📍 ${settings.address}</div>` : ''}
    </div>
    <div class="doc-block">
      <div class="doc-label">Purchase Order</div>
      <div class="doc-number">${po.poNumber}</div>
      <div class="status-pill">${STATUS_LABEL[po.status] ?? po.status}</div>
      <div class="print-date">ພິມວັນທີ: ${new Date().toLocaleDateString('lo-LA')}</div>
    </div>
  </div>
  <div class="divider"></div>

  <div class="info-grid">
    <div class="info-card">
      <div class="info-card-head">ຂໍ້ມູນ PO</div>
      <div class="info-card-body">
        <div class="info-row"><span class="lbl">ເລກ PR</span><span class="val val-blue">${po.purchaseRequest.prNumber}</span></div>
        <div class="info-row"><span class="lbl">ສ້າງໂດຍ</span><span class="val">${po.creator.fullName}</span></div>
        <div class="info-row"><span class="lbl">ວັນທີສ້າງ</span><span class="val">${new Date(po.createdAt).toLocaleDateString('lo-LA')}</span></div>
        ${po.sentAt ? `<div class="info-row"><span class="lbl">ວັນທີສົ່ງ</span><span class="val">${new Date(po.sentAt).toLocaleDateString('lo-LA')}</span></div>` : ''}
        ${po.purchaseRequest.purpose ? `<div class="info-row"><span class="lbl">ຈຸດປະສົງ</span><span class="val">${po.purchaseRequest.purpose}</span></div>` : ''}
      </div>
    </div>
    <div class="info-card">
      <div class="info-card-head">Supplier</div>
      <div class="info-card-body">
        <div class="info-row"><span class="lbl">ຊື່</span><span class="val">${po.supplier.name}</span></div>
        ${po.supplier.phone ? `<div class="info-row"><span class="lbl">ເບີໂທ</span><span class="val">${po.supplier.phone}</span></div>` : ''}
        ${po.supplier.email ? `<div class="info-row"><span class="lbl">Email</span><span class="val">${po.supplier.email}</span></div>` : ''}
        <div class="info-row"><span class="lbl">ເງື່ອນໄຂຊຳລະ</span><span class="val">${po.supplier.paymentTerm} ວັນ</span></div>
      </div>
    </div>
  </div>

  <div class="sec-title">ລາຍການສິນຄ້າ</div>
  <table class="items-table">
    <thead><tr>
      <th style="width:36px;text-align:center">#</th>
      <th>ສິນຄ້າ</th>
      <th style="text-align:center;width:90px">ສັ່ງ</th>
      <th style="text-align:center;width:75px">ຮັບແລ້ວ</th>
      <th style="text-align:center;width:60px">ຄ້າງ</th>
      <th style="text-align:right;width:120px">ລາຄາ/ໜ່ວຍ (₭)</th>
      <th style="text-align:right;width:120px">ລວມ (₭)</th>
    </tr></thead>
    <tbody>${buildItemRows(po.items)}</tbody>
    <tfoot>
      <tr class="total-band">
        <td colspan="6" style="text-align:right;letter-spacing:.5px">ລວມທັງໝົດ :</td>
        <td style="text-align:right">${Number(po.totalAmount).toLocaleString()} ₭</td>
      </tr>
    </tfoot>
  </table>

  ${po.goodsReceipts.length > 0 ? `
  <div class="sec-title">ປະຫວັດການຮັບສິນຄ້າ &nbsp;<span style="font-size:11px;font-weight:400;color:#64748b">(${po.goodsReceipts.length} ຄັ້ງ)</span></div>
  <table class="gr-table">
    <thead><tr>
      <th>ເລກ GR</th>
      <th style="text-align:center">ວັນທີຮັບ</th>
      <th>ຜູ້ຮັບ</th>
      <th>ໝາຍເຫດ</th>
      <th style="text-align:center">ສະຖານະ</th>
    </tr></thead>
    <tbody>${buildGrRows(po.goodsReceipts)}</tbody>
  </table>` : ''}

  <div class="sign-row">
    <div class="sign-box">
      <div class="sign-line">${po.creator.fullName}</div>
      <div class="sign-sub">ຜູ້ສ້າງ / ຜູ້ຂໍ</div>
    </div>
    <div class="sign-box">
      <div class="sign-line">................................</div>
      <div class="sign-sub">ຜູ້ອະນຸມັດ / ຜູ້ຈັດການ</div>
    </div>
    <div class="sign-box">
      <div class="sign-line">${po.supplier.name}</div>
      <div class="sign-sub">Supplier ຮັບຊາບ / ວັນທີ</div>
    </div>
  </div>

  <div class="doc-footer">
    <span>${settings?.companyName ?? ''} &nbsp;|&nbsp; ເອກະສານສ້າງຈາກລະບົບ PR-PO</span>
    <span>${po.poNumber} &nbsp;|&nbsp; ໜ້າ 1 / 1</span>
  </div>
</div>
<script>window.addEventListener('load', () => { window.print(); });<\/script>
</body></html>`;
