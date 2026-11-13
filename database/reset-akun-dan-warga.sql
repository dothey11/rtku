-- =====================================================================
-- RTku: RESET akun pengguna dan data warga
-- PERINGATAN: menghapus permanen. Tidak bisa dibatalkan.
-- Jalankan di Supabase > SQL Editor SETELAH migrasi-006 (atau schema.sql terbaru).
--
-- DIHAPUS : semua akun login, semua data warga, dan catatan yang melekat pada
--           rumah/orang lama: tagihan, surat, sinyal SOS, laporan warga, buku tamu,
--           dan suara polling.
-- TETAP   : peran dan izin, jenis iuran, laporan kas, pengumuman, polling.
-- =====================================================================
begin;

delete from public.tagihan;
delete from public.surat;
delete from public.sos;
delete from public.lapor;
delete from public.tamu;
delete from public.warga where not kk;   -- anggota dulu, baru kepala keluarga
delete from public.warga;
delete from auth.users;                  -- profil dan suara polling ikut terhapus
alter sequence public.surat_nomor_seq restart with 1;

-- OPSIONAL: hapus tanda "--" di tiga baris berikut bila kas, pengumuman, dan polling
-- yang ada masih data contoh dan ingin mulai benar-benar dari nol.
-- delete from public.kas;
-- delete from public.pengumuman;
-- delete from public.polling;

commit;

-- SESUDAH RESET:
-- 1. Buka aplikasi, pilih "Daftar akun", daftarkan diri Anda (username, nama, rumah, email, sandi).
-- 2. Jadikan akun itu Ketua RT (ganti usernamenya), jalankan di SQL Editor:
--      update public.profiles set peran = 'ketua', aktif = true where username = 'username_anda';
-- 3. Masuk sebagai Ketua RT, daftarkan kepala keluarga tiap rumah di menu Warga & Tamu.
-- 4. Warga lain mendaftar sendiri, lalu Anda setujui dan beri peran di menu Pengaturan.
