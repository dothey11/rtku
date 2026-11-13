-- =====================================================================
-- RTku: data awal (DATA CONTOH)
-- Jalankan setelah schema.sql. Ganti dengan data RT Anda yang sebenarnya,
-- atau hapus isinya lewat Supabase > Table Editor.
-- =====================================================================

insert into public.iuran_jenis (nama, jumlah) values
  ('Iuran keamanan', 75000),
  ('Iuran sampah',   25000),
  ('Kas RT',         20000);

-- Kepala keluarga tiap rumah, dengan jumlah jiwa awal (seluruh penghuni rumah).
insert into public.warga (rumah, nama, kk, status, hubungan, kelamin, hp, jiwa) values
  ('A-01', 'Hendra Wijaya',      true, 'Pemilik', 'Kepala keluarga', 'L', '0812-0000-0101', 4),
  ('A-02', 'Agus Santoso',       true, 'Pemilik', 'Kepala keluarga', 'L', '0812-0000-0102', 3),
  ('A-03', 'Rina Marlina',       true, 'Penyewa', 'Kepala keluarga', 'P', '0812-0000-0103', 2),
  ('A-04', 'Made Sudarsana',     true, 'Pemilik', 'Kepala keluarga', 'L', '0812-0000-0104', 6),
  ('B-05', 'Fitri Handayani',    true, 'Pemilik', 'Kepala keluarga', 'P', '0812-0000-0105', 4),
  ('B-06', 'Bambang Prasetyo',   true, 'Pemilik', 'Kepala keluarga', 'L', '0812-0000-0106', 4),
  ('B-07', 'Yohanes Tan',        true, 'Pemilik', 'Kepala keluarga', 'L', '0812-0000-0107', 2),
  ('B-08', 'Dewi Lestari',       true, 'Penyewa', 'Kepala keluarga', 'P', '0812-0000-0108', 3),
  ('C-09', 'Ahmad Fauzi',        true, 'Pemilik', 'Kepala keluarga', 'L', '0812-0000-0109', 8),
  ('C-10', 'Siti Nurhaliza',     true, 'Penyewa', 'Kepala keluarga', 'P', '0812-0000-0110', 2),
  ('C-11', 'Paulus Simanjuntak', true, 'Pemilik', 'Kepala keluarga', 'L', '0812-0000-0111', 4),
  ('C-12', 'Sari Wulandari',     true, 'Pemilik', 'Kepala keluarga', 'P', '0812-0000-0112', 4);

-- Anggota yang sudah terdata. Sisanya dilengkapi tiap warga dari aplikasi.
insert into public.warga (rumah, nama, status, hubungan, kelamin, hp) values
  ('A-04', 'Sumiyati',      'ART', 'ART',      'P', '0812-0000-0114'),
  ('C-09', 'Rizky Maulana', 'Kos', 'Anak kos', 'L', '0812-0000-0119'),
  ('C-09', 'Dimas Aditya',  'Kos', 'Anak kos', 'L', '0812-0000-0129'),
  ('C-12', 'Tuti Rahayu',   'ART', 'ART',      'P', '0812-0000-0122');

-- Tagihan September sampai November 2026 untuk setiap rumah.
insert into public.tagihan (rumah, bulan, jumlah, lunas, metode, dibayar_pada)
select w.rumah, b.bulan, 120000, true, 'transfer', (b.bulan || '-05')::timestamptz
  from public.warga w cross join (values ('2026-09'), ('2026-10'), ('2026-11')) as b(bulan)
 where w.kk;

update public.tagihan set lunas = false, metode = null, dibayar_pada = null
 where (bulan = '2026-10' and rumah = 'B-08')
    or (bulan = '2026-11' and rumah in ('A-03', 'B-06', 'B-08', 'C-10', 'C-12'));

insert into public.kas (tgl, ket, jenis, jml) values
  ('2026-08-01', 'Saldo awal',                    'masuk',  2350000),
  ('2026-08-05', 'Iuran Agustus (12 rumah)',      'masuk',  1440000),
  ('2026-08-20', 'Honor satpam Agustus',          'keluar',  900000),
  ('2026-08-25', 'Angkut sampah Agustus',         'keluar',  300000),
  ('2026-09-05', 'Iuran September (12 rumah)',    'masuk',  1440000),
  ('2026-09-14', 'Perbaikan lampu jalan Blok B',  'keluar',  275000),
  ('2026-09-20', 'Honor satpam September',        'keluar',  900000),
  ('2026-09-25', 'Angkut sampah September',       'keluar',  300000),
  ('2026-10-05', 'Iuran Oktober (11 rumah)',      'masuk',  1320000),
  ('2026-10-12', 'Konsumsi kerja bakti',          'keluar',  185000),
  ('2026-10-20', 'Honor satpam Oktober',          'keluar',  900000),
  ('2026-10-25', 'Angkut sampah Oktober',         'keluar',  300000),
  ('2026-11-05', 'Iuran November (7 rumah)',      'masuk',   840000),
  ('2026-11-08', 'Cat gapura dan kuas',           'keluar',  450000);

insert into public.pengumuman (judul, isi, waktu, oleh) values
  ('Rapat warga akhir tahun',
   'Sabtu, 28 November 2026 pukul 19.30 di balai RT. Agenda: laporan kas dan rencana kegiatan 2027.',
   '2026-11-03 09:15+07', 'Pengurus RT'),
  ('Pemadaman listrik bergilir',
   'PLN menjadwalkan pemeliharaan jaringan pada Kamis, 12 November 2026 pukul 10.00 sampai 14.00.',
   '2026-11-07 16:20+07', 'Pengurus RT'),
  ('Kerja bakti bersih selokan',
   'Minggu, 15 November 2026 pukul 07.00 di sepanjang Blok B dan C. Mohon membawa cangkul atau sapu lidi.',
   '2026-11-09 08:00+07', 'Pengurus RT');

with p as (
  insert into public.polling (tanya) values ('Warna cat gapura yang baru') returning id
)
insert into public.polling_opsi (polling_id, teks)
select p.id, o.teks from p cross join (values ('Merah putih'), ('Hijau tua'), ('Biru laut')) as o(teks);

with p as (
  insert into public.polling (tanya) values ('Tujuan rekreasi warga Desember') returning id
)
insert into public.polling_opsi (polling_id, teks)
select p.id, o.teks from p cross join (values ('Kebun Raya Bogor'), ('Pantai Anyer'), ('Lembang')) as o(teks);
