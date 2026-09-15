# Makes simple-streamer's backend AND the mobile app's Expo dev server both
# launch automatically when you log into Windows, by placing shortcuts to
# run-server.cmd and run-expo.cmd in your Startup folder. No admin rights
# needed. Run once, from PowerShell, from anywhere:
#
#   .\install-windows-startup.ps1
#
# Skip the Expo one if you don't want this machine hosting the mobile dev
# server at all: pass -SkipExpo.
#
# For a machine that's meant to run headless (nobody normally logs in), also
# enable auto-login for this Windows account (Settings > Accounts > Sign-in
# options, or `netplwiz`) so it comes back up unattended after a reboot.

param(
  [switch]$SkipExpo
)

$ErrorActionPreference = 'Stop'

$scriptDir = $PSScriptRoot
$startupDir = [Environment]::GetFolderPath('Startup')
$shell = New-Object -ComObject WScript.Shell

function Install-Shortcut($targetCmd, $linkName, $description) {
  $target = Join-Path $scriptDir $targetCmd
  $shortcutPath = Join-Path $startupDir $linkName
  $shortcut = $shell.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = $target
  $shortcut.WorkingDirectory = $scriptDir
  $shortcut.WindowStyle = 1
  $shortcut.Description = $description
  $shortcut.Save()
  Write-Host "Installed startup shortcut: $shortcutPath"
}

Install-Shortcut 'run-server.cmd' 'simple-streamer.lnk' 'Starts the simple-streamer backend'
if (-not $SkipExpo) {
  Install-Shortcut 'run-expo.cmd' 'simple-streamer-expo.lnk' 'Starts the simple-streamer mobile app Expo dev server'
}

Write-Host ""
Write-Host "Both will now start automatically next time you log in."
Write-Host "To start them right now without logging out: double-click run-server.cmd / run-expo.cmd in this folder."
