// Builds a one-page A4 PDF payment receipt in the browser, with no libraries.
// Uses the standard PDF fonts (Helvetica), so text stays selectable and the file
// is a few KB. Characters outside Latin-1 are simplified for the PDF.
import { getCurriculum } from '../data/catalog';
import { formatAmount, amountInWords } from './money';

/**
 * Business details printed on every receipt. Fill these in before going live;
 * empty fields are simply left off the receipt.
 */
export const COMPANY = {
  name: 'Monklogy',
  tagline: 'Software development courses',
  address: [], // e.g. ['Monklogy Learning Pvt. Ltd.', '12 Example Road', 'Chennai 600001, India']
  email: '', // e.g. 'billing@yourdomain.in'
  website: '',
  gstin: ''
};

const W = 595.28;
const H = 841.89;
const M = 50; // page margin
const R = W - M;

const QUOTES = [
  { text: 'The expert in anything was once a beginner.', by: 'Helen Hayes' },
  { text: 'First, solve the problem. Then, write the code.', by: 'John Johnson' },
  { text: 'Learning never exhausts the mind.', by: 'Leonardo da Vinci' },
  { text: 'The beautiful thing about learning is that nobody can take it away from you.', by: 'B. B. King' },
  { text: 'It always seems impossible until it is done.', by: 'Nelson Mandela' },
  { text: 'An investment in knowledge pays the best interest.', by: 'Benjamin Franklin' }
];
export const pickQuote = (seed = Date.now()) => QUOTES[Math.abs(Math.floor(seed / 1000)) % QUOTES.length];

// ── text helpers ──────────────────────────────────────────────
const latin1 = (str) =>
  String(str ?? '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/₹/g, 'Rs.')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\xFF]/g, '?');
const esc = (s) => latin1(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
const rgb = (h) => {
  const n = parseInt(h.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255].map((v) => v.toFixed(3)).join(' ');
};

// Standard Helvetica / Helvetica-Bold advance widths for ASCII 32–126 (per 1000 em).
const HELV = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const HELV_B = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
const FONTS = { reg: 'F1', bold: 'F2', ital: 'F3' };
const widthOf = (str, size, font = 'reg') => {
  const table = font === 'bold' ? HELV_B : HELV;
  let w = 0;
  for (const ch of latin1(str)) {
    const c = ch.charCodeAt(0);
    w += c >= 32 && c <= 126 ? table[c - 32] : 556;
  }
  return (w / 1000) * size;
};
const wrap = (str, size, max, font) => {
  const lines = [];
  let line = '';
  latin1(str).split(/\s+/).forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (line && widthOf(next, size, font) > max) {
      lines.push(line);
      line = word;
    } else line = next;
  });
  if (line) lines.push(line);
  return lines;
};

class Page {
  constructor() { this.ops = []; }
  fill(h) { this.ops.push(`${rgb(h)} rg`); }
  rect(x, y, w, h, color) { this.fill(color); this.ops.push(`${x.toFixed(2)} ${(H - y - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`); }
  line(x1, y, x2, color = '#d9d6cf', width = 0.6) {
    this.ops.push(`${rgb(color)} RG ${width} w ${x1.toFixed(2)} ${(H - y).toFixed(2)} m ${x2.toFixed(2)} ${(H - y).toFixed(2)} l S`);
  }
  box(x, y, w, h, color, width = 0.9) {
    this.ops.push(`${rgb(color)} RG ${width} w ${x.toFixed(2)} ${(H - y - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S`);
  }
  text(str, x, y, { size = 9.5, font = 'reg', color = '#1d1d1b', align = 'left', spacing = 0 } = {}) {
    const s = latin1(str);
    let w = widthOf(s, size, font) + spacing * Math.max(0, s.length - 1);
    let tx = x;
    if (align === 'right') tx = x - w;
    if (align === 'center') tx = x - w / 2;
    this.fill(color);
    this.ops.push(`BT /${FONTS[font]} ${size} Tf ${spacing ? `${spacing} Tc ` : ''}${tx.toFixed(2)} ${(H - y).toFixed(2)} Td (${esc(s)}) Tj ${spacing ? '0 Tc ' : ''}ET`);
    return w;
  }
}

const buildPdf = (content, title) => {
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 5 0 R /F2 6 0 R /F3 7 0 R >> >> /Contents 4 0 R >>`,
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>',
    `<< /Title (${esc(title)}) /Author (${esc(COMPANY.name)}) /Creator (${esc(COMPANY.name)}) >>`
  ];
  let out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((o) => { out += `${String(o).padStart(10, '0')} 00000 n \n`; });
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info ${objs.length} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
  return new Blob([bytes], { type: 'application/pdf' });
};

// ── the receipt ───────────────────────────────────────────────
const C = { ink: '#1d1d1b', body: '#3b3a36', muted: '#7c786f', faint: '#a7a39a', rule: '#dcd8d0', band: '#f5f3ef', brand: '#c65a12', green: '#23744a' };
const inr = (n) => `INR ${formatAmount(n)}`;

export const receiptNumber = (r) => (r.order ? r.order.replace(/^MNK-/, 'RCT-') : `RCT-${r.at}`);
export const receiptFileName = (r) => `Monklogy-Receipt-${receiptNumber(r)}.pdf`;

export const buildReceipt = (r, courses) => {
  const g = new Page();
  const at = new Date(r.at);
  const dateLong = at.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  const time = at.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).toUpperCase();
  const zone = (() => {
    try { return Intl.DateTimeFormat('en-IN', { timeZoneName: 'short' }).formatToParts(at).find((p) => p.type === 'timeZoneName')?.value || ''; } catch { return ''; }
  })();
  const name = r.customer?.name || 'Learner';
  const first = r.customer?.firstName || name.split(' ')[0];
  const number = receiptNumber(r);

  // ── top accent + letterhead
  g.rect(0, 0, W, 5, C.brand);
  let y = 62;
  g.text(COMPANY.name, M, y, { size: 21, font: 'bold' });
  g.text(COMPANY.tagline, M, y + 16, { size: 9, color: C.muted });
  let ly = y + 30;
  [...COMPANY.address, COMPANY.email, COMPANY.website, COMPANY.gstin && `GSTIN ${COMPANY.gstin}`].filter(Boolean).forEach((l) => {
    g.text(l, M, ly, { size: 8.5, color: C.muted });
    ly += 11;
  });

  g.text('RECEIPT', R, y, { size: 20, font: 'bold', align: 'right', spacing: 1.5 });
  // PAID mark
  const paidW = 46;
  g.box(R - paidW, y + 9, paidW, 17, C.green, 1);
  g.text('PAID', R - paidW / 2, y + 21, { size: 9, font: 'bold', color: C.green, align: 'center', spacing: 1.2 });

  // ── meta block (right)
  const meta = [
    ['Receipt no.', number],
    ['Date of issue', dateLong],
    ['Order no.', r.order || '-']
  ];
  let my = y + 46;
  meta.forEach(([k, v]) => {
    g.text(k, R - 150, my, { size: 8.5, color: C.muted });
    g.text(v, R, my, { size: 8.5, font: 'bold', align: 'right' });
    my += 13;
  });

  y = Math.max(ly, my) + 18;
  g.line(M, y, R);

  // ── billed to / payment details
  y += 22;
  const colB = M + (R - M) / 2 + 10;
  const label = (t, x, yy) => g.text(t.toUpperCase(), x, yy, { size: 7.5, font: 'bold', color: C.muted, spacing: 0.8 });
  label('Billed to', M, y);
  label('Payment details', colB, y);
  g.text(name, M, y + 16, { size: 10.5, font: 'bold' });
  g.text(r.customer?.email || '', M, y + 30, { size: 9, color: C.body });

  const pay = [
    ['Payment method', r.method || '-'],
    ['Transaction ID', r.transactionId || '-'],
    ['Paid on', `${dateLong}, ${time}${zone ? ` ${zone}` : ''}`],
    ['Status', 'Successful']
  ];
  let py = y + 16;
  pay.forEach(([k, v]) => {
    g.text(k, colB, py, { size: 8.5, color: C.muted });
    g.text(v, R, py, { size: 8.5, font: k === 'Status' ? 'bold' : 'reg', color: k === 'Status' ? C.green : C.ink, align: 'right' });
    py += 13;
  });

  // ── line items
  y = py + 24;
  const cols = { idx: M + 8, desc: M + 34, qty: R - 190, unit: R - 98, amt: R - 8 };
  g.rect(M, y - 13, R - M, 22, C.band);
  const th = (t, x, align = 'left') => g.text(t.toUpperCase(), x, y + 1, { size: 7.5, font: 'bold', color: C.muted, align, spacing: 0.6 });
  th('#', cols.idx);
  th('Description', cols.desc);
  th('Qty', cols.qty, 'right');
  th('Unit price', cols.unit, 'right');
  th('Amount', cols.amt, 'right');
  y += 30;
  courses.forEach((c, i) => {
    const lessons = getCurriculum(c.id)?.lessons?.length || 0;
    g.text(String(i + 1), cols.idx, y, { size: 9.5, color: C.muted });
    g.text(c.title, cols.desc, y, { size: 10, font: 'bold' });
    g.text(`${c.subtitle ? `${c.subtitle}  ·  ` : ''}${lessons} lessons  ·  Lifetime access`, cols.desc, y + 13, { size: 8, color: C.muted });
    g.text('1', cols.qty, y, { size: 9.5, align: 'right' });
    g.text(formatAmount(c.price), cols.unit, y, { size: 9.5, align: 'right' });
    g.text(formatAmount(c.price), cols.amt, y, { size: 9.5, align: 'right' });
    y += 26;
    g.line(M, y, R);
    y += 20;
  });

  // ── totals
  const tl = R - 210;
  const total = (k, v, strong = false) => {
    g.text(k, tl, y, { size: strong ? 10.5 : 9, font: strong ? 'bold' : 'reg', color: strong ? C.ink : C.body });
    g.text(v, cols.amt, y, { size: strong ? 10.5 : 9, font: strong ? 'bold' : 'reg', align: 'right' });
    y += strong ? 0 : 15;
  };
  total('Subtotal', inr(r.paid));
  total('Discount', inr(0));
  y += 2;
  g.line(tl, y - 9, R, C.ink, 0.9);
  y += 7;
  total('Total paid', inr(r.paid), true);

  // amount in words (left of totals)
  const words = `Indian Rupees ${amountInWords(r.paid)} Only`;
  label('Amount in words', M, y - 40);
  wrap(words, 9, tl - M - 30, 'reg').forEach((l, i) => g.text(l, M, y - 26 + i * 12, { size: 9, color: C.body }));

  // ── closing note
  y += 46;
  g.line(M, y, R);
  y += 30;
  const q = r.quote || pickQuote(r.at);
  const inner = R - M - 20;
  wrap(`"${q.text}"`, 12.5, inner, 'ital').forEach((l) => {
    g.text(l, M, y, { size: 12.5, font: 'ital', color: C.ink });
    y += 16;
  });
  g.text(`- ${q.by}`, M, y + 1, { size: 8.5, color: C.muted });
  y += 24;
  const wish = `Congratulations, ${first}, and welcome aboard. You have just made a real investment in your future. Every lesson you complete brings you closer to the developer you want to become. Learn steadily, build boldly, and enjoy the journey. We are proud to be part of it.`;
  wrap(wish, 9.5, inner, 'reg').forEach((l) => {
    g.text(l, M, y, { size: 9.5, color: C.body });
    y += 14;
  });
  y += 8;
  g.text(`Warm regards, Team ${COMPANY.name}`, M, y, { size: 9.5, font: 'bold', color: C.ink });

  // ── footer
  const fy = H - 58;
  g.line(M, fy, R);
  g.text('This is a computer-generated receipt and does not require a signature.', M, fy + 16, { size: 7.8, color: C.muted });
  g.text('One-time purchase  ·  Lifetime access  ·  30-day refund policy', M, fy + 28, { size: 7.8, color: C.muted });
  g.text(number, R, fy + 16, { size: 7.8, color: C.muted, align: 'right' });
  g.text('Page 1 of 1', R, fy + 28, { size: 7.8, color: C.muted, align: 'right' });

  return buildPdf(g.ops.join('\n'), `Receipt ${number}`);
};

export const downloadReceipt = (r, courses) => {
  const blob = buildReceipt(r, courses);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = receiptFileName(r);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};
