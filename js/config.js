// Koneksi ke database Supabase.
// Isi dua nilai di bawah dari Supabase > Project Settings > API.
// Selama keduanya kosong, aplikasi berjalan dalam MODE DEMO (data contoh di browser).
//
// "anon key" memang dirancang untuk dipakai di browser dan boleh ikut di GitHub:
// keamanan data dijaga oleh aturan Row Level Security di database/schema.sql.
// JANGAN PERNAH menaruh "service_role key" di file ini.
window.RTKU_CONFIG = {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: ""
};
