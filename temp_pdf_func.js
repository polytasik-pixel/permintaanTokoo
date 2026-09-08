function test() {
function bukaPdfModal(noSurat, includePhotos = null, targetPartialId = null) {
  const requests = getRequestsFromDB();
  const targetNo = String(noSurat || '').trim().toUpperCase();
  const req = requests.find(r => r && (
    String(r.noSurat || '').trim().toUpperCase() === targetNo ||
    String(r.id || '').trim().toUpperCase() === targetNo
  ));
  if (!req) {
    showNotif('DOKUMEN TIDAK DITEMUKAN!', 'warning');
    return;
  }

  const targetPartial = (targetPartialId && Array.isArray(req.partialBreakdowns)) 
    ? req.partialBreakdowns.find(p => p && p.id === targetPartialId) 
    : null;

  const activePdfNoSurat = targetPartial ? targetPartial.id : req.noSurat;
  window._currentActivePdfNoSurat = activePdfNoSurat;

  const userCat = (currentUser && currentUser.category) ? String(currentUser.category).toUpperCase() : '';
  const isAdmUser = (typeof checkIsAdminUser === 'function') ? checkIsAdminUser() : (userCat === 'ADMIN' || (currentUser && currentUser.username && currentUser.username.toUpperCase() === 'ADMIN'));
  if (!isAdmUser && typeof isPdfButtonAllowed === 'function' && !isPdfButtonAllowed(req)) {
    if (userCat === 'TOKO' || userCat === 'SALES') {
      showNotif('DOKUMEN BELUM SELESAI DISETUJUI / DIVERIFIKASI OLEH DM!', 'warning');
      return;
    }
  }

  const validPhotos = targetPartial 
    ? (targetPartial.artemisPhoto ? [targetPartial.artemisPhoto] : [])
    : getReqPhotosList(req);

  // JIKA includePhotos BELUM DIPILIH & DOKUMEN MEMILIKI FOTO -> TAMPILKAN POPUP PILIHAN (HANYA JIKA BUKAN PARSIAL)
  if (includePhotos === null && validPhotos.length > 0 && !targetPartial) {
    tampilkanPilihanCetakPdf(noSurat);
    return;
  }

  const pdfContainer = document.getElementById('pdfDocumentContent');
  if (!pdfContainer) return;

  const activeModel = (typeof getActivePdfModel === 'function') ? getActivePdfModel() : 'MODEL_1';

  const hasUnfulfilledItem = Array.isArray(req.items) && req.items.some(i => {
    if (!i) return false;
    return !!(
      i.unfulfilled || 
      i.batal || 
      i.status === 'TIDAK BISA DIPENUHI' || 
      i.status === 'TIDAK DIPENUHI' ||
      i.statusPart === 'TIDAK DIPENUHI' ||
      i.keteranganPart === 'TIDAK DIPENUHI' ||
      req.status === 'BATAL' || 
      req.unfulfilled
    );
  });

  let itemRowsHtml = '';
  let pdfTableHeaderHtml = '';

  if (targetPartial) {
    // MODAL PDF SURAT JALAN PARSIAL (DISERAHKAN SAJA, TANPA SISA, TANPA RIWAYAT BREAKDOWN BOX)
    itemRowsHtml = (targetPartial.items || []).map((i, idx) => {
      const rowTdStyle = 'padding:6px 6px; border:1px solid #cbd5e1; font-size:11px;';
      const numTdStyle = 'text-align:center; padding:6px 4px; border:1px solid #cbd5e1; font-size:11px; white-space: nowrap !important;';
      const pQty = Number(i.qty || 1);

      return `
        <tr style="border-bottom:1px solid #cbd5e1;">
          <td style="${numTdStyle} width:1%;">${idx + 1}</td>
          <td style="${rowTdStyle} white-space: nowrap !important; width:1%; text-align:left;">${i.type || i.tipe || '-'}</td>
          <td style="${rowTdStyle} white-space: nowrap !important; width:1%; text-align:left;">${i.seri || i.sn || '-'}</td>
          ${req.jenis === 'DUS' ? `<td style="${rowTdStyle} white-space: nowrap !important; width:1%; text-align:left; font-weight:600;">${i.dus || '-'}</td>` : ''}
          <td style="${rowTdStyle} white-space: normal !important; word-break: break-word; text-align:left;">${i.barang || i.permintaan || '-'}</td>
          <td style="${rowTdStyle} white-space: normal !important; word-break: break-word; text-align:left;">${i.alasan || '-'}</td>
          <td style="${numTdStyle} width:1%; font-weight: bold; color: #0284c7;">${pQty}</td>
        </tr>
      `;
    }).join('');

    pdfTableHeaderHtml = `
      <tr style="background: ${activeModel === 'MODEL_2' ? '#334155' : '#0284c7'}; color: #ffffff;">
        <th style="width: 1%; text-align:center; padding:7px 6px; border:1px solid #cbd5e1; font-weight:700; white-space: nowrap !important;">NO</th>
        <th style="width: 1%; padding:7px 8px; border:1px solid #cbd5e1; font-weight:700; text-align:center; white-space: nowrap !important;">TIPE BARANG</th>
        <th style="width: 1%; padding:7px 8px; border:1px solid #cbd5e1; font-weight:700; text-align:center; white-space: nowrap !important;">NO. SERI</th>
        ${req.jenis === 'DUS' ? `<th style="width: 1%; padding:7px 8px; border:1px solid #cbd5e1; font-weight:700; text-align:center; white-space: nowrap !important;">NO. SERI DUS</th>` : ''}
        <th style="padding:7px 8px; border:1px solid #cbd5e1; font-weight:700; text-align:center; white-space: normal !important;">BARANG DISERAHKAN</th>
        <th style="padding:7px 8px; border:1px solid #cbd5e1; font-weight:700; text-align:center; white-space: normal !important;">ALASAN PERMINTAAN</th>
        <th style="width: 1%; text-align:center; padding:7px 6px; border:1px solid #cbd5e1; font-weight:700; white-space: nowrap !important;">QTY</th>
      </tr>
    `;
  } else {
    // MODAL PDF DOKUMEN SURAT INDUK STANDAR
    itemRowsHtml = (req.items || []).map((i, idx) => {
      const isUnfulfilled = !!(
        i.unfulfilled || 
        i.batal || 
        i.status === 'TIDAK BISA DIPENUHI' || 
        i.status === 'TIDAK DIPENUHI' ||
        i.statusPart === 'TIDAK DIPENUHI' ||
        i.keteranganPart === 'TIDAK DIPENUHI' ||
        req.status === 'BATAL' || 
        req.unfulfilled
      );
      const rowTdStyle = isUnfulfilled 
        ? 'padding:6px 6px; border:1px solid #cbd5e1; font-size:11px; text-decoration: line-through; text-decoration-thickness: 2px; font-weight: bold; color: #b91c1c; background-color: #fef2f2;' 
        : 'padding:6px 6px; border:1px solid #cbd5e1; font-size:11px;';
      const numTdStyle = isUnfulfilled 
        ? 'text-align:center; padding:6px 4px; border:1px solid #cbd5e1; font-size:11px; text-decoration: line-through; text-decoration-thickness: 2px; font-weight: bold; color: #b91c1c; background-color: #fef2f2; white-space: nowrap !important;' 
        : 'text-align:center; padding:6px 4px; border:1px solid #cbd5e1; font-size:11px; white-space: nowrap !important;';

      const reqQty = Number(i.qty || i.jumlah || 1);
      const delQty = (typeof calcItemDeliveredQty === 'function') ? calcItemDeliveredQty(req, idx) : 0;
      const remQty = Math.max(0, reqQty - delQty);

      return `
        <tr style="border-bottom:1px solid #cbd5e1; ${isUnfulfilled ? 'background-color:#fef2f2;' : ''}">
          <td style="${numTdStyle} width:1%;">${idx + 1}</td>
          <td style="${rowTdStyle} white-space: nowrap !important; width:1%; text-align:left;">${i.type || i.tipe || '-'}</td>
          <td style="${rowTdStyle} white-space: nowrap !important; width:1%; text-align:left;">${i.seri || i.sn || '-'}</td>
          ${req.jenis === 'DUS' ? `<td style="${rowTdStyle} white-space: nowrap !important; width:1%; text-align:left; color:${isUnfulfilled ? '#b91c1c' : '#d97706'}; font-weight:600;">${i.dus || '-'}</td>` : ''}
          <td style="${rowTdStyle} white-space: normal !important; word-break: break-word; text-align:left;">${i.barang || i.permintaan || '-'}</td>
          <td style="${rowTdStyle} white-space: normal !important; word-break: break-word; text-align:left;">${i.alasan || '-'}</td>
          <td style="${numTdStyle} width:1%; font-weight: bold;">${reqQty}</td>
          <td style="${numTdStyle} width:1%; color: #0284c7; font-weight: bold;">${delQty}</td>
          <td style="${numTdStyle} width:1%; color: ${remQty > 0 ? '#d97706' : '#10b981'}; font-weight: bold;">${remQty}</td>
        </tr>
      `;
    }).join('');

    pdfTableHeaderHtml = `
      <tr style="background: ${activeModel === 'MODEL_2' ? '#334155' : '#0284c7'}; color: #ffffff;">
        <th style="width: 1%; text-align:center; padding:7px 6px; border:1px solid #cbd5e1; font-weight:700; white-space: nowrap !important;">NO</th>
        <th style="width: 1%; padding:7px 8px; border:1px solid #cbd5e1; font-weight:700; text-align:center; white-space: nowrap !important;">TIPE BARANG</th>
        <th style="width: 1%; padding:7px 8px; border:1px solid #cbd5e1; font-weight:700; text-align:center; white-space: nowrap !important;">NO. SERI</th>
        ${req.jenis === 'DUS' ? `<th style="width: 1%; padding:7px 8px; border:1px solid #cbd5e1; font-weight:700; text-align:center; white-space: nowrap !important;">NO. SERI DUS</th>` : ''}
        <th style="padding:7px 8px; border:1px solid #cbd5e1; font-weight:700; text-align:center; white-space: normal !important;">PERMINTAAN BARANG</th>
        <th style="padding:7px 8px; border:1px solid #cbd5e1; font-weight:700; text-align:center; white-space: normal !important;">ALASAN PERMINTAAN</th>
        <th style="width: 1%; text-align:center; padding:7px 6px; border:1px solid #cbd5e1; font-weight:700; white-space: nowrap !important;">QTY MINTA</th>
        <th style="width: 1%; text-align:center; padding:7px 6px; border:1px solid #cbd5e1; font-weight:700; white-space: nowrap !important; color: #e0f2fe;">TERKIRIM</th>
        <th style="width: 1%; text-align:center; padding:7px 6px; border:1px solid #cbd5e1; font-weight:700; white-space: nowrap !important; color: #fde68a;">SISA</th>
      </tr>
    `;
  }

  const users = getUsersFromDB();
  const serviceUser = users.find(u => u.category === 'SERVICE' && u.area === req.area) || users.find(u => u.category === 'SERVICE');
  const dmUser = users.find(u => u.category === 'DM') || users.find(u => u.username === 'ADMIN');
  const serviceName = req.serviceUserName || (serviceUser ? serviceUser.fullName : 'SERVICE SUPERVISOR');
  const dmName = typeof getNamaDM === 'function' ? getNamaDM() : 'FERRY EDIYANTO';

  let serviceTTD = req.serviceTTD || '';
  const reqSrvName = req.serviceUserName || (serviceUser ? serviceUser.fullName : '');

  // Verifikasi TTD Service langsung dari akun User Service terkait
  if (reqSrvName) {
    const exactSig = getUserRealSignature('SERVICE', req.area, '', reqSrvName);
    serviceTTD = exactSig;
  } else if (!isValidSig(serviceTTD) && serviceUser) {
    serviceTTD = getUserRealSignature('SERVICE', req.area, serviceUser.username, serviceUser.fullName);
  }

  if (!isValidSig(serviceTTD)) {
    serviceTTD = ''; // KOSONGKAN JIKA USER SERVICE BELUM MEMPUNYAI TTD
  }

  let dmTTD = req.dmTTD || '';
  if (!isValidSig(dmTTD)) {
    dmTTD = getUserRealSignature('DM', '', '', dmName) || (dmUser ? dmUser.ttd : '');
  }
  if (!isValidSig(dmTTD)) {
    dmTTD = ''; // KOSONGKAN DI PDF JIKA USER DM BELUM MEMPUNYAI TTD
  }

  const isReqFromGBJ = (
    (req.createdBy && String(req.createdBy).toUpperCase().includes('GBJ')) ||
    (req.toko && String(req.toko).toUpperCase().includes('GBJ')) ||
    req.isGBJ === true
  );

  let pemohonTTD = req.pemohonTTD || req.tokoTTD || '';
  let pemohonName = req.toko || req.createdBy || 'PEMOHON';
  let pemohonRoleTitle = 'PEMOHON (TOKO)';

  if (isReqFromGBJ) {
    const gbjUser = users.find(u => u && (
      (u.id && String(u.id).toUpperCase() === String(req.createdBy || '').toUpperCase()) ||
      (u.username && String(u.username).toUpperCase() === String(req.createdBy || '').toUpperCase()) ||
      (u.fullName && String(u.fullName).toUpperCase() === String(req.createdBy || '').toUpperCase()) ||
      u.category === 'GBJ'
    ));

    pemohonName = (gbjUser ? (gbjUser.fullName || gbjUser.username) : '') || req.createdBy || req.toko || 'GBJ';
    pemohonRoleTitle = 'GUDANG BARANG JADI (GBJ)';

    if (!isValidSig(pemohonTTD)) {
      pemohonTTD = (gbjUser && isValidSig(gbjUser.ttd)) ? gbjUser.ttd : getUserRealSignature('GBJ', req.area, req.createdBy, req.createdBy);
    }
  } else {
    if (!isValidSig(pemohonTTD)) {
      pemohonTTD = getUserRealSignature('TOKO', req.area, req.createdBy, req.toko);
    }
  }

  if (!isValidSig(pemohonTTD)) {
    pemohonTTD = '';
  }

  const nowPrint = new Date();
  const pDay = String(nowPrint.getDate()).padStart(2, '0');
  const pMonth = String(nowPrint.getMonth() + 1).padStart(2, '0');
  const pYear = nowPrint.getFullYear();
  const pHour = String(nowPrint.getHours()).padStart(2, '0');
  const pMin = String(nowPrint.getMinutes()).padStart(2, '0');
  const pSec = String(nowPrint.getSeconds()).padStart(2, '0');
  const timestampStr = `DICETAK PADA ${pDay}/${pMonth}/${pYear} Pukul ${pHour}:${pMin}:${pSec}`;

  let photoSection = '';
  if (includePhotos === true && validPhotos.length > 0) {
    photoSection = `
      <div style="margin-top: 10px; margin-bottom: 8px; page-break-inside: avoid;">
        <div style="font-size: 8px; font-weight: 700; color: #475569; letter-spacing: 0.3px; margin-bottom: 4px; border-bottom: 1px solid #e2e8f0; padding-bottom: 2px; text-transform: uppercase;">
          LAMPIRAN FOTO BARANG (${validPhotos.length} FOTO):
        </div>
        <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; width: 100%;">
          ${validPhotos.map((p, pIdx) => `
            <div style="aspect-ratio: 1/1; border: 1px solid #cbd5e1; border-radius: 4px; overflow: hidden; background: #ffffff; position: relative; display: flex; align-items: center; justify-content: center; padding: 2px; box-sizing: border-box;">
              <img src="${p}" style="max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain;">
              <span style="position: absolute; bottom: 2px; right: 2px; background: rgba(15,23,42,0.75); color: #ffffff; font-size: 7.5px; font-weight: 800; padding: 1px 3px; border-radius: 2px;">#${pIdx+1}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  const areaNameMap = {
    TSM: 'TASIKMALAYA',
    BDG: 'BANDUNG',
    BDU: 'BANDUNG UTARA',
    CRB: 'CIREBON',
    SKB: 'SUKABUMI',
    SBN: 'SUBANG'
  };
  const hodsAreaTitle = `HODS ${areaNameMap[req.area] || req.area || ''}`;

  let tableHeaderBg = '#0284c7';
  let headerTitleHtml = `
    <div style="text-align: center; font-size: 20px; font-weight: 800; border-bottom: 2.5px solid #0f172a; padding-bottom: 24px; margin-bottom: 20px; letter-spacing: 0.5px; color: #0f172a; text-transform: uppercase;">
      PERMINTAAN TOKO
    </div>
  `;

  if (activeModel === 'MODEL_2') {
    tableHeaderBg = '#334155';
    headerTitleHtml = `
      <div style="background: linear-gradient(135deg, #0284c7, #0369a1); color: #ffffff; padding: 12px 18px; border-radius: 10px; text-align: center; font-size: 20px; font-weight: 900; margin-bottom: 14px; letter-spacing: 1px; box-shadow: 0 4px 12px rgba(2,132,199,0.25);">
        PERMINTAAN TOKO
      </div>
    `;
  } else if (activeModel === 'MODEL_3') {
    tableHeaderBg = '#0f172a';
    headerTitleHtml = `
      <div style="background: #0f172a; color: #fbbf24; padding: 14px 18px; border-radius: 8px; border-bottom: 4px solid #fbbf24; text-align: center; font-size: 21px; font-weight: 900; margin-bottom: 14px; letter-spacing: 1.5px; text-transform: uppercase;">
        PERMINTAAN TOKO
      </div>
    `;
  } else if (activeModel === 'MODEL_4') {
    tableHeaderBg = '#059669';
    headerTitleHtml = `
      <div style="background: #059669; color: #ffffff; padding: 12px 18px; border-radius: 6px; text-align: center; font-size: 20px; font-weight: 900; margin-bottom: 14px; letter-spacing: 1px; border-left: 6px solid #047857;">
        PERMINTAAN TOKO
      </div>
    `;
  } else if (activeModel === 'MODEL_5') {
    tableHeaderBg = '#7c3aed';
    headerTitleHtml = `
      <div style="background: linear-gradient(135deg, #7c3aed, #4c1d95); color: #ffffff; padding: 14px 18px; border-radius: 12px; text-align: center; font-size: 21px; font-weight: 900; margin-bottom: 14px; letter-spacing: 1.5px; box-shadow: 0 6px 18px rgba(124,58,237,0.3);">
        PERMINTAAN TOKO
      </div>
    `;
  }

  const hasRemainingItem = Array.isArray(req.items) && req.items.some((i, idx) => {
    return (typeof calcItemRemainingQty === 'function') ? calcItemRemainingQty(req, idx) > 0 : true;
  });

  const isDMUserForBreakdown = currentUser && (
    (currentUser.category && String(currentUser.category).toUpperCase().includes('DM')) ||
    (currentUser.role && String(currentUser.role).toUpperCase().includes('DM'))
  );

  const canBreakdown = req.status !== 'BATAL' && hasRemainingItem && !isDMUserForBreakdown && (
    !currentUser || 
    currentUser.role === 'ADMIN' || 
    currentUser.category === 'ADMIN' || 
    currentUser.category === 'SERVICE' || 
    currentUser.username === 'admin' ||
    (currentUser.role && String(currentUser.role).toUpperCase().includes('ADMIN')) ||
    (currentUser.category && String(currentUser.category).toUpperCase().includes('SERVICE'))
  );

  pdfContainer.innerHTML = `
    <div class="pdf-paper" style="min-height: 680px; display: flex; flex-direction: column; justify-content: space-between; padding: 1mm 20px; color: #0f172a; background: #ffffff; font-family: 'Poppins', sans-serif; box-sizing: border-box;">
      <div>
        ${headerTitleHtml}

        <table class="pdf-info-table" style="width: 100%; border-collapse: collapse; margin-top: 8px; margin-bottom: 20px; font-size: 12px; background: transparent; border: none;">
          <tr>
            <td style="padding: 4px 0; width: 85px; font-weight: 800; color: #0f172a; border: none; white-space: nowrap;">NO SURAT</td>
            <td style="padding: 4px 12px 4px 8px; width: 14px; font-weight: 800; color: #0f172a; border: none; text-align: center;">:</td>
            <td style="padding: 4px 20px 4px 0; width: 100%; font-weight: 800; color: #0284c7; border: none; letter-spacing: 0.2px;">
              ${activePdfNoSurat}
              ${(!targetPartial && canBreakdown) ? `
                <button type="button" onclick="bukaModalBuatParsial('${req.noSurat}')" style="margin-left: 14px; background: linear-gradient(135deg, #10b981, #059669) !important; color: #ffffff !important; border: none; border-radius: 4px; padding: 4px 10px; font-size: 11px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; vertical-align: middle; box-shadow: 0 3px 8px rgba(16,185,129,0.3) !important;">
                  <span style="font-size: 13px;">+</span> AJUKAN BREAKDOWN PARSIAL
                </button>
              ` : ''}
            </td>
            
            <td style="padding: 4px 0; width: 75px; font-weight: 800; color: #0f172a; border: none; white-space: nowrap; text-align: left;">TANGGAL</td>
            <td style="padding: 4px 12px 4px 8px; width: 14px; font-weight: 800; color: #0f172a; border: none; text-align: center;">:</td>
            <td style="padding: 4px 0; width: 105px; font-weight: 800; color: #0f172a; border: none; white-space: nowrap; text-align: left;">${(typeof formatDateDDMMYYYYString === 'function') ? formatDateDDMMYYYYString(req.tanggal) : (req.tanggal || '-')}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; font-weight: 800; color: #0f172a; border: none; white-space: nowrap;">TOKO</td>
            <td style="padding: 4px 12px 4px 8px; font-weight: 800; color: #0f172a; border: none; text-align: center;">:</td>
            <td style="padding: 4px 20px 4px 0; font-weight: 800; color: #0f172a; border: none; text-transform: uppercase;">${req.toko}</td>
            
            <td style="padding: 4px 0; font-weight: 800; color: #0f172a; border: none; white-space: nowrap; text-align: left;">JENIS</td>
            <td style="padding: 4px 12px 4px 8px; font-weight: 800; color: #0f172a; border: none; text-align: center;">:</td>
            <td style="padding: 4px 0; font-weight: 800; color: #0f172a; border: none; text-transform: uppercase; white-space: nowrap; text-align: left;">${req.jenis || 'DEFAULT'}</td>
          </tr>
        </table>

        <div style="font-size: 11px; font-weight: bold; margin-bottom: 6px; color: #0f172a;">${targetPartial ? 'DETAIL SURAT JALAN PARSIAL:' : 'DETAIL PERMINTAAN:'}</div>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 11.5px; border: 1px solid #cbd5e1;">
          <thead>
            ${pdfTableHeaderHtml}
          </thead>
          <tbody>${itemRowsHtml}</tbody>
        </table>

        ${photoSection}

        ${(() => {
          const cTxt = (req.catatan || '').trim();
          if (cTxt && cTxt !== '-') {
            return `
              <div style="margin-top: 12px; margin-bottom: 16px; font-size: 11.5px; background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 1.5px solid #0284c7; border-left: 6px solid ${tableHeaderBg}; padding: 12px 16px; border-radius: 8px; box-shadow: 0 3px 10px rgba(2,132,199,0.12); color: #0f172a; opacity: 1 !important;">
                <div style="font-weight: 800; font-size: 11.5px; color: ${tableHeaderBg === '#0f172a' ? '#0369a1' : tableHeaderBg}; margin-bottom: 4px; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px;">
                  <span style="font-size: 14px;">📌</span> CATATAN / KETERANGAN PERMINTAAN:
                </div>
                <div style="font-weight: 600; color: #0f172a; line-height: 1.5; font-size: 11.5px; word-break: break-word;">${cTxt}</div>
              </div>
            `;
          }
          return '';
        })()}

        ${(!targetPartial) ? (() => {
          const partials = req.partialBreakdowns || [];
          let html = `
            <div style="margin-top: 16px; margin-bottom: 16px; font-size: 11.5px; background: var(--bg-body, #f8fafc); border: 1.5px solid var(--border-color, #cbd5e1); padding: 12px 14px; border-radius: 8px;">
              <div style="font-weight: 800; font-size: 12px; color: #0f172a; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px;">
                <span style="display: flex; align-items: center; gap: 6px;">
                  <span style="font-size: 16px;">📦</span> RIWAYAT BREAKDOWN SURAT PARSIAL:
                </span>
                ${canBreakdown ? `
                  <button type="button" onclick="bukaModalBuatParsial('${req.noSurat}')" style="background: linear-gradient(135deg, #10b981, #059669) !important; color: #ffffff !important; border: none; border-radius: 4px; padding: 6px 12px; font-size: 11.5px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 4px 10px rgba(16,185,129,0.3) !important;">
                    <span style="font-size: 14px;">+</span> AJUKAN BREAKDOWN PARSIAL
                  </button>
                ` : ''}
              </div>
          `;

          if (partials.length === 0) {
            html += `<div style="font-size: 11px; color: #64748b; font-style: italic;">Belum ada penyerahan parsial (breakdown) untuk surat ini.</div>`;
          } else {
            partials.forEach((p, pIndex) => {
              const pNoSurat = p.id || `${req.noSurat}-P${pIndex + 1}`;
              const statusBadge = p.status === 'PENDING' 
                ? `<span class="partial-badge-pending">⏳ PENDING APPROVAL DM</span>` 
                : (p.status === 'APPROVE' || p.status === 'DONE' 
                  ? `<span class="partial-badge-approved">🟢 DISERAHKAN (DISINKRON DM)</span>` 
                  : `<span class="partial-badge-rejected">🔴 DITOLAK DM</span>`);

              const itemCount = (p.items || []).reduce((acc, it) => acc + (Number(it.qty) || 0), 0);

              html += `
                <div class="partial-card-item" style="display: flex; flex-direction: column; gap: 6px;">
                  <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px;">
                    <div style="font-weight: 800; color: #0284c7; font-size: 12px; cursor: pointer;" onclick="bukaDetailSuratParsial('${req.noSurat}', '${p.id}')">
                      📄 ${pNoSurat} <span style="font-size: 10px; color: #64748b; font-weight: 600;">(${itemCount} Item Diserahkan)</span>
                    </div>
                    <div>${statusBadge}</div>
                  </div>

                  ${(p.status === 'REJECT' && p.rejectReason && (currentUser.category === 'SERVICE' || currentUser.category === 'ADMIN' || currentUser.username === 'admin')) ? `
                    <div style="background: #fee2e2; border: 1px solid #fca5a5; color: #b91c1c; font-size: 10.5px; font-weight: 700; padding: 4px 8px; border-radius: 4px; margin-top: 2px;">
                      🔴 CATATAN PENOLAKAN DM: ${p.rejectReason}
                    </div>
                  ` : ''}

                  <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 2px; flex-wrap: wrap;">
                    <div style="font-size: 10px; color: #64748b;">
                      Tgl Pengajuan: ${(p.createdAt ? p.createdAt.substring(0,10) : '-')} | Oleh: ${p.createdBy || '-'}
                    </div>
                    <div style="display: flex; gap: 6px; align-items: center;">
                      ${(p.status === 'PENDING' && (currentUser.category === 'DM' || currentUser.role === 'ADMIN' || currentUser.username === 'admin')) ? `
                        <button type="button" onclick="prosesKirimApproveBreakdownDM('${req.noSurat}', '${p.id}')" style="background: #10b981; color: #fff; border: none; border-radius: 3px; padding: 3px 8px; font-size: 10.5px; font-weight: 800; cursor: pointer;">
                          ✓ APPROVE DM
                        </button>
                        <button type="button" onclick="bukaModalRejectBreakdown('${req.noSurat}', '${p.id}')" style="background: #ef4444; color: #fff; border: none; border-radius: 3px; padding: 3px 8px; font-size: 10.5px; font-weight: 800; cursor: pointer;">
                          ✕ TOLAK DM
                        </button>
                      ` : ''}

                      ${(p.status === 'APPROVE' && (currentUser.category === 'SERVICE' || currentUser.category === 'ADMIN' || currentUser.username === 'admin')) ? `
                        <button type="button" onclick="bukaModalArtemisParsial('${req.noSurat}', '${p.id}')" style="background: #0284c7; color: #fff; border: none; border-radius: 3px; padding: 3px 8px; font-size: 10.5px; font-weight: 800; cursor: pointer;">
                          📷 UPLOAD ARTEMIS P1
                        </button>
                      ` : ''}

                      <button type="button" onclick="bukaDetailSuratParsial('${req.noSurat}', '${p.id}')" style="background: #334155; color: #fff; border: none; border-radius: 3px; padding: 3px 8px; font-size: 10.5px; font-weight: 800; cursor: pointer;">
                        🔍 DETAIL PARSIAL
                      </button>

                      ${(p.status === 'APPROVE' || p.status === 'DONE') ? `
                        <button type="button" onclick="cetakPdfSuratParsial('${req.noSurat}', '${p.id}')" style="background: #059669; color: #fff; border: none; border-radius: 3px; padding: 3px 8px; font-size: 10.5px; font-weight: 800; cursor: pointer;">
                          🖨️ CETAK PDF
                        </button>
                      ` : ''}
                    </div>
                  </div>
                </div>
              `;
            });
          }

          html += `</div>`;
          return html;
        })() : ''}
      </div>

      <div>
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-top: 28px; text-align: center; font-size: 11px; page-break-inside: avoid;">
          <div style="width: 30%; display: flex; flex-direction: column; justify-content: space-between; height: 125px;">
            <div style="font-weight: 500; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">PEMOHON</div>
            <div style="height: 55px; display: flex; align-items: center; justify-content: center;">
              ${renderSafeTtdImageTag(pemohonTTD, "max-height: 52px; max-width: 100%; object-fit: contain;")}
            </div>
            <div>
              <div style="font-weight: 500; color: #0f172a; font-size: 11.5px;">${pemohonName}</div>
              <div style="font-size: 10px; color: #475569; margin-top: 2px; text-transform: uppercase;">${pemohonRoleTitle}</div>
            </div>
          </div>

          <div style="width: 30%; display: flex; flex-direction: column; justify-content: space-between; height: 125px;">
            <div style="font-weight: 500; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">DIPERIKSA</div>
            <div style="height: 55px; display: flex; align-items: center; justify-content: center;">
              ${renderSafeTtdImageTag(serviceTTD, "max-height: 52px; max-width: 100%; object-fit: contain;")}
            </div>
            <div>
              <div style="font-weight: 500; color: #0f172a; font-size: 11.5px;">${serviceName}</div>
              <div style="font-size: 10px; color: #475569; margin-top: 2px; text-transform: uppercase;">${hodsAreaTitle}</div>
            </div>
          </div>

          <div style="width: 30%; display: flex; flex-direction: column; justify-content: space-between; height: 125px;">
            <div style="font-weight: 500; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">DISETUJUI</div>
            <div style="height: 55px; display: flex; align-items: center; justify-content: center;">
              ${renderSafeTtdImageTag(dmTTD, "max-height: 52px; max-width: 100%; object-fit: contain;")}
            </div>
            <div>
              <div style="font-weight: 500; color: #0f172a; font-size: 11.5px;">${dmName}</div>
              <div style="font-size: 10px; color: #475569; margin-top: 2px; text-transform: uppercase;">DISTRICT MANAGER</div>
            </div>
          </div>
        </div>

        <div style="margin-top: 28px; display: flex; justify-content: space-between; align-items: center; font-size: 8px; color: #64748b; letter-spacing: 0.2px;">
          ${hasUnfulfilledItem ? `
            <div style="font-weight: 800; color: #b91c1c; font-style: normal; display: flex; align-items: center; gap: 4px; font-size: 8px;">
              <span style="text-decoration: line-through; text-decoration-thickness: 2.5px; font-weight: 900; color: #b91c1c; font-size: 10px;">---</span> = Tidak di penuhi
            </div>
          ` : '<div></div>'}
          <div style="font-style: italic; opacity: 0.85; font-size: 8px;">
            ${timestampStr}
          </div>
        </div>
      </div>
    </div>
  `;

  const pdfModal = document.getElementById('pdfModal');
  if (pdfModal) {
    pdfModal.style.setProperty('display', 'flex', 'important');
    pdfModal.style.setProperty('z-index', '800000', 'important');
}