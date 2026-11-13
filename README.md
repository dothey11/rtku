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
database/schema.sql      tabel, peran dan izin, aturan akses (RLS), fungsi, realtime, storage
database/seed.sql        data awal contoh
database/migrasi-005-login-username.sql   pembaruan untuk database lama (memuat semua migrasi sebelumnya)
database/reset-akun-dan-warga.sql          mengosongkan akun dan data warga
```

## Dua mode

| Mode | Kapan aktif | Data |
|---|---|---|
| Demo | `js/config.js` masih kosong | Data contoh, tersimpan di browser itu saja |
| Database | `js/config.js` sudah diisi | Supabase, dipakai bersama semua warga, masuk dengan username |

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
5. Matikan konfirmasi email: **Authentication > Sign In / Providers > Email > Confirm email** (off). Tanpa ini setiap pendaftar harus membuka tautan di emailnya sebelum bisa masuk.
6. Buka aplikasi, pilih **Daftar akun**, dan daftarkan diri Anda: username, nama lengkap, nomor rumah, email, kata sandi.
7. Jadikan akun pertama itu Ketua RT. Jalankan di SQL Editor (ganti usernamenya):

   ```sql
   update public.profiles set peran = 'ketua', aktif = true where username = 'username_anda';
   ```

8. Masuk sebagai Ketua RT dan daftarkan kepala keluarga tiap rumah di menu **Warga & Tamu**.
9. Akun berikutnya mendaftar sendiri, lalu Ketua RT menyetujuinya dan memilih perannya di menu **Pengaturan > Akun pengguna**. Akun yang belum disetujui tidak bisa melihat data apa pun.

## Cara menayangkan aplikasi

**GitHub Pages** (repo harus public pada paket GitHub gratis): **Settings > Pages > Deploy from a branch > main / root**. Aplikasi tampil di `https://<user>.github.io/<repo>/`.

**Vercel atau Netlify** (bisa repo private): impor repo ini, tanpa build command, output directory `/`.

Setelah punya alamat, masukkan alamat itu di Supabase **Authentication > URL Configuration > Site URL** supaya tautan di email konfirmasi mengarah ke aplikasi.

Untuk mencoba di komputer sendiri: `npx serve .` lalu buka alamat yang ditampilkan.

## Login dengan username

Warga masuk dengan **username dan kata sandi**. Email hanya diisi saat mendaftar sebagai data kontak.

| Hal | Cara kerjanya |
|---|---|
| Pendaftaran | Username, nama lengkap, nomor rumah, email, kata sandi |
| Username | 3 sampai 20 karakter: huruf kecil, angka, titik, garis bawah. Harus unik. Disimpan di `profiles.username` |
| Email | Disimpan di `profiles.email` sebagai kontak. Boleh sama untuk beberapa akun (misalnya suami dan istri) |
| Lupa kata sandi | Pengurus berizin `akun.kelola` mengatur ulang dari **Pengaturan > Akun pengguna > Atur ulang sandi** |

Supabase Auth tidak punya login username bawaan dan tetap membutuhkan sebuah alamat email sebagai pengenal internal. Aplikasi membuatnya otomatis dari email pendaftar dengan sisipan `+rtku.username` (contoh: `budi+rtku.budi01@gmail.com`), lalu menukar username dengan alamat itu saat masuk. Warga tidak pernah melihat atau mengetiknya.

Dua hal yang perlu diketahui pengelola:

- **Privasi:** penukaran username ke alamat internal (fungsi `email_masuk`) harus bisa dipanggil sebelum login. Akibatnya, orang yang mengetahui sebuah username dan alamat aplikasi bisa mengetahui email pendaftarnya. Bila ini tidak bisa diterima, jalan keluarnya adalah memindahkan proses masuk ke Supabase Edge Function.
- **Email tetap harus beralamat sungguhan.** Supabase menolak domain yang tidak bisa menerima email, jadi alamat karangan seperti `nama@tidakada.xyz` akan gagal didaftarkan.

### Mengosongkan akun dan data warga

`database/reset-akun-dan-warga.sql` menghapus permanen semua akun login, data warga, tagihan, surat, sinyal SOS, laporan, dan buku tamu. Peran, izin, jenis iuran, kas, pengumuman, dan polling tetap. Sesudahnya ulangi langkah 6 sampai 9 di atas.

## Peran dan izin

Hak akses tidak ditulis mati di kode. Database menyimpannya di dua tabel:

| Tabel | Isi |
|---|---|
| `peran` | Daftar peran: kode, nama, dan tanda `bawaan` |
| `peran_izin` | Izin yang dimiliki tiap peran, satu baris per pasangan peran dan izin |

Semua aturan akses di database memanggil fungsi `punya_izin('...')`, yang membaca kedua tabel itu. Mengubah isi tabel langsung mengubah hak akses, tanpa mengubah kode.

Cara mengaturnya dari aplikasi: menu **Pengaturan** (terlihat oleh peran berizin `akun.kelola`).

- **Akun pengguna:** pendaftar baru muncul di sini. Pilih perannya di kotak pilihan, lalu klik **Setujui dengan peran ini**. Peran akun yang sudah aktif bisa diganti dengan **Simpan peran**.
- **Peran dan izin:** tabel centang, baris izin dan kolom peran. Centang atau hapus centang untuk mengubah izin; berlaku seketika.
- **Tambah peran:** misalnya Humas atau Koordinator Keamanan. Peran baru belum punya izin sampai dicentang.

Daftar izin:

| Kode izin | Arti |
|---|---|
| `rumah` | Penghuni rumah: bayar iuran, ajukan surat, lapor tamu, tombol SOS |
| `kas.kelola` | Catat pemasukan dan pengeluaran, buat tagihan, catat bayar tunai |
| `surat.lihat` | Lihat semua permohonan surat |
| `surat.putuskan` | Setujui atau tolak surat |
| `info.kelola` | Buat pengumuman dan polling |
| `lapor.kelola` | Ubah status laporan warga |
| `warga.lihat` | Lihat data semua warga |
| `warga.kelola` | Tambah, ubah, dan hapus data warga |
| `tamu.lihat` | Lihat buku tamu semua rumah |
| `sos.tangani` | Terima dan tangani sinyal darurat |
| `akun.kelola` | Setujui akun, atur peran dan izin |

Izin awal saat database dipasang:

| Peran | Izin |
|---|---|
| Warga | `rumah` |
| Ketua RT | semua |
| Bendahara | `rumah`, `kas.kelola`, `warga.lihat`, `sos.tangani` |
| Sekretaris | `rumah`, `surat.lihat`, `info.kelola`, `lapor.kelola`, `warga.lihat`, `warga.kelola`, `tamu.lihat`, `sos.tangani` |
| Satpam | `tamu.lihat`, `sos.tangani` |

Ketentuan tetap:

- Peran `ketua` selalu memiliki semua izin, supaya pengaturan tidak pernah terkunci.
- Peran `warga` dan `ketua` tidak bisa dihapus. `warga` adalah peran setiap akun baru.
- Peran yang masih dipakai akun tidak bisa dihapus.
- Daftar kode izin sendiri tetap: menambah jenis izin baru berarti menambah fitur, dan itu perlu perubahan kode.

## Data warga

Satu baris data warga adalah satu orang.

| Siapa | Yang dilakukan |
|---|---|
| Pengurus berizin `warga.kelola` (awalnya Ketua RT dan Sekretaris) | Mendaftarkan **kepala keluarga** tiap rumah (Pemilik atau Penyewa) beserta **jumlah jiwa awal**. Bisa juga menambah, mengubah, dan menghapus siapa pun. |
| Warga (izin `rumah`) | Setelah login, menambah **anggota rumahnya sendiri**: istri atau suami, anak, orang tua, saudara, ART, anak kos. Nomor rumah terkunci ke rumah akunnya. Boleh mengubah dan menghapus anggota, tetapi tidak baris kepala keluarga. |

Ketentuan yang ditegakkan database:

- Satu rumah punya satu kepala keluarga. Warga baru bisa menambah anggota setelah rumahnya didaftarkan pengurus.
- **Jumlah jiwa** di baris kepala keluarga berarti seluruh penghuni rumah, termasuk ART dan anak kos. Bila orang yang terdata melebihi angka itu, angkanya naik otomatis. Angka tidak turun sendiri saat anggota dihapus; pengurus bisa mengoreksinya.
- Kepala keluarga tidak bisa dihapus selama rumahnya masih punya anggota terdata.
- Bila nomor rumah kepala keluarga diubah, anggotanya ikut pindah.
- Surat bisa diajukan atas nama anggota rumah sendiri (pilihan "Surat untuk").

Yang dicatat per orang: nama, hubungan, jenis kelamin, tanggal lahir (opsional), nomor HP (opsional). NIK tidak dicatat.

### Database yang sudah terpasang sebelumnya

Jalankan `database/migrasi-005-login-username.sql` satu kali di SQL Editor. File ini memuat semua pembaruan sebelumnya (data warga per orang, peran dan izin dinamis, login username), berlaku untuk database versi mana pun, dan aman dijalankan ulang. Rincian perubahan pada data lama tertulis di bagian atas file. Database baru yang dibuat dari `schema.sql` terbaru tidak memerlukannya.

## Yang belum ada

- **Pembayaran sungguhan.** Tombol Bayar masih simulasi: tagihan ditandai lunas tanpa uang berpindah. Untuk GoPay, OVO, QRIS, dan Virtual Account perlu akun payment gateway (Midtrans atau Xendit) dan satu Supabase Edge Function sebagai penerima webhook. Setelah itu fungsi `bayar_tagihan` harus dicabut dari warga dan hanya dipanggil oleh webhook.
- **Notifikasi ke HP saat aplikasi tertutup.** Sinyal SOS muncul seketika di HP satpam dan pengurus selama aplikasi terbuka (realtime). Notifikasi dorong (push) atau WhatsApp perlu layanan tambahan.
- **Tombol Ingatkan** untuk tagihan belum mengirim apa pun, dengan alasan yang sama.
- **Tanda tangan digital tersertifikasi.** Surat memakai nomor, kode verifikasi, dan QR, bukan tanda tangan elektronik tersertifikasi (BSrE/PSrE).
- Tagihan bulanan dibuat Ketua RT dengan satu tombol tiap bulan, belum otomatis.
- Nama "RT 04 / RW 07" masih tertulis langsung di `index.html`, `js/app.js`, dan fungsi `setujui_surat`.

## Status pengujian

Skema, migrasi (dari tiap versi sebelumnya), aturan akses berbasis izin, dan fungsi database diuji pada PostgreSQL 16. Tampilan diuji dalam mode demo dan dengan klien Supabase tiruan. Sambungan ke proyek Supabase sungguhan belum diuji, jadi coba semua alur setelah langkah pemasangan di atas. Ini terutama berlaku untuk pendaftaran, masuk dengan username, dan atur ulang sandi, yang bergantung pada perilaku Supabase Auth.
