// =============================================================
// KONFIGURASI SUPABASE — MODE TANPA LOGIN
// =============================================================

const SUPABASE_URL      = 'https://jopljietaofydczmchzm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpvcGxqaWV0YW9meWRjem1jaHptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0ODE5MDksImV4cCI6MjEwNzA1NzkwOX0.VCpL5ACchcRaHYogEAE44My2XWToL4NQAe3gB4E9lWs';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const EDGE_SEND_WA = SUPABASE_URL + '/functions/v1/send-wa';

// Helper escape HTML
function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// Format tgl Indonesia
function fmtDate(d) {
  if (!d) return '-';
  const dt = new Date(d + (d.length === 10 ? 'T00:00:00' : ''));
  return dt.toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

// Selisih hari dari hari ini
function daysDiff(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr + 'T00:00:00');
  const today  = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

// Kirim WA via Edge Function
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

// Render template {nama} dsb
function renderTemplate(tpl, data) {
  return String(tpl || '').replace(/\{(\w+)\}/g, (_, k) => data[k] ?? '');
}

// Navbar (tanpa logout)
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
        </div>
      </div>
    </nav>`;
}
// -------------------------------------------------------------
// Helper: Reset reminder setelah edit resep
// - Hapus notif H-1/H+1/H+3 lama yang belum terkirim
// - Reset no_show_log
// - Buat ulang no_show_log untuk siklus baru
// -------------------------------------------------------------
async function resetReminderForPrescription(prescriptionId, patientId, tglKontrolBerikutnya) {
  // 1. Hapus no_show_log lama untuk resep ini
  await sb.from('no_show_log').delete().eq('prescription_id', prescriptionId);

  // 2. Buat no_show_log baru dengan tgl target baru
  await sb.from('no_show_log').insert({
    prescription_id: prescriptionId,
    patient_id: patientId,
    tgl_kontrol_target: tglKontrolBerikutnya,
    status: 'pending'
  });

  // 3. Hapus notif log lama yang belum pernah sukses (opsional, biar rapi)
  //    Tapi biarkan yang sudah terkirim sebagai history
}

// -------------------------------------------------------------
// Helper: Hapus resep beserta data terkait
// -------------------------------------------------------------
async function deletePrescription(prescriptionId) {
  // Hapus no_show_log
  await sb.from('no_show_log').delete().eq('prescription_id', prescriptionId);

  // Hapus notif log
  await sb.from('notifications_log').delete().eq('prescription_id', prescriptionId);

  // Hapus resep
  const { error } = await sb.from('prescriptions').delete().eq('id', prescriptionId);
  return error;
}
