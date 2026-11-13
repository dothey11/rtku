// RTku: tampilan dan aksi. Data diambil dari "store" (demo atau Supabase) dengan bentuk yang sama.
"use strict";
(function () {
  const cfg = window.RTKU_CONFIG || {};
  const diisi = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
  const live = diisi && !!window.supabase;
  const store = live ? window.SupaStore(cfg) : window.DemoStore();

  let S = null, masuk = false, galat = "", infoTab = "pengumuman", filterWarga = "Semua", fotoFile = null, authTab = "masuk", pesan = "";   // pesan = kabar baik di halaman masuk (misalnya permintaan reset terkirim)
  // Daftar izin yang dikenal aplikasi. Peran mana punya izin apa disimpan di database (tabel peran_izin).
  const IZIN = [
    ["rumah", "Penghuni rumah: bayar iuran, ajukan surat, lapor tamu, tombol SOS"],
    ["kas.kelola", "Kelola iuran dan kas: catat pemasukan dan pengeluaran, tagihan, bayar tunai"],
    ["surat.lihat", "Lihat semua permohonan surat"],
    ["surat.putuskan", "Setujui atau tolak surat"],
    ["info.kelola", "Buat pengumuman dan polling"],
    ["lapor.kelola", "Ubah status laporan warga"],
    ["warga.lihat", "Lihat data semua warga"],
    ["warga.kelola", "Tambah, ubah, dan hapus data warga"],
    ["tamu.lihat", "Lihat buku tamu semua rumah"],
    ["sos.tangani", "Terima dan tangani sinyal darurat"],
    ["akun.kelola", "Setujui akun, atur peran dan izin"]
  ];
  // Pilihan hubungan untuk anggota rumah, dan status hunian yang disimpan untuk masing-masing.
  const HUBUNGAN = [["Istri", "Keluarga"], ["Suami", "Keluarga"], ["Anak", "Keluarga"], ["Orang tua", "Keluarga"], ["Saudara", "Keluarga"], ["Keluarga lainnya", "Keluarga"], ["ART", "ART"], ["Anak kos", "Kos"]];
  const JENIS_SURAT = ["Surat Pengantar KTP", "Surat Keterangan Domisili", "Surat Keterangan Tidak Mampu", "Surat Pengantar Kartu Keluarga", "Surat Pengantar SKCK"];
  const ICON = {
    beranda: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    iuran: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/>',
    surat: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>',
    darurat: '<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17v.5"/>',
    info: '<path d="M4 10v4h3l6 4V6l-6 4z"/><path d="M17 9a4 4 0 0 1 0 6"/>',
    pengaturan: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
    warga: '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14a5 5 0 0 1 5 5"/>'
  };
  const icon = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;
  const $ = id => document.getElementById(id);

  // ---------- alat bantu ----------
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const rp = n => "Rp" + Math.round(n).toLocaleString("id-ID");
  const tgl = s => new Date(s.length <= 10 ? s + "T00:00" : s).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  const jam = s => new Date(s).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const namaBulan = ym => new Date(ym + "-01T00:00").toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  const hariIni = () => { const d = new Date(), p = n => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
  const baru = (a, k) => a.slice().sort((x, y) => String(y[k]).localeCompare(String(x[k])));
  const me = () => S.me;
  // Wewenang dibaca dari database: S.izin = daftar izin milik peran akun ini.
  const bisa = k => S.izin.includes(k);
  const namaPeran = k => { const p = S.peranList.find(x => x.kode === k); return p ? p.nama : k; };
  const bisaKas = () => bisa("kas.kelola");
  const lihatSurat = () => bisa("surat.lihat") || bisa("surat.putuskan");
  const lihatWarga = () => bisa("warga.lihat") || bisa("warga.kelola");
  const petugas = () => bisa("sos.tangani");
  const tanpaRumah = () => !bisa("rumah");   // misalnya satpam: tanpa iuran, surat, dan tombol SOS
  const total = () => S.iuran.reduce((a, i) => a + i.jumlah, 0);
  const saldo = () => S.kas.reduce((a, k) => a + (k.jenis === "masuk" ? k.jml : -k.jml), 0);
  const kkList = () => S.warga.filter(w => w.kk);
  const tagihanku = () => S.tagihan.filter(t => t.rumah === me().rumah);
  const pill = (t, c) => `<span class="pill ${c}">${esc(t)}</span>`;
  const statusPill = s => pill(s, { Lunas: "ok", Disetujui: "ok", Selesai: "ok", Aktif: "bad", "Belum bayar": "warn", Menunggu: "warn", Diproses: "warn", Ditangani: "warn", Baru: "bad", Ditolak: "bad" }[s] || "mute");

  function menu() {
    const m = [["beranda", "Beranda"]];
    if (bisa("rumah") || bisaKas()) m.push(["iuran", "Iuran & Kas"]);
    if (bisa("rumah") || lihatSurat()) m.push(["surat", "Surat"]);
    m.push(["darurat", "Darurat"], ["info", "Informasi"], ["warga", lihatWarga() ? "Warga & Tamu" : tanpaRumah() ? "Buku Tamu" : "Keluarga & Tamu"]);
    if (bisa("akun.kelola")) m.push(["pengaturan", "Pengaturan"]);
    return m;
  }
  function currentView() { const h = (location.hash || "").slice(1); return menu().some(m => m[0] === h) ? h : "beranda"; }
  function badge(v) {
    if (v === "darurat") return S.sos.filter(x => x.status !== "Selesai").length;
    if (v === "surat" && bisa("surat.putuskan")) return S.surat.filter(x => x.status === "Menunggu").length;
    if (v === "iuran" && !tanpaRumah()) return tagihanku().filter(t => !t.lunas).length;
    if (v === "pengaturan") return S.akun.filter(a => !a.aktif).length + S.reset.length;
    return 0;
  }

  // ---------- kerangka ----------
  function render() {
    const siap = masuk && S && !S.pending;
    $("shell").classList.toggle("polos", !siap);
    $("banner").innerHTML = live
      ? ""
      : `<div class="demo">Mode demo. Semua nama dan angka adalah data contoh dan tersimpan hanya di browser ini. ${diisi ? "Pustaka Supabase gagal dimuat, periksa koneksi internet." : "Isi js/config.js untuk menyambung ke database."}</div>`;
    if (!siap) {
      $("whoName").textContent = "RTku"; $("whoSub").textContent = "Aplikasi warga RT 04 / RW 07";
      $("roles").innerHTML = masuk ? `<button class="btn sm" data-act="keluar">Keluar</button>` : "";
      $("alarm").innerHTML = ""; $("nav").innerHTML = ""; $("bottom").innerHTML = "";
      $("view").innerHTML = masuk ? vMenunggu() : vAuth();
      return;
    }
    renderKerangka();
    $("view").innerHTML = ({ beranda: vBeranda, iuran: vIuran, surat: vSurat, darurat: vDarurat, info: vInfo, warga: vWarga, pengaturan: vPengaturan })[currentView()]();
  }
  function renderKerangka() {
    const v = currentView(), u = me();
    $("whoName").textContent = u.nama;
    $("whoSub").textContent = namaPeran(u.peran) + " · " + u.rumah;
    $("roles").innerHTML = live
      ? `<button class="btn sm" data-act="keluar">Keluar</button>`
      : `<div class="roles" role="group" aria-label="Lihat aplikasi sebagai">${S.peranList.map(r => `<button data-act="role" data-v="${esc(r.kode)}" aria-pressed="${u.peran === r.kode}">${esc(r.nama)}</button>`).join("")}</div>`;
    $("foot").innerHTML = `<span class="small muted">${live ? "Tersambung ke database" : "Perumahan Griya Melati (contoh)"}</span>${live ? "" : `<button class="btn sm" data-act="reset">Kembalikan data contoh</button>`}`;
    $("nav").innerHTML = menu().map(([k, l]) => { const b = badge(k); return `<a href="#${k}" ${k === v ? 'aria-current="page"' : ""}>${icon(k)}<span>${l}</span>${b ? `<span class="dot">${b}</span>` : ""}</a>`; }).join("");
    $("bottom").innerHTML = menu().map(([k, l]) => `<a href="#${k}" ${k === v ? 'aria-current="page"' : ""}>${icon(k)}<span>${l.split(" ")[0]}</span></a>`).join("");
    let h = "";
    S.sos.filter(x => x.status !== "Selesai").forEach(a => {
      if (!petugas()) {
        if (a.rumah === u.rumah) h += `<div class="alarm"><span>Sinyal darurat dari rumah Anda terkirim ke satpam dan pengurus RT. Status: ${a.status === "Aktif" ? "menunggu petugas" : "petugas menuju lokasi"}.</span></div>`;
      } else {
        h += `<div class="alarm" role="alert"><span>DARURAT: ${esc(a.jenis)} di rumah ${esc(a.rumah)} (${esc(a.nama)}), ${jam(a.waktu)}</span><span>${a.status === "Aktif" ? `<button class="btn sm" data-act="sos-tangani" data-id="${a.id}">Saya tangani</button>` : `<button class="btn sm" data-act="sos-selesai" data-id="${a.id}">Tandai selesai</button>`}</span></div>`;
      }
    });
    $("alarm").innerHTML = h;
  }

  // ---------- masuk dan daftar (hanya versi database) ----------
  function vAuth() {
    const diMasuk = authTab !== "daftar";
    const tab = `<div class="tabs" role="group" aria-label="Masuk atau daftar"><button data-act="auth-tab" data-v="masuk" aria-pressed="${diMasuk}">Masuk</button><button data-act="auth-tab" data-v="daftar" aria-pressed="${!diMasuk}">Daftar akun</button></div>`;
    const err = (galat ? `<p class="err">${esc(galat)}</p>` : "") + (pesan ? `<p class="live" style="border-radius:10px;padding:10px 12px">${esc(pesan)}</p>` : "");
    let form;
    if (authTab === "masuk") form = `<form class="f" data-form="masuk"><div class="fld"><label for="a-u">Username</label><input id="a-u" name="username" required autocomplete="username" autocapitalize="none" spellcheck="false"></div>
          <div class="fld"><label for="a-p">Kata sandi</label><input id="a-p" name="password" type="password" required autocomplete="current-password"></div><button class="btn pri">Masuk</button>
          <button type="button" class="btn" data-act="auth-tab" data-v="lupa">Lupa username atau kata sandi?</button></form>`;
    else if (authTab === "lupa") form = `<h2>Lupa username atau kata sandi</h2>
          <p class="small">1. Kirim permintaan di bawah ini. 2. Pengurus RT menekan Reset dan memberi Anda <b>username</b> serta <b>kode reset</b>. 3. Buka "Saya sudah punya kode reset" dan buat kata sandi baru.</p>
          <form class="f" data-form="lupa"><div class="fld"><label for="lp-n">Nama lengkap</label><input id="lp-n" name="nama" required maxlength="60" autocomplete="name"></div>
          <div class="fld"><label for="lp-r">Nomor rumah</label><input id="lp-r" name="rumah" required maxlength="20" placeholder="Contoh: C-12"></div>
          <div class="fld"><label for="lp-u">Username (kosongkan bila lupa)</label><input id="lp-u" name="username" maxlength="20" autocomplete="username" autocapitalize="none" spellcheck="false"></div>
          <button class="btn pri">Kirim permintaan ke pengurus RT</button><button type="button" class="btn" data-act="auth-tab" data-v="kode">Saya sudah punya kode reset</button><button type="button" class="btn" data-act="auth-tab" data-v="masuk">Kembali ke Masuk</button></form>`;
    else if (authTab === "kode") form = `<h2>Buat kata sandi baru</h2><p class="small">Isi username dan kode reset yang diberikan pengurus RT. Kode berlaku 24 jam dan hanya bisa dipakai sekali.</p>
          <form class="f" data-form="kode"><div class="fld"><label for="kd-u">Username</label><input id="kd-u" name="username" required autocomplete="username" autocapitalize="none" spellcheck="false"></div>
          <div class="fld"><label for="kd-k">Kode reset (6 angka)</label><input id="kd-k" name="kode" required inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="off" placeholder="Contoh: 123456"></div>
          <div class="fld"><label for="kd-p">Kata sandi baru (minimal 6 karakter)</label><input id="kd-p" name="sandi" type="password" minlength="6" required autocomplete="new-password"></div>
          <div class="fld"><label for="kd-p2">Ulangi kata sandi baru</label><input id="kd-p2" name="sandi2" type="password" minlength="6" required autocomplete="new-password"></div>
          <button class="btn pri">Simpan kata sandi baru dan masuk</button><button type="button" class="btn" data-act="auth-tab" data-v="lupa">Belum punya kode</button><button type="button" class="btn" data-act="auth-tab" data-v="masuk">Batal</button></form>`;
    else form = `<form class="f" data-form="daftar"><div class="fld"><label for="d-u">Username (untuk masuk)</label><input id="d-u" name="username" required minlength="3" maxlength="20" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="Contoh: budi_c12">
            <span class="small muted">3 sampai 20 karakter: huruf kecil, angka, titik, atau garis bawah. Tanpa spasi.</span></div>
          <div class="fld"><label for="d-n">Nama lengkap</label><input id="d-n" name="nama" required autocomplete="name"></div>
          <div class="fld"><label for="d-r">Nomor rumah</label><input id="d-r" name="rumah" required placeholder="Contoh: C-12"></div>
          <div class="fld"><label for="d-e">Email</label><input id="d-e" name="email" type="email" required autocomplete="email"><span class="small muted">Hanya sebagai data kontak. Masuk tetap memakai username.</span></div>
          <div class="fld"><label for="d-p">Kata sandi (minimal 6 karakter)</label><input id="d-p" name="password" type="password" minlength="6" required autocomplete="new-password"></div>
          <button class="btn pri">Daftar</button><p class="small muted">Setelah mendaftar, akun perlu disetujui pengurus RT sebelum bisa dipakai.</p></form>`;
    return `<div class="card auth"><h1>Masuk ke RTku</h1><p class="muted">Aplikasi warga RT 04 / RW 07</p>${tab}${err}${form}</div>`;
  }
  function vMenunggu() {
    return `<div class="card auth"><h1>Menunggu verifikasi</h1><p>Akun <b>${esc(S.me.username || "")}</b> atas nama <b>${esc(S.me.nama)}</b> untuk rumah <b>${esc(S.me.rumah)}</b> sudah terdaftar. Ketua RT perlu memverifikasinya sebelum Anda bisa melihat data RT.</p>
      <div style="display:flex;gap:8px"><button class="btn pri" data-act="cek-lagi">Periksa lagi</button><button class="btn" data-act="keluar">Keluar</button></div></div>`;
  }

  // ---------- Beranda ----------
  function vBeranda() {
    const p = baru(S.pengumuman, "waktu")[0], tiles = [];
    if (!tanpaRumah() && !bisaKas()) {
      const t = tagihanku().filter(x => !x.lunas);
      tiles.push(`<div class="card tile"><span class="lbl">Tagihan belum dibayar</span><span class="big num">${t.length ? rp(t.reduce((a, x) => a + x.jumlah, 0)) : "Lunas"}</span><a class="btn ${t.length ? "pri" : ""}" href="#iuran">${t.length ? "Bayar sekarang" : "Lihat riwayat"}</a></div>`);
    }
    if (bisaKas()) {
      const belum = S.tagihan.filter(t => t.bulan === S.bulan && !t.lunas).length;
      tiles.push(`<div class="card tile"><span class="lbl">Belum bayar ${namaBulan(S.bulan)}</span><span class="big num">${belum} rumah</span><a class="btn" href="#iuran">Kelola iuran</a></div>`);
    }
    if (lihatSurat()) {
      tiles.push(`<div class="card tile"><span class="lbl">Surat menunggu persetujuan</span><span class="big num">${S.surat.filter(x => x.status === "Menunggu").length}</span><a class="btn" href="#surat">Periksa permohonan</a></div>`);
    }
    if (tanpaRumah()) {
      tiles.push(`<div class="card tile"><span class="lbl">Sinyal darurat aktif</span><span class="big num">${S.sos.filter(x => x.status !== "Selesai").length}</span><a class="btn" href="#darurat">Buka darurat</a></div>`);
      tiles.push(`<div class="card tile"><span class="lbl">Tamu menginap tercatat</span><span class="big num">${S.tamu.length}</span><a class="btn" href="#warga">Buka buku tamu</a></div>`);
    } else {
      tiles.push(`<div class="card tile"><span class="lbl">Saldo kas RT</span><span class="big num">${rp(saldo())}</span><a class="btn" href="#iuran">Lihat laporan kas</a></div>`);
    }
    tiles.push(`<div class="card tile"><span class="lbl">Laporan warga belum selesai</span><span class="big num">${S.lapor.filter(x => x.status !== "Selesai").length}</span><a class="btn" href="#info" data-act="tab" data-v="lapor">Lihat laporan</a></div>`);
    return `<div class="head"><div><h1>Selamat datang, ${esc(me().nama.split(" ")[0])}</h1><p class="muted">RT 04 / RW 07 · ${new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p></div>
      ${tanpaRumah() ? "" : `<a class="btn danger" href="#darurat">Tombol darurat</a>`}</div>
    <div class="grid">${tiles.join("")}</div>
    <div class="two">
      <div class="card"><div class="head"><h2>Pengumuman terbaru</h2><a class="btn sm" href="#info" data-act="tab" data-v="pengumuman">Semua</a></div>
        ${p ? `<div><h3>${esc(p.judul)}</h3><p>${esc(p.isi)}</p><p class="small muted">${jam(p.waktu)} · ${esc(p.oleh)}</p></div>` : `<p class="muted">Belum ada pengumuman.</p>`}</div>
      <div class="card"><div class="head"><h2>Polling berjalan</h2><a class="btn sm" href="#info" data-act="tab" data-v="polling">Ikut memilih</a></div>
        <div class="list">${S.polling.map(q => `<div class="row"><div class="grow"><b>${esc(q.tanya)}</b><p class="small muted">${q.opsi.reduce((a, o) => a + o.n, 0)} suara masuk</p></div></div>`).join("") || `<p class="muted">Belum ada polling.</p>`}</div></div>
    </div>`;
  }

  // ---------- Iuran & Kas ----------
  function chartKas() {
    const m = {}; S.kas.filter(k => k.ket !== "Saldo awal").forEach(k => { const b = String(k.tgl).slice(0, 7); (m[b] = m[b] || { masuk: 0, keluar: 0 })[k.jenis] += k.jml; });
    const keys = Object.keys(m).sort().slice(-4); if (!keys.length) return "";
    const max = Math.max(...keys.map(k => Math.max(m[k].masuk, m[k].keluar)), 1), W = 420, H = 170, base = 132, gw = W / keys.length;
    let g = `<line x1="0" x2="${W}" y1="${base}" y2="${base}" stroke="var(--line)"/>`;
    keys.forEach((k, i) => {
      const x = i * gw + gw / 2, hm = m[k].masuk / max * 104, hk = m[k].keluar / max * 104;
      g += `<rect x="${x - 30}" y="${base - hm}" width="26" height="${hm}" rx="4" fill="var(--accent)"/><rect x="${x + 4}" y="${base - hk}" width="26" height="${hk}" rx="4" fill="var(--warn)"/>
        <text x="${x - 17}" y="${base - hm - 5}" text-anchor="middle" font-size="10" fill="var(--muted)">${(m[k].masuk / 1000).toLocaleString("id-ID")}</text>
        <text x="${x + 17}" y="${base - hk - 5}" text-anchor="middle" font-size="10" fill="var(--muted)">${(m[k].keluar / 1000).toLocaleString("id-ID")}</text>
        <text x="${x}" y="${base + 18}" text-anchor="middle" font-size="12" fill="var(--ink)">${new Date(k + "-01T00:00").toLocaleDateString("id-ID", { month: "short" })}</text>`;
    });
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Pemasukan dan pengeluaran per bulan" style="width:100%;height:auto">${g}</svg>
      <div class="legend"><span><i style="background:var(--accent)"></i>Pemasukan</span><span><i style="background:var(--warn)"></i>Pengeluaran</span><span>dalam ribuan rupiah</span></div>`;
  }
  function laporanKas() {
    const masukT = S.kas.filter(k => k.jenis === "masuk").reduce((a, k) => a + k.jml, 0), keluarT = S.kas.filter(k => k.jenis === "keluar").reduce((a, k) => a + k.jml, 0);
    return `<div class="card"><div class="head"><h2>Laporan kas terbuka</h2><span class="small muted">Bisa dilihat semua warga</span></div>
      <div class="grid"><div class="tile"><span class="lbl">Saldo saat ini</span><div class="big num">${rp(saldo())}</div></div>
        <div class="tile"><span class="lbl">Total masuk</span><div class="big num" style="color:var(--ok)">${rp(masukT)}</div></div>
        <div class="tile"><span class="lbl">Total keluar</span><div class="big num" style="color:var(--warn)">${rp(keluarT)}</div></div></div>
      ${chartKas()}
      <div class="tw"><table><thead><tr><th>Tanggal</th><th>Keterangan</th><th class="r">Masuk</th><th class="r">Keluar</th></tr></thead><tbody>
      ${baru(S.kas, "tgl").map(k => `<tr><td>${tgl(String(k.tgl))}</td><td>${esc(k.ket)}</td><td class="r num">${k.jenis === "masuk" ? rp(k.jml) : ""}</td><td class="r num">${k.jenis === "keluar" ? rp(k.jml) : ""}</td></tr>`).join("")}
      </tbody></table></div></div>`;
  }
  function vIuran() {
    const punya = baru(tagihanku(), "bulan");
    const milik = `<div class="card"><div class="head"><h2>Tagihan rumah ${esc(me().rumah)}</h2><span class="small muted">${S.iuran.map(i => esc(i.nama) + " " + rp(i.jumlah)).join(" · ")}</span></div>
        <div class="list">${punya.map(t => `<div class="row"><div class="grow"><b>${namaBulan(t.bulan)}</b><p class="small muted num">${rp(t.jumlah)}${t.lunas ? " · dibayar via " + esc(t.metode) : " · jatuh tempo tanggal 15"}</p></div><div class="acts">${t.lunas ? statusPill("Lunas") : `${statusPill("Belum bayar")}<button class="btn pri sm" data-act="bayar" data-v="${t.bulan}">Bayar</button>`}</div></div>`).join("") || `<p class="muted">Belum ada tagihan untuk rumah ini.</p>`}</div></div>`;
    let atas;
    if (bisaKas()) {
      const bills = S.tagihan.filter(t => t.bulan === S.bulan).sort((a, b) => a.rumah.localeCompare(b.rumah)), lunas = bills.filter(t => t.lunas).length;
      const nama = r => { const w = kkList().find(x => x.rumah === r); return w ? w.nama : ""; };
      const kiri = bills.length
        ? `<div class="head"><h2>Status iuran ${namaBulan(S.bulan)}</h2><span class="num">${lunas} dari ${bills.length} rumah lunas</span></div>
           <div class="bar"><i style="width:${lunas / bills.length * 100}%"></i></div>
           <div class="list">${bills.map(t => `<div class="row"><div class="grow"><b>${esc(t.rumah)}</b> ${esc(nama(t.rumah))}</div><div class="acts">${t.lunas ? statusPill("Lunas") : `${statusPill("Belum bayar")}<button class="btn sm" data-act="ingatkan" data-v="${esc(t.rumah)}">Ingatkan</button><button class="btn sm" data-act="tunai" data-v="${esc(t.rumah)}">Catat tunai</button>`}</div></div>`).join("")}</div>`
        : `<h2>Status iuran ${namaBulan(S.bulan)}</h2><p>Tagihan bulan ini belum dibuat.</p><button class="btn pri" data-act="buat-tagihan">Buat tagihan ${namaBulan(S.bulan)} untuk ${kkList().length} rumah</button>`;
      atas = `<div class="two"><div class="card">${kiri}</div>
        <div class="card"><h2>Catat kas</h2><form class="f" data-form="kas">
          <div class="fld"><label for="k-jenis">Jenis</label><select id="k-jenis" name="jenis"><option value="keluar">Pengeluaran</option><option value="masuk">Pemasukan lain (sumbangan, sewa, dan sebagainya)</option></select></div>
          <div class="fld"><label for="k-ket">Keterangan</label><input id="k-ket" name="ket" required placeholder="Contoh: beli lampu jalan"></div>
          <div class="frow"><div class="fld"><label for="k-jml">Jumlah (Rp)</label><input id="k-jml" name="jml" type="number" min="1000" step="500" required></div>
          <div class="fld"><label for="k-tgl">Tanggal</label><input id="k-tgl" name="tgl" type="date" value="${hariIni()}" required></div></div>
          <button class="btn pri">Simpan ke laporan kas</button></form>
          <p class="small muted">Setiap catatan langsung tampil di laporan kas yang dilihat warga. Iuran bulanan tercatat otomatis saat dibayar atau lewat Catat tunai.</p></div></div>`;
      if (punya.length) atas += milik;
    } else {
      atas = milik;
    }
    return `<div class="head"><div><h1>Iuran & Kas RT</h1><p class="muted">${bisaKas() ? "Pantau pembayaran, catat pemasukan dan pengeluaran." : "Bayar iuran bulanan dan lihat penggunaan kas."}</p></div></div>${atas}${laporanKas()}`;
  }

  // ---------- Surat ----------
  function vSurat() {
    const semua = lihatSurat(), putus = bisa("surat.putuskan"), punyaRumah = bisa("rumah");
    const list = baru(semua ? S.surat : S.surat.filter(x => x.rumah === me().rumah), "waktu");
    const rows = list.map(s => `<div class="row"><div class="grow"><b>${esc(s.jenis)}</b><p class="small">${esc(s.keperluan)}</p><p class="small muted">${s.untuk && s.untuk !== s.pemohon ? "Untuk " + esc(s.untuk) + " · diajukan " : ""}${esc(s.pemohon)} · ${esc(s.rumah)} · ${jam(s.waktu)}${s.nomor ? " · No. " + esc(s.nomor) : ""}${s.catatan ? " · Alasan: " + esc(s.catatan) : ""}</p></div>
      <div class="acts">${statusPill(s.status)}${s.status === "Disetujui" ? `<button class="btn sm" data-act="surat-lihat" data-id="${s.id}">Lihat surat</button>` : ""}${putus && s.status === "Menunggu" ? `<button class="btn pri sm" data-act="surat-setuju" data-id="${s.id}">Setujui</button><button class="btn sm" data-act="surat-tolak" data-id="${s.id}">Tolak</button>` : ""}</div></div>`).join("");
    const form = punyaRumah ? `<div class="card"><h2>Ajukan surat</h2><form class="f" data-form="surat">
      <div class="fld"><label for="s-jenis">Jenis surat</label><select id="s-jenis" name="jenis">${JENIS_SURAT.map(j => `<option>${j}</option>`).join("")}</select></div>
      <div class="fld"><label for="s-untuk">Surat untuk</label><select id="s-untuk" name="untuk"><option value="">${esc(me().nama)} (saya)</option>${S.warga.filter(w => w.rumah === me().rumah && w.nama !== me().nama).map(w => `<option>${esc(w.nama)}</option>`).join("")}</select></div>
      <div class="fld"><label for="s-kep">Keperluan</label><textarea id="s-kep" name="keperluan" required placeholder="Contoh: syarat pendaftaran sekolah"></textarea></div>
      <button class="btn pri">Kirim permohonan</button></form><p class="small muted">Pengurus RT menerima permohonan ini dan menyetujuinya dari aplikasi. Tidak perlu datang ke rumahnya.</p></div>` : "";
    return `<div class="head"><div><h1>Surat-menyurat</h1><p class="muted">${putus ? "Periksa dan putuskan permohonan warga." : semua ? "Pantau semua permohonan surat warga." : "Ajukan surat pengantar tanpa keluar rumah."}</p></div></div>
    <div class="${form ? "two" : ""}"><div class="card"><h2>${semua ? "Semua permohonan" : "Permohonan saya"}</h2><div class="list">${rows || `<p class="muted">Belum ada permohonan.</p>`}</div></div>${form}</div>`;
  }
  function qrSvg(text) { try { if (typeof qrcode !== "function") return ""; const q = qrcode(0, "M"); q.addData(text); q.make(); return `<div class="qr">${q.createSvgTag({ cellSize: 3, margin: 2 })}</div>`; } catch (e) { return ""; } }
  function suratHtml(s) {
    const ketua = S.akun.find(a => a.peran === "ketua") || (me().peran === "ketua" ? me() : null);
    return `<div class="surat"><div class="kop"><b>RUKUN TETANGGA 04 / RUKUN WARGA 07</b></div>
      <div style="text-align:center"><b style="text-decoration:underline">${esc(s.jenis).toUpperCase()}</b><br>Nomor: ${esc(s.nomor)}</div>
      <p>Yang bertanda tangan di bawah ini, Ketua RT 04 / RW 07, menerangkan bahwa:</p>
      <p>Nama: <b>${esc(s.untuk || s.pemohon)}</b><br>Alamat: Rumah ${esc(s.rumah)}, RT 04 / RW 07</p>
      <p>adalah benar warga kami. Surat ini diberikan untuk keperluan: ${esc(s.keperluan)}.</p>
      <div class="ttd">${qrSvg("RTKU|" + s.nomor + "|" + s.kode)}<div style="text-align:right">${tgl(s.setuju || s.waktu)}<br>Ketua RT 04<br><i>Disetujui secara digital</i>${ketua ? `<br><b>${esc(ketua.nama)}</b>` : ""}<br>Kode verifikasi: ${esc(s.kode)}</div></div></div>`;
  }

  // ---------- Darurat ----------
  function vDarurat() {
    const riwayat = baru(S.sos, "waktu").map(a => `<div class="row"><div class="grow"><b>${esc(a.jenis)}</b> · ${esc(a.rumah)}<p class="small muted">${esc(a.nama)} · ${jam(a.waktu)}${a.petugas ? " · Petugas: " + esc(a.petugas) : ""}</p></div><div class="acts">${statusPill(a.status)}${petugas() && a.status === "Aktif" ? `<button class="btn sm" data-act="sos-tangani" data-id="${a.id}">Saya tangani</button>` : ""}${petugas() && a.status === "Ditangani" ? `<button class="btn sm" data-act="sos-selesai" data-id="${a.id}">Selesai</button>` : ""}</div></div>`).join("");
    const kiri = !tanpaRumah()
      ? `<div class="card" style="align-items:center;text-align:center"><h2>Butuh bantuan segera?</h2><button class="sos" data-act="sos" aria-label="Kirim sinyal darurat">SOS</button>
          <p>Tekan tombol, pilih jenis keadaan, lalu kirim. Satpam dan pengurus RT menerima peringatan beserta alamat rumah <b>${esc(me().rumah)}</b>.${petugas() ? " Sinyal dari warga lain muncul sebagai bilah merah di atas." : ""}</p>
          <p class="small muted">Nomor penting: Polisi 110 · Pemadam 113 · Ambulans 118 / 119</p></div>`
      : `<div class="card"><h2>Pos pemantauan</h2><p>${S.sos.some(a => a.status !== "Selesai") ? "Ada sinyal darurat yang belum selesai. Lihat bilah merah di atas atau daftar di samping." : "Tidak ada sinyal darurat aktif saat ini."}</p><p class="small muted">Sinyal dari warga muncul sebagai bilah merah di semua halaman petugas, lengkap dengan alamat rumah. Biarkan aplikasi ini terbuka di HP pos jaga.</p></div>`;
    return `<div class="head"><div><h1>Keamanan & Darurat</h1><p class="muted">Kebakaran, kemalingan, atau darurat medis.</p></div></div>
    <div class="two">${kiri}<div class="card"><h2>Riwayat sinyal darurat</h2><div class="list">${riwayat || `<p class="muted">Belum ada riwayat.</p>`}</div></div></div>`;
  }

  // ---------- Informasi ----------
  function vInfo() {
    const t = infoTab, tabs = [["pengumuman", "Pengumuman"], ["polling", "Polling"], ["lapor", "Lapor RT"]];
    let body;
    if (t === "pengumuman") {
      body = `<div class="${bisa("info.kelola") ? "two" : ""}"><div class="card"><div class="list">${baru(S.pengumuman, "waktu").map(p => `<div class="row"><div class="grow"><h3>${esc(p.judul)}</h3><p>${esc(p.isi)}</p><p class="small muted">${jam(p.waktu)} · ${esc(p.oleh)}</p></div></div>`).join("") || `<p class="muted">Belum ada pengumuman.</p>`}</div></div>
        ${bisa("info.kelola") ? `<div class="card"><h2>Buat pengumuman</h2><form class="f" data-form="umum"><div class="fld"><label for="u-j">Judul</label><input id="u-j" name="judul" required></div><div class="fld"><label for="u-i">Isi</label><textarea id="u-i" name="isi" required></textarea></div><button class="btn pri">Terbitkan</button></form></div>` : ""}</div>`;
    } else if (t === "polling") {
      body = `<div class="${bisa("info.kelola") ? "two" : ""}"><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">${S.polling.map(q => {
        const tot = q.opsi.reduce((a, o) => a + o.n, 0), mine = q.pilihku;
        return `<div class="card"><h2>${esc(q.tanya)}</h2>${q.opsi.map(o => `<div><div class="head"><span>${esc(o.t)} ${mine === o.id ? pill("Pilihan Anda", "ok") : ""}</span><span class="num small muted">${o.n} suara · ${tot ? Math.round(o.n / tot * 100) : 0}%</span></div><div class="bar"><i style="width:${tot ? o.n / tot * 100 : 0}%"></i></div>${mine == null ? `<button class="btn sm" style="margin-top:6px" data-act="vote" data-id="${q.id}" data-v="${o.id}">Pilih ${esc(o.t)}</button>` : ""}</div>`).join("")}
          <p class="small muted">${mine == null ? "Satu suara per akun." : "Suara Anda sudah tercatat."} Total ${tot} suara.</p></div>`;
      }).join("") || `<div class="card"><p class="muted">Belum ada polling.</p></div>`}</div>
        ${bisa("info.kelola") ? `<div class="card"><h2>Buat polling</h2><form class="f" data-form="poll"><div class="fld"><label for="p-t">Pertanyaan</label><input id="p-t" name="tanya" required></div><div class="fld"><label for="p-o">Pilihan, satu per baris</label><textarea id="p-o" name="opsi" required placeholder="Pilihan A&#10;Pilihan B"></textarea></div><button class="btn pri">Mulai polling</button></form></div>` : ""}</div>`;
    } else {
      const next = { Baru: "Diproses", Diproses: "Selesai" };
      body = `<div class="two"><div class="card"><h2>Laporan warga</h2><div class="list">${baru(S.lapor, "waktu").map(l => `<div class="row"><div class="grow"><b>${esc(l.judul)}</b> ${pill(l.kategori, "mute")}<p>${esc(l.ket)}</p>${l.foto ? `<img class="foto" src="${esc(l.foto)}" alt="Foto laporan ${esc(l.judul)}">` : ""}<p class="small muted">${esc(l.pelapor)} · ${esc(l.rumah)} · ${jam(l.waktu)}</p></div><div class="acts">${statusPill(l.status)}${bisa("lapor.kelola") && next[l.status] ? `<button class="btn sm" data-act="lapor-next" data-id="${l.id}">Tandai ${next[l.status].toLowerCase()}</button>` : ""}</div></div>`).join("") || `<p class="muted">Belum ada laporan.</p>`}</div></div>
        <div class="card"><h2>Buat laporan</h2><form class="f" data-form="lapor"><div class="fld"><label for="l-j">Judul</label><input id="l-j" name="judul" required placeholder="Contoh: lampu jalan mati"></div>
          <div class="fld"><label for="l-k">Kategori</label><select id="l-k" name="kategori"><option>Penerangan</option><option>Kebersihan</option><option>Jalan</option><option>Keamanan</option><option>Lainnya</option></select></div>
          <div class="fld"><label for="l-d">Keterangan dan lokasi</label><textarea id="l-d" name="ket" required></textarea></div>
          <div class="fld"><label for="l-f">Foto (opsional)</label><input id="l-f" type="file" accept="image/*"></div><div id="fotoPrev"></div>
          <button class="btn pri">Kirim laporan</button></form></div></div>`;
    }
    return `<div class="head"><div><h1>Informasi & Interaksi</h1><p class="muted">Pengumuman resmi terpisah dari obrolan santai.</p></div></div>
    <div class="tabs" role="group" aria-label="Bagian informasi">${tabs.map(([k, l]) => `<button data-act="tab" data-v="${k}" aria-pressed="${t === k}">${l}</button>`).join("")}</div>${body}`;
  }

  // ---------- Warga & Tamu ----------
  // Satu baris data warga = satu orang. Kepala keluarga didaftarkan pengurus (izin warga.kelola)
  // beserta jumlah jiwa awal; anggota ditambahkan pengurus atau penghuni rumah itu sendiri.
  const terdata = r => S.warga.filter(w => w.rumah === r).length;
  const kkRumah = r => S.warga.find(w => w.rumah === r && w.kk);
  const umur = t => { if (!t) return null; const d = new Date(String(t).slice(0, 10) + "T00:00"), n = new Date(); let u = n.getFullYear() - d.getFullYear(); if (n.getMonth() < d.getMonth() || (n.getMonth() === d.getMonth() && n.getDate() < d.getDate())) u--; return u; };
  const ketOrang = w => [w.hubungan || w.status, w.kelamin === "L" ? "Laki-laki" : w.kelamin === "P" ? "Perempuan" : "", umur(w.tgl_lahir) != null ? umur(w.tgl_lahir) + " tahun" : "", w.hp].filter(Boolean).map(esc).join(" · ");
  const bolehUbah = w => bisa("warga.kelola") || (bisa("rumah") && !w.kk && w.rumah === me().rumah);
  const tombolOrang = w => bolehUbah(w) ? `<button class="btn sm" data-act="warga-ubah" data-id="${w.id}">Ubah</button><button class="btn sm" data-act="warga-hapus" data-id="${w.id}">Hapus</button>` : "";
  const pilihKelamin = (px, v) => `<div class="fld"><label for="${px}-k">Jenis kelamin</label><select id="${px}-k" name="kelamin"><option value="">Belum diisi</option><option value="L" ${v === "L" ? "selected" : ""}>Laki-laki</option><option value="P" ${v === "P" ? "selected" : ""}>Perempuan</option></select></div>`;
  const isiLahir = (px, v) => `<div class="fld"><label for="${px}-t">Tanggal lahir (opsional)</label><input id="${px}-t" name="tgl_lahir" type="date" value="${esc(v ? String(v).slice(0, 10) : "")}"></div>`;

  // Isian kepala keluarga: hanya untuk pengurus.
  function fieldKK(px, w) {
    return `<div class="frow"><div class="fld"><label for="${px}-r">Nomor rumah</label><input id="${px}-r" name="rumah" required placeholder="Contoh: B-06" value="${esc(w.rumah || "")}"></div><div class="fld"><label for="${px}-s">Status hunian</label><select id="${px}-s" name="status">${["Pemilik", "Penyewa"].map(s => `<option ${w.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></div></div>
      <div class="fld"><label for="${px}-n">Nama kepala keluarga</label><input id="${px}-n" name="nama" required value="${esc(w.nama || "")}"></div>
      <div class="frow">${pilihKelamin(px, w.kelamin)}${isiLahir(px, w.tgl_lahir)}</div>
      <div class="frow"><div class="fld"><label for="${px}-h">No. HP</label><input id="${px}-h" name="hp" value="${esc(w.hp || "")}"></div><div class="fld"><label for="${px}-j">Jumlah jiwa di rumah ini</label><input id="${px}-j" name="jiwa" type="number" min="1" value="${w.jiwa || 1}" required></div></div>
      <p class="small muted">Jumlah jiwa menghitung semua penghuni rumah: kepala keluarga, anggota keluarga, ART, dan anak kos. Angka ini naik sendiri bila orang yang terdata melebihinya.</p>`;
  }
  // Isian anggota rumah: untuk pengurus dan penghuni rumah itu. Nomor rumah terkunci.
  function fieldAnggota(px, w, rumah) {
    return `<div class="frow"><div class="fld"><label for="${px}-r">Nomor rumah (terkunci)</label><input id="${px}-r" value="${esc(rumah)}" disabled></div><div class="fld"><label for="${px}-hb">Hubungan / status</label><select id="${px}-hb" name="hubungan">${HUBUNGAN.map(([h]) => `<option ${w.hubungan === h ? "selected" : ""}>${h}</option>`).join("")}</select></div></div>
      <div class="fld"><label for="${px}-n">Nama lengkap</label><input id="${px}-n" name="nama" required value="${esc(w.nama || "")}"></div>
      <div class="frow">${pilihKelamin(px, w.kelamin)}${isiLahir(px, w.tgl_lahir)}</div>
      <div class="fld"><label for="${px}-h">No. HP (opsional)</label><input id="${px}-h" name="hp" value="${esc(w.hp || "")}"></div>`;
  }
  function vWarga() {
    const semuaTamu = bisa("tamu.lihat"), kelola = bisa("warga.kelola"), punyaRumah = bisa("rumah"), rumahku = me().rumah;
    const tamuList = baru(semuaTamu ? S.tamu : S.tamu.filter(t => t.rumah === rumahku), "waktu");
    const tamu = `<div class="card"><h2>${semuaTamu ? "Buku tamu 1x24 jam" : "Tamu menginap di rumah saya"}</h2><div class="list">${tamuList.map(t => `<div class="row"><div class="grow"><b>${esc(t.nama)}</b> <span class="muted">dari ${esc(t.asal)}</span><p class="small muted">${esc(t.hubungan)} · menginap di ${esc(t.rumah)} (${esc(t.tuan)}) · datang ${tgl(String(t.datang))}</p></div><div class="acts">${pill(t.malam + " malam", "mute")}</div></div>`).join("") || `<p class="muted">Belum ada tamu yang dilaporkan.</p>`}</div></div>`;
    const formTamu = punyaRumah ? `<div class="card"><h2>Lapor tamu menginap</h2><form class="f" data-form="tamu">
      <div class="fld"><label for="t-n">Nama tamu</label><input id="t-n" name="nama" required></div>
      <div class="frow"><div class="fld"><label for="t-h">Hubungan</label><input id="t-h" name="hubungan" required placeholder="Contoh: saudara"></div><div class="fld"><label for="t-a">Kota asal</label><input id="t-a" name="asal" required></div></div>
      <div class="frow"><div class="fld"><label for="t-d">Tanggal datang</label><input id="t-d" name="datang" type="date" value="${hariIni()}" required></div><div class="fld"><label for="t-m">Lama menginap (malam)</label><input id="t-m" name="malam" type="number" min="1" max="60" value="1" required></div></div>
      <button class="btn pri">Laporkan tamu</button></form></div>` : "";
    // Kartu "rumah saya": daftar penghuni + form tambah anggota (nomor rumah terkunci).
    const kk = kkRumah(rumahku), kel = S.warga.filter(w => w.rumah === rumahku);
    const rumahSaya = !punyaRumah ? "" : `<div class="card"><div class="head"><h2>Penghuni rumah ${esc(rumahku)}</h2>${kk ? `<span class="small muted num">Terdata ${kel.length} dari ${kk.jiwa} jiwa</span>` : ""}</div>
        ${kk && kel.length < kk.jiwa ? `<p class="small" style="color:var(--warn)">Masih ${kk.jiwa - kel.length} orang belum didata. Lengkapi lewat form Tambah anggota.</p>` : ""}
        <div class="list">${kel.map(w => `<div class="row"><div class="grow"><b>${esc(w.nama)}</b>${w.kk ? " " + pill(w.status, "ok") : ""}<p class="small muted">${ketOrang(w)}</p></div><div class="acts">${tombolOrang(w)}</div></div>`).join("") || `<p class="muted">Belum ada data.</p>`}</div>
        <p class="small muted">Data kepala keluarga dan nomor rumah hanya bisa diubah pengurus RT.</p></div>`;
    const formAnggota = !punyaRumah ? "" : kk
      ? `<div class="card"><h2>Tambah anggota rumah</h2><form class="f" data-form="anggota" data-v="${esc(rumahku)}">${fieldAnggota("g", {}, rumahku)}<button class="btn pri">Tambah anggota</button></form>
          <p class="small muted">Isi satu orang per kali simpan: istri atau suami, anak, orang tua, ART, anak kos.</p></div>`
      : `<div class="card"><h2>Tambah anggota rumah</h2><p class="muted">Rumah ${esc(rumahku)} belum didaftarkan pengurus RT. Setelah kepala keluarga didaftarkan, Anda bisa menambah anggota di sini.</p></div>`;
    if (!lihatWarga()) {
      if (!punyaRumah) return `<div class="head"><div><h1>Buku Tamu</h1><p class="muted">Tamu menginap yang dilaporkan warga.</p></div></div>${tamu}`;
      return `<div class="head"><div><h1>Keluarga & Tamu</h1><p class="muted">Data rumah ${esc(rumahku)} hanya terlihat oleh penghuni rumah ini dan pengurus RT.</p></div></div>
      <div class="two"><div style="display:flex;flex-direction:column;gap:20px">${rumahSaya}${tamu}</div><div style="display:flex;flex-direction:column;gap:20px">${formAnggota}${formTamu}</div></div>`;
    }
    const kks = kkList(), jiwa = kks.reduce((a, w) => a + Math.max(w.jiwa, terdata(w.rumah)), 0);
    const st = ["Pemilik", "Penyewa", "Keluarga", "Kos", "ART"];
    const urut = S.warga.slice().sort((a, b) => a.rumah.localeCompare(b.rumah) || (b.kk - a.kk) || a.nama.localeCompare(b.nama));
    const rows = urut.filter(w => filterWarga === "Semua" || w.status === filterWarga);
    return `<div class="head"><div><h1>Warga & Tamu</h1><p class="muted">Data penghuni RT 04 per orang dan buku tamu digital.</p></div></div>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))"><div class="card tile"><span class="lbl">Rumah terdaftar</span><span class="big num">${kks.length}</span></div><div class="card tile"><span class="lbl">Total jiwa</span><span class="big num">${jiwa}</span></div>
      <div class="card tile"><span class="lbl">Sudah terdata</span><span class="big num">${S.warga.length}</span></div>
      <div class="card tile"><span class="lbl">Laki-laki / Perempuan</span><span class="big num">${S.warga.filter(w => w.kelamin === "L").length} / ${S.warga.filter(w => w.kelamin === "P").length}</span></div>
      <div class="card tile"><span class="lbl">Pemilik / Penyewa</span><span class="big num">${S.warga.filter(w => w.status === "Pemilik").length} / ${S.warga.filter(w => w.status === "Penyewa").length}</span></div>
      <div class="card tile"><span class="lbl">ART / Anak kos</span><span class="big num">${S.warga.filter(w => w.status === "ART").length} / ${S.warga.filter(w => w.status === "Kos").length}</span></div></div>
    <div class="card"><div class="head"><h2>Daftar warga</h2><div class="tabs" role="group" aria-label="Saring status">${["Semua", ...st].map(s => `<button data-act="filter" data-v="${s}" aria-pressed="${filterWarga === s}">${s}</button>`).join("")}</div></div>
      <div class="tw"><table><thead><tr><th>Rumah</th><th>Nama</th><th>Hubungan</th><th>L/P</th><th class="r">Umur</th><th>No. HP</th><th>Jiwa</th>${kelola ? "<th>Kelola</th>" : ""}</tr></thead><tbody>${rows.map(w => `<tr><td><b>${esc(w.rumah)}</b></td><td>${esc(w.nama)}</td><td>${w.kk ? pill("Kepala keluarga · " + w.status, "ok") : pill(w.hubungan || w.status, "mute")}</td><td>${esc(w.kelamin || "")}</td><td class="r num">${umur(w.tgl_lahir) != null ? umur(w.tgl_lahir) : ""}</td><td class="num">${esc(w.hp)}</td><td class="num">${w.kk ? `terdata ${terdata(w.rumah)} dari ${Math.max(w.jiwa, terdata(w.rumah))}` : ""}</td>${kelola ? `<td>${w.kk ? `<button class="btn sm" data-act="anggota-baru" data-v="${esc(w.rumah)}">Tambah anggota</button> ` : ""}<button class="btn sm" data-act="warga-ubah" data-id="${w.id}">Ubah</button> <button class="btn sm" data-act="warga-hapus" data-id="${w.id}">Hapus</button></td>` : ""}</tr>`).join("") || `<tr><td colspan="8" class="muted">Tidak ada data.</td></tr>`}</tbody></table></div>
      ${kelola ? "" : `<p class="small muted">Peran Anda hanya bisa melihat data warga.</p>`}</div>
    <div class="two"><div style="display:flex;flex-direction:column;gap:20px">${kelola ? `<div class="card"><h2>Daftarkan kepala keluarga</h2><form class="f" data-form="kk">${fieldKK("w", {})}
      <button class="btn pri">Daftarkan rumah ini</button></form><p class="small muted">Cukup kepala keluarga pemilik atau penyewa. Anggota lain dilengkapi warga sendiri setelah login, atau lewat tombol Tambah anggota di tabel.</p></div>` : ""}${tamu}</div>
      <div style="display:flex;flex-direction:column;gap:20px">${rumahSaya}${formAnggota}${formTamu}</div></div>`;
  }

  // ---------- Pengaturan: akun, peran, dan izin ----------
  function vPengaturan() {
    const pilihPeran = (id, kini) => `<select aria-label="Peran" data-peran="${id}">${S.peranList.map(p => `<option value="${esc(p.kode)}" ${kini === p.kode ? "selected" : ""}>${esc(p.nama)}</option>`).join("")}</select>`;
    const daftar = S.akun.slice().sort((a, b) => (a.aktif - b.aktif) || String(b.dibuat).localeCompare(String(a.dibuat)));
    const akun = live
      ? `<div class="card"><div class="head"><h2>Akun pengguna</h2><span class="small muted">${S.akun.filter(a => !a.aktif).length} menunggu persetujuan</span></div>
          <div class="list">${daftar.map(a => `<div class="row"><div class="grow"><b>${esc(a.nama)}</b> · rumah ${esc(a.rumah)}<p class="small muted">Username: <b>${esc(a.username || "")}</b>${a.email ? " · " + esc(a.email) : ""}</p><p class="small muted">${a.aktif ? "Peran: " + esc(namaPeran(a.peran)) : "Mendaftar " + tgl(a.dibuat) + ", belum disetujui"}</p></div>
            <div class="acts">${a.aktif ? pill("Aktif", "ok") : pill("Menunggu", "warn")}${a.id === me().id ? pill("Akun Anda", "mute") : `<span class="small">Peran:</span>${pilihPeran(a.id, a.peran)}<button class="btn pri sm" data-act="akun" data-uid="${a.id}" data-v="simpan">${a.aktif ? "Simpan peran" : "Setujui dengan peran ini"}</button>${a.aktif ? `<button class="btn sm" data-act="akun" data-uid="${a.id}" data-v="nonaktif">Nonaktifkan</button>` : ""}<button class="btn sm" data-act="reset-sandi" data-uid="${a.id}">Reset kata sandi</button>`}</div></div>`).join("")}</div>
          <p class="small muted">Pilih peran di kotak pilihan, lalu klik tombolnya. Cocokkan nama dan nomor rumah dengan data warga lebih dulu: akun yang disetujui bisa melihat data rumah tersebut. Peran bisa diganti kapan saja dari sini. </p></div>`
      : `<div class="card"><h2>Akun pengguna</h2><p class="muted">Mode demo tidak memakai akun login. Setelah tersambung ke database, pendaftar baru muncul di sini untuk disetujui dan diberi peran.</p></div>`;
    const minta = !live ? "" : `<div class="card"><div class="head"><h2>Permintaan reset kata sandi</h2><span class="small muted">${S.reset.length} menunggu</span></div>
          <div class="list">${S.reset.map(r => { const cocok = S.akun.filter(a => (r.username && a.username === r.username) || (a.nama.toLowerCase() === r.nama.toLowerCase() && a.rumah === r.rumah));
            return `<div class="row"><div class="grow"><b>${esc(r.nama)}</b> · rumah ${esc(r.rumah)}<p class="small muted">${r.username ? "Username yang diketik: " + esc(r.username) : "Lupa username"} · ${jam(r.waktu)}</p><p class="small muted">${cocok.length ? "Akun yang cocok: " + cocok.map(a => esc(a.username)).join(", ") : "Tidak ada akun yang cocok persis. Cari orangnya di daftar Akun pengguna."}</p></div>
              <div class="acts">${cocok.map(a => `<button class="btn pri sm" data-act="reset-sandi" data-uid="${a.id}">Reset ${esc(a.username)}</button>`).join("")}<button class="btn sm" data-act="reset-abaikan" data-id="${r.id}">Abaikan</button></div></div>`; }).join("") || `<p class="muted">Tidak ada permintaan.</p>`}</div>
          <p class="small muted">Pastikan dulu bahwa yang meminta memang pemilik akunnya, misalnya dengan menelepon atau bertemu. Reset menghasilkan kode sekali pakai; Anda tidak menentukan kata sandinya.</p></div>`;
    const matriks = `<div class="card"><div class="head"><h2>Peran dan izin</h2><span class="small muted">Centang untuk memberi izin. Berlaku seketika.</span></div>
      <div class="tw"><table><thead><tr><th>Izin</th>${S.peranList.map(p => `<th style="text-align:center">${esc(p.nama)}${p.bawaan ? "" : `<br><button class="btn sm" data-act="peran-hapus" data-v="${esc(p.kode)}">Hapus</button>`}</th>`).join("")}</tr></thead>
      <tbody>${IZIN.map(([k, ket]) => `<tr><td style="white-space:normal;min-width:220px">${ket}</td>${S.peranList.map(p => `<td style="text-align:center"><input type="checkbox" aria-label="${esc(p.nama)}: ${ket}" data-ip="${esc(p.kode)}" data-ik="${k}" ${p.kode === "ketua" || p.izin.includes(k) ? "checked" : ""} ${p.kode === "ketua" ? "disabled" : ""}></td>`).join("")}</tr>`).join("")}</tbody></table></div>
      <p class="small muted">Ketua RT selalu memiliki semua izin, supaya pengaturan ini tidak pernah terkunci. Peran Warga dan Ketua RT tidak bisa dihapus.</p></div>`;
    const tambah = `<div class="card"><h2>Tambah peran</h2><form class="f" data-form="peran"><div class="fld"><label for="pr-n">Nama peran</label><input id="pr-n" name="nama" required maxlength="30" placeholder="Contoh: Humas, Ketua Pemuda, Koordinator Keamanan"></div><button class="btn pri">Tambah peran</button></form>
      <p class="small muted">Peran baru belum punya izin apa pun. Centang izinnya di tabel, lalu berikan peran itu ke akun di daftar Akun pengguna.</p></div>`;
    return `<div class="head"><div><h1>Pengaturan</h1><p class="muted">Setujui akun baru, tentukan perannya, dan atur izin tiap peran.</p></div></div>${minta}${akun}${matriks}<div class="two">${tambah}<div></div></div>`;
  }

  // ---------- modal, toast, pemuatan ----------
  function modal(h) { $("modal").innerHTML = h ? `<div class="scrim" data-act="tutup-luar"><div class="modal" role="dialog" aria-modal="true">${h}</div></div>` : ""; if (h) { const f = document.querySelector(".modal button, .modal input"); if (f) f.focus(); } }
  let tt; function toast(m) { $("toast").innerHTML = `<div class="toast">${esc(m)}</div>`; clearTimeout(tt); tt = setTimeout(() => { $("toast").innerHTML = ""; }, 3500); }
  const tombolTutup = `<button class="btn pri" data-act="tutup">Tutup</button>`;

  // Jalankan satu aksi ke store, muat ulang data, gambar ulang. Mengembalikan hasil aksi, atau undefined bila gagal.
  let sibuk = false;
  async function aksi(fn, pesan) {
    if (sibuk) return; sibuk = true;
    try { const r = await fn(); S = await store.load(); render(); if (pesan) toast(pesan); return r === undefined ? true : r; }
    catch (e) { toast(e.message || "Terjadi kesalahan"); }
    finally { sibuk = false; }
  }
  async function muat() {
    try { masuk = await store.init(); S = masuk ? await store.load() : null; galat = ""; }
    catch (e) { galat = "Tidak bisa terhubung ke database: " + (e.message || e); masuk = false; S = null; }
    render();
  }
  // Perubahan dari pengguna lain (realtime). Jangan timpa form yang sedang diisi.
  let tunda;
  function adaPerubahan() {
    clearTimeout(tunda);
    tunda = setTimeout(async () => {
      if (!masuk || sibuk) return;
      try { S = await store.load(); } catch (e) { return; }
      const a = document.activeElement, mengetik = a && ["INPUT", "TEXTAREA", "SELECT"].includes(a.tagName);
      if (S.pending || !(mengetik || document.querySelector(".scrim"))) render(); else renderKerangka();
    }, 400);
  }

  // ---------- aksi klik ----------
  document.addEventListener("click", async e => {
    const el = e.target.closest("[data-act]"); if (!el) return;
    const act = el.dataset.act, v = el.dataset.v, id = Number(el.dataset.id);
    if (act === "tutup-luar") { if (e.target === el) modal(""); return; }
    if (act === "tutup") { modal(""); return; }
    if (act === "auth-tab") { authTab = v; galat = ""; pesan = ""; render(); return; }
    if (act === "keluar") { await store.keluar(); masuk = false; S = null; authTab = "masuk"; galat = ""; pesan = ""; location.hash = ""; render(); return; }
    if (act === "cek-lagi") { await muat(); if (S && S.pending) toast("Belum diverifikasi"); return; }
    if (!S || S.pending) return;
    if (act === "role") { store.setRole(v); S = await store.load(); render(); return; }
    if (act === "reset") { store.reset(); filterWarga = "Semua"; S = await store.load(); render(); toast("Data contoh dikembalikan"); return; }
    if (act === "tab") { infoTab = v; render(); return; }
    if (act === "filter") { filterWarga = v; render(); return; }
    if (act === "bayar") {
      const t = tagihanku().find(x => x.bulan === v); if (!t) return;
      const m = ["GoPay", "OVO", "DANA", "QRIS", "Virtual Account BCA", "Virtual Account Mandiri"];
      modal(`<h2>Bayar iuran ${namaBulan(v)}</h2><div class="list">${S.iuran.map(i => `<div class="row"><span>${esc(i.nama)}</span><span class="num">${rp(i.jumlah)}</span></div>`).join("")}<div class="row"><b>Total</b><b class="num">${rp(t.jumlah)}</b></div></div>
        <form class="f" data-form="bayar" data-v="${v}"><b>Metode pembayaran</b>${m.map((x, i) => `<label class="opt"><input type="radio" name="metode" value="${x}" ${i ? "" : "checked"}> ${x}</label>`).join("")}
        <p class="small muted">Simulasi: belum tersambung ke payment gateway, jadi tidak ada uang yang berpindah.</p>
        <div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn" data-act="tutup">Batal</button><button class="btn pri">Bayar ${rp(t.jumlah)}</button></div></form>`); return;
    }
    if (act === "ingatkan") { toast(`Pengingat untuk rumah ${v} belum bisa dikirim: notifikasi ke HP belum dipasang`); return; }
    if (act === "tunai") { aksi(() => store.tunai(v, S.bulan), `Pembayaran tunai ${v} dicatat`); return; }
    if (act === "buat-tagihan") { aksi(() => store.buatTagihan(S.bulan), `Tagihan ${namaBulan(S.bulan)} dibuat`); return; }
    if (act === "surat-setuju") { const s = await aksi(() => store.setujuiSurat(id), "Surat disetujui dan diberi nomor"); if (s && s.nomor) modal(`<h2>Surat diterbitkan</h2>${suratHtml(s)}${tombolTutup}`); return; }
    if (act === "surat-tolak") { modal(`<h2>Tolak permohonan</h2><form class="f" data-form="tolak" data-id="${id}"><div class="fld"><label for="x-c">Alasan penolakan</label><textarea id="x-c" name="catatan" required></textarea></div><div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn" data-act="tutup">Batal</button><button class="btn danger">Tolak permohonan</button></div></form>`); return; }
    if (act === "surat-lihat") { const s = S.surat.find(x => x.id === id); if (s) modal(`<h2>${esc(s.jenis)}</h2>${suratHtml(s)}<p class="small muted">Petugas kelurahan bisa mencocokkan kode verifikasi dengan catatan RT.</p>${tombolTutup}`); return; }
    if (act === "sos") {
      modal(`<h2>Kirim sinyal darurat</h2><form class="f" data-form="sos">${["Kebakaran", "Kemalingan", "Darurat medis", "Lainnya"].map((x, i) => `<label class="opt"><input type="radio" name="jenis" value="${x}" ${i ? "" : "checked"}> ${x}</label>`).join("")}
        <p class="small">Lokasi yang dikirim: rumah <b>${esc(me().rumah)}</b> atas nama ${esc(me().nama)}.</p>
        <div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn" data-act="tutup">Batal</button><button class="btn danger">Kirim sekarang</button></div></form>`); return;
    }
    if (act === "sos-tangani") { aksi(() => store.sosStatus(id, "Ditangani", me().nama), "Anda tercatat menangani sinyal ini"); return; }
    if (act === "sos-selesai") { const a = S.sos.find(x => x.id === id); aksi(() => store.sosStatus(id, "Selesai", (a && a.petugas) || me().nama), "Sinyal darurat ditutup"); return; }
    if (act === "vote") { aksi(() => store.vote(id, Number(v)), "Suara Anda tercatat"); return; }
    if (act === "lapor-next") { const l = S.lapor.find(x => x.id === id), n = l && { Baru: "Diproses", Diproses: "Selesai" }[l.status]; if (n) aksi(() => store.laporStatus(id, n), "Status laporan diperbarui"); return; }
    if (act === "akun") {
      const uid = el.dataset.uid, sel = document.querySelector(`select[data-peran="${uid}"]`), peran = sel ? sel.value : "warga";
      aksi(() => store.aturAkun(uid, v === "nonaktif" ? { aktif: false } : { aktif: true, peran }), v === "nonaktif" ? "Akun dinonaktifkan" : `Akun aktif sebagai ${namaPeran(peran)}`); return;
    }
    if (act === "reset-sandi") {
      const a = S.akun.find(x => x.id === el.dataset.uid); if (!a) return;
      modal(`<h2>Reset kata sandi?</h2><p>Akun <b>${esc(a.username)}</b> (${esc(a.nama)}, rumah ${esc(a.rumah)}).</p><p class="small muted">Aplikasi akan membuat kode reset sekali pakai. Kata sandi lama tetap berlaku sampai pemilik akun membuat yang baru dengan kode itu.</p><div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" data-act="tutup">Batal</button><button class="btn pri" data-act="reset-sandi-ya" data-uid="${a.id}">Reset dan buat kode</button></div>`); return;
    }
    if (act === "reset-sandi-ya") {
      const a = S.akun.find(x => x.id === el.dataset.uid); if (!a) return;
      modal(""); const kode = await aksi(() => store.buatKodeReset(a.id));
      if (typeof kode === "string") modal(`<h2>Kode reset dibuat</h2><p>Sampaikan dua hal ini kepada <b>${esc(a.nama)}</b>:</p><div class="list"><div class="row"><span>Username</span><b>${esc(a.username)}</b></div><div class="row"><span>Kode reset</span><b class="num" style="font-size:24px;letter-spacing:3px">${esc(kode)}</b></div></div><p class="small muted">Berlaku 24 jam, sekali pakai. Di halaman masuk, ia memilih "Lupa username atau kata sandi?", lalu "Saya sudah punya kode reset". Kode ini tidak bisa ditampilkan lagi setelah jendela ini ditutup; bila hilang, tekan Reset sekali lagi.</p>${tombolTutup}`);
      return;
    }
    if (act === "reset-abaikan") { aksi(() => store.selesaiReset(id), "Permintaan ditutup"); return; }
    if (act === "warga-ubah") {
      const w = S.warga.find(x => x.id === id); if (!w || !bolehUbah(w)) return;
      modal(`<h2>${w.kk ? "Ubah data kepala keluarga" : "Ubah data anggota"}</h2><form class="f" data-form="warga-ubah" data-id="${id}">${w.kk ? fieldKK("e", w) : fieldAnggota("e", w, w.rumah)}<div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn" data-act="tutup">Batal</button><button class="btn pri">Simpan perubahan</button></div></form>`); return;
    }
    if (act === "anggota-baru") {
      modal(`<h2>Tambah anggota rumah ${esc(v)}</h2><form class="f" data-form="anggota" data-v="${esc(v)}">${fieldAnggota("m", {}, v)}<div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn" data-act="tutup">Batal</button><button class="btn pri">Tambah anggota</button></div></form>`); return;
    }
    if (act === "warga-hapus") {
      const w = S.warga.find(x => x.id === id); if (!w || !bolehUbah(w)) return;
      const sisa = S.warga.filter(x => x.rumah === w.rumah && !x.kk).length;
      if (w.kk && sisa) { toast(`Rumah ${w.rumah} masih punya ${sisa} anggota terdata. Hapus anggotanya dulu.`); return; }
      modal(`<h2>Hapus data ini?</h2><p><b>${esc(w.nama)}</b>, rumah ${esc(w.rumah)} (${esc(w.kk ? "Kepala keluarga" : w.hubungan || w.status)}).</p><p class="small muted">${w.kk ? "Rumah ini tidak lagi terdaftar dan tidak mendapat tagihan baru. " : ""}Riwayat tagihan, surat, dan tamu tetap tersimpan. Penghapusan tidak bisa dibatalkan.</p><div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" data-act="tutup">Batal</button><button class="btn danger" data-act="warga-hapus-ya" data-id="${id}">Hapus</button></div>`); return;
    }
    if (act === "warga-hapus-ya") { modal(""); aksi(() => store.hapusWarga(id), "Data warga dihapus"); return; }
    if (act === "peran-hapus") {
      modal(`<h2>Hapus peran ${esc(namaPeran(v))}?</h2><p class="small muted">Semua izin peran ini ikut terhapus. Peran yang masih dipakai akun tidak bisa dihapus.</p><div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" data-act="tutup">Batal</button><button class="btn danger" data-act="peran-hapus-ya" data-v="${esc(v)}">Hapus peran</button></div>`); return;
    }
    if (act === "peran-hapus-ya") { modal(""); aksi(() => store.hapusPeran(v), "Peran dihapus"); return; }
  });

  // ---------- aksi form ----------
  document.addEventListener("submit", async e => {
    const f = e.target.closest("[data-form]"); if (!f) return; e.preventDefault();
    const d = Object.fromEntries(new FormData(f).entries()), k = f.dataset.form;
    const rapi = o => { Object.keys(o).forEach(x => { if (typeof o[x] === "string") o[x] = o[x].trim(); }); return o; };
    if (k === "lupa") {
      if (sibuk) return; sibuk = true; galat = ""; pesan = "";
      try { await store.mintaReset({ username: d.username.trim().toLowerCase(), nama: d.nama.trim(), rumah: d.rumah.trim().toUpperCase() }); authTab = "kode"; pesan = "Permintaan terkirim. Hubungi pengurus RT untuk mendapat username dan kode reset, lalu isi di sini."; }
      catch (err) { galat = err.message; }
      sibuk = false; render(); return;
    }
    if (k === "kode") {
      if (sibuk) return;
      if (d.sandi !== d.sandi2) { toast("Dua isian kata sandi baru belum sama"); return; }
      sibuk = true; galat = ""; pesan = "";
      try { await store.sandiBaru(d.username.trim().toLowerCase(), d.kode.trim(), d.sandi); authTab = "masuk"; sibuk = false; await muat(); toast("Kata sandi berhasil diganti"); }
      catch (err) { sibuk = false; toast(err.message); }
      return;
    }
    if (k === "masuk" || k === "daftar") {
      if (sibuk) return; sibuk = true; galat = "";
      try {
        const username = d.username.trim().toLowerCase();
        if (k === "masuk") { await store.masuk(username, d.password); }
        else {
          if (!/^[a-z0-9_.]{3,20}$/.test(username)) { sibuk = false; galat = "Username harus 3 sampai 20 karakter: huruf kecil, angka, titik, atau garis bawah. Tanpa spasi."; render(); return; }
          const langsung = await store.daftar({ username, email: d.email.trim(), password: d.password, nama: d.nama.trim(), rumah: d.rumah.trim().toUpperCase() });
          if (!langsung) { authTab = "masuk"; sibuk = false; render(); toast("Pendaftaran diterima. Buka email konfirmasi, lalu masuk dengan username Anda."); return; }
        }
        sibuk = false; await muat();
      } catch (err) { sibuk = false; galat = /invalid login/i.test(err.message) ? "Username atau kata sandi salah." : /not confirmed/i.test(err.message) ? "Email belum dikonfirmasi. Buka tautan di email pendaftaran, atau minta pengurus mematikan konfirmasi email." : err.message; render(); }
      return;
    }
    if (!S || S.pending) return;
    if (k === "bayar") {
      const bulan = f.dataset.v, t = tagihanku().find(x => x.bulan === bulan), jumlah = t ? t.jumlah : 0;
      const ok = await aksi(() => store.bayar(bulan, d.metode));
      if (ok) modal(`<h2>Pembayaran tercatat</h2><div class="list"><div class="row"><span>Tagihan</span><b>${namaBulan(bulan)}</b></div><div class="row"><span>Metode</span><b>${esc(d.metode)}</b></div><div class="row"><span>Jumlah</span><b class="num">${rp(jumlah)}</b></div></div><p class="small muted">Ini bukti simulasi. Saldo kas RT di laporan sudah bertambah.</p><button class="btn pri" data-act="tutup">Selesai</button>`);
      else modal("");
      return;
    }
    if (k === "kas") { const jml = Math.abs(Math.round(Number(d.jml))) || 0; if (!jml) { toast("Isi jumlah lebih dari nol"); return; } aksi(() => store.catatKas({ tgl: d.tgl, ket: d.ket.trim(), jenis: d.jenis === "masuk" ? "masuk" : "keluar", jml }), d.jenis === "masuk" ? "Pemasukan masuk ke laporan kas" : "Pengeluaran masuk ke laporan kas"); return; }
    if (k === "surat") { aksi(() => store.ajukanSurat(rapi({ jenis: d.jenis, keperluan: d.keperluan, untuk: d.untuk || null })), "Permohonan terkirim ke Ketua RT"); return; }
    if (k === "tolak") { modal(""); aksi(() => store.tolakSurat(Number(f.dataset.id), d.catatan.trim()), "Permohonan ditolak"); return; }
    if (k === "sos") { modal(""); aksi(() => store.kirimSos(d.jenis), "Sinyal darurat terkirim"); return; }
    if (k === "umum") { aksi(() => store.umumkan(rapi({ judul: d.judul, isi: d.isi })), "Pengumuman diterbitkan"); return; }
    if (k === "poll") { const o = d.opsi.split("\n").map(x => x.trim()).filter(Boolean); if (o.length < 2) { toast("Isi minimal dua pilihan, satu per baris"); return; } aksi(() => store.buatPolling(d.tanya.trim(), o), "Polling dimulai"); return; }
    if (k === "lapor") { const file = fotoFile; fotoFile = null; aksi(() => store.lapor(rapi({ judul: d.judul, kategori: d.kategori, ket: d.ket, file })), "Laporan terkirim ke pengurus RT"); return; }
    if (k === "tamu") { aksi(() => store.tamu(rapi({ nama: d.nama, hubungan: d.hubungan, asal: d.asal, datang: d.datang, malam: Math.min(60, Math.max(1, Number(d.malam) || 1)) })), "Tamu tercatat di buku tamu RT"); return; }
    // Susun data orang dari isian form. Anggota: status hunian diturunkan dari pilihan hubungan.
    const orang = () => { const o = rapi({ nama: d.nama, kelamin: d.kelamin || null, tgl_lahir: d.tgl_lahir || null, hp: d.hp || "" }); if (d.hubungan) { const h = HUBUNGAN.find(x => x[0] === d.hubungan) || HUBUNGAN[5]; o.hubungan = h[0]; o.status = h[1]; } return o; };
    const dataKK = () => Object.assign(orang(), { rumah: d.rumah.trim().toUpperCase(), status: d.status === "Penyewa" ? "Penyewa" : "Pemilik", jiwa: Math.max(1, Math.round(Number(d.jiwa)) || 1) });
    if (k === "kk") { aksi(() => store.tambahKK(dataKK()), "Kepala keluarga didaftarkan"); return; }
    if (k === "anggota") { const rumah = f.dataset.v; modal(""); aksi(() => store.tambahAnggota(rumah, orang()), "Anggota ditambahkan"); return; }
    if (k === "warga-ubah") {
      const w = S.warga.find(x => x.id === Number(f.dataset.id)); if (!w) return;
      modal(""); aksi(() => store.ubahWarga(w.id, w.kk ? dataKK() : orang()), "Perubahan disimpan"); return;
    }
    if (k === "peran") {
      const nama = d.nama.trim(), kode = nama.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
      if (!/^[a-z][a-z0-9_]{1,29}$/.test(kode)) { toast("Nama peran harus diawali huruf dan minimal dua karakter"); return; }
      if (S.peranList.some(p => p.kode === kode)) { toast("Peran dengan nama itu sudah ada"); return; }
      aksi(() => store.tambahPeran({ kode, nama }), `Peran ${nama} ditambahkan. Centang izinnya di tabel.`); return;
    }
  });

  document.addEventListener("change", e => {
    const c = e.target;
    if (c.dataset && c.dataset.ik) { if (S && bisa("akun.kelola")) aksi(() => store.setIzin(c.dataset.ip, c.dataset.ik, c.checked), "Izin diperbarui"); return; }
    if (e.target.id !== "l-f") return; fotoFile = (e.target.files && e.target.files[0]) || null;
    const p = $("fotoPrev"); if (!p) return; p.innerHTML = "";
    if (fotoFile) { const r = new FileReader(); r.onload = () => { p.innerHTML = `<img class="foto" src="${r.result}" alt="Pratinjau foto laporan">`; }; r.readAsDataURL(fotoFile); }
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") modal(""); });
  window.addEventListener("hashchange", () => { if (masuk && S && !S.pending) { render(); const m = document.querySelector(".main"); if (m) m.scrollTop = 0; } });

  muat().then(() => { if (live) store.onChange(adaPerubahan); });
})();
