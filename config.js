// =============================================================
// KONFIGURASI SUPABASE
// Ganti 2 baris di bawah dengan data project Anda
// (bisa dilihat di Supabase → Settings → API)
// =============================================================

const SUPABASE_URL      = 'https://jopljietaofydczmchzm.supabase.co/rest/v1/';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpvcGxqaWV0YW9meWRjem1jaHptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0ODE5MDksImV4cCI6MjEwNzA1NzkwOX0.VCpL5ACchcRaHYogEAE44My2XWToL4NQAe3gB4E9lWs';

// -------------------------------------------------------------
// Inisialisasi Supabase client (pakai global `supabase` dari CDN)
// -------------------------------------------------------------
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const EDGE_SEND_WA = SUPABASE_URL + '/functions/v1/send-wa';

// -------------------------------------------------------------
// Helper: pastikan user sudah login
// -------------------------------------------------------------
async function requireAuth() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    window.location.href = 'index.html';
    return null;
  }
  return session;
}

// -------------------------------------------------------------
// Helper: escape HTML
// -------------------------------------------------------------
function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// -------------------------------------------------------------
// Helper: format tanggal Indonesia
// -------------------------------------------------------------
function fmtDate(d) {
  if (!d) return '-';
  const dt = new Date(d + (d.length === 10 ? 'T00:00:00' : ''));
  return dt.toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

// -------------------------------------------------------------
// Helper: hitung selisih hari dari hari ini
// -------------------------------------------------------------
function daysDiff(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr + 'T00:00:00');
  const today  = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

// -------------------------------------------------------------
// Helper: kirim WA via Edge Function
// -------------------------------------------------------------
async function sendWA({ prescription_id = null, tipe, target_wa, pesan }) {
  const res = await fetch(EDGE_SEND_WA, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ prescription_id, tipe, target_wa, pesan })
  });
  return res.json();
}

// -------------------------------------------------------------
// Helper: render template {nama} {no_rm} dst
// -------------------------------------------------------------
function renderTemplate(tpl, data) {
  return String(tpl || '').replace(/\{(\w+)\}/g, (_, k) => data[k] ?? '');
}

// -------------------------------------------------------------
// Helper: label status SP
// -------------------------------------------------------------
const STATUS_SP_LABEL = {
  belum_sp:  { text: 'Belum SP',  cls: 'bg-red-100 text-red-700' },
  sp_dibuat: { text: 'SP Dibuat', cls: 'bg-yellow-100 text-yellow-700' },
  dikirim:   { text: 'Dikirim',   cls: 'bg-blue-100 text-blue-700' },
  diterima:  { text: 'Diterima',  cls: 'bg-green-100 text-green-700' },
};

// -------------------------------------------------------------
// Helper: render badge status
// -------------------------------------------------------------
function statusBadge(status) {
  const s = STATUS_SP_LABEL[status] || STATUS_SP_LABEL.belum_sp;
  return `<span class="px-2 py-1 rounded text-xs font-medium ${s.cls}">${s.text}</span>`;
}

// -------------------------------------------------------------
// Helper: navbar (dipakai semua halaman setelah login)
// -------------------------------------------------------------
function renderNav(active) {
  const items = [
    { href: 'dashboard.html',    label: 'Dashboard' },
    { href: 'input-resep.html',  label: 'Input Resep' },
    { href: 'pengaturan.html',   label: 'Pengaturan' },
  ];
  return `
    <nav class="bg-white shadow-sm">
      <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-xl">💊</span>
          <span class="font-bold text-slate-700">Notifikasi Pasien CAPD</span>
        </div>
        <div class="flex items-center gap-1">
          ${items.map(i => `
            <a href="${i.href}"
               class="px-3 py-2 rounded text-sm font-medium
                      ${active === i.href
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-600 hover:bg-slate-100'}">
              ${i.label}
            </a>`).join('')}
          <button onclick="logout()"
                  class="ml-2 px-3 py-2 rounded text-sm font-medium text-red-600 hover:bg-red-50">
            Logout
          </button>
        </div>
      </div>
    </nav>`;
}

async function logout() {
  await sb.auth.signOut();
  window.location.href = 'index.html';
}
