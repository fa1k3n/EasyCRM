# Bygger TypeScript med TypeScript 6.0.3 i Edge (Node kan inte installeras på datorn).
# Standard: kundregister\logic.ts -> kundregister\logic.js. Med -Project byggs en annan mapp med tsconfig.json (t.ex. ett privat mailtillägg).
# Användning: powershell -NoProfile -ExecutionPolicy Bypass -File tools\tsc.ps1 [-Project <mapp med tsconfig.json>]
# Avslutningskod 0 = typkontrollen gick igenom och de byggda .js-filerna är uppdaterade, 1 = typfel eller byggfel (inga filer skrivs).
param([string]$Project = '')
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$proj = if ($Project) { (Resolve-Path -LiteralPath $Project).Path } else { Join-Path $root 'kundregister' }

$edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") |
    Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { Write-Host "Hittar inte Microsoft Edge, som behövs för att köra TypeScript-kompilatorn." -ForegroundColor Red; exit 1 }

$projUrl = ([Uri]($proj + '\')).AbsoluteUri
$page = ([Uri](Join-Path $root 'tools\tsc-build.html')).AbsoluteUri + '?dir=' + [Uri]::EscapeDataString($projUrl)
$profileDir = Join-Path $env:TEMP ("crm-tsc-" + [guid]::NewGuid())
$domFile = Join-Path $env:TEMP ("crm-tsc-" + [guid]::NewGuid() + ".html")
try {
    $proc = Start-Process -FilePath $edge -PassThru -WindowStyle Hidden -RedirectStandardOutput $domFile `
        -ArgumentList @('--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--allow-file-access-from-files',
                        "--user-data-dir=`"$profileDir`"", '--virtual-time-budget=10000', '--dump-dom', "`"$page`"")
    if (-not $proc.WaitForExit(120000)) {
        & taskkill.exe /PID $proc.Id /T /F | Out-Null
        Write-Host "Edge svarade inte inom 120 sekunder och stängdes." -ForegroundColor Red
    }
    $dom = if (Test-Path $domFile) { Get-Content $domFile -Raw -Encoding UTF8 } else { "" }
} finally {
    Remove-Item -Recurse -Force $profileDir, $domFile -ErrorAction SilentlyContinue
}

$m = [regex]::Match($dom, 'TSRESULT (\S+) END')
if (-not $m.Success) { Write-Host "Fick inget resultat från TypeScript-kompilatorn i Edge." -ForegroundColor Red; exit 1 }
$r = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($m.Groups[1].Value)) | ConvertFrom-Json
if (-not $r.ok) {
    Write-Host "TypeScript $($r.version): typkontrollen misslyckades i $proj, inga filer är uppdaterade." -ForegroundColor Red
    Write-Host $r.diagnostics
    exit 1
}
$names = @($r.files.PSObject.Properties.Name)
if (-not $names.Count) { Write-Host "Kompilatorn skrev inga filer." -ForegroundColor Red; exit 1 }
foreach ($name in $names) {
    $js = $r.files.$name
    $target = Join-Path $proj $name
    # Git på Windows kan ha skrivit filen med CRLF; jämför därför oberoende av radslut
    $old = if (Test-Path $target) { [IO.File]::ReadAllText($target) -replace "`r`n", "`n" } else { "" }
    if ($old -ne $js) {
        [IO.File]::WriteAllText($target, $js, (New-Object Text.UTF8Encoding $false))
        Write-Host "  TypeScript $($r.version): inga typfel, $name uppdaterad." -ForegroundColor Green
    } else {
        Write-Host "  TypeScript $($r.version): inga typfel, $name redan aktuell." -ForegroundColor Green
    }
}
exit 0
