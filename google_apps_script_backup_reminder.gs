/**
 * =========================================================================================
 * GOOGLE APPS SCRIPT: BACKUP SUPABASE KE GOOGLE SHEET & REMINDER WA RINGKAS (SHEET SETING)
 * =========================================================================================
 * Membaca Tab Sheet 'seting':
 * Kolom A: Nama
 * Kolom B: Area (BDG, CRB, SKB, TSM, SBN, BDU, ALL, dll.)
 * Kolom C: Kategori (SERVICE / DM)
 * Kolom D: No HP (Format 628...)
 * Kolom E: Token Fonte
 * Kolom F: Status Reminder (ON / OFF)
 * =========================================================================================
 */

// ================= KONFIGURASI UTAMA =================
const CONFIG = {
  // Supabase REST API Configuration (PROJECT BARU AKTIF)
  SUPABASE_URL: 'https://bfkmxhvqezdobsbgxmzg.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_FMzN5oje55yHwz3Sv1s6ww_AyYU3r9K', // Kunci Publishable Baru
  
  // Token Fonnte WhatsApp API (Otomatis dibaca dari Sheet 'seting' jika dikosongkan)
  FONNTE_TOKEN: 'FejqMMmJNpcfvouaqVoE',
  
  // Nama Sheet untuk Backup Data & Setting Kontak
  SHEET_NAME_BACKUP: 'BACKUP_PERMINTAAN',
  SHEET_NAME_SETING: 'seting',
  
  // Link Web App Permintaan Toko
  APP_URL: 'https://jabargroup.github.io/PermintaanToko/'
};

/**
 * =========================================================================
 * 1. WEB APP HANDLER (GET & POST) UNTUK INTEGRASI WEB APLIKASI
 * =========================================================================
 */
function doGet(e) {
  var action = e ? e.parameter.action : '';
  if (action === 'get_settings') {
    return handleGetSettings();
  }
  return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Google Apps Script WA Active' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    if (data.action === 'send_wa') {
      return handleSendWAWeb(data);
    }
    if (data.action === 'sync_now') {
      jalankanBackupDanReminderHarian();
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Backup & WA Reminder Completed' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Action not supported' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * =========================================================================
 * 2. FUNGSI UTAMA TRIGGER HARIAN (Pukul 18:00 WIB)
 * Panggil/Pilih fungsi ini saat Tes Manual di Apps Script!
 * =========================================================================
 */
function jalankanBackupDanReminderHarian() {
  Logger.log('=== MEMULAI PROSES OTOMATIS HARIAN ===');
  
  // 1. BACKUP DATA SUPABASE KE GOOGLE SHEET (SALING TINDIH DARI A2)
  try {
    const backupResult = backupSupabaseToGoogleSheetOverwrite();
    Logger.log('Hasil Backup Overwrite A2: ' + JSON.stringify(backupResult));
  } catch (err) {
    Logger.log('Error saat Backup: ' + err.message);
  }
  
  // 2. JEDA 60 DETIK (1 MENIT)
  Logger.log('Menunggu 60 detik sebelum memproses Reminder WA...');
  Utilities.sleep(60000); 
  
  // 3. CEK DOKUMEN PENDING DARI SHEET & BACA TAB 'SETING' UNTUK KIRIM WA RINGKAS
  try {
    const reminderResult = kirimReminderWAPendingFromSheet();
    Logger.log('Hasil Reminder WA: ' + JSON.stringify(reminderResult));
  } catch (err) {
    Logger.log('Error saat Reminder WA: ' + err.message);
  }
  
  Logger.log('=== SELESAI SELURUH PROSES OTOMATIS HARIAN ===');
}

/**
 * =========================================================================
 * 3. BAGIAN 1: BACKUP DOKUMEN SUPABASE KE GOOGLE SHEET (STATUS DETAIL & SALING TINDIH A2)
 * =========================================================================
 */
function backupSupabaseToGoogleSheetOverwrite() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME_BACKUP);
  
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME_BACKUP);
  }
  
  // Header Kolom Lengkap & Rapi Terpisah
  const headers = [
    'NO SURAT',
    'TANGGAL',
    'TOKO',
    'AREA',
    'JENIS PERMINTAAN',
    'STATUS SURAT (DETAIL)',
    'SERVICE APPROVAL',
    'ITEM KE',
    'TYPE BARANG',
    'NO SERI',
    'SERI DUS',
    'NAMA BARANG / PERMINTAAN',
    'ALASAN PERMINTAAN',
    'QTY',
    'SATUAN',
    'STATUS / NO PART (SERVICE)',
    'CATATAN TOKO',
    'DIBUAT OLEH',
    'WAKTU BACKUP (WIB)'
  ];
  
  // Pasang Header jika sheet masih kosong
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground('#0284c7');
    headerRange.setFontColor('#ffffff');
    headerRange.setFontWeight('bold');
    headerRange.setHorizontalAlignment('center');
    sheet.setFrozenRows(1);
  }
  
  // Fetch data terbaru dari Supabase table 'permintaan_toko'
  const url = CONFIG.SUPABASE_URL + '/rest/v1/permintaan_toko?select=*';
  const options = {
    method: 'GET',
    headers: {
      'apikey': CONFIG.SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + CONFIG.SUPABASE_ANON_KEY
    },
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(url, options);
  Logger.log('Supabase HTTP Status Code: ' + response.getResponseCode());
  
  if (response.getResponseCode() !== 200) {
    throw new Error('Gagal fetch Supabase permintaan_toko: ' + response.getContentText());
  }
  
  const allRows = JSON.parse(response.getContentText());
  Logger.log('Jumlah Data Ditemukan di Supabase: ' + (Array.isArray(allRows) ? allRows.length : 0));

  if (!Array.isArray(allRows)) {
    return { count: 0, message: 'Format data Supabase bukan array' };
  }
  
  const rowsToInsert = [];
  const nowStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
  
  allRows.forEach(item => {
    const noSurat = String(item.no_surat || item.noSurat || '').trim();
    if (!noSurat || noSurat.startsWith('__SYSTEM_')) return;
    
    // Parse items / daftar barang
    let itemsList = [];
    if (typeof item.items === 'string') {
      try { itemsList = JSON.parse(item.items); } catch(e) {}
    } else if (Array.isArray(item.items)) {
      itemsList = item.items;
    }
    
    const isServiceApproved = (item.service_approve === true || item.serviceApprove === true || item.service_approve === 'true');
    const srvApproveStr = isServiceApproved ? 'SUDAH APPROVE' : 'BELUM APPROVE';
    
    // EVALUASI STATUS DETAIL YANG INFORMATIF BAGI PENGGUNA
    const rawStatus = String(item.status || 'PENDING').trim().toUpperCase();
    let statusDisplay = rawStatus;
    
    if (rawStatus === 'DONE') {
      statusDisplay = 'SELESAI (DONE)';
    } else if (rawStatus === 'APPROVE') {
      statusDisplay = 'APPROVED DM';
    } else if (rawStatus === 'REJECT' || rawStatus === 'DITOLAK' || rawStatus === 'BATAL') {
      statusDisplay = 'DITOLAK / BATAL';
    } else if (isServiceApproved && rawStatus === 'PENDING') {
      statusDisplay = 'APPROVED SERVICE (MENUNGGU DM)';
    } else if (!isServiceApproved && rawStatus === 'PENDING') {
      statusDisplay = 'PENDING SERVICE';
    }
    
    const tglStr = item.tanggal || '-';
    const tokoStr = item.toko || '-';
    const areaStr = item.area || 'ALL';
    const jenisStr = item.jenis || 'REGULER';
    const catatanStr = item.catatan || '-';
    const createdByStr = item.created_by || item.createdBy || '-';
    
    // Jika ada banyak item: pisah 1 baris per item
    if (Array.isArray(itemsList) && itemsList.length > 0) {
      itemsList.forEach((it, idx) => {
        const typeBarang = it.type || it.typeBarang || it.jenis || '-';
        const noSeri = it.seri || it.noSeri || it.kodeSeri || '-';
        const seriDus = it.dus || it.seriDus || it.dusBarang || it.snDus || '-';
        const namaBarang = it.barang || it.namaBarang || it.permintaan || it.nama || '-';
        const alasan = it.alasan || it.alasanPermintaan || it.keterangan || it.ket || '-';
        const qty = Number(it.qty || it.jumlah || 1);
        const satuan = it.satuan || 'Pcs';
        const partInfo = it.statusPart || it.noPart || it.keteranganPart || '-';
        
        rowsToInsert.push([
          noSurat,
          tglStr,
          tokoStr,
          areaStr,
          jenisStr,
          statusDisplay,   // STATUS SURAT DETAIL
          srvApproveStr,   // SERVICE APPROVAL (SUDAH/BELUM)
          idx + 1,
          typeBarang,
          noSeri,
          seriDus,
          namaBarang,
          alasan,
          qty,
          satuan,
          partInfo,
          catatanStr,
          createdByStr,
          nowStr
        ]);
      });
    } else {
      rowsToInsert.push([
        noSurat,
        tglStr,
        tokoStr,
        areaStr,
        jenisStr,
        statusDisplay,
        srvApproveStr,
        1,
        '-',
        '-',
        '-',
        '-',
        '-',
        1,
        'Pcs',
        '-',
        catatanStr,
        createdByStr,
        nowStr
      ]);
    }
  });
  
  // BERSIHKAN DATA LAMA MULAI BARIS A2 KEBAWAH (SALING TINDIH DARI A2)
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    sheet.getRange(2, 1, lastRow - 1, headers.length).clearContent();
  }
  
  // TULIS DATA DARI SUPABASE MULAI BARIS A2
  if (rowsToInsert.length > 0) {
    sheet.getRange(2, 1, rowsToInsert.length, headers.length).setValues(rowsToInsert);
    for (let c = 1; c <= headers.length; c++) {
      sheet.autoResizeColumn(c);
    }
  }

  Logger.log('BERHASIL WRITE OVERWRITE KE SHEET: ' + rowsToInsert.length + ' baris.');
  
  return {
    success: true,
    overwrittenRowsCount: rowsToInsert.length,
    totalSuratCount: allRows.length
  };
}

/**
 * =========================================================================
 * 4. BAGIAN 2: KIRIM WA REMINDER RINGKAS (BACA TAB 'SETING' A-F)
 * =========================================================================
 */
function kirimReminderWAPendingFromSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Baca Data Kontak & Token Fonte dari Tab Sheet 'seting' (Kolom A s/d F)
  const settingSheet = ss.getSheetByName(CONFIG.SHEET_NAME_SETING) || ss.getSheetByName('SETTING') || ss.getSheetByName('seting');
  if (!settingSheet) {
    Logger.log('⚠️ SHEET "seting" TIDAK DITEMUKAN!');
    return { success: false, error: 'Sheet seting tidak ditemukan.' };
  }
  
  const settingRows = settingSheet.getDataRange().getValues();
  const users = [];
  let fonnteToken = CONFIG.FONNTE_TOKEN;
  
  for (let i = 1; i < settingRows.length; i++) {
    const nama = String(settingRows[i][0] || '').trim();
    const area = String(settingRows[i][1] || 'ALL').trim().toUpperCase();
    const kategori = String(settingRows[i][2] || '').trim().toUpperCase();
    const rawNoHp = String(settingRows[i][3] || '').trim();
    const tokenInSheet = String(settingRows[i][4] || '').trim();
    const statusReminder = String(settingRows[i][5] || 'ON').trim().toUpperCase();
    
    // CEK STATUS REMINDER: ABAIKAN JIKA STATUS REMINDER = OFF / NONAKTIF
    if (statusReminder === 'OFF' || statusReminder === 'NONAKTIF' || statusReminder === 'FALSE') {
      continue;
    }

    if (tokenInSheet && (!fonnteToken || fonnteToken.includes('PASTE_TOKEN'))) {
      fonnteToken = tokenInSheet;
    }
    
    const cleanHp = cleanPhoneNumber(rawNoHp);
    if (cleanHp && (kategori === 'SERVICE' || kategori === 'DM' || kategori === 'HODS')) {
      users.push({ nama: nama, area: area, kategori: kategori, phone: cleanHp });
    }
  }
  
  if (!fonnteToken || fonnteToken.includes('PASTE_TOKEN')) {
    fonnteToken = fetchTokenFromSupabaseLookup();
  }
  
  if (!fonnteToken) {
    Logger.log('⚠️ TOKEN FONNTE KOSONG! Masukkan token di Config atau Kolom E Sheet seting.');
    return { success: false, error: 'Token Fonnte belum diisi.' };
  }
  
  if (users.length === 0) {
    Logger.log('⚠️ BELUM ADA USER SERVICE / DM DENGAN STATUS REMINDER ON DI SHEET "seting".');
    return { success: false, error: 'Belum ada user Service/DM aktif di Sheet seting.' };
  }
  
  // 2. Baca Dokumen Pending dari Sheet 'BACKUP_PERMINTAAN'
  const dataSheet = ss.getSheetByName(CONFIG.SHEET_NAME_BACKUP);
  if (!dataSheet || dataSheet.getLastRow() <= 1) {
    Logger.log('ℹ️ Tidak ada data di Sheet BACKUP_PERMINTAAN.');
    return { success: true, message: 'Tidak ada data di Sheet backup.' };
  }
  
  const sheetValues = dataSheet.getDataRange().getValues();
  const pendingMap = new Map();
  
  for (let k = 1; k < sheetValues.length; k++) {
    const noSurat = String(sheetValues[k][0] || '').trim();
    const area = String(sheetValues[k][3] || 'ALL').trim().toUpperCase();
    const statusText = String(sheetValues[k][5] || '').trim().toUpperCase();
    const srvApproveText = String(sheetValues[k][6] || '').trim().toUpperCase();
    
    if (!noSurat || noSurat.startsWith('__SYSTEM_')) continue;
    if (statusText.includes('SELESAI') || statusText.includes('DONE') || statusText.includes('DITOLAK') || statusText.includes('BATAL')) continue;
    
    const isServicePending = (statusText.includes('PENDING SERVICE') || (srvApproveText !== 'SUDAH APPROVE' && !statusText.includes('APPROVED')));
    const isDMPending = (statusText.includes('APPROVED SERVICE') || (srvApproveText === 'SUDAH APPROVE' && !statusText.includes('APPROVED DM')));
    
    if (isServicePending || isDMPending) {
      if (!pendingMap.has(noSurat)) {
        pendingMap.set(noSurat, {
          noSurat: noSurat,
          area: area,
          isServicePending: isServicePending,
          isDMPending: isDMPending
        });
      }
    }
  }
  
  const pendingList = Array.from(pendingMap.values());
  const pendingService = pendingList.filter(p => p.isServicePending);
  const pendingDM = pendingList.filter(p => p.isDMPending);
  
  Logger.log(`Total Dokumen Pending: Service = ${pendingService.length}, DM = ${pendingDM.length}`);
  
  if (pendingService.length === 0 && pendingDM.length === 0) {
    Logger.log('ℹ️ Tidak ada dokumen berstatus PENDING saat ini.');
    return { success: true, message: 'Tidak ada dokumen pending.' };
  }
  
  let totalTerkirim = 0;
  const processedKeys = new Set(); // KUNCI ANTI-DUPLIKAT PER UNIK USER & AREA

  // 3. KIRIM WA PENGINGAT RINGKAS SERVICE (1 WA RINGKAS KONSOLIDASI)
  if (pendingService.length > 0) {
    const serviceUsers = users.filter(u => u.kategori === 'SERVICE' || u.kategori === 'HODS');
    serviceUsers.forEach(srv => {
      const userKey = `${srv.nama}_${srv.area}_${srv.kategori}_${srv.phone}`;
      if (processedKeys.has(userKey)) return;
      
      const userReqs = pendingService.filter(r => {
        if (srv.area === 'ALL' || srv.area === 'SEMUA' || !srv.area || srv.area === '-') return true;
        if (!r.area || r.area === 'ALL' || r.area === 'SEMUA' || r.area === '-') return true;
        return srv.area === r.area;
      });
      
      if (userReqs.length > 0) {
        const uniqueNoSuratList = Array.from(new Set(userReqs.map(r => r.noSurat)));
        const itemsStr = uniqueNoSuratList.map((ns, idx) => `${idx + 1}.${ns}`).join('\n');
        
        const pesan = 
          `Kepada Yth. Bapak/Ibu ${srv.nama},\n\n` +
          `berikut No surat permintaan menunggu approval anda:\n` +
          `${itemsStr}\n\n` +
          `${CONFIG.APP_URL}\n\n` +
          `Terima kasih.`;
          
        const res = kirimPesanFonnte(fonnteToken, srv.phone, pesan);
        if (res && res.status === true) {
          totalTerkirim++;
          processedKeys.add(userKey);
        }
      }
    });
  }
  
  // 4. KIRIM WA PENGINGAT RINGKAS DM (1 WA RINGKAS KONSOLIDASI)
  if (pendingDM.length > 0) {
    const dmUsers = users.filter(u => u.kategori === 'DM');
    dmUsers.forEach(dm => {
      const userKey = `${dm.nama}_${dm.area}_${dm.kategori}_${dm.phone}`;
      if (processedKeys.has(userKey)) return;
      
      const userReqs = pendingDM.filter(r => {
        if (dm.area === 'ALL' || dm.area === 'SEMUA' || !dm.area || dm.area === '-') return true;
        if (!r.area || r.area === 'ALL' || r.area === 'SEMUA' || r.area === '-') return true;
        return dm.area === r.area;
      });
      
      if (userReqs.length > 0) {
        const uniqueNoSuratList = Array.from(new Set(userReqs.map(r => r.noSurat)));
        const itemsStr = uniqueNoSuratList.map((ns, idx) => `${idx + 1}.${ns}`).join('\n');
        
        const pesan = 
          `Kepada Yth. Bapak/Ibu ${dm.nama},\n\n` +
          `berikut No surat permintaan menunggu approval anda:\n` +
          `${itemsStr}\n\n` +
          `${CONFIG.APP_URL}\n\n` +
          `Terima kasih.`;
          
        const res = kirimPesanFonnte(fonnteToken, dm.phone, pesan);
        if (res && res.status === true) {
          totalTerkirim++;
          processedKeys.add(userKey);
        }
      }
    });
  }
  
  return {
    success: true,
    totalPesanTerkirim: totalTerkirim,
    pendingServiceCount: pendingService.length,
    pendingDMCount: pendingDM.length
  };
}

/**
 * =========================================================================
 * 5. HELPER UNTUK APPS SCRIPT WEB APP & FONNTE API
 * =========================================================================
 */
function handleGetSettings() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME_SETING) || ss.getSheetByName('SETTING') || ss.getSheetByName('seting');
  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'success', items: [] })).setMimeType(ContentService.MimeType.JSON);
  }
  
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'success', items: [] })).setMimeType(ContentService.MimeType.JSON);
  }
  
  var headers = data[0];
  var items = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j];
    }
    items.push(obj);
  }
  return ContentService.createTextOutput(JSON.stringify({ status: 'success', items: items })).setMimeType(ContentService.MimeType.JSON);
}

function handleSendWAWeb(data) {
  var target = data.target;
  var message = data.message;
  var token = data.fonteToken || CONFIG.FONNTE_TOKEN;

  if (!target || !token) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Target phone or Token missing' })).setMimeType(ContentService.MimeType.JSON);
  }

  var res = kirimPesanFonnte(token, target, message);
  return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
}

function kirimPesanFonnte(token, target, message) {
  const url = 'https://api.fonnte.com/send';
  const payload = {
    target: target,
    message: message,
    countryCode: '62'
  };
  
  const options = {
    method: 'POST',
    headers: {
      'Authorization': token.trim()
    },
    payload: payload,
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    Logger.log(`[FONNTE RESPONSE to ${target}]: ` + response.getContentText());
    return result;
  } catch (err) {
    Logger.log(`[FONNTE ERROR to ${target}]: ` + err.message);
    return { status: false, error: err.message };
  }
}

function cleanPhoneNumber(phone) {
  if (!phone) return '';
  let clean = String(phone).replace(/[^0-9]/g, '');
  if (!clean || clean.length < 5) return '';
  if (clean.startsWith('0')) {
    clean = '62' + clean.slice(1);
  } else if (!clean.startsWith('62')) {
    clean = '62' + clean;
  }
  return clean;
}

function fetchTokenFromSupabaseLookup() {
  try {
    const url = CONFIG.SUPABASE_URL + '/rest/v1/lookup?key=eq.fonteToken&select=value';
    const options = {
      method: 'GET',
      headers: {
        'apikey': CONFIG.SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + CONFIG.SUPABASE_ANON_KEY
      },
      muteHttpExceptions: true
    };
    const res = UrlFetchApp.fetch(url, options);
    if (res.getResponseCode() === 200) {
      const arr = JSON.parse(res.getContentText());
      if (Array.isArray(arr) && arr.length > 0 && arr[0].value) {
        return String(arr[0].value).trim();
      }
    }
  } catch(e) {
    Logger.log('Notice: Tidak dapat mengambil token dari Supabase lookup: ' + e.message);
  }
  return '';
}

/**
 * =========================================================================
 * 6. PASANG TRIGGER OTOMATIS (CUKUP DIJALANKAN SEKALI DARI APPS SCRIPT)
 * =========================================================================
 */
function pasangTriggerJam18Otomatis() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction() === 'jalankanBackupDanReminderHarian') {
      ScriptApp.deleteTrigger(t);
    }
  });
  
  ScriptApp.newTrigger('jalankanBackupDanReminderHarian')
    .timeBased()
    .everyDays(1)
    .atHour(18)
    .inTimezone('Asia/Jakarta')
    .create();
    
  Logger.log('✅ Trigger Otomatis Jam 18:00 WIB Berhasil Dipasang!');
}
