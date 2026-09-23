@echo off
setlocal

cd /d "%~dp0"

echo.
echo   ========================================================
echo      LIBRARY MANAGEMENT SYSTEM
echo      Starting up. First run takes a few minutes.
echo   ========================================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo   Node.js is not installed, or not on PATH.
  echo   Install the LTS build from https://nodejs.org and run this again.
  echo.
  pause
  exit /b 1
)

if not exist "backend\node_modules" (
  echo   [1/4] Installing backend dependencies...
  call npm --prefix backend install
  if errorlevel 1 goto :failed
) else (
  echo   [1/4] Backend dependencies present.
)

if not exist "frontend\node_modules" (
  echo   [2/4] Installing frontend dependencies...
  call npm --prefix frontend install
  if errorlevel 1 goto :failed
) else (
  echo   [2/4] Frontend dependencies present.
)

if not exist "frontend\build\index.html" (
  echo   [3/4] Building the frontend. This is the slow part...
  call npm --prefix frontend run build
  if errorlevel 1 goto :failed
) else (
  echo   [3/4] Frontend already built.
  echo         Delete frontend\build to force a rebuild after changing the UI.
)

where cloudflared >nul 2>&1
if errorlevel 1 (
  echo.
  echo   cloudflared is not installed, so there is no public URL to make.
  echo   Install it with:
  echo       winget install --id Cloudflare.cloudflared
  echo.
  echo   Starting locally instead - open http://localhost:4000
  echo.
  call npm --prefix backend run dev:local
  goto :done
)

echo   [4/4] Starting the server and opening a Cloudflare tunnel...
echo.

call npm --prefix backend run tunnel

:done
echo.
echo   Stopped.
pause
exit /b 0

:failed
echo.
echo   Something failed above. The message just before this line says what.
echo.
pause
exit /b 1
