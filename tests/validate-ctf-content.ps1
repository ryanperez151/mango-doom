param(
    [string]$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'
$failures = [System.Collections.Generic.List[string]]::new()
$reviewFindings = [System.Collections.Generic.List[string]]::new()

function Add-Failure {
    param([string]$Message)
    $failures.Add($Message)
}

function Test-DocumentationAddress {
    param([string]$Address)
    $ipText = $Address.Split('/')[0]
    $parsed = $null
    if (-not [System.Net.IPAddress]::TryParse($ipText, [ref]$parsed)) { return $false }
    $bytes = $parsed.GetAddressBytes()
    return $bytes.Count -eq 4 -and (
        ($bytes[0] -eq 192 -and $bytes[1] -eq 0 -and $bytes[2] -eq 2) -or
        ($bytes[0] -eq 198 -and $bytes[1] -eq 51 -and $bytes[2] -eq 100) -or
        ($bytes[0] -eq 203 -and $bytes[1] -eq 0 -and $bytes[2] -eq 113)
    )
}

$relativeRuntimeFiles = @(
    'ctf.html',
    'css\ctf.css',
    'js\ctf\app.js',
    'js\ctf\console-view.js',
    'js\ctf\siem-view.js',
    'js\ctf\contracts.js',
    'js\ctf\paired.js',
    'js\ctf\state.js',
    'js\ctf\storage.js',
    'js\ctf\timeline.js',
    'data\ctf\scenario.js',
    'data\ctf\incident-response.js',
    'data\ctf\telemetry.js',
    'data\ctf\telemetry.json',
    'data\ctf\evidence-manifest.json',
    'data\ctf\event-evidence-map.json'
)

$runtimeText = @{}
foreach ($relativePath in $relativeRuntimeFiles) {
    $fullPath = Join-Path $RepositoryRoot $relativePath
    if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
        Add-Failure "Required CTF file is missing: $relativePath"
        continue
    }
    $runtimeText[$relativePath] = Get-Content -Raw -Encoding utf8 -LiteralPath $fullPath
}

$executionPatterns = [ordered]@{
    'network request API' = '(?i)\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|RTCPeerConnection)\s*\('
    'beacon API' = '(?i)navigator\.sendBeacon\s*\('
    'dynamic import' = '(?i)\bimport\s*\('
    'eval' = '(?i)\beval\s*\('
    'dynamic Function construction' = '(?i)\bnew\s+Function\b'
    'string timer execution' = '(?i)\bset(?:Timeout|Interval)\s*\(\s*["'']'
    'unsafe HTML rendering' = '(?i)\.(?:innerHTML|outerHTML)\s*=|insertAdjacentHTML\s*\(|document\.write\s*\('
    'process execution' = '(?i)\b(?:child_process|shell_exec|execFile|spawn)\b'
}

foreach ($entry in $runtimeText.GetEnumerator()) {
    foreach ($pattern in $executionPatterns.GetEnumerator()) {
        if ($entry.Value -match $pattern.Value) {
            Add-Failure "$($entry.Key) contains disallowed $($pattern.Key)."
        }
    }
}

if ($runtimeText.ContainsKey('ctf.html')) {
    $html = $runtimeText['ctf.html']
    if ($html -match '(?i)(?:src|href|action)\s*=\s*["'']\s*(?:https?:|//|data:|javascript:)') {
        Add-Failure 'ctf.html contains a remote or executable asset/navigation reference.'
    }
    if ($html -match '(?i)<input\b[^>]*\btype\s*=\s*["'']file["'']') {
        Add-Failure 'ctf.html contains a file-upload control.'
    }
    if ($html -match '(?i)<(?:input|textarea)\b[^>]*(?:id|name)\s*=\s*["''][^"'']*(?:target|domain|hostname|address|url|ip)[^"'']*["'']') {
        Add-Failure 'ctf.html contains arbitrary target-like text input.'
    }
}

foreach ($scenarioPath in @('data\ctf\scenario.js', 'data\ctf\incident-response.js')) {
    if (-not $runtimeText.ContainsKey($scenarioPath)) { continue }
    $text = $runtimeText[$scenarioPath]
    foreach ($match in [regex]::Matches($text, 'hostname:\s*"([^"]+)"')) {
        if ($match.Groups[1].Value -notmatch '^(?:[a-z0-9-]+\.)+invalid$') {
            Add-Failure "$scenarioPath contains a hostname outside .invalid: $($match.Groups[1].Value)"
        }
    }
    foreach ($match in [regex]::Matches($text, 'address:\s*"([^"]+)"')) {
        if (-not (Test-DocumentationAddress $match.Groups[1].Value)) {
            Add-Failure "$scenarioPath contains a non-documentation address: $($match.Groups[1].Value)"
        }
    }
    if ($text -match '(?i)\b(?:instructor|facilitator)[ _-]?only\b') {
        Add-Failure "$scenarioPath exposes instructor-only narrative in learner data."
    }
    if ($text -match '(?i)(?:[a-z][a-z0-9+.-]*://|javascript:|data:)') {
        Add-Failure "$scenarioPath contains a URL-bearing scenario string."
    }
}

$learnerData = @(
    $runtimeText['ctf.html'],
    $runtimeText['js\ctf\paired.js'],
    $runtimeText['data\ctf\scenario.js'],
    $runtimeText['data\ctf\incident-response.js'],
    $runtimeText['data\ctf\telemetry.json']
) -join "`n"

if ($learnerData -match '(?i)\b(?:instructor|facilitator)[ _-]?only\b') {
    Add-Failure 'Learner-visible content contains instructor-only narrative.'
}

$secretPatterns = [ordered]@{
    'private key material' = '-----BEGIN [A-Z ]*PRIVATE KEY-----'
    'cloud access key shape' = '\bAKIA[0-9A-Z]{16}\b'
    'repository token shape' = '\bgh[pousr]_[A-Za-z0-9]{20,}\b'
    'JWT-like value' = '\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b'
    'assigned secret-like value' = '(?i)\b(?:password|passwd|secret|token|api[_ -]?key|access[_ -]?key)\s*[:=]\s*["'']?[A-Za-z0-9+/=_-]{8,}'
    'long hexadecimal material' = '(?i)\b[a-f0-9]{32,64}\b'
}
foreach ($pattern in $secretPatterns.GetEnumerator()) {
    if ($learnerData -match $pattern.Value) {
        Add-Failure "Learner data contains $($pattern.Key); human review is required before release."
    }
}

$strongOperationalPatterns = [ordered]@{
    'real CVE identifier' = '(?i)\bCVE-\d{4}-\d{4,}\b'
    'filesystem implementation path' = '(?i)(?:\b[A-Z]:\\(?:Windows|Users|ProgramData)\\|/(?:etc|var|usr|opt)/)'
    'command-line utility sequence' = '(?i)(?:^|[\s"''])(?:curl|wget|powershell|cmd\.exe|bash|sh|sudo)\s+-[A-Za-z]'
    'encoded executable marker' = '(?i)\b(?:base64|fromCharCode)\s*\('
}
foreach ($pattern in $strongOperationalPatterns.GetEnumerator()) {
    if ($learnerData -match $pattern.Value) {
        Add-Failure "Learner data contains $($pattern.Key); human review is required before release."
    }
}

$reviewAidPatterns = [ordered]@{
    'exploit language' = '(?i)\bexploit(?:ation|ed|s)?\b'
    'command language' = '(?i)\bcommands?\b'
    'payload language' = '(?i)\bpayloads?\b'
    'credential language' = '(?i)\bcredentials?\b'
    'persistence language' = '(?i)\bpersistence\b'
    'evasion language' = '(?i)\bevasion\b'
    'logging-bypass language' = '(?i)\b(?:disable|delete|suppress|bypass)\b.{0,40}\b(?:log|logging|monitoring|security tool)\b'
}
foreach ($pattern in $reviewAidPatterns.GetEnumerator()) {
    $count = [regex]::Matches($learnerData, $pattern.Value).Count
    if ($count -gt 0) {
        $reviewFindings.Add("$($pattern.Key): $count occurrence(s)")
    }
}

if ($runtimeText.ContainsKey('data\ctf\telemetry.js') -and $runtimeText.ContainsKey('data\ctf\telemetry.json')) {
    $moduleMatch = [regex]::Match($runtimeText['data\ctf\telemetry.js'], 'export const mangoKeepTelemetry = (\{.*\});\s*$', [System.Text.RegularExpressions.RegexOptions]::Singleline)
    if (-not $moduleMatch.Success) {
        Add-Failure 'telemetry.js is not a fixed inert wrapper around the JSON pack.'
    } else {
        try {
            $moduleObject = $moduleMatch.Groups[1].Value | ConvertFrom-Json
            $jsonObject = $runtimeText['data\ctf\telemetry.json'] | ConvertFrom-Json
            $moduleNormalized = $moduleObject | ConvertTo-Json -Depth 20 -Compress
            $jsonNormalized = $jsonObject | ConvertTo-Json -Depth 20 -Compress
            if ($moduleNormalized -ne $jsonNormalized) {
                Add-Failure 'telemetry.js differs from the validated JSON telemetry pack.'
            }
        } catch {
            Add-Failure "Unable to compare telemetry module and JSON: $($_.Exception.Message)"
        }
    }
}

if ($failures.Count -gt 0) {
    Write-Host "CTF content validation failed with $($failures.Count) issue(s):" -ForegroundColor Red
    foreach ($failure in $failures) { Write-Host "- $failure" -ForegroundColor Red }
    exit 1
}

Write-Host 'CTF content and runtime safety validation passed.' -ForegroundColor Green
Write-Host ('Files checked: {0}' -f $runtimeText.Count)
Write-Host 'Network, dynamic execution, unsafe rendering, remote assets, uploads, and target-like inputs: 0'
Write-Host 'Secret-like and strong operational patterns: 0'
if ($reviewFindings.Count -gt 0) {
    Write-Host 'Manual-review aid findings (context must be reviewed; these are not automatic failures):' -ForegroundColor Yellow
    foreach ($finding in $reviewFindings) { Write-Host "- $finding" -ForegroundColor Yellow }
} else {
    Write-Host 'Manual-review aid findings: 0'
}
