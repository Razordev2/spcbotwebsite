# Panduan Deploy & Run: Spaceman Pattern Dashboard

Sistem ini terdiri dari dua bagian:
1. **Frontend (Website)**: Dashboard visual yang responsive, premium, dan interaktif.
2. **Backend (Node.js)**: Server WebSocket yang membaca data real-time langsung dari server game Pragmatic Play dan menghitung pola prediksi.

---

## Cara Menjalankan Secara Lokal (Local Run)

### 1. Jalankan Backend
1. Buka Command Prompt / terminal pada folder `backend/`.
2. Install package pendukung:
   ```bash
   npm install
   ```
3. Mulai server:
   ```bash
   node server.js
   ```
   *Server akan berjalan di `http://localhost:3001`.*

### 2. Jalankan Frontend
1. Buka file `website/index.html` langsung di browser Anda (klik dua kali pada file).
2. Di pojok kanan atas, pastikan status indikator berwarna hijau (**CONNECTED**).
3. Jika Anda memindahkan port backend, klik icon server di pojok kanan atas untuk menyesuaikan URL backend.

---

## Panduan Deploy ke Cloud (Vercel & Render/Railway)

Karena backend membutuhkan koneksi WebSocket yang standby 24/7 untuk mendengarkan server game Pragmatic Play secara real-time, **Vercel tidak mendukung hosting backend ini secara langsung** (Vercel menggunakan Serverless Functions yang mati setelah 15 detik).

Oleh karena itu, strategi deploy terbaik adalah:
- **Frontend** di-deploy ke **Vercel** (Gratis & Cepat).
- **Backend** di-deploy ke **Render.com** atau **Railway.app** (Gratis/Murah & Mendukung WebSocket 24/7).

### Langkah 1: Deploy Frontend ke Vercel
1. Upload folder `website/` ke repository GitHub Anda (misal struktur repo hanya berisi isi folder `website/` di root repo).
2. Hubungkan GitHub ke akun [Vercel](https://vercel.com).
3. Pilih repository tersebut dan klik **Deploy**.
4. Website Anda selesai di-deploy dan Anda akan mendapatkan URL Vercel (contoh: `https://spaceman-predictor.vercel.app`).

### Langkah 2: Deploy Backend ke Render.com
1. Buat repository GitHub baru untuk isi folder `backend/` (pastikan file `.env` diabaikan/dikecualikan lewat `.gitignore` agar JSESSIONID tidak tersebar publik).
2. Masuk ke [Render.com](https://render.com) dan buat **New Web Service**.
3. Hubungkan repository backend GitHub Anda.
4. Set parameter build:
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
5. Buka tab **Environment** di Render, lalu tambahkan environment variables berikut:
   - `JSESSIONID` = `4-zi-uQtQxBda3Ny4wqpDKrdygkjtvK_YY34P_9Zd__G2jAb_-gn!021770770-f2d7d982`
   - `TABLE_ID` = `spacemanyxe123nh`
   - `PORT` = `10000` (Render akan memberikan port default otomatis)
6. Klik **Deploy Web Service**. Render akan memberikan URL backend Anda (contoh: `https://spaceman-backend.onrender.com`).

### Langkah 3: Hubungkan Website ke Backend Baru
1. Buka URL website Anda yang ada di Vercel.
2. Klik tombol **localhost:3001** (icon server) di pojok kanan atas.
3. Masukkan URL backend Render Anda (misal: `https://spaceman-backend.onrender.com`).
4. Klik **Connect**. Status akan berubah menjadi **CONNECTED** / **LIVE** secara real-time!

---

> [!TIP]
> **Deteksi Otomatis & Sinkronisasi Tanpa Copy-Paste!**
> Sistem ini telah diintegrasikan sepenuhnya dengan ekstensi Chrome (**Spaceman Tracker**). 
> - Ketika ekstensi berjalan di browser Anda dan mendeteksi aktivitas game Spaceman, ia akan secara otomatis menangkap `JSESSIONID` baru secara real-time.
> - Ekstensi kemudian akan langsung mengirimkan `JSESSIONID` baru tersebut ke website dashboard (Vercel) dan memperbarui backend server Anda (Render/Railway) secara otomatis.
> - **Tidak perlu melakukan salin-tempel (copy-paste) manual atau restart server lagi!** Cukup buka game Spaceman di browser Anda, dan sistem akan tersinkronisasi secara otomatis.
