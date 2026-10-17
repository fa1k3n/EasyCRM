# Kör alla enhetstester för kundregistret:
#   0. bygger och typkontrollerar kundregister\logic.ts till logic.js (tools\tsc.ps1)
#   1. kundregister\tests (JavaScript) i Edge utan fönster
#   2. alla tests\*.Tests.ps1 med Pester 3.4 (PowerShell-skripten)
# Användning: powershell -NoProfile -ExecutionPolicy Bypass -File run-tests.ps1
# Avslutningskod 0 om allt gick igenom, annars 1.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$failed = $false

# logic.js byggs från logic.ts, så att testerna alltid körs mot aktuell TypeScript-kod
Write-Host "== TypeScript (logic.ts) ==" -ForegroundColor Cyan
& (Join-Path $root 'tools\tsc.ps1')
if ($LASTEXITCODE -ne 0) { $failed = $true }

Write-Host "== Kundregister (logic.js) ==" -ForegroundColor Cyan
$edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") |
    Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) {
    Write-Host "Hittar inte Microsoft Edge. Öppna kundregister\tests\run.html i en webbläsare i stället." -ForegroundColor Yellow
    $failed = $true
} else {
    $url = ([Uri](Join-Path $root 'kundregister\tests\run.html')).AbsoluteUri
    $profileDir = Join-Path $env:TEMP ("crm-tests-" + [guid]::NewGuid())
    $domFile = Join-Path $env:TEMP ("crm-tests-" + [guid]::NewGuid() + ".html")
    try {
        # --virtual-time-budget låter sidans skript köra klart innan DOM:en skrivs ut; utan den kan Edge ibland bli hängande.
        $proc = Start-Process -FilePath $edge -PassThru -WindowStyle Hidden -RedirectStandardOutput $domFile `
            -ArgumentList @('--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check', "--user-data-dir=`"$profileDir`"", '--virtual-time-budget=5000', '--dump-dom', "`"$url`"")
        if (-not $proc.WaitForExit(60000)) {
            # Stäng Edge och allt den startat (renderare m.m.) om den hänger sig
            & taskkill.exe /PID $proc.Id /T /F | Out-Null
            Write-Host "Edge svarade inte inom 60 sekunder och stängdes." -ForegroundColor Red
        }
        $dom = if (Test-Path $domFile) { Get-Content $domFile -Raw -Encoding UTF8 } else { "" }
    } finally {
        Remove-Item -Recurse -Force $profileDir, $domFile -ErrorAction SilentlyContinue
    }
    $m = [regex]::Match($dom, 'TESTRESULTAT (\{.*?\})</pre>')
    if (-not $m.Success) {
        Write-Host "Fick inget testresultat från Edge (fel i en skriptfil?)." -ForegroundColor Red
        $failed = $true
    } else {
        $r = [System.Net.WebUtility]::HtmlDecode($m.Groups[1].Value) | ConvertFrom-Json
        foreach ($f in $r.failures) { Write-Host "  [FEL] $($f.name)`n        $($f.error)" -ForegroundColor Red }
        $color = if ($r.failed) { 'Red' } else { 'Green' }
        Write-Host "  $($r.passed) godkända, $($r.failed) misslyckade" -ForegroundColor $color
        if ($r.failed) { $failed = $true }
    }
}

Write-Host "`n== PowerShell-skripten (Pester) ==" -ForegroundColor Cyan
# Testerna är skrivna för Pester 3.4, som följer med Windows. GitHubs Windows-maskiner har Pester 5 som standard,
# och den kan inte köra 3.4-syntaxen (Should Be), så versionen väljs uttryckligen.
if (-not (Get-Module -ListAvailable Pester | Where-Object { $_.Version -eq [version]'3.4.0' })) {
    Write-Host "Pester 3.4.0 saknas. Den följer med Windows; på en annan dator: Install-Module Pester -RequiredVersion 3.4.0 -Scope CurrentUser -SkipPublisherCheck" -ForegroundColor Red
    exit 1
}
Import-Module Pester -RequiredVersion 3.4.0 -ErrorAction Stop
$p = Invoke-Pester -Script (Get-ChildItem (Join-Path $root 'tests') -Filter '*.Tests.ps1' | Sort-Object Name | ForEach-Object { $_.FullName }) -PassThru
if ($p.FailedCount -gt 0) { $failed = $true }

Write-Host ""
if ($failed) { Write-Host "Några tester misslyckades." -ForegroundColor Red; exit 1 }
Write-Host "Alla tester gick igenom." -ForegroundColor Green
exit 0
