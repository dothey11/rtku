-- =====================================================================
-- RTku migrasi 005: login dengan username (memuat semua migrasi sebelumnya)
-- Untuk database yang SUDAH terpasang dari schema.sql versi mana pun sebelumnya.
-- Jalankan SATU KALI di Supabase > SQL Editor. Aman dijalankan ulang.
-- Database baru yang dibuat dari schema.sql terbaru TIDAK perlu file ini.
--
-- Isi: (1) data warga per orang, (2) peran dan izin dinamis, (3) login username.
-- Akun lama diberi username dari bagian depan emailnya, supaya tetap bisa masuk.
-- Untuk mengosongkan akun dan data warga, jalankan reset-akun-dan-warga.sql SETELAH file ini.
-- =====================================================================

alter table public.surat add column if not exists untuk text;

do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'warga' and column_name = 'hubungan') then
    alter table public.warga add column hubungan text,
                             add column kelamin text check (kelamin in ('L','P')),
                             add column tgl_lahir date;
    alter table public.warga drop constraint if exists warga_status_check;
    update public.warga set kk = false where status in ('Kos','ART') and kk;
    update public.warga w set kk = false
     where kk and exists (select 1 from public.warga x where x.rumah = w.rumah and x.kk and x.id < w.id);
    update public.warga set status = 'Keluarga' where not kk and status in ('Pemilik','Penyewa');
    update public.warga set hubungan = case when kk then 'Kepala keluarga' when status = 'Kos' then 'Anak kos'
                                            when status = 'ART' then 'ART' else 'Keluarga lainnya' end;
    update public.warga k set jiwa = k.jiwa + (select count(*) from public.warga w where w.rumah = k.rumah and not w.kk)
     where k.kk;
    update public.warga set jiwa = 1 where not kk;
    alter table public.warga add constraint warga_status_check
      check ((kk and status in ('Pemilik','Penyewa')) or (not kk and status in ('Keluarga','Kos','ART')));
    create unique index warga_satu_kk on public.warga (rumah) where kk;
  end if;
end
$$;

-- ---------- 3. Peran dan izin (dinamis) ----------
-- Hak akses TIDAK ditulis mati di kode. Setiap peran punya daftar izin di tabel
-- peran_izin. Pengurus yang berizin 'akun.kelola' bisa menambah peran dan mengubah
-- izinnya dari aplikasi (menu Pengaturan) tanpa menyentuh SQL.
create table if not exists public.peran (
  kode    text primary key check (kode ~ '^[a-z][a-z0-9_]{1,29}$'),
  nama    text not null,
  bawaan  boolean not null default false     -- peran bawaan tidak bisa dihapus
);

create table if not exists public.peran_izin (
  peran  text not null references public.peran(kode) on update cascade on delete cascade,
  izin   text not null check (izin in (
           'rumah',           -- penghuni rumah: bayar iuran, ajukan surat, lapor tamu, tombol SOS
           'kas.kelola',      -- catat pemasukan/pengeluaran, tagihan, bayar tunai, jenis iuran
           'surat.lihat',     -- lihat semua permohonan surat
           'surat.putuskan',  -- setujui atau tolak surat
           'info.kelola',     -- buat pengumuman dan polling
           'lapor.kelola',    -- ubah status laporan warga
           'warga.lihat',     -- lihat data semua warga
           'warga.kelola',    -- tambah, ubah, hapus data warga
           'tamu.lihat',      -- lihat buku tamu semua rumah
           'sos.tangani',     -- terima dan tangani sinyal darurat
           'akun.kelola')),   -- verifikasi akun, atur peran dan izin
  primary key (peran, izin)
);

-- Peran awal. Boleh diubah dari aplikasi setelah terpasang.
insert into public.peran (kode, nama, bawaan) values
  ('warga',      'Warga',      true),
  ('ketua',      'Ketua RT',   true),
  ('bendahara',  'Bendahara',  false),
  ('sekretaris', 'Sekretaris', false),
  ('satpam',     'Satpam',     false)
on conflict (kode) do nothing;

insert into public.peran_izin (peran, izin) values
  ('warga', 'rumah'),
  ('ketua', 'rumah'), ('ketua', 'kas.kelola'), ('ketua', 'surat.lihat'), ('ketua', 'surat.putuskan'),
  ('ketua', 'info.kelola'), ('ketua', 'lapor.kelola'), ('ketua', 'warga.lihat'), ('ketua', 'warga.kelola'),
  ('ketua', 'tamu.lihat'), ('ketua', 'sos.tangani'), ('ketua', 'akun.kelola'),
  ('bendahara', 'rumah'), ('bendahara', 'kas.kelola'), ('bendahara', 'warga.lihat'), ('bendahara', 'sos.tangani'),
  ('sekretaris', 'rumah'), ('sekretaris', 'surat.lihat'), ('sekretaris', 'info.kelola'), ('sekretaris', 'lapor.kelola'),
  ('sekretaris', 'warga.lihat'), ('sekretaris', 'warga.kelola'), ('sekretaris', 'tamu.lihat'), ('sekretaris', 'sos.tangani'),
  ('satpam', 'tamu.lihat'), ('satpam', 'sos.tangani')
on conflict do nothing;

-- Kolom peran di profil sekarang merujuk ke tabel peran (bukan daftar tetap).
alter table public.profiles drop constraint if exists profiles_peran_check;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_peran_fkey') then
    alter table public.profiles add constraint profiles_peran_fkey
      foreign key (peran) references public.peran(kode) on update cascade;
  end if;
end
$$;

-- true bila akun yang login aktif dan perannya punya izin tersebut.
-- Peran 'ketua' selalu punya semua izin, supaya tidak ada yang terkunci dari pengaturan.
create or replace function public.punya_izin(p_izin text) returns boolean
  language sql stable security definer set search_path = public as
$$
  select exists (
    select 1 from profiles p
     where p.id = auth.uid() and p.aktif
       and (p.peran = 'ketua'
            or exists (select 1 from peran_izin i where i.peran = p.peran and i.izin = p_izin)))
$$;

-- ---------- 4. Aturan akses (Row Level Security) ----------
alter table public.profiles      enable row level security;
alter table public.peran         enable row level security;
alter table public.peran_izin    enable row level security;
alter table public.iuran_jenis   enable row level security;
alter table public.warga         enable row level security;
alter table public.tagihan       enable row level security;
alter table public.kas           enable row level security;
alter table public.surat         enable row level security;
alter table public.sos           enable row level security;
alter table public.pengumuman    enable row level security;
alter table public.polling       enable row level security;
alter table public.polling_opsi  enable row level security;
alter table public.polling_suara enable row level security;
alter table public.lapor         enable row level security;
alter table public.tamu          enable row level security;

-- Profil: lihat milik sendiri; izin 'akun.kelola' melihat dan mengubah semua.
drop policy if exists profil_lihat on public.profiles;
create policy profil_lihat on public.profiles for select to authenticated
  using (id = auth.uid() or public.punya_izin('akun.kelola'));
drop policy if exists profil_ubah on public.profiles;
create policy profil_ubah on public.profiles for update to authenticated
  using (public.punya_izin('akun.kelola')) with check (public.punya_izin('akun.kelola'));

-- Peran dan izin: semua akun aktif membaca; 'akun.kelola' mengatur. Peran bawaan tidak bisa dihapus.
drop policy if exists peran_lihat on public.peran;
create policy peran_lihat on public.peran for select to authenticated
  using (public.peran() is not null);
drop policy if exists peran_tambah on public.peran;
create policy peran_tambah on public.peran for insert to authenticated
  with check (public.punya_izin('akun.kelola') and not bawaan);
drop policy if exists peran_ubah on public.peran;
create policy peran_ubah on public.peran for update to authenticated
  using (public.punya_izin('akun.kelola') and not bawaan)
  with check (public.punya_izin('akun.kelola') and not bawaan);
drop policy if exists peran_hapus on public.peran;
create policy peran_hapus on public.peran for delete to authenticated
  using (public.punya_izin('akun.kelola') and not bawaan);

drop policy if exists izin_lihat on public.peran_izin;
create policy izin_lihat on public.peran_izin for select to authenticated
  using (public.peran() is not null);
drop policy if exists izin_atur on public.peran_izin;
create policy izin_atur on public.peran_izin for all to authenticated
  using (public.punya_izin('akun.kelola')) with check (public.punya_izin('akun.kelola'));

-- Jenis iuran, tagihan, kas: izin 'kas.kelola'.
drop policy if exists iuran_lihat on public.iuran_jenis;
create policy iuran_lihat on public.iuran_jenis for select to authenticated
  using (public.peran() is not null);
drop policy if exists iuran_atur on public.iuran_jenis;
create policy iuran_atur on public.iuran_jenis for all to authenticated
  using (public.punya_izin('kas.kelola')) with check (public.punya_izin('kas.kelola'));

-- Perubahan status lunas hanya lewat fungsi di bagian 5.
drop policy if exists tagihan_lihat on public.tagihan;
create policy tagihan_lihat on public.tagihan for select to authenticated
  using (public.punya_izin('kas.kelola') or rumah = public.rumah_saya());

drop policy if exists kas_lihat on public.kas;
create policy kas_lihat on public.kas for select to authenticated
  using (public.peran() is not null);               -- laporan kas terbuka untuk semua akun aktif
drop policy if exists kas_catat on public.kas;
create policy kas_catat on public.kas for insert to authenticated
  with check (public.punya_izin('kas.kelola'));

-- Data warga: 'warga.lihat' melihat semua, lainnya hanya rumahnya sendiri; 'warga.kelola' tambah/ubah/hapus.
drop policy if exists warga_lihat on public.warga;
create policy warga_lihat on public.warga for select to authenticated
  using (public.punya_izin('warga.lihat') or public.punya_izin('warga.kelola') or rumah = public.rumah_saya());
drop policy if exists warga_atur on public.warga;
create policy warga_atur on public.warga for all to authenticated
  using (public.punya_izin('warga.kelola')) with check (public.punya_izin('warga.kelola'));

-- Surat: penghuni mengajukan dan melihat miliknya; 'surat.lihat' melihat semua; 'surat.putuskan' memutuskan.
drop policy if exists surat_lihat on public.surat;
create policy surat_lihat on public.surat for select to authenticated
  using (public.punya_izin('surat.lihat') or public.punya_izin('surat.putuskan') or user_id = auth.uid());
drop policy if exists surat_ajukan on public.surat;
create policy surat_ajukan on public.surat for insert to authenticated
  with check (public.punya_izin('rumah') and user_id = auth.uid() and rumah = public.rumah_saya()
              and pemohon = public.nama_saya() and status = 'Menunggu' and nomor is null and kode is null);
drop policy if exists surat_putuskan on public.surat;
create policy surat_putuskan on public.surat for update to authenticated
  using (public.punya_izin('surat.putuskan')) with check (public.punya_izin('surat.putuskan'));

-- SOS: pengirim melihat miliknya; 'sos.tangani' melihat dan menangani semua.
drop policy if exists sos_lihat on public.sos;
create policy sos_lihat on public.sos for select to authenticated
  using (public.punya_izin('sos.tangani') or user_id = auth.uid());
drop policy if exists sos_kirim on public.sos;
create policy sos_kirim on public.sos for insert to authenticated
  with check (user_id = auth.uid() and rumah = public.rumah_saya() and nama = public.nama_saya()
              and status = 'Aktif');
drop policy if exists sos_tangani on public.sos;
create policy sos_tangani on public.sos for update to authenticated
  using (public.punya_izin('sos.tangani')) with check (public.punya_izin('sos.tangani'));

-- Pengumuman dan polling: semua akun aktif membaca; 'info.kelola' membuat.
drop policy if exists umum_lihat on public.pengumuman;
create policy umum_lihat on public.pengumuman for select to authenticated
  using (public.peran() is not null);
drop policy if exists umum_buat on public.pengumuman;
create policy umum_buat on public.pengumuman for insert to authenticated
  with check (public.punya_izin('info.kelola'));

drop policy if exists polling_lihat on public.polling;
create policy polling_lihat on public.polling for select to authenticated
  using (public.peran() is not null);
drop policy if exists polling_buat on public.polling;
create policy polling_buat on public.polling for insert to authenticated
  with check (public.punya_izin('info.kelola'));
drop policy if exists opsi_lihat on public.polling_opsi;
create policy opsi_lihat on public.polling_opsi for select to authenticated
  using (public.peran() is not null);
drop policy if exists opsi_buat on public.polling_opsi;
create policy opsi_buat on public.polling_opsi for insert to authenticated
  with check (public.punya_izin('info.kelola'));

-- Suara: setiap orang hanya melihat pilihannya sendiri (rahasia).
-- Jumlah suara diambil lewat fungsi hasil_polling().
drop policy if exists suara_lihat on public.polling_suara;
create policy suara_lihat on public.polling_suara for select to authenticated
  using (user_id = auth.uid());
drop policy if exists suara_pilih on public.polling_suara;
create policy suara_pilih on public.polling_suara for insert to authenticated
  with check (user_id = auth.uid() and public.peran() is not null);

-- Lapor RT: semua akun aktif melihat dan membuat; 'lapor.kelola' mengubah status.
drop policy if exists lapor_lihat on public.lapor;
create policy lapor_lihat on public.lapor for select to authenticated
  using (public.peran() is not null);
drop policy if exists lapor_buat on public.lapor;
create policy lapor_buat on public.lapor for insert to authenticated
  with check (user_id = auth.uid() and rumah = public.rumah_saya() and pelapor = public.nama_saya()
              and status = 'Baru');
drop policy if exists lapor_status on public.lapor;
create policy lapor_status on public.lapor for update to authenticated
  using (public.punya_izin('lapor.kelola')) with check (public.punya_izin('lapor.kelola'));

-- Buku tamu: tuan rumah melihat tamunya; 'tamu.lihat' melihat semua.
drop policy if exists tamu_lihat on public.tamu;
create policy tamu_lihat on public.tamu for select to authenticated
  using (public.punya_izin('tamu.lihat') or rumah = public.rumah_saya());
drop policy if exists tamu_lapor on public.tamu;
create policy tamu_lapor on public.tamu for insert to authenticated
  with check (public.punya_izin('rumah') and user_id = auth.uid() and rumah = public.rumah_saya()
              and tuan = public.nama_saya());

-- ---------- 5. Fungsi transaksi ----------
-- Nama bulan Indonesia dari teks 'YYYY-MM'.
create or replace function public.nama_bulan(p_bulan text) returns text
  language sql immutable as
$$
  select (array['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus',
                'September','Oktober','November','Desember'])[split_part(p_bulan, '-', 2)::int]
         || ' ' || split_part(p_bulan, '-', 1)
$$;

-- Penghuni membayar tagihan rumahnya. Tagihan ditandai lunas dan kas bertambah.
-- CATATAN: ini masih simulasi. Di produksi, fungsi ini dipanggil oleh webhook
-- payment gateway (Midtrans/Xendit) setelah uang benar-benar diterima, bukan oleh warga.
create or replace function public.bayar_tagihan(p_bulan text, p_metode text) returns void
  language plpgsql security definer set search_path = public as
$$
declare v_rumah text := rumah_saya(); v_jumlah integer;
begin
  if v_rumah is null then raise exception 'Akun belum diverifikasi'; end if;
  update tagihan set lunas = true, metode = p_metode, dibayar_pada = now()
   where rumah = v_rumah and bulan = p_bulan and not lunas
   returning jumlah into v_jumlah;
  if v_jumlah is null then raise exception 'Tagihan tidak ditemukan atau sudah lunas'; end if;
  insert into kas (ket, jenis, jml)
  values ('Iuran ' || nama_bulan(p_bulan) || ' ' || v_rumah || ' (' || p_metode || ')', 'masuk', v_jumlah);
end
$$;

-- Pencatatan pembayaran tunai (izin 'kas.kelola').
create or replace function public.catat_tunai(p_rumah text, p_bulan text) returns void
  language plpgsql security definer set search_path = public as
$$
declare v_jumlah integer;
begin
  if not punya_izin('kas.kelola') then raise exception 'Peran Anda tidak punya izin mengelola kas'; end if;
  update tagihan set lunas = true, metode = 'tunai', dibayar_pada = now()
   where rumah = p_rumah and bulan = p_bulan and not lunas
   returning jumlah into v_jumlah;
  if v_jumlah is null then raise exception 'Tagihan tidak ditemukan atau sudah lunas'; end if;
  insert into kas (ket, jenis, jml)
  values ('Iuran ' || nama_bulan(p_bulan) || ' ' || p_rumah || ' (tunai)', 'masuk', v_jumlah);
end
$$;

-- Membuat tagihan satu bulan untuk semua rumah yang punya kepala keluarga (izin 'kas.kelola').
create or replace function public.buat_tagihan(p_bulan text) returns integer
  language plpgsql security definer set search_path = public as
$$
declare v_total integer; v_n integer;
begin
  if not punya_izin('kas.kelola') then raise exception 'Peran Anda tidak punya izin mengelola kas'; end if;
  select coalesce(sum(jumlah), 0) into v_total from iuran_jenis;
  if v_total = 0 then raise exception 'Jenis iuran belum diisi'; end if;
  insert into tagihan (rumah, bulan, jumlah)
  select distinct rumah, p_bulan, v_total from warga where kk
  on conflict (rumah, bulan) do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end
$$;

-- Menyetujui surat: diberi nomor urut dan kode verifikasi (izin 'surat.putuskan').
create or replace function public.setujui_surat(p_id bigint) returns public.surat
  language plpgsql security definer set search_path = public as
$$
declare v public.surat;
        v_romawi text[] := array['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
begin
  if not punya_izin('surat.putuskan') then raise exception 'Peran Anda tidak punya izin memutuskan surat'; end if;
  update surat set
    status = 'Disetujui',
    setuju = now(),
    nomor  = lpad(nextval('surat_nomor_seq')::text, 3, '0') || '/SK/RT04-RW07/'
             || v_romawi[extract(month from now())::int] || '/' || extract(year from now())::int,
    kode   = upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8))
  where id = p_id and status = 'Menunggu'
  returning * into v;
  if v.id is null then raise exception 'Permohonan tidak ditemukan atau sudah diputuskan'; end if;
  return v;
end
$$;

-- Jumlah suara per pilihan, tanpa membuka siapa memilih apa.
create or replace function public.hasil_polling() returns table (opsi_id bigint, jumlah bigint)
  language sql stable security definer set search_path = public as
$$
  select s.opsi_id, count(*) from polling_suara s
   where peran() is not null group by s.opsi_id
$$;

revoke execute on function public.bayar_tagihan(text, text), public.catat_tunai(text, text),
  public.buat_tagihan(text), public.setujui_surat(bigint), public.hasil_polling() from public, anon;
grant execute on function public.bayar_tagihan(text, text), public.catat_tunai(text, text),
  public.buat_tagihan(text), public.setujui_surat(bigint), public.hasil_polling() to authenticated;

-- ---------- Data warga per orang ----------
-- Satu baris = satu orang. Tiap rumah punya satu kepala keluarga (kk = true, status
-- Pemilik atau Penyewa) yang didaftarkan pengurus beserta jumlah jiwa awal. Anggota
-- lain (keluarga, ART, anak kos) ditambahkan pengurus atau oleh penghuni rumah itu sendiri.

-- true bila rumah sudah punya kepala keluarga terdaftar
create or replace function public.rumah_terdaftar(p_rumah text) returns boolean
  language sql stable security definer set search_path = public as
$$ select exists (select 1 from warga where rumah = p_rumah and kk) $$;

-- true bila nama itu terdata sebagai penghuni rumah akun yang login
create or replace function public.anggota_saya(p_nama text) returns boolean
  language sql stable security definer set search_path = public as
$$ select exists (select 1 from warga where rumah = rumah_saya() and nama = p_nama) $$;

-- Sebelum simpan: rapikan nomor rumah; anggota selalu dihitung 1 jiwa;
-- kepala keluarga tidak bisa dihapus selama rumahnya masih punya anggota terdata.
create or replace function public.warga_sebelum() returns trigger
  language plpgsql security definer set search_path = public as
$$
begin
  if tg_op = 'DELETE' then
    if old.kk and exists (select 1 from warga where rumah = old.rumah and not kk) then
      raise exception 'Rumah % masih punya anggota terdata. Hapus anggotanya dulu.', old.rumah;
    end if;
    return old;
  end if;
  new.rumah := upper(trim(new.rumah));
  if new.kk then new.hubungan := 'Kepala keluarga'; else new.jiwa := 1; end if;
  return new;
end
$$;

-- Sesudah simpan: jumlah jiwa di baris kepala keluarga naik otomatis bila orang yang
-- terdata melebihi jumlah jiwa awal. Bila nomor rumah kepala keluarga diubah, anggotanya ikut pindah.
create or replace function public.warga_sesudah() returns trigger
  language plpgsql security definer set search_path = public as
$$
declare v_rumah text[] := '{}'; r text; n integer;
begin
  if tg_op = 'UPDATE' then
    if old.kk and new.kk and new.rumah <> old.rumah then
      update warga set rumah = new.rumah where rumah = old.rumah and not kk;
    end if;
    v_rumah := array[new.rumah, old.rumah];
  elsif tg_op = 'INSERT' then v_rumah := array[new.rumah];
  else v_rumah := array[old.rumah];
  end if;
  foreach r in array v_rumah loop
    select count(*) into n from warga where rumah = r;
    update warga set jiwa = n where kk and rumah = r and jiwa < n;
  end loop;
  return null;
end
$$;

drop trigger if exists warga_sebelum_trg on public.warga;
create trigger warga_sebelum_trg before insert or update or delete on public.warga
  for each row execute function public.warga_sebelum();
drop trigger if exists warga_sesudah_trg on public.warga;
create trigger warga_sesudah_trg after insert or update or delete on public.warga
  for each row execute function public.warga_sesudah();

-- Penghuni (izin 'rumah') boleh menambah, mengubah, dan menghapus ANGGOTA rumahnya sendiri.
-- Nomor rumah terkunci ke rumah akunnya, dan rumah itu harus sudah didaftarkan pengurus.
-- Baris kepala keluarga hanya bisa diubah oleh izin 'warga.kelola'.
drop policy if exists warga_anggota_tambah on public.warga;
create policy warga_anggota_tambah on public.warga for insert to authenticated
  with check (public.punya_izin('rumah') and not kk and rumah = public.rumah_saya()
              and public.rumah_terdaftar(rumah));
drop policy if exists warga_anggota_ubah on public.warga;
create policy warga_anggota_ubah on public.warga for update to authenticated
  using (public.punya_izin('rumah') and not kk and rumah = public.rumah_saya())
  with check (public.punya_izin('rumah') and not kk and rumah = public.rumah_saya());
drop policy if exists warga_anggota_hapus on public.warga;
create policy warga_anggota_hapus on public.warga for delete to authenticated
  using (public.punya_izin('rumah') and not kk and rumah = public.rumah_saya());

-- Surat boleh diajukan atas nama anggota rumah sendiri (kolom "untuk").
drop policy if exists surat_ajukan on public.surat;
create policy surat_ajukan on public.surat for insert to authenticated
  with check (public.punya_izin('rumah') and user_id = auth.uid() and rumah = public.rumah_saya()
              and pemohon = public.nama_saya() and status = 'Menunggu' and nomor is null and kode is null
              and (untuk is null or public.anggota_saya(untuk)));

-- Realtime untuk tabel baru (dilewati bila sudah terdaftar)
do $$
declare t text;
begin
  foreach t in array array['warga','peran','peran_izin'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end
$$;

-- ===== Login dengan username: kolom baru di profil =====
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists email text;

-- Akun lama: email kontak = email login lama; username = bagian depan email (dibuat unik).
update public.profiles p set email = u.email::text
  from auth.users u where u.id = p.id and p.email is null;
update public.profiles p
   set username = rpad(left(regexp_replace(lower(split_part(u.email, '@', 1)), '[^a-z0-9_.]', '', 'g'), 15), greatest(3, least(15, length(regexp_replace(lower(split_part(u.email, '@', 1)), '[^a-z0-9_.]', '', 'g')))), '0')
  from auth.users u where u.id = p.id and p.username is null;
update public.profiles p set username = p.username || '_' || left(replace(p.id::text, '-', ''), 4)
 where exists (select 1 from public.profiles x where x.username = p.username and x.id < p.id);

alter table public.profiles alter column username set not null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_username_key') then
    alter table public.profiles add constraint profiles_username_key unique (username);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_username_check') then
    alter table public.profiles add constraint profiles_username_check check (username ~ '^[a-z0-9_.]{3,20}$');
  end if;
end
$$;

-- ---------- Login dengan username ----------
-- Warga masuk memakai USERNAME dan kata sandi. Supabase Auth tetap butuh sebuah alamat
-- email sebagai pengenal internal; aplikasi membuatnya otomatis dari email pendaftar
-- (namaemail+rtku.username@domain), sehingga satu email boleh dipakai beberapa akun
-- (misalnya suami dan istri) dan warga tidak pernah mengetik email saat masuk.

-- Buat profil otomatis saat seseorang mendaftar. Data diambil dari isian form pendaftaran.
create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as
$$
declare
  v_user text := lower(trim(coalesce(new.raw_user_meta_data->>'username', '')));
begin
  if v_user = '' then
    -- akun yang dibuat dari dashboard Supabase (tanpa form): turunkan username dari emailnya
    v_user := rpad(left(regexp_replace(lower(split_part(new.email, '@', 1)), '[^a-z0-9_.]', '', 'g'), 15), greatest(3, least(15, length(regexp_replace(lower(split_part(new.email, '@', 1)), '[^a-z0-9_.]', '', 'g')))), '0');
    if exists (select 1 from profiles where username = v_user) then
      v_user := v_user || '_' || left(replace(new.id::text, '-', ''), 4);
    end if;
  end if;
  if v_user !~ '^[a-z0-9_.]{3,20}$' then
    raise exception 'Username hanya boleh huruf kecil, angka, titik, garis bawah (3 sampai 20 karakter)';
  end if;
  if exists (select 1 from profiles where username = v_user) then
    raise exception 'Username sudah dipakai';
  end if;
  insert into profiles (id, username, nama, rumah, email)
  values (
    new.id,
    v_user,
    coalesce(nullif(trim(new.raw_user_meta_data->>'nama'), ''), v_user),
    upper(coalesce(nullif(trim(new.raw_user_meta_data->>'rumah'), ''), '-')),
    nullif(trim(coalesce(new.raw_user_meta_data->>'email', new.email)), '')
  );
  return new;
end
$$;

-- Dipakai form pendaftaran (sebelum login): apakah username masih bebas?
create or replace function public.username_tersedia(p_username text) returns boolean
  language sql stable security definer set search_path = public as
$$ select not exists (select 1 from profiles where username = lower(trim(p_username))) $$;

-- Dipakai form masuk (sebelum login): alamat pengenal internal untuk username ini.
-- CATATAN PRIVASI: fungsi ini bisa dipanggil tanpa login, jadi siapa pun yang tahu sebuah
-- username bisa mengetahui alamat email pendaftarnya. Lihat README bagian "Login".
create or replace function public.email_masuk(p_username text) returns text
  language sql stable security definer set search_path = public as
$$
  select u.email::text from profiles p join auth.users u on u.id = p.id
   where p.username = lower(trim(p_username))
$$;

-- Pengurus berizin 'akun.kelola' mengganti kata sandi warga yang lupa.
create or replace function public.atur_ulang_sandi(p_user uuid, p_sandi text) returns void
  language plpgsql security definer set search_path = public, extensions as
$$
begin
  if not punya_izin('akun.kelola') then raise exception 'Peran Anda tidak punya izin mengatur akun'; end if;
  if p_user = auth.uid() then raise exception 'Ganti kata sandi sendiri lewat akun Anda, bukan lewat menu ini'; end if;
  if length(coalesce(p_sandi, '')) < 6 then raise exception 'Kata sandi minimal 6 karakter'; end if;
  update auth.users set encrypted_password = crypt(p_sandi, gen_salt('bf')), updated_at = now()
   where id = p_user;
  if not found then raise exception 'Akun tidak ditemukan'; end if;
end
$$;

revoke execute on function public.atur_ulang_sandi(uuid, text) from public, anon;
grant execute on function public.atur_ulang_sandi(uuid, text) to authenticated;
grant execute on function public.username_tersedia(text), public.email_masuk(text) to anon, authenticated;

