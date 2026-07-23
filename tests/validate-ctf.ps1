$ErrorActionPreference = 'Stop'

$global:LASTEXITCODE = 0
& (Join-Path $PSScriptRoot 'validate-ctf-telemetry.ps1')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$global:LASTEXITCODE = 0
& (Join-Path $PSScriptRoot 'validate-ctf-content.ps1')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host 'Static CTF validation suite passed.' -ForegroundColor Green
Write-Host 'Run tests/ctf-engine.html through the documented local preview for browser engine tests.'
