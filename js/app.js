// RTku: tampilan dan aksi. Data diambil dari "store" (demo atau Supabase) dengan bentuk yang sama.
"use strict";
(function () {
  const cfg = window.RTKU_CONFIG || {};
  const diisi = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
  const live = diisi && !!window.supabase;
  const store = live ? window.SupaStore(cfg) : window.DemoStore();

  let S = null, masuk = false, galat = "", infoTab = "pengumuman", filterWarga = "Semua", fotoFile = null, authTab = "masuk";
  const LABEL = { warga: "Warga", ketua: "Ketua RT", bendahara: "Bendahara", sekretaris: "Sekretaris", satpam: "Satpam" };
  const JENIS_SURAT = ["Surat Pengantar KTP", "Surat Keterangan Domisili", "Surat Keterangan Tidak Mampu", "Surat Pengantar Kartu Keluarga", "Surat Pengantar SKCK"];
  const ICON = {
    beranda: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    iuran: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/>',
    surat: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>',
    darurat: '<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17v.5"/>',
    info: '<path d="M4 10v4h3l6 4V6l-6 4z"/><path d="M17 9a4 4 0 0 1 0 6"/>',
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
  const isKetua = () => S.me.peran === "ketua";
  const isSatpam = () => S.me.peran === "satpam";
  const isWarga = () => S.me.peran === "warga";
  // Wewenang per peran. Aturan yang sama ditegakkan di database (schema.sql bagian 3).
  const bisaKas = () => ["ketua", "bendahara"].includes(S.me.peran);        // iuran, tagihan, kas
  const bisaAdmin = () => ["ketua", "sekretaris"].includes(S.me.peran);     // surat masuk, pengumuman, polling, lapor, data warga
  const petugas = () => S.me.peran !== "warga";                             // menerima dan menangani SOS
  const total = () => S.iuran.reduce((a, i) => a + i.jumlah, 0);
  const saldo = () => S.kas.reduce((a, k) => a + (k.jenis === "masuk" ? k.jml : -k.jml), 0);
  const kkList = () => S.warga.filter(w => w.kk);
  const tagihanku = () => S.tagihan.filter(t => t.rumah === me().rumah);
  const pill = (t, c) => `<span class="pill ${c}">${esc(t)}</span>`;
  const statusPill = s => pill(s, { Lunas: "ok", Disetujui: "ok", Selesai: "ok", Aktif: "bad", "Belum bayar": "warn", Menunggu: "warn", Diproses: "warn", Ditangani: "warn", Baru: "bad", Ditolak: "bad" }[s] || "mute");

  function menu() {
    const m = [["beranda", "Beranda"]];
    if (!isSatpam()) m.push(["iuran", "Iuran & Kas"], ["surat", "Surat"]);
    m.push(["darurat", "Darurat"], ["info", "Informasi"], ["warga", bisaAdmin() ? "Warga & Tamu" : isSatpam() ? "Buku Tamu" : "Keluarga & Tamu"]);
    return m;
  }
  function currentView() { const h = (location.hash || "").slice(1); return menu().some(m => m[0] === h) ? h : "beranda"; }
  function badge(v) {
    if (v === "darurat") return S.sos.filter(x => x.status !== "Selesai").length;
    if (v === "surat" && bisaAdmin()) return S.surat.filter(x => x.status === "Menunggu").length;
    if (v === "iuran" && !isSatpam()) return tagihanku().filter(t => !t.lunas).length;
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
    $("view").innerHTML = ({ beranda: vBeranda, iuran: vIuran, surat: vSurat, darurat: vDarurat, info: vInfo, warga: vWarga })[currentView()]();
  }
  function renderKerangka() {
    const v = currentView(), u = me();
    $("whoName").textContent = u.nama;
    $("whoSub").textContent = LABEL[u.peran] + " · " + u.rumah;
    $("roles").innerHTML = live
      ? `<button class="btn sm" data-act="keluar">Keluar</button>`
      : `<div class="roles" role="group" aria-label="Lihat aplikasi sebagai">${Object.keys(LABEL).map(r => `<button data-act="role" data-v="${r}" aria-pressed="${u.peran === r}">${LABEL[r]}</button>`).join("")}</div>`;
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
    const tab = `<div class="tabs" role="group" aria-label="Masuk atau daftar"><button data-act="auth-tab" data-v="masuk" aria-pressed="${authTab === "masuk"}">Masuk</button><button data-act="auth-tab" data-v="daftar" aria-pressed="${authTab === "daftar"}">Daftar akun</button></div>`;
    const err = galat ? `<p class="err">${esc(galat)}</p>` : "";
    const form = authTab === "masuk"
      ? `<form class="f" data-form="masuk"><div class="fld"><label for="a-e">Email</label><input id="a-e" name="email" type="email" required autocomplete="email"></div>
          <div class="fld"><label for="a-p">Kata sandi</label><input id="a-p" name="password" type="password" required autocomplete="current-password"></div><button class="btn pri">Masuk</button></form>`
      : `<form class="f" data-form="daftar"><div class="fld"><label for="d-n">Nama lengkap</label><input id="d-n" name="nama" required></div>
          <div class="fld"><label for="d-r">Nomor rumah</label><input id="d-r" name="rumah" required placeholder="Contoh: C-12"></div>
          <div class="fld"><label for="d-e">Email</label><input id="d-e" name="email" type="email" required autocomplete="email"></div>
          <div class="fld"><label for="d-p">Kata sandi (minimal 6 karakter)</label><input id="d-p" name="password" type="password" minlength="6" required autocomplete="new-password"></div>
          <button class="btn pri">Daftar</button><p class="small muted">Setelah mendaftar, akun perlu diverifikasi Ketua RT sebelum bisa dipakai.</p></form>`;
    return `<div class="card auth"><h1>Masuk ke RTku</h1><p class="muted">Aplikasi warga RT 04 / RW 07</p>${tab}${err}${form}</div>`;
  }
  function vMenunggu() {
    return `<div class="card auth"><h1>Menunggu verifikasi</h1><p>Akun <b>${esc(S.me.nama)}</b> untuk rumah <b>${esc(S.me.rumah)}</b> sudah terdaftar. Ketua RT perlu memverifikasinya sebelum Anda bisa melihat data RT.</p>
      <div style="display:flex;gap:8px"><button class="btn pri" data-act="cek-lagi">Periksa lagi</button><button class="btn" data-act="keluar">Keluar</button></div></div>`;
  }

  // ---------- Beranda ----------
  function vBeranda() {
    const p = baru(S.pengumuman, "waktu")[0], tiles = [];
    if (!isSatpam() && !bisaKas()) {
      const t = tagihanku().filter(x => !x.lunas);
      tiles.push(`<div class="card tile"><span class="lbl">Tagihan belum dibayar</span><span class="big num">${t.length ? rp(t.reduce((a, x) => a + x.jumlah, 0)) : "Lunas"}</span><a class="btn ${t.length ? "pri" : ""}" href="#iuran">${t.length ? "Bayar sekarang" : "Lihat riwayat"}</a></div>`);
    }
    if (bisaKas()) {
      const belum = S.tagihan.filter(t => t.bulan === S.bulan && !t.lunas).length;
      tiles.push(`<div class="card tile"><span class="lbl">Belum bayar ${namaBulan(S.bulan)}</span><span class="big num">${belum} rumah</span><a class="btn" href="#iuran">Kelola iuran</a></div>`);
    }
    if (bisaAdmin()) {
      tiles.push(`<div class="card tile"><span class="lbl">Surat menunggu persetujuan</span><span class="big num">${S.surat.filter(x => x.status === "Menunggu").length}</span><a class="btn" href="#surat">Periksa permohonan</a></div>`);
    }
    if (isSatpam()) {
      tiles.push(`<div class="card tile"><span class="lbl">Sinyal darurat aktif</span><span class="big num">${S.sos.filter(x => x.status !== "Selesai").length}</span><a class="btn" href="#darurat">Buka darurat</a></div>`);
      tiles.push(`<div class="card tile"><span class="lbl">Tamu menginap tercatat</span><span class="big num">${S.tamu.length}</span><a class="btn" href="#warga">Buka buku tamu</a></div>`);
    } else {
      tiles.push(`<div class="card tile"><span class="lbl">Saldo kas RT</span><span class="big num">${rp(saldo())}</span><a class="btn" href="#iuran">Lihat laporan kas</a></div>`);
    }
    tiles.push(`<div class="card tile"><span class="lbl">Laporan warga belum selesai</span><span class="big num">${S.lapor.filter(x => x.status !== "Selesai").length}</span><a class="btn" href="#info" data-act="tab" data-v="lapor">Lihat laporan</a></div>`);
    return `<div class="head"><div><h1>Selamat datang, ${esc(me().nama.split(" ")[0])}</h1><p class="muted">RT 04 / RW 07 · ${new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p></div>
      ${isSatpam() ? "" : `<a class="btn danger" href="#darurat">Tombol darurat</a>`}</div>
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
    const list = baru(bisaAdmin() ? S.surat : S.surat.filter(s => s.rumah === me().rumah), "waktu");
    const rows = list.map(s => `<div class="row"><div class="grow"><b>${esc(s.jenis)}</b><p class="small">${esc(s.keperluan)}</p><p class="small muted">${esc(s.pemohon)} · ${esc(s.rumah)} · ${jam(s.waktu)}${s.nomor ? " · No. " + esc(s.nomor) : ""}${s.catatan ? " · Alasan: " + esc(s.catatan) : ""}</p></div>
      <div class="acts">${statusPill(s.status)}${s.status === "Disetujui" ? `<button class="btn sm" data-act="surat-lihat" data-id="${s.id}">Lihat surat</button>` : ""}${isKetua() && s.status === "Menunggu" ? `<button class="btn pri sm" data-act="surat-setuju" data-id="${s.id}">Setujui</button><button class="btn sm" data-act="surat-tolak" data-id="${s.id}">Tolak</button>` : ""}</div></div>`).join("");
    const form = isKetua() ? "" : `<div class="card"><h2>Ajukan surat</h2><form class="f" data-form="surat">
      <div class="fld"><label for="s-jenis">Jenis surat</label><select id="s-jenis" name="jenis">${JENIS_SURAT.map(j => `<option>${j}</option>`).join("")}</select></div>
      <div class="fld"><label for="s-kep">Keperluan</label><textarea id="s-kep" name="keperluan" required placeholder="Contoh: syarat pendaftaran sekolah"></textarea></div>
      <button class="btn pri">Kirim permohonan</button></form><p class="small muted">Ketua RT menerima permohonan ini dan menyetujuinya dari aplikasi. Tidak perlu datang ke rumahnya.</p></div>`;
    return `<div class="head"><div><h1>Surat-menyurat</h1><p class="muted">${isKetua() ? "Periksa dan setujui permohonan warga." : isSatpam() ? "" : "Ajukan surat pengantar tanpa keluar rumah. Persetujuan oleh Ketua RT."}</p></div></div>
    <div class="${isKetua() ? "" : "two"}"><div class="card"><h2>${bisaAdmin() ? "Semua permohonan" : "Permohonan saya"}</h2><div class="list">${rows || `<p class="muted">Belum ada permohonan.</p>`}</div></div>${form}</div>`;
  }
  function qrSvg(text) { try { if (typeof qrcode !== "function") return ""; const q = qrcode(0, "M"); q.addData(text); q.make(); return `<div class="qr">${q.createSvgTag({ cellSize: 3, margin: 2 })}</div>`; } catch (e) { return ""; } }
  function suratHtml(s) {
    const ketua = S.akun.find(a => a.peran === "ketua") || (isKetua() ? me() : null);
    return `<div class="surat"><div class="kop"><b>RUKUN TETANGGA 04 / RUKUN WARGA 07</b></div>
      <div style="text-align:center"><b style="text-decoration:underline">${esc(s.jenis).toUpperCase()}</b><br>Nomor: ${esc(s.nomor)}</div>
      <p>Yang bertanda tangan di bawah ini, Ketua RT 04 / RW 07, menerangkan bahwa:</p>
      <p>Nama: <b>${esc(s.pemohon)}</b><br>Alamat: Rumah ${esc(s.rumah)}, RT 04 / RW 07</p>
      <p>adalah benar warga kami. Surat ini diberikan untuk keperluan: ${esc(s.keperluan)}.</p>
      <div class="ttd">${qrSvg("RTKU|" + s.nomor + "|" + s.kode)}<div style="text-align:right">${tgl(s.setuju || s.waktu)}<br>Ketua RT 04<br><i>Disetujui secara digital</i>${ketua ? `<br><b>${esc(ketua.nama)}</b>` : ""}<br>Kode verifikasi: ${esc(s.kode)}</div></div></div>`;
  }

  // ---------- Darurat ----------
  function vDarurat() {
    const riwayat = baru(S.sos, "waktu").map(a => `<div class="row"><div class="grow"><b>${esc(a.jenis)}</b> · ${esc(a.rumah)}<p class="small muted">${esc(a.nama)} · ${jam(a.waktu)}${a.petugas ? " · Petugas: " + esc(a.petugas) : ""}</p></div><div class="acts">${statusPill(a.status)}${!isWarga() && a.status === "Aktif" ? `<button class="btn sm" data-act="sos-tangani" data-id="${a.id}">Saya tangani</button>` : ""}${!isWarga() && a.status === "Ditangani" ? `<button class="btn sm" data-act="sos-selesai" data-id="${a.id}">Selesai</button>` : ""}</div></div>`).join("");
    const kiri = !isSatpam()
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
      body = `<div class="${bisaAdmin() ? "two" : ""}"><div class="card"><div class="list">${baru(S.pengumuman, "waktu").map(p => `<div class="row"><div class="grow"><h3>${esc(p.judul)}</h3><p>${esc(p.isi)}</p><p class="small muted">${jam(p.waktu)} · ${esc(p.oleh)}</p></div></div>`).join("") || `<p class="muted">Belum ada pengumuman.</p>`}</div></div>
        ${bisaAdmin() ? `<div class="card"><h2>Buat pengumuman</h2><form class="f" data-form="umum"><div class="fld"><label for="u-j">Judul</label><input id="u-j" name="judul" required></div><div class="fld"><label for="u-i">Isi</label><textarea id="u-i" name="isi" required></textarea></div><button class="btn pri">Terbitkan</button></form></div>` : ""}</div>`;
    } else if (t === "polling") {
      body = `<div class="${bisaAdmin() ? "two" : ""}"><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">${S.polling.map(q => {
        const tot = q.opsi.reduce((a, o) => a + o.n, 0), mine = q.pilihku;
        return `<div class="card"><h2>${esc(q.tanya)}</h2>${q.opsi.map(o => `<div><div class="head"><span>${esc(o.t)} ${mine === o.id ? pill("Pilihan Anda", "ok") : ""}</span><span class="num small muted">${o.n} suara · ${tot ? Math.round(o.n / tot * 100) : 0}%</span></div><div class="bar"><i style="width:${tot ? o.n / tot * 100 : 0}%"></i></div>${mine == null ? `<button class="btn sm" style="margin-top:6px" data-act="vote" data-id="${q.id}" data-v="${o.id}">Pilih ${esc(o.t)}</button>` : ""}</div>`).join("")}
          <p class="small muted">${mine == null ? "Satu suara per akun." : "Suara Anda sudah tercatat."} Total ${tot} suara.</p></div>`;
      }).join("") || `<div class="card"><p class="muted">Belum ada polling.</p></div>`}</div>
        ${bisaAdmin() ? `<div class="card"><h2>Buat polling</h2><form class="f" data-form="poll"><div class="fld"><label for="p-t">Pertanyaan</label><input id="p-t" name="tanya" required></div><div class="fld"><label for="p-o">Pilihan, satu per baris</label><textarea id="p-o" name="opsi" required placeholder="Pilihan A&#10;Pilihan B"></textarea></div><button class="btn pri">Mulai polling</button></form></div>` : ""}</div>`;
    } else {
      const next = { Baru: "Diproses", Diproses: "Selesai" };
      body = `<div class="two"><div class="card"><h2>Laporan warga</h2><div class="list">${baru(S.lapor, "waktu").map(l => `<div class="row"><div class="grow"><b>${esc(l.judul)}</b> ${pill(l.kategori, "mute")}<p>${esc(l.ket)}</p>${l.foto ? `<img class="foto" src="${esc(l.foto)}" alt="Foto laporan ${esc(l.judul)}">` : ""}<p class="small muted">${esc(l.pelapor)} · ${esc(l.rumah)} · ${jam(l.waktu)}</p></div><div class="acts">${statusPill(l.status)}${bisaAdmin() && next[l.status] ? `<button class="btn sm" data-act="lapor-next" data-id="${l.id}">Tandai ${next[l.status].toLowerCase()}</button>` : ""}</div></div>`).join("") || `<p class="muted">Belum ada laporan.</p>`}</div></div>
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
  function vWarga() {
    const tamuList = baru(bisaAdmin() || isSatpam() ? S.tamu : S.tamu.filter(t => t.rumah === me().rumah), "waktu");
    const tamu = `<div class="card"><h2>${bisaAdmin() || isSatpam() ? "Buku tamu 1x24 jam" : "Tamu menginap di rumah saya"}</h2><div class="list">${tamuList.map(t => `<div class="row"><div class="grow"><b>${esc(t.nama)}</b> <span class="muted">dari ${esc(t.asal)}</span><p class="small muted">${esc(t.hubungan)} · menginap di ${esc(t.rumah)} (${esc(t.tuan)}) · datang ${tgl(String(t.datang))}</p></div><div class="acts">${pill(t.malam + " malam", "mute")}</div></div>`).join("") || `<p class="muted">Belum ada tamu yang dilaporkan.</p>`}</div></div>`;
    const formTamu = `<div class="card"><h2>Lapor tamu menginap</h2><form class="f" data-form="tamu">
      <div class="fld"><label for="t-n">Nama tamu</label><input id="t-n" name="nama" required></div>
      <div class="frow"><div class="fld"><label for="t-h">Hubungan</label><input id="t-h" name="hubungan" required placeholder="Contoh: saudara"></div><div class="fld"><label for="t-a">Kota asal</label><input id="t-a" name="asal" required></div></div>
      <div class="frow"><div class="fld"><label for="t-d">Tanggal datang</label><input id="t-d" name="datang" type="date" value="${hariIni()}" required></div><div class="fld"><label for="t-m">Lama menginap (malam)</label><input id="t-m" name="malam" type="number" min="1" max="60" value="1" required></div></div>
      <button class="btn pri">Laporkan tamu</button></form></div>`;
    if (isSatpam()) return `<div class="head"><div><h1>Buku Tamu</h1><p class="muted">Tamu menginap yang dilaporkan warga.</p></div></div>${tamu}`;
    if (!bisaAdmin()) {
      const kel = S.warga.filter(w => w.rumah === me().rumah);
      return `<div class="head"><div><h1>Keluarga & Tamu</h1><p class="muted">Data rumah ${esc(me().rumah)} hanya terlihat oleh penghuni rumah ini dan pengurus RT.</p></div></div>
      <div class="two"><div style="display:flex;flex-direction:column;gap:20px"><div class="card"><h2>Penghuni rumah ${esc(me().rumah)}</h2><div class="list">${kel.map(w => `<div class="row"><div class="grow"><b>${esc(w.nama)}</b><p class="small muted">${w.kk ? w.jiwa + " jiwa dalam KK · " : ""}${esc(w.hp)}</p></div>${pill(w.status, "mute")}</div>`).join("") || `<p class="muted">Data penghuni belum diisi pengurus RT.</p>`}</div></div>${tamu}</div>${formTamu}</div>`;
    }
    const st = ["Pemilik", "Penyewa", "Kos", "ART"], jiwa = S.warga.reduce((a, w) => a + w.jiwa, 0);
    const rows = S.warga.filter(w => filterWarga === "Semua" || w.status === filterWarga);
    const akun = live && isKetua() ? `<div class="card"><div class="head"><h2>Akun pengguna</h2><span class="small muted">${S.akun.filter(a => !a.aktif).length} menunggu verifikasi</span></div><div class="list">${S.akun.map(a => `<div class="row"><div class="grow"><b>${esc(a.nama)}</b> · ${esc(a.rumah)}<p class="small muted">${LABEL[a.peran]} · daftar ${tgl(a.dibuat)}</p></div><div class="acts">${a.aktif ? pill("Aktif", "ok") : pill("Menunggu", "warn")}${a.id === me().id ? "" : `<select aria-label="Peran ${esc(a.nama)}" data-peran="${a.id}">${Object.keys(LABEL).map(r => `<option value="${r}" ${a.peran === r ? "selected" : ""}>${LABEL[r]}</option>`).join("")}</select><button class="btn pri sm" data-act="akun" data-uid="${a.id}" data-v="simpan">${a.aktif ? "Simpan peran" : "Verifikasi"}</button>${a.aktif ? `<button class="btn sm" data-act="akun" data-uid="${a.id}" data-v="nonaktif">Nonaktifkan</button>` : ""}`}</div></div>`).join("")}</div>
      <p class="small muted">Pilih peran, lalu Verifikasi. Cocokkan nama dan nomor rumah dengan data warga lebih dulu. Akun yang diverifikasi bisa melihat data rumah tersebut.</p></div>` : "";
    return `<div class="head"><div><h1>Warga & Tamu</h1><p class="muted">Data demografi RT 04 dan buku tamu digital.</p></div></div>
    <div class="grid"><div class="card tile"><span class="lbl">Rumah berpenghuni</span><span class="big num">${kkList().length}</span></div><div class="card tile"><span class="lbl">Total jiwa</span><span class="big num">${jiwa}</span></div>
      ${st.map(s => `<div class="card tile"><span class="lbl">${s}</span><span class="big num">${S.warga.filter(w => w.status === s).length}</span></div>`).join("")}</div>
    ${akun}
    <div class="card"><div class="head"><h2>Daftar warga</h2><div class="tabs" role="group" aria-label="Saring status">${["Semua", ...st].map(s => `<button data-act="filter" data-v="${s}" aria-pressed="${filterWarga === s}">${s}</button>`).join("")}</div></div>
      <div class="tw"><table><thead><tr><th>Rumah</th><th>Nama</th><th>Status</th><th class="r">Jiwa</th><th>No. HP</th></tr></thead><tbody>${rows.map(w => `<tr><td><b>${esc(w.rumah)}</b></td><td>${esc(w.nama)}</td><td>${pill(w.status, "mute")}</td><td class="r num">${w.jiwa}</td><td class="num">${esc(w.hp)}</td></tr>`).join("")}</tbody></table></div></div>
    <div class="two">${tamu}<div class="card"><h2>Tambah warga</h2><form class="f" data-form="warga">
      <div class="frow"><div class="fld"><label for="w-r">Nomor rumah</label><input id="w-r" name="rumah" required placeholder="Contoh: B-06"></div><div class="fld"><label for="w-s">Status</label><select id="w-s" name="status">${st.map(s => `<option>${s}</option>`).join("")}</select></div></div>
      <div class="fld"><label for="w-n">Nama lengkap</label><input id="w-n" name="nama" required></div>
      <div class="frow"><div class="fld"><label for="w-j">Jumlah jiwa</label><input id="w-j" name="jiwa" type="number" min="1" value="1" required></div><div class="fld"><label for="w-h">No. HP</label><input id="w-h" name="hp" required></div></div>
      <button class="btn pri">Simpan data warga</button></form></div></div>`;
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
    if (act === "auth-tab") { authTab = v; galat = ""; render(); return; }
    if (act === "keluar") { await store.keluar(); masuk = false; S = null; location.hash = ""; render(); return; }
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
    if (act === "akun") { const uid = el.dataset.uid; const sel = document.querySelector(`select[data-peran="${uid}"]`); aksi(() => store.aturAkun(uid, v === "nonaktif" ? { aktif: false } : { aktif: true, peran: sel ? sel.value : "warga" }), v === "nonaktif" ? "Akun dinonaktifkan" : "Peran akun disimpan"); return; }
  });

  // ---------- aksi form ----------
  document.addEventListener("submit", async e => {
    const f = e.target.closest("[data-form]"); if (!f) return; e.preventDefault();
    const d = Object.fromEntries(new FormData(f).entries()), k = f.dataset.form;
    const rapi = o => { Object.keys(o).forEach(x => { if (typeof o[x] === "string") o[x] = o[x].trim(); }); return o; };
    if (k === "masuk" || k === "daftar") {
      if (sibuk) return; sibuk = true; galat = "";
      try {
        if (k === "masuk") { await store.masuk(d.email.trim(), d.password); }
        else {
          const langsung = await store.daftar({ email: d.email.trim(), password: d.password, nama: d.nama.trim(), rumah: d.rumah.trim().toUpperCase() });
          if (!langsung) { authTab = "masuk"; sibuk = false; render(); toast("Pendaftaran diterima. Buka email konfirmasi, lalu masuk."); return; }
        }
        sibuk = false; await muat();
      } catch (err) { sibuk = false; galat = /invalid login/i.test(err.message) ? "Email atau kata sandi salah." : err.message; render(); }
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
    if (k === "surat") { aksi(() => store.ajukanSurat(rapi({ jenis: d.jenis, keperluan: d.keperluan })), "Permohonan terkirim ke Ketua RT"); return; }
    if (k === "tolak") { modal(""); aksi(() => store.tolakSurat(Number(f.dataset.id), d.catatan.trim()), "Permohonan ditolak"); return; }
    if (k === "sos") { modal(""); aksi(() => store.kirimSos(d.jenis), "Sinyal darurat terkirim"); return; }
    if (k === "umum") { aksi(() => store.umumkan(rapi({ judul: d.judul, isi: d.isi })), "Pengumuman diterbitkan"); return; }
    if (k === "poll") { const o = d.opsi.split("\n").map(x => x.trim()).filter(Boolean); if (o.length < 2) { toast("Isi minimal dua pilihan, satu per baris"); return; } aksi(() => store.buatPolling(d.tanya.trim(), o), "Polling dimulai"); return; }
    if (k === "lapor") { const file = fotoFile; fotoFile = null; aksi(() => store.lapor(rapi({ judul: d.judul, kategori: d.kategori, ket: d.ket, file })), "Laporan terkirim ke pengurus RT"); return; }
    if (k === "tamu") { aksi(() => store.tamu(rapi({ nama: d.nama, hubungan: d.hubungan, asal: d.asal, datang: d.datang, malam: Math.min(60, Math.max(1, Number(d.malam) || 1)) })), "Tamu tercatat di buku tamu RT"); return; }
    if (k === "warga") { aksi(() => store.tambahWarga(rapi({ rumah: d.rumah.trim().toUpperCase(), nama: d.nama, status: d.status, jiwa: Math.max(1, Number(d.jiwa) || 1), hp: d.hp })), "Data warga disimpan"); return; }
  });

  document.addEventListener("change", e => {
    if (e.target.id !== "l-f") return; fotoFile = (e.target.files && e.target.files[0]) || null;
    const p = $("fotoPrev"); if (!p) return; p.innerHTML = "";
    if (fotoFile) { const r = new FileReader(); r.onload = () => { p.innerHTML = `<img class="foto" src="${r.result}" alt="Pratinjau foto laporan">`; }; r.readAsDataURL(fotoFile); }
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") modal(""); });
  window.addEventListener("hashchange", () => { if (masuk && S && !S.pending) { render(); const m = document.querySelector(".main"); if (m) m.scrollTop = 0; } });

  muat().then(() => { if (live) store.onChange(adaPerubahan); });
})();
