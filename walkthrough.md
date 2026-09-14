# Walkthrough - Pembaruan Tampilan Modal Diam (Fixed) & Tabel Scrollable

Telah dilakukan pembaruan struktur layout pada modal **Kelola / Tambah Toko Baru** (`#popupTambahToko`) dan **User Management** (`#popupUserManagementModal`):

## 1. Padding 5mm dari Tepi Layar Atas & Bawah
- Container backdrop modal diatur dengan `padding: 5mm 15mm !important;`.
- Tinggi card modal diatur pas `height: calc(100vh - 10mm) !important; max-height: calc(100vh - 10mm) !important;` sehingga jarak ke tepi atas dan bawah layar tetap **5mm**.

## 2. Popup Card Diam (Fixed Container)
- **Komponen yang Diam (Tidak Ikut Ter-scroll)**:
  - Header Toolbar Biru (`KELOLA / TAMBAH TOKO BARU`) & tombol Tutup `✖`.
  - Sub-instruksi teks grey.
  - Baris Form Input Toko (Dropdown Area, Text Input Nama Toko, Tombol SIMPAN).
  - Judul Sub-Tabel & Search Bar Toolbar.
  - Header Tabel `<thead>` (`NAMA TOKO`, `AREA`, `KODE TOKO`, `AKSI`).

## 3. Khusus Isi Tabel yang Bisa Di-scroll (Scrollable Table Body)
- Pembungkus tabel (`<div>` di sekeliling `<table>`) diatur menggunakan:
  `flex: 1 !important; overflow-y: auto !important; overflow-x: auto !important;`
- Hanya baris data di dalam `<tbody>` (`#daftarTokoTableBody` & `#userTableBodyModal`) yang akan bergerak naik/turun saat di-scroll, sementara seluruh bagian popup lainnya tetap **diam/statis (fixed)**.

## 4. Refresh Cache Browser
- Cache buster script diperbarui ke: `app.js?v=20260911_FIXED_MODAL_CARD_SCROLLABLE_TABLE_ONLY`.
