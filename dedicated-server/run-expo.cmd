@echo off
REM Runs the mobile app's Expo/Metro dev server from wherever this repo is
REM cloned. Point Expo Go at this machine's Tailscale IP, port 8081 — either
REM scan the QR this prints, or use Expo Go's "Enter URL manually" with
REM exp://<tailscale-ip>:8081. Set EXPO_PACKAGER_HOSTNAME in mobile/.env
REM first (see mobile/.env.example) so that address is advertised correctly.
cd /d "%~dp0..\mobile"
echo Starting Expo dev server...
npx expo start
echo.
echo Expo dev server stopped.
pause
