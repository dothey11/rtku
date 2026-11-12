-- =====================================================================
-- RTku: skema database (Supabase / PostgreSQL)
-- Jalankan seluruh file ini SATU KALI di Supabase > SQL Editor,
-- lalu jalankan database/seed.sql untuk data awal.
-- =====================================================================

-- ---------- 1. Akun pengguna ----------
-- Setiap akun login (auth.users) punya satu baris profil.
-- Akun baru belum aktif: Ketua RT harus memverifikasinya dulu.
create table public.profiles (
  id      uuid primary key references auth.users(id) on delete cascade,
  nama    text not null,
  rumah   text not null default '-',
  peran   text not null default 'warga' check (peran in ('warga','ketua','satpam')),
  aktif   boolean not null default false,
  dibuat  timestamptz not null default now()
);

-- Fungsi bantu: peran, rumah dan nama pengguna yang sedang login.
-- Mengembalikan NULL bila akun belum diverifikasi, sehingga semua aturan akses gagal.
create function public.peran() returns text
  language sql stable security definer set search_path = public as
$$ select peran from profiles where id = auth.uid() and aktif $$;

create function public.rumah_saya() returns text
  language sql stable security definer set search_path = public as
$$ select rumah from profiles where id = auth.uid() and aktif $$;

create function public.nama_saya() returns text
  language sql stable security definer set search_path = public as
$$ select nama from profiles where id = auth.uid() and aktif $$;

-- Buat profil otomatis saat seseorang mendaftar.
create function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as
$$
begin
  insert into profiles (id, nama, rumah)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'nama'), ''), split_part(new.email, '@', 1)),
    upper(coalesce(nullif(trim(new.raw_user_meta_data->>'rumah'), ''), '-'))
  );
  return new;
end
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- 2. Tabel data ----------
create table public.iuran_jenis (
  id      bigint generated always as identity primary key,
  nama    text not null,
  jumlah  integer not null check (jumlah > 0)
);

create table public.warga (
  id      bigint generated always as identity primary key,
  rumah   text not null,
  nama    text not null,
  status  text not null check (status in ('Pemilik','Penyewa','Kos','ART')),
  jiwa    integer not null default 1 check (jiwa > 0),
  hp      text not null default '',
  kk      boolean not null default false   -- true = kepala keluarga, penanggung iuran rumah itu
);
create index on public.warga (rumah);

create table public.tagihan (
  id            bigint generated always as identity primary key,
  rumah         text not null,
  bulan         text not null check (bulan ~ '^\d{4}-\d{2}$'),
  jumlah        integer not null,
  lunas         boolean not null default false,
  metode        text,
  dibayar_pada  timestamptz,
  unique (rumah, bulan)
);

create table public.kas (
  id     bigint generated always as identity primary key,
  tgl    date not null default current_date,
  ket    text not null,
  jenis  text not null check (jenis in ('masuk','keluar')),
  jml    integer not null check (jml > 0)
);

create sequence public.surat_nomor_seq start 1;

create table public.surat (
  id         bigint generated always as identity primary key,
  user_id    uuid default auth.uid() references auth.users(id) on delete set null,
  pemohon    text not null default public.nama_saya(),
  rumah      text not null default public.rumah_saya(),
  jenis      text not null,
  keperluan  text not null,
  waktu      timestamptz not null default now(),
  status     text not null default 'Menunggu' check (status in ('Menunggu','Disetujui','Ditolak')),
  nomor      text,
  kode       text,
  catatan    text,
  setuju     timestamptz
);

create table public.sos (
  id       bigint generated always as identity primary key,
  user_id  uuid default auth.uid() references auth.users(id) on delete set null,
  nama     text not null default public.nama_saya(),
  rumah    text not null default public.rumah_saya(),
  jenis    text not null,
  waktu    timestamptz not null default now(),
  status   text not null default 'Aktif' check (status in ('Aktif','Ditangani','Selesai')),
  petugas  text
);

create table public.pengumuman (
  id     bigint generated always as identity primary key,
  judul  text not null,
  isi    text not null,
  waktu  timestamptz not null default now(),
  oleh   text not null default public.nama_saya()
);

create table public.polling (
  id     bigint generated always as identity primary key,
  tanya  text not null,
  waktu  timestamptz not null default now()
);

create table public.polling_opsi (
  id          bigint generated always as identity primary key,
  polling_id  bigint not null references public.polling(id) on delete cascade,
  teks        text not null
);

create table public.polling_suara (
  polling_id  bigint not null references public.polling(id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  opsi_id     bigint not null references public.polling_opsi(id) on delete cascade,
  waktu       timestamptz not null default now(),
  primary key (polling_id, user_id)          -- satu suara per akun per polling
);

create table public.lapor (
  id        bigint generated always as identity primary key,
  user_id   uuid default auth.uid() references auth.users(id) on delete set null,
  pelapor   text not null default public.nama_saya(),
  rumah     text not null default public.rumah_saya(),
  judul     text not null,
  kategori  text not null,
  ket       text not null,
  foto      text,                             -- URL foto di Supabase Storage
  waktu     timestamptz not null default now(),
  status    text not null default 'Baru' check (status in ('Baru','Diproses','Selesai'))
);

create table public.tamu (
  id        bigint generated always as identity primary key,
  user_id   uuid default auth.uid() references auth.users(id) on delete set null,
  tuan      text not null default public.nama_saya(),
  rumah     text not null default public.rumah_saya(),
  nama      text not null,
  hubungan  text not null,
  asal      text not null,
  datang    date not null,
  malam     integer not null default 1 check (malam between 1 and 60),
  waktu     timestamptz not null default now()
);

-- ---------- 3. Aturan akses (Row Level Security) ----------
alter table public.profiles      enable row level security;
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

-- Profil: lihat milik sendiri; Ketua RT melihat dan mengubah semua (verifikasi, ganti peran).
create policy profil_lihat on public.profiles for select to authenticated
  using (id = auth.uid() or public.peran() = 'ketua');
create policy profil_ubah on public.profiles for update to authenticated
  using (public.peran() = 'ketua') with check (public.peran() = 'ketua');

-- Jenis iuran: semua akun aktif boleh lihat, Ketua RT yang mengatur.
create policy iuran_lihat on public.iuran_jenis for select to authenticated
  using (public.peran() is not null);
create policy iuran_atur on public.iuran_jenis for all to authenticated
  using (public.peran() = 'ketua') with check (public.peran() = 'ketua');

-- Data warga: Ketua RT melihat semua, warga hanya rumahnya sendiri.
create policy warga_lihat on public.warga for select to authenticated
  using (public.peran() = 'ketua' or rumah = public.rumah_saya());
create policy warga_atur on public.warga for all to authenticated
  using (public.peran() = 'ketua') with check (public.peran() = 'ketua');

-- Tagihan: warga melihat tagihan rumahnya, Ketua RT semua.
-- Perubahan status lunas hanya lewat fungsi di bagian 4.
create policy tagihan_lihat on public.tagihan for select to authenticated
  using (public.peran() = 'ketua' or rumah = public.rumah_saya());

-- Kas: laporan terbuka untuk semua akun aktif; Ketua RT mencatat.
create policy kas_lihat on public.kas for select to authenticated
  using (public.peran() is not null);
create policy kas_catat on public.kas for insert to authenticated
  with check (public.peran() = 'ketua');

-- Surat: warga mengajukan dan melihat miliknya; Ketua RT melihat dan memutuskan.
create policy surat_lihat on public.surat for select to authenticated
  using (public.peran() = 'ketua' or user_id = auth.uid());
create policy surat_ajukan on public.surat for insert to authenticated
  with check (user_id = auth.uid() and rumah = public.rumah_saya() and pemohon = public.nama_saya()
              and status = 'Menunggu' and nomor is null and kode is null);
create policy surat_putuskan on public.surat for update to authenticated
  using (public.peran() = 'ketua') with check (public.peran() = 'ketua');

-- SOS: pengirim melihat miliknya; Ketua RT dan satpam melihat dan menangani semua.
create policy sos_lihat on public.sos for select to authenticated
  using (public.peran() in ('ketua','satpam') or user_id = auth.uid());
create policy sos_kirim on public.sos for insert to authenticated
  with check (user_id = auth.uid() and rumah = public.rumah_saya() and nama = public.nama_saya()
              and status = 'Aktif');
create policy sos_tangani on public.sos for update to authenticated
  using (public.peran() in ('ketua','satpam')) with check (public.peran() in ('ketua','satpam'));

-- Pengumuman dan polling: semua akun aktif membaca, Ketua RT membuat.
create policy umum_lihat on public.pengumuman for select to authenticated
  using (public.peran() is not null);
create policy umum_buat on public.pengumuman for insert to authenticated
  with check (public.peran() = 'ketua');

create policy polling_lihat on public.polling for select to authenticated
  using (public.peran() is not null);
create policy polling_buat on public.polling for insert to authenticated
  with check (public.peran() = 'ketua');
create policy opsi_lihat on public.polling_opsi for select to authenticated
  using (public.peran() is not null);
create policy opsi_buat on public.polling_opsi for insert to authenticated
  with check (public.peran() = 'ketua');

-- Suara: setiap orang hanya melihat pilihannya sendiri (rahasia).
-- Jumlah suara diambil lewat fungsi hasil_polling().
create policy suara_lihat on public.polling_suara for select to authenticated
  using (user_id = auth.uid());
create policy suara_pilih on public.polling_suara for insert to authenticated
  with check (user_id = auth.uid() and public.peran() is not null);

-- Lapor RT: semua akun aktif melihat, pelapor membuat, Ketua RT mengubah status.
create policy lapor_lihat on public.lapor for select to authenticated
  using (public.peran() is not null);
create policy lapor_buat on public.lapor for insert to authenticated
  with check (user_id = auth.uid() and rumah = public.rumah_saya() and pelapor = public.nama_saya()
              and status = 'Baru');
create policy lapor_status on public.lapor for update to authenticated
  using (public.peran() = 'ketua') with check (public.peran() = 'ketua');

-- Buku tamu: tuan rumah melihat tamunya; Ketua RT dan satpam melihat semua.
create policy tamu_lihat on public.tamu for select to authenticated
  using (public.peran() in ('ketua','satpam') or rumah = public.rumah_saya());
create policy tamu_lapor on public.tamu for insert to authenticated
  with check (user_id = auth.uid() and rumah = public.rumah_saya() and tuan = public.nama_saya());

-- ---------- 4. Fungsi transaksi ----------
-- Nama bulan Indonesia dari teks 'YYYY-MM'.
create function public.nama_bulan(p_bulan text) returns text
  language sql immutable as
$$
  select (array['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus',
                'September','Oktober','November','Desember'])[split_part(p_bulan, '-', 2)::int]
         || ' ' || split_part(p_bulan, '-', 1)
$$;

-- Warga membayar tagihan rumahnya. Tagihan ditandai lunas dan kas bertambah.
-- CATATAN: ini masih simulasi. Di produksi, fungsi ini dipanggil oleh webhook
-- payment gateway (Midtrans/Xendit) setelah uang benar-benar diterima, bukan oleh warga.
create function public.bayar_tagihan(p_bulan text, p_metode text) returns void
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

-- Ketua RT mencatat pembayaran tunai.
create function public.catat_tunai(p_rumah text, p_bulan text) returns void
  language plpgsql security definer set search_path = public as
$$
declare v_jumlah integer;
begin
  if peran() is distinct from 'ketua' then raise exception 'Hanya Ketua RT'; end if;
  update tagihan set lunas = true, metode = 'tunai', dibayar_pada = now()
   where rumah = p_rumah and bulan = p_bulan and not lunas
   returning jumlah into v_jumlah;
  if v_jumlah is null then raise exception 'Tagihan tidak ditemukan atau sudah lunas'; end if;
  insert into kas (ket, jenis, jml)
  values ('Iuran ' || nama_bulan(p_bulan) || ' ' || p_rumah || ' (tunai)', 'masuk', v_jumlah);
end
$$;

-- Ketua RT membuat tagihan satu bulan untuk semua rumah yang punya kepala keluarga.
create function public.buat_tagihan(p_bulan text) returns integer
  language plpgsql security definer set search_path = public as
$$
declare v_total integer; v_n integer;
begin
  if peran() is distinct from 'ketua' then raise exception 'Hanya Ketua RT'; end if;
  select coalesce(sum(jumlah), 0) into v_total from iuran_jenis;
  if v_total = 0 then raise exception 'Jenis iuran belum diisi'; end if;
  insert into tagihan (rumah, bulan, jumlah)
  select distinct rumah, p_bulan, v_total from warga where kk
  on conflict (rumah, bulan) do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end
$$;

-- Ketua RT menyetujui surat: diberi nomor urut dan kode verifikasi.
create function public.setujui_surat(p_id bigint) returns public.surat
  language plpgsql security definer set search_path = public as
$$
declare v public.surat;
        v_romawi text[] := array['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
begin
  if peran() is distinct from 'ketua' then raise exception 'Hanya Ketua RT'; end if;
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
create function public.hasil_polling() returns table (opsi_id bigint, jumlah bigint)
  language sql stable security definer set search_path = public as
$$
  select s.opsi_id, count(*) from polling_suara s
   where peran() is not null group by s.opsi_id
$$;

revoke execute on function public.bayar_tagihan(text, text), public.catat_tunai(text, text),
  public.buat_tagihan(text), public.setujui_surat(bigint), public.hasil_polling() from public, anon;
grant execute on function public.bayar_tagihan(text, text), public.catat_tunai(text, text),
  public.buat_tagihan(text), public.setujui_surat(bigint), public.hasil_polling() to authenticated;

-- ---------- 5. Realtime (agar SOS dan data baru langsung muncul) ----------
alter publication supabase_realtime add table
  public.sos, public.pengumuman, public.polling, public.polling_suara, public.lapor,
  public.surat, public.tagihan, public.kas, public.tamu, public.profiles;

-- ---------- 6. Penyimpanan foto laporan ----------
insert into storage.buckets (id, name, public)
values ('lapor-foto', 'lapor-foto', true)
on conflict (id) do nothing;

create policy lapor_foto_unggah on storage.objects for insert to authenticated
  with check (bucket_id = 'lapor-foto' and public.peran() is not null);
