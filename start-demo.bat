@echo off
echo ====================================
echo   ລະບົບສາງ PR-PO - Demo Mode
echo ====================================
echo.
echo [1/2] Starting Backend Server...
start "Stock System Server" cmd /k "cd /d D:\Stock-System\server && npm run dev"

echo Waiting for server to start...
timeout /t 5 /nobreak >nul

echo [2/2] Starting ngrok tunnel...
start "ngrok tunnel" cmd /k "ngrok http 3000"

echo.
echo ✅ Done! Copy the ngrok URL and send to customer.
echo    (Check the ngrok window for the https://xxx.ngrok-free.app URL)
echo.
pause
