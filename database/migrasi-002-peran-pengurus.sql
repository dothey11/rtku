-- =====================================================================
-- RTku migrasi 002: peran Bendahara dan Sekretaris
-- Jalankan SATU KALI di Supabase > SQL Editor bila database Anda dibuat
-- dari schema.sql versi sebelumnya. (schema.sql terbaru sudah memuat ini.)
-- =====================================================================

-- Peran yang diizinkan
alter table public.profiles drop constraint profiles_peran_check;
alter table public.profiles add constraint profiles_peran_check
  check (peran in ('warga','ketua','bendahara','sekretaris','satpam'));

-- Bendahara: iuran, tagihan, kas
alter policy iuran_atur on public.iuran_jenis
  using (public.peran() in ('ketua','bendahara')) with check (public.peran() in ('ketua','bendahara'));
alter policy tagihan_lihat on public.tagihan
  using (public.peran() in ('ketua','bendahara') or rumah = public.rumah_saya());
alter policy kas_catat on public.kas
  with check (public.peran() in ('ketua','bendahara'));

-- Sekretaris: data warga, surat (melihat), pengumuman, polling, lapor, buku tamu
-- Bendahara ikut melihat data warga karena perlu nama penanggung iuran.
alter policy warga_lihat on public.warga
  using (public.peran() in ('ketua','sekretaris','bendahara') or rumah = public.rumah_saya());
alter policy warga_atur on public.warga
  using (public.peran() in ('ketua','sekretaris')) with check (public.peran() in ('ketua','sekretaris'));
alter policy surat_lihat on public.surat
  using (public.peran() in ('ketua','sekretaris') or user_id = auth.uid());
alter policy umum_buat on public.pengumuman
  with check (public.peran() in ('ketua','sekretaris'));
alter policy polling_buat on public.polling
  with check (public.peran() in ('ketua','sekretaris'));
alter policy opsi_buat on public.polling_opsi
  with check (public.peran() in ('ketua','sekretaris'));
alter policy lapor_status on public.lapor
  using (public.peran() in ('ketua','sekretaris')) with check (public.peran() in ('ketua','sekretaris'));
alter policy tamu_lihat on public.tamu
  using (public.peran() in ('ketua','sekretaris','satpam') or rumah = public.rumah_saya());

-- Semua pengurus dan satpam menerima dan menangani SOS
alter policy sos_lihat on public.sos
  using (public.peran() in ('ketua','bendahara','sekretaris','satpam') or user_id = auth.uid());
alter policy sos_tangani on public.sos
  using (public.peran() in ('ketua','bendahara','sekretaris','satpam'))
  with check (public.peran() in ('ketua','bendahara','sekretaris','satpam'));

-- Fungsi kas: Ketua RT atau Bendahara
create or replace function public.catat_tunai(p_rumah text, p_bulan text) returns void
  language plpgsql security definer set search_path = public as
$$
declare v_jumlah integer;
begin
  if peran() is null or peran() not in ('ketua','bendahara') then raise exception 'Hanya Ketua RT atau Bendahara'; end if;
  update tagihan set lunas = true, metode = 'tunai', dibayar_pada = now()
   where rumah = p_rumah and bulan = p_bulan and not lunas
   returning jumlah into v_jumlah;
  if v_jumlah is null then raise exception 'Tagihan tidak ditemukan atau sudah lunas'; end if;
  insert into kas (ket, jenis, jml)
  values ('Iuran ' || nama_bulan(p_bulan) || ' ' || p_rumah || ' (tunai)', 'masuk', v_jumlah);
end
$$;

create or replace function public.buat_tagihan(p_bulan text) returns integer
  language plpgsql security definer set search_path = public as
$$
declare v_total integer; v_n integer;
begin
  if peran() is null or peran() not in ('ketua','bendahara') then raise exception 'Hanya Ketua RT atau Bendahara'; end if;
  select coalesce(sum(jumlah), 0) into v_total from iuran_jenis;
  if v_total = 0 then raise exception 'Jenis iuran belum diisi'; end if;
  insert into tagihan (rumah, bulan, jumlah)
  select distinct rumah, p_bulan, v_total from warga where kk
  on conflict (rumah, bulan) do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end
$$;
