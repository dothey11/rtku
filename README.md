# RTku

Aplikasi warga untuk satu RT: iuran dan kas terbuka, surat-menyurat, tombol darurat, pengumuman, polling, lapor RT, data warga, dan buku tamu.

Aplikasi web tanpa proses build (HTML, CSS, JavaScript biasa) dengan database **Supabase (PostgreSQL)**.

## Isi repo

```
index.html               halaman aplikasi
css/style.css            tampilan
js/config.js             alamat dan kunci Supabase (isi sendiri)
js/app.js                tampilan dan aksi
js/store-supabase.js     baca/tulis ke database
js/store-demo.js         data contoh untuk mode demo
database/schema.sql      tabel, aturan akses (RLS), fungsi, realtime, storage
database/seed.sql        data awal contoh
database/migrasi-002-peran-pengurus.sql   pembaruan untuk database lama: peran Bendahara dan Sekretaris
```

## Dua mode

| Mode | Kapan aktif | Data |
|---|---|---|
| Demo | `js/config.js` masih kosong | Data contoh, tersimpan di browser itu saja |
| Database | `js/config.js` sudah diisi | Supabase, dipakai bersama semua warga, perlu login |

## Cara memasang database

1. Buat akun di [supabase.com](https://supabase.com), lalu **New project**. Pilih region Singapore.
2. Buka **SQL Editor**, tempel seluruh isi `database/schema.sql`, klik **Run**.
3. Tempel isi `database/seed.sql`, klik **Run**. Data ini contoh; ganti dengan data RT Anda lewat **Table Editor** atau dari aplikasi.
4. Buka **Project Settings > API**. Salin **Project URL** dan **anon public key** ke `js/config.js`:

   ```js
   window.RTKU_CONFIG = {
     SUPABASE_URL: "https://xxxxxxxx.supabase.co",
     SUPABASE_ANON_KEY: "eyJ..."
   };
   ```

   Anon key aman berada di repo karena akses data dijaga aturan RLS. **Jangan pernah** memakai `service_role key` di sini.
5. Buka aplikasi, pilih **Daftar akun**, dan daftar sebagai Ketua RT.
   Supabase secara bawaan mengirim email konfirmasi. Untuk uji coba, ini bisa dimatikan di **Authentication > Sign In / Providers > Email > Confirm email**.
6. Jadikan akun pertama itu Ketua RT. Jalankan di SQL Editor (ganti emailnya):

   ```sql
   update public.profiles set peran = 'ketua', aktif = true
   where id = (select id from auth.users where email = 'email-anda@contoh.com');
   ```

7. Akun warga dan satpam berikutnya mendaftar sendiri, lalu Ketua RT memverifikasinya di menu **Warga & Tamu > Akun pengguna**. Akun yang belum diverifikasi tidak bisa melihat data apa pun.

## Cara menayangkan aplikasi

**GitHub Pages** (repo harus public pada paket GitHub gratis): **Settings > Pages > Deploy from a branch > main / root**. Aplikasi tampil di `https://<user>.github.io/<repo>/`.

**Vercel atau Netlify** (bisa repo private): impor repo ini, tanpa build command, output directory `/`.

Setelah punya alamat, masukkan alamat itu di Supabase **Authentication > URL Configuration > Site URL** supaya tautan di email konfirmasi mengarah ke aplikasi.

Untuk mencoba di komputer sendiri: `npx serve .` lalu buka alamat yang ditampilkan.

## Hak akses per peran

Ada lima peran: **warga**, **ketua**, **bendahara**, **sekretaris**, dan **satpam**. Ketua RT, Bendahara, dan Sekretaris disebut pengurus.

| Data | Warga | Bendahara | Sekretaris | Ketua RT | Satpam |
|---|---|---|---|---|---|
| Laporan kas | lihat | lihat, catat pemasukan dan pengeluaran | lihat | lihat, catat | lihat |
| Tagihan iuran | rumah sendiri, bayar | semua, catat tunai, buat tagihan bulanan | rumah sendiri, bayar | semua, catat tunai, buat tagihan | tidak |
| Surat | ajukan, lihat milik sendiri | ajukan, lihat milik sendiri | lihat semua, ajukan | lihat semua, setujui/tolak | tidak |
| SOS | kirim, lihat milik sendiri | kirim, lihat semua, tangani | kirim, lihat semua, tangani | kirim, lihat semua, tangani | lihat semua, tangani |
| Pengumuman, polling | lihat, memilih | lihat, memilih | buat | buat | lihat, memilih |
| Lapor RT | lihat, buat | lihat, buat | ubah status | ubah status | lihat, buat |
| Data warga | rumah sendiri | lihat semua (di database) | lihat semua, tambah | lihat semua, tambah | tidak |
| Buku tamu | rumah sendiri, lapor | rumah sendiri, lapor | lihat semua | lihat semua | lihat semua |
| Akun pengguna | profil sendiri | profil sendiri | profil sendiri | verifikasi, ganti peran | profil sendiri |

Menyetujui surat hanya bisa dilakukan Ketua RT, karena surat terbit atas namanya. Memverifikasi akun dan mengganti peran juga hanya Ketua RT, lewat menu **Warga & Tamu > Akun pengguna**: pilih peran, lalu klik Verifikasi atau Simpan peran.

Aturan ini ditegakkan di database (`database/schema.sql` bagian 3), bukan hanya di tampilan.

### Database yang sudah terpasang sebelum ada Bendahara dan Sekretaris

Jalankan `database/migrasi-002-peran-pengurus.sql` satu kali di SQL Editor. Database baru yang dibuat dari `schema.sql` terbaru tidak memerlukannya.

## Yang belum ada

- **Pembayaran sungguhan.** Tombol Bayar masih simulasi: tagihan ditandai lunas tanpa uang berpindah. Untuk GoPay, OVO, QRIS, dan Virtual Account perlu akun payment gateway (Midtrans atau Xendit) dan satu Supabase Edge Function sebagai penerima webhook. Setelah itu fungsi `bayar_tagihan` harus dicabut dari warga dan hanya dipanggil oleh webhook.
- **Notifikasi ke HP saat aplikasi tertutup.** Sinyal SOS muncul seketika di HP satpam dan pengurus selama aplikasi terbuka (realtime). Notifikasi dorong (push) atau WhatsApp perlu layanan tambahan.
- **Tombol Ingatkan** untuk tagihan belum mengirim apa pun, dengan alasan yang sama.
- **Tanda tangan digital tersertifikasi.** Surat memakai nomor, kode verifikasi, dan QR, bukan tanda tangan elektronik tersertifikasi (BSrE/PSrE).
- Tagihan bulanan dibuat Ketua RT dengan satu tombol tiap bulan, belum otomatis.
- Nama "RT 04 / RW 07" masih tertulis langsung di `index.html`, `js/app.js`, dan fungsi `setujui_surat`.

## Status pengujian

Skema, migrasi, aturan akses kelima peran, dan fungsi database diuji pada PostgreSQL 16. Tampilan diuji dalam mode demo dan dengan klien Supabase tiruan. Sambungan ke proyek Supabase sungguhan belum diuji, jadi coba semua alur setelah langkah pemasangan di atas.
