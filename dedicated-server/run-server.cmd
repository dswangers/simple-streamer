@echo off
REM Double-click this (or point a Startup-folder shortcut at it — see
REM install-windows-startup.ps1) to run simple-streamer from wherever this
REM repo happens to be cloned on this machine.
cd /d "%~dp0.."
echo Starting simple-streamer...
npm start
echo.
echo simple-streamer stopped (crashed, or you closed it).
pause
