/**
 * =========================================================================================
 * GOOGLE APPS SCRIPT: BACKUP SUPABASE KE GOOGLE SHEET, REMINDER WA & UPLOAD PDF GOOGLE DRIVE
 * =========================================================================================
 */

const CONFIG = {
  SUPABASE_URL: 'https://bfkmxhvqezdobsbgxmzg.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_FMzN5oje55yHwz3Sv1s6ww_AyYU3r9K',
  FONNTE_TOKEN: 'FejqMMmJNpcfvouaqVoE',
  SHEET_NAME_BACKUP: 'BACKUP_PERMINTAAN',
  SHEET_NAME_SETING: 'seting',
  APP_URL: 'https://jabargroup.github.io/PermintaanToko/'
};

function doGet(e) {
  try {
    var action = e ? e.parameter.action : '';
    if (action === 'get_settings') {
      return handleGetSettings();
    }
    if (action === 'upload_pdf_gdrive' || action === 'upload_pdf' || action === 'upload_gdrive') {
      return handleUploadPdfGDrive(e ? e.parameter : {});
    }
    return ContentService.createTextOutput(JSON.stringify({ 
      status: 'success', 
      message: 'Google Apps Script Web App Active',
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    var data = {};
    if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch(pErr) {
        data = e.parameter || {};
      }
    } else if (e && e.parameter) {
      data = e.parameter;
    }

    var action = data.action || '';
    if (action === 'upload_pdf_gdrive' || action === 'upload_pdf' || action === 'upload_gdrive') {
      return handleUploadPdfGDrive(data);
    }
    if (action === 'send_wa') {
      return handleSendWAWeb(data);
    }
    if (action === 'sync_now') {
      jalankanBackupDanReminderHarian();
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Backup & WA Reminder Completed' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Action not supported: ' + action }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function handleUploadPdfGDrive(data) {
  try {
    var fileName = data.fileName || data.filename || ('SURAT_PERMINTAAN_' + (data.noSurat || Date.now()) + '.pdf');
    var base64Data = data.fileBase64 || data.base64 || '';
    if (!base64Data) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Data Base64 PDF tidak ditemukan' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (base64Data.indexOf('base64,') !== -1) {
      base64Data = base64Data.split('base64,')[1];
    }
    
    var decoded = Utilities.base64Decode(base64Data);
    var blob = Utilities.newBlob(decoded, 'application/pdf', fileName);
    
    var folderName = 'PDF_PERMINTAAN_TOKO';
    var folders = DriveApp.getFoldersByName(folderName);
    var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
    
    // Set folder agar siap diakses publik jika baru dibuat
    try {
      folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch(fErr) {}
    
    // 1. Buat file baru terlebih dahulu
    var file = folder.createFile(blob);
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch(sErr) {}

    var fileUrl = file.getUrl();
    var downloadUrl = 'https://drive.google.com/uc?export=download&id=' + file.getId();
    
    // 2. Bersihkan file lama jika ada yang namanya sama (tanpa merusak file baru)
    try {
      var existingFiles = folder.getFilesByName(fileName);
      while (existingFiles.hasNext()) {
        var oldFile = existingFiles.next();
        if (oldFile.getId() !== file.getId()) {
          oldFile.setTrashed(true);
        }
      }
    } catch(tErr) {}

    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: 'PDF berhasil disimpan ke Google Drive!',
      url: fileUrl,
      fileUrl: fileUrl,
      downloadUrl: downloadUrl,
      fileId: file.getId(),
      fileName: fileName
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
