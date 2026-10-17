# Bygger en lokal förhandsvisning av kundregistret med påhittade exempelkunder (inga riktiga data).
# Användning: powershell -NoProfile -ExecutionPolicy Bypass -File tools\preview.ps1 [-OutDir <mapp>] [-Brand <mapp med brand.json>]
# Utan -Brand används varumarke\ i repots rot om den finns, annars standardvarumärket (exempelföretaget i logic.js).
# Öppna sedan <OutDir>\preview.html i webbläsaren.
param([string]$OutDir = (Join-Path $env:TEMP 'crm-preview'), [string]$Brand = '')
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
if (-not $Brand -and (Test-Path -LiteralPath (Join-Path $root 'varumarke\brand.json'))) { $Brand = Join-Path $root 'varumarke' }
New-Item -ItemType Directory -Force $OutDir | Out-Null
$utf8 = New-Object Text.UTF8Encoding $false
$page = [IO.File]::ReadAllText((Join-Path $root 'kundregister\index.html'), $utf8)
$html = "<!doctype html><html lang=`"sv`"><head><meta charset=`"utf-8`"><meta name=`"viewport`" content=`"width=device-width,initial-scale=1,viewport-fit=cover`">" +
        "<style>body{margin:0}[hidden]{display:none!important}</style>" +
        "<script src=`"preview-stub.js`"></script></head><body>`n" + $page + "`n</body></html>"
[IO.File]::WriteAllText((Join-Path $OutDir 'preview.html'), $html, $utf8)
Copy-Item (Join-Path $root 'kundregister\logic.js') $OutDir -Force
Copy-Item (Join-Path $root 'tools\preview-stub.js') $OutDir -Force
Copy-Item (Join-Path $root 'kundregister\logo.svg') $OutDir -Force
$brandJs = Join-Path $OutDir 'brand.js'
if ($Brand) {
    # Varumärket blir brand.js (window.BRAND), precis som vid publicering; bilderna kopieras bredvid
    $json = [IO.File]::ReadAllText((Join-Path $Brand 'brand.json'), $utf8)
    [IO.File]::WriteAllText($brandJs, "window.BRAND = $json;`n", $utf8)
    Get-ChildItem $Brand -File | Where-Object { $_.Extension -in '.png', '.svg', '.jpg', '.jpeg', '.webp' } | Copy-Item -Destination $OutDir -Force
    # Valfritt mailtillägg (mail\mail.js, byggt från mail.ts) följer med, precis som vid publicering
    $mailJs = Join-Path $Brand 'mail\mail.js'
    if (Test-Path $mailJs) { Copy-Item $mailJs $OutDir -Force } elseif (Test-Path (Join-Path $OutDir 'mail.js')) { [IO.File]::Delete((Join-Path $OutDir 'mail.js')) }
} else { foreach ($old in 'brand.js', 'mail.js') { $p = Join-Path $OutDir $old; if (Test-Path $p) { [IO.File]::Delete($p) } } }
Write-Host (Join-Path $OutDir 'preview.html')
