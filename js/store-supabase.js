// Penyimpanan versi DATABASE: semua data dibaca dan ditulis ke Supabase (PostgreSQL).
// Dipakai setelah js/config.js diisi. Hak akses tiap peran dijaga di database (lihat database/schema.sql).
"use strict";
window.SupaStore = function (cfg) {
  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  let user = null;
  const ok = r => { if (r.error) throw new Error(r.error.message); return r.data; };
  const semua = async (tabel, urut) => { let q = sb.from(tabel).select("*"); if (urut) q = q.order(urut, { ascending: false }); return ok(await q) || []; };
  const bulanIni = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); };

  return {
    mode: "live",

    // ----- akun -----
    async init() { const r = await sb.auth.getSession(); user = r.data && r.data.session ? r.data.session.user : null; return !!user; },
    async masuk(email, password) { ok(await sb.auth.signInWithPassword({ email, password })); return this.init(); },
    async daftar(d) {
      const r = ok(await sb.auth.signUp({ email: d.email, password: d.password, options: { data: { nama: d.nama, rumah: d.rumah } } }));
      user = r.session ? r.session.user : null; return !!user;   // false = perlu konfirmasi email dulu
    },
    async keluar() { await sb.auth.signOut(); user = null; },

    // ----- muat semua data yang boleh dilihat akun ini -----
    async load() {
      const prof = ok(await sb.from("profiles").select("*").eq("id", user.id).maybeSingle());
      const me = prof || { id: user.id, nama: user.email, rumah: "-", peran: "warga", aktif: false };
      if (!me.aktif) return { mode: "live", me, pending: true };
      const [iuran, warga, tagihan, kas, surat, sos, pengumuman, poll, opsi, suara, hasil, lapor, tamu, akun, peran, izinSemua] = await Promise.all([
        semua("iuran_jenis"), semua("warga"), semua("tagihan"), semua("kas"), semua("surat", "waktu"), semua("sos", "waktu"),
        semua("pengumuman", "waktu"), semua("polling", "waktu"), semua("polling_opsi"), semua("polling_suara"),
        sb.rpc("hasil_polling").then(ok), semua("lapor", "waktu"), semua("tamu", "waktu"),
        semua("profiles", "dibuat"),          // aturan akses: hanya izin 'akun.kelola' yang menerima semua akun
        semua("peran"), semua("peran_izin")
      ]);
      // Peran dan izinnya dibaca dari database, tidak ditulis mati di aplikasi.
      const urut = ["warga", "ketua"];
      const peranList = peran.map(p => ({ kode: p.kode, nama: p.nama, bawaan: p.bawaan, izin: izinSemua.filter(i => i.peran === p.kode).map(i => i.izin) }))
        .sort((a, b) => (b.bawaan - a.bawaan) || (urut.indexOf(a.kode) - urut.indexOf(b.kode)) || a.nama.localeCompare(b.nama));
      const semuaIzin = ["rumah", "kas.kelola", "surat.lihat", "surat.putuskan", "info.kelola", "lapor.kelola", "warga.lihat", "warga.kelola", "tamu.lihat", "sos.tangani", "akun.kelola"];
      const punya = peranList.find(p => p.kode === me.peran);
      const izin = me.peran === "ketua" ? semuaIzin : (punya ? punya.izin : []);
      const n = {}; (hasil || []).forEach(h => { n[h.opsi_id] = Number(h.jumlah); });
      warga.sort((a, b) => a.rumah.localeCompare(b.rumah) || (b.kk - a.kk));
      opsi.sort((a, b) => a.id - b.id);
      return {
        mode: "live", me, izin, peranList, bulan: bulanIni(), iuran, warga, tagihan, kas, surat, sos, pengumuman, lapor, tamu, akun,
        polling: poll.map(q => {
          const s = suara.find(x => x.polling_id === q.id && x.user_id === user.id);
          return { id: q.id, tanya: q.tanya, pilihku: s ? s.opsi_id : null, opsi: opsi.filter(o => o.polling_id === q.id).map(o => ({ id: o.id, t: o.teks, n: n[o.id] || 0 })) };
        })
      };
    },

    // Panggil cb setiap ada perubahan data di database (SOS baru, pengumuman baru, dan seterusnya).
    onChange(cb) { sb.channel("rtku").on("postgres_changes", { event: "*", schema: "public" }, cb).subscribe(); },

    // ----- iuran dan kas -----
    async bayar(bulan, metode) { ok(await sb.rpc("bayar_tagihan", { p_bulan: bulan, p_metode: metode })); },
    async tunai(rumah, bulan) { ok(await sb.rpc("catat_tunai", { p_rumah: rumah, p_bulan: bulan })); },
    async buatTagihan(bulan) { ok(await sb.rpc("buat_tagihan", { p_bulan: bulan })); },
    async catatKas(d) { ok(await sb.from("kas").insert({ tgl: d.tgl, ket: d.ket, jenis: d.jenis, jml: d.jml })); },

    // ----- surat -----
    async ajukanSurat(d) { ok(await sb.from("surat").insert({ jenis: d.jenis, keperluan: d.keperluan, untuk: d.untuk || null })); },
    async setujuiSurat(id) { return ok(await sb.rpc("setujui_surat", { p_id: id })); },
    async tolakSurat(id, catatan) { ok(await sb.from("surat").update({ status: "Ditolak", catatan }).eq("id", id)); },

    // ----- darurat -----
    async kirimSos(jenis) { ok(await sb.from("sos").insert({ jenis })); },
    async sosStatus(id, status, petugas) { ok(await sb.from("sos").update({ status, petugas }).eq("id", id)); },

    // ----- informasi -----
    async umumkan(d) { ok(await sb.from("pengumuman").insert({ judul: d.judul, isi: d.isi })); },
    async buatPolling(tanya, opsi) {
      const p = ok(await sb.from("polling").insert({ tanya }).select().single());
      ok(await sb.from("polling_opsi").insert(opsi.map(teks => ({ polling_id: p.id, teks }))));
    },
    async vote(pollId, opsiId) { ok(await sb.from("polling_suara").insert({ polling_id: pollId, opsi_id: opsiId })); },
    async lapor(d) {
      let foto = null;
      if (d.file) {
        const path = user.id + "/" + Date.now() + "-" + d.file.name.replace(/[^a-zA-Z0-9.]+/g, "_");
        ok(await sb.storage.from("lapor-foto").upload(path, d.file));
        foto = sb.storage.from("lapor-foto").getPublicUrl(path).data.publicUrl;
      }
      ok(await sb.from("lapor").insert({ judul: d.judul, kategori: d.kategori, ket: d.ket, foto }));
    },
    async laporStatus(id, status) { ok(await sb.from("lapor").update({ status }).eq("id", id)); },

    // ----- warga dan tamu -----
    async tamu(d) { ok(await sb.from("tamu").insert(d)); },
    // Pengurus mendaftarkan kepala keluarga; pengurus atau penghuni menambah anggota (rumah dikunci di database).
    async tambahKK(d) {
      const r = await sb.from("warga").insert(Object.assign({ kk: true }, d));
      if (r.error) throw new Error(/warga_satu_kk/.test(r.error.message) ? "Rumah itu sudah punya kepala keluarga terdaftar." : r.error.message);
    },
    async tambahAnggota(rumah, d) {
      const r = await sb.from("warga").insert(Object.assign({ kk: false, rumah }, d));
      if (r.error) throw new Error(/row-level security/.test(r.error.message) ? "Tidak bisa menambah anggota: rumah belum didaftarkan pengurus, atau bukan rumah Anda." : r.error.message);
    },
    async ubahWarga(id, d) {
      const r = await sb.from("warga").update(d).eq("id", id);
      if (r.error) throw new Error(/warga_satu_kk/.test(r.error.message) ? "Rumah itu sudah punya kepala keluarga terdaftar." : r.error.message);
    },
    async hapusWarga(id) { ok(await sb.from("warga").delete().eq("id", id)); },

    // ----- akun, peran, izin -----
    async aturAkun(id, ubah) { ok(await sb.from("profiles").update(ubah).eq("id", id)); },
    async tambahPeran(d) { ok(await sb.from("peran").insert({ kode: d.kode, nama: d.nama })); },
    async hapusPeran(kode) {
      const r = await sb.from("peran").delete().eq("kode", kode);
      if (r.error) throw new Error(/foreign key/i.test(r.error.message) ? "Peran masih dipakai akun. Pindahkan akun itu ke peran lain dulu." : r.error.message);
    },
    async setIzin(peran, izin, aktif) {
      if (aktif) ok(await sb.from("peran_izin").upsert({ peran, izin }));
      else ok(await sb.from("peran_izin").delete().eq("peran", peran).eq("izin", izin));
    }
  };
};
