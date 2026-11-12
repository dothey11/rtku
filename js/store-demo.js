// Penyimpanan MODE DEMO: data contoh, tersimpan di browser ini saja (localStorage).
// Dipakai selama js/config.js belum diisi. Bentuk datanya sama dengan versi Supabase.
"use strict";
window.DemoStore = function () {
  const KEY = "rtku-demo-v2";
  const USERS = {
    warga:  { nama: "Sari Wulandari", rumah: "C-12" },
    ketua:  { nama: "Hendra Wijaya",  rumah: "A-01" },
    bendahara:  { nama: "Fitri Handayani", rumah: "B-05" },
    sekretaris: { nama: "Agus Santoso",    rumah: "A-02" },
    satpam: { nama: "Ujang Suryana",  rumah: "Pos Jaga" }
  };
  const BULAN = "2026-11";
  const BLN = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
  const namaBulan = ym => BLN[Number(ym.slice(5)) - 1] + " " + ym.slice(0, 4);
  const kini = () => { const d = new Date(), p = n => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
  const kode = () => Array.from({ length: 8 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
  const ROMAWI = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"];

  function seed() {
    const warga = [
      ["A-01","Hendra Wijaya","Pemilik",4,"0812-0000-0101",true],["A-02","Agus Santoso","Pemilik",3,"0812-0000-0102",true],
      ["A-03","Rina Marlina","Penyewa",2,"0812-0000-0103",true],["A-04","Made Sudarsana","Pemilik",5,"0812-0000-0104",true],
      ["A-04","Sumiyati","ART",1,"0812-0000-0114",false],["B-05","Fitri Handayani","Pemilik",4,"0812-0000-0105",true],
      ["B-06","Bambang Prasetyo","Pemilik",4,"0812-0000-0106",true],["B-07","Yohanes Tan","Pemilik",2,"0812-0000-0107",true],
      ["B-08","Dewi Lestari","Penyewa",3,"0812-0000-0108",true],["C-09","Ahmad Fauzi","Pemilik",6,"0812-0000-0109",true],
      ["C-09","Rizky Maulana","Kos",1,"0812-0000-0119",false],["C-09","Dimas Aditya","Kos",1,"0812-0000-0129",false],
      ["C-10","Siti Nurhaliza","Penyewa",2,"0812-0000-0110",true],["C-11","Paulus Simanjuntak","Pemilik",4,"0812-0000-0111",true],
      ["C-12","Sari Wulandari","Pemilik",3,"0812-0000-0112",true],["C-12","Tuti Rahayu","ART",1,"0812-0000-0122",false]
    ].map(([rumah, nama, status, jiwa, hp, kk]) => ({ rumah, nama, status, jiwa, hp, kk }));
    const belum = { "2026-10": ["B-08"], "2026-11": ["A-03", "B-06", "B-08", "C-10", "C-12"] };
    const tagihan = [];
    ["2026-09", "2026-10", "2026-11"].forEach(bulan => warga.filter(w => w.kk).forEach(w => {
      const lunas = !(belum[bulan] || []).includes(w.rumah);
      tagihan.push({ rumah: w.rumah, bulan, jumlah: 120000, lunas, metode: lunas ? "transfer" : null });
    }));
    return {
      role: "warga", seq: { surat: 14, id: 100 },
      iuran: [{ nama: "Iuran keamanan", jumlah: 75000 }, { nama: "Iuran sampah", jumlah: 25000 }, { nama: "Kas RT", jumlah: 20000 }],
      warga, tagihan,
      kas: [
        ["2026-08-01","Saldo awal","masuk",2350000],["2026-08-05","Iuran Agustus (12 rumah)","masuk",1440000],
        ["2026-08-20","Honor satpam Agustus","keluar",900000],["2026-08-25","Angkut sampah Agustus","keluar",300000],
        ["2026-09-05","Iuran September (12 rumah)","masuk",1440000],["2026-09-14","Perbaikan lampu jalan Blok B","keluar",275000],
        ["2026-09-20","Honor satpam September","keluar",900000],["2026-09-25","Angkut sampah September","keluar",300000],
        ["2026-10-05","Iuran Oktober (11 rumah)","masuk",1320000],["2026-10-12","Konsumsi kerja bakti","keluar",185000],
        ["2026-10-20","Honor satpam Oktober","keluar",900000],["2026-10-25","Angkut sampah Oktober","keluar",300000],
        ["2026-11-05","Iuran November (7 rumah)","masuk",840000],["2026-11-08","Cat gapura dan kuas","keluar",450000]
      ].map(([tgl, ket, jenis, jml]) => ({ tgl, ket, jenis, jml })),
      surat: [
        { id: 1, jenis: "Surat Keterangan Domisili", keperluan: "Pembukaan rekening bank", pemohon: "Sari Wulandari", rumah: "C-12", waktu: "2026-10-21T19:10", status: "Disetujui", nomor: "013/SK/RT04-RW07/X/2026", kode: "K7Q2M9XA", setuju: "2026-10-22T07:30" },
        { id: 2, jenis: "Surat Pengantar KTP", keperluan: "Perekaman KTP anak usia 17 tahun", pemohon: "Bambang Prasetyo", rumah: "B-06", waktu: "2026-11-10T20:35", status: "Menunggu" }
      ],
      sos: [{ id: 1, jenis: "Darurat medis", nama: "Yohanes Tan", rumah: "B-07", waktu: "2026-10-29T22:14", status: "Selesai", petugas: "Ujang Suryana" }],
      pengumuman: [
        { id: 1, judul: "Kerja bakti bersih selokan", isi: "Minggu, 15 November 2026 pukul 07.00 di sepanjang Blok B dan C. Mohon membawa cangkul atau sapu lidi.", waktu: "2026-11-09T08:00", oleh: "Hendra Wijaya" },
        { id: 2, judul: "Pemadaman listrik bergilir", isi: "PLN menjadwalkan pemeliharaan jaringan pada Kamis, 12 November 2026 pukul 10.00 sampai 14.00.", waktu: "2026-11-07T16:20", oleh: "Hendra Wijaya" },
        { id: 3, judul: "Rapat warga akhir tahun", isi: "Sabtu, 28 November 2026 pukul 19.30 di balai RT. Agenda: laporan kas dan rencana kegiatan 2027.", waktu: "2026-11-03T09:15", oleh: "Hendra Wijaya" }
      ],
      polling: [
        { id: 1, tanya: "Warna cat gapura yang baru", opsi: [{ id: 11, t: "Merah putih", n: 5 }, { id: 12, t: "Hijau tua", n: 3 }, { id: 13, t: "Biru laut", n: 2 }], pilih: {} },
        { id: 2, tanya: "Tujuan rekreasi warga Desember", opsi: [{ id: 21, t: "Kebun Raya Bogor", n: 4 }, { id: 22, t: "Pantai Anyer", n: 6 }, { id: 23, t: "Lembang", n: 3 }], pilih: {} }
      ],
      lapor: [
        { id: 1, judul: "Lampu jalan mati", kategori: "Penerangan", ket: "Lampu di depan rumah B-08 mati sejak tiga hari lalu.", pelapor: "Dewi Lestari", rumah: "B-08", waktu: "2026-11-08T18:40", status: "Diproses" },
        { id: 2, judul: "Selokan mampet", kategori: "Kebersihan", ket: "Air meluap ke jalan saat hujan di tikungan Blok C.", pelapor: "Sari Wulandari", rumah: "C-12", waktu: "2026-11-10T06:55", status: "Baru" }
      ],
      tamu: [
        { id: 1, nama: "Budi Hartono", hubungan: "Kakak kandung", asal: "Semarang", datang: "2026-11-10", malam: 3, tuan: "Sari Wulandari", rumah: "C-12", waktu: "2026-11-10T15:05" },
        { id: 2, nama: "Lina Kusuma", hubungan: "Teman kuliah", asal: "Bandung", datang: "2026-11-09", malam: 1, tuan: "Rina Marlina", rumah: "A-03", waktu: "2026-11-09T20:30" }
      ]
    };
  }

  let D = (function () { try { const o = JSON.parse(localStorage.getItem(KEY)); if (o && o.kas && o.tagihan) return o; } catch (e) {} return seed(); })();
  const save = () => { try { const c = JSON.parse(JSON.stringify(D)); c.lapor.forEach(l => { if (l.foto && l.foto.length > 2000) delete l.foto; }); localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {} };
  const me = () => Object.assign({ id: D.role, peran: D.role, aktif: true }, USERS[D.role]);
  const nid = () => ++D.seq.id;
  const cari = (arr, id) => { const x = arr.find(o => o.id === id); if (!x) throw new Error("Data tidak ditemukan"); return x; };
  function lunasi(rumah, bulan, metode) {
    const t = D.tagihan.find(x => x.rumah === rumah && x.bulan === bulan && !x.lunas);
    if (!t) throw new Error("Tagihan tidak ditemukan atau sudah lunas");
    t.lunas = true; t.metode = metode;
    D.kas.push({ tgl: kini().slice(0, 10), ket: `Iuran ${namaBulan(bulan)} ${rumah} (${metode})`, jenis: "masuk", jml: t.jumlah });
  }
  const bacaFile = f => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => no(new Error("Foto tidak terbaca")); r.readAsDataURL(f); });

  return {
    mode: "demo",
    async init() { return true; },
    async load() {
      return {
        mode: "demo", me: me(), bulan: BULAN, iuran: D.iuran, warga: D.warga, tagihan: D.tagihan, kas: D.kas, surat: D.surat,
        sos: D.sos, pengumuman: D.pengumuman, lapor: D.lapor, tamu: D.tamu, akun: [],
        polling: D.polling.map(q => ({ id: q.id, tanya: q.tanya, opsi: q.opsi, pilihku: q.pilih[D.role] == null ? null : q.pilih[D.role] }))
      };
    },
    onChange() {},
    setRole(r) { D.role = r; save(); },
    reset() { D = seed(); save(); },

    async bayar(bulan, metode) { lunasi(me().rumah, bulan, metode); save(); },
    async tunai(rumah, bulan) { lunasi(rumah, bulan, "tunai"); save(); },
    async buatTagihan(bulan) {
      const total = D.iuran.reduce((a, i) => a + i.jumlah, 0);
      D.warga.filter(w => w.kk).forEach(w => { if (!D.tagihan.some(t => t.rumah === w.rumah && t.bulan === bulan)) D.tagihan.push({ rumah: w.rumah, bulan, jumlah: total, lunas: false, metode: null }); });
      save();
    },
    async catatKas(d) { D.kas.push({ tgl: d.tgl, ket: d.ket, jenis: d.jenis, jml: d.jml }); save(); },

    async ajukanSurat(d) { const u = me(); D.surat.push({ id: nid(), jenis: d.jenis, keperluan: d.keperluan, pemohon: u.nama, rumah: u.rumah, waktu: kini(), status: "Menunggu" }); save(); },
    async setujuiSurat(id) {
      const s = cari(D.surat, id), d = new Date();
      s.status = "Disetujui"; s.setuju = kini(); s.kode = kode();
      s.nomor = `${String(D.seq.surat++).padStart(3, "0")}/SK/RT04-RW07/${ROMAWI[d.getMonth()]}/${d.getFullYear()}`;
      save(); return s;
    },
    async tolakSurat(id, catatan) { const s = cari(D.surat, id); s.status = "Ditolak"; s.catatan = catatan; save(); },

    async kirimSos(jenis) { const u = me(); D.sos.push({ id: nid(), jenis, nama: u.nama, rumah: u.rumah, waktu: kini(), status: "Aktif" }); save(); },
    async sosStatus(id, status) { const a = cari(D.sos, id); a.status = status; if (!a.petugas) a.petugas = me().nama; save(); },

    async umumkan(d) { D.pengumuman.unshift({ id: nid(), judul: d.judul, isi: d.isi, waktu: kini(), oleh: me().nama }); save(); },
    async buatPolling(tanya, opsi) { D.polling.unshift({ id: nid(), tanya, opsi: opsi.map(t => ({ id: nid(), t, n: 0 })), pilih: {} }); save(); },
    async vote(pollId, opsiId) {
      const q = cari(D.polling, pollId); if (q.pilih[D.role] != null) throw new Error("Anda sudah memilih");
      cari(q.opsi, opsiId).n++; q.pilih[D.role] = opsiId; save();
    },

    async lapor(d) { const u = me(); const foto = d.file ? await bacaFile(d.file) : null; D.lapor.push({ id: nid(), judul: d.judul, kategori: d.kategori, ket: d.ket, foto, pelapor: u.nama, rumah: u.rumah, waktu: kini(), status: "Baru" }); save(); },
    async laporStatus(id, status) { cari(D.lapor, id).status = status; save(); },

    async tamu(d) { const u = me(); D.tamu.push(Object.assign({ id: nid(), tuan: u.nama, rumah: u.rumah, waktu: kini() }, d)); save(); },
    async tambahWarga(d) {
      const kk = (d.status === "Pemilik" || d.status === "Penyewa") && !D.warga.some(w => w.kk && w.rumah === d.rumah);
      D.warga.push(Object.assign({ kk }, d)); D.warga.sort((a, b) => a.rumah.localeCompare(b.rumah) || (b.kk - a.kk)); save();
    },
    async aturAkun() {}
  };
};
