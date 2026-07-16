@echo off
title Launch Chrome with Remote Debugging
echo ========================================================
echo   MENYALAKAN CHROME DENGAN MODE AUTO-DETEKSI COOKIE
echo ========================================================
echo.
echo Langkah:
echo 1. Pastikan semua jendela Chrome ditutup terlebih dahulu.
echo 2. Tekan Enter untuk membuka Chrome khusus.
echo 3. Login ke situs akun Spaceman seperti biasa di jendela baru ini.
echo 4. Backend otomatis mendeteksi login Anda tanpa perlu salin-tempel manual!
echo.
pause

start chrome --remote-debugging-port=9222 "https://eca004.kaca189b.online/crash"
echo.
echo [SUKSES] Jendela Chrome debug telah terbuka pada port 9222!
echo Silakan login dan biarkan tab tetap terbuka.
echo.
pause
