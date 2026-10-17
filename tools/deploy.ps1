# Kontrollerar ett varumärke och sätter ihop en publiceringsmapp för kundregistret.
# Användning: powershell -NoProfile -ExecutionPolicy Bypass -File tools\deploy.ps1 [-Brand <mapp med brand.json>] [-OutDir <mapp>]
#   Utan -Brand används varumarke\ i repots rot (ignoreras av git; skapas med  Copy-Item exempel varumarke -Recurse ).
#   1. brand.json kontrolleras med appens egen kontroll (validateBrand) i Edge: giltig JSON, obligatoriska fält, färger,
#      kontrast (WCAG AA 4.5:1), unika kundtyp-id och att varje avsändare som en kundtyp pekar på finns.
#   2. Bilderna i varumärkesmappen (png, svg, jpg, jpeg, webp) får vara högst 1 MB, och loggan måste finnas.
#   3. Ett mailtillägg i TypeScript (mail\tsconfig.json) byggs mot kontraktet kundregister\mail-api.d.ts; en färdig mail\mail.js tas annars med som den är.
#   4. Varumärkets egna tester (run-tests.ps1 i varumärkesmappen, anropas med -Repo <repot>) och repots tester (run-tests.ps1) körs.
#   5. Publiceringsmappen (standard: <varumärkesmappen>\publicera) får index.html, logic.js, brand.js, bilderna och eventuell mail.js.
# -SkipRepoTests hoppar över repots tester (används av tests\deploy.Tests.ps1, som själv ingår i repots tester).
# Avslutningskod 0 = publiceringsmappen är klar, 1 = något fel (då skrivs ingenting).
param([string]$Brand = '', [string]$OutDir = '', [switch]$SkipRepoTests)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$utf8 = New-Object Text.UTF8Encoding $false
$images = '.png', '.svg', '.jpg', '.jpeg', '.webp'
$maxImage = 1MB

function Stop-Deploy([string[]]$errors) {
    Write-Host "Publiceringsmappen skrevs inte:" -ForegroundColor Red
    foreach ($e in $errors) { Write-Host "  [FEL] $e" -ForegroundColor Red }
    exit 1
}
# Kör ett PowerShell-skript i en egen process och returnerar avslutningskoden
function Invoke-Child([string]$file, [string[]]$arguments = @()) {
    $ErrorActionPreference = 'Continue'
    & powershell -NoProfile -ExecutionPolicy Bypass -File $file @arguments | Out-Host
    return $LASTEXITCODE
}

# ---------- Mappar ----------
if (-not $Brand) {
    $Brand = Join-Path $root 'varumarke'
    if (-not (Test-Path -LiteralPath $Brand -PathType Container)) {
        Stop-Deploy "Mappen varumarke\ saknas i $root. Skapa den från exemplet och fyll i brand.json: Copy-Item exempel varumarke -Recurse (eller ange -Brand <mapp>)."
    }
}
if (-not (Test-Path -LiteralPath $Brand -PathType Container)) { Stop-Deploy "Varumärkesmappen finns inte: $Brand" }
$brandDir = (Resolve-Path -LiteralPath $Brand).Path
$brandFile = Join-Path $brandDir 'brand.json'
if (-not (Test-Path -LiteralPath $brandFile)) { Stop-Deploy "Hittar inte brand.json i $brandDir (kopiera exempel\brand.json och fyll i)" }
if (-not $OutDir) { $OutDir = Join-Path $brandDir 'publicera' }
$out = [IO.Path]::GetFullPath($OutDir)
# Publiceringsmappen töms före varje körning, så den får bara innehålla filer som deploy själv skriver
$published = 'index.html', 'logic.js', 'brand.js', 'mail.js'
if (Test-Path -LiteralPath $out) {
    $foreign = @(Get-ChildItem -LiteralPath $out -Force | Where-Object { $_.PSIsContainer -or -not ($published -contains $_.Name -or $images -contains $_.Extension.ToLower()) })
    if ($foreign.Count) { Stop-Deploy ("Publiceringsmappen $out innehåller annat än det deploy skriver (" + (($foreign | ForEach-Object Name) -join ', ') + "). Välj en annan mapp med -OutDir.") }
}
Write-Host "== Varumärke: $brandDir ==" -ForegroundColor Cyan

# ---------- 1. brand.json kontrolleras med appens egen logik i Edge ----------
$edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { Stop-Deploy "Hittar inte Microsoft Edge, som behövs för kontrollen av brand.json." }
$brandText = [IO.File]::ReadAllText($brandFile, $utf8)
$tmp = Join-Path $env:TEMP ("crm-deploy-" + [guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Force $tmp | Out-Null
try {
    Copy-Item (Join-Path $root 'kundregister\logic.js') $tmp
    # Texten läggs in som en JS-sträng och tolkas med JSON.parse, så att bara giltig JSON godkänns
    [IO.File]::WriteAllText((Join-Path $tmp 'brand-text.js'), "window.BRAND_TEXT = $(ConvertTo-Json -InputObject $brandText);`n", $utf8)
    $check = @'
const L = window.CRMLogic, r = {errors: [], logo: ''};
let b = null;
try { b = JSON.parse(window.BRAND_TEXT); } catch (e) { r.errors.push('brand.json är inte giltig JSON: ' + e.message); }
if (b !== null && (typeof b !== 'object' || Array.isArray(b))) r.errors.push('brand.json måste vara ett objekt ({ ... })');
else if (b) {
  r.errors.push(...L.validateBrand(b));
  // Kontrasten: appen visar ändå varumärket, men vid publicering räknas för låg kontrast som fel
  if (b.colors) { try { r.errors.push(...L.deriveColors(b.colors).warnings); } catch (e) { /* ogiltig färg rapporteras redan av validateBrand */ } }
  const ids = Array.isArray(b.senders) ? b.senders.map(s => s && s.id) : [];
  if (Array.isArray(b.customerTypes)) b.customerTypes.forEach((t, i) => { if (t && t.sender && !ids.includes(t.sender)) r.errors.push(`customerTypes[${i}].sender "${t.sender}" finns inte bland senders`); });
  r.logo = typeof b.logo === 'string' ? b.logo : '';
}
const pre = document.createElement('pre'); pre.textContent = 'KONTROLL ' + JSON.stringify(r) + ' SLUT'; document.body.appendChild(pre);
'@
    [IO.File]::WriteAllText((Join-Path $tmp 'check.js'), $check, $utf8)
    [IO.File]::WriteAllText((Join-Path $tmp 'check.html'), "<!doctype html><meta charset=`"utf-8`"><body>`n<script src=`"logic.js`"></script>`n<script src=`"brand-text.js`"></script>`n<script src=`"check.js`"></script>`n", $utf8)
    $dom = Join-Path $tmp 'dom.html'
    $proc = Start-Process -FilePath $edge -PassThru -WindowStyle Hidden -RedirectStandardOutput $dom `
        -ArgumentList @('--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--allow-file-access-from-files',
                        "--user-data-dir=`"$tmp\profile`"", '--virtual-time-budget=5000', '--dump-dom', "`"$(([Uri](Join-Path $tmp 'check.html')).AbsoluteUri)`"")
    # Edge blir ibland hängande efter att ha skrivit ut sidan, så resultatet läses så fort det finns och Edge stängs då.
    # Get-Content, eftersom Edge har filen öppen för skrivning medan den kör.
    $html = ''
    $clock = [Diagnostics.Stopwatch]::StartNew()
    while ($clock.Elapsed.TotalSeconds -lt 60) {
        $done = $proc.WaitForExit(200)
        $html = if (Test-Path $dom) { Get-Content $dom -Raw -Encoding UTF8 } else { '' }
        if ($done -or $html -match ' SLUT') { break }
    }
    # Edge och dess hjälpprocesser stängs; taskkill skriver på stderr om processen hann avsluta själv, vilket inte är ett fel
    if (-not $proc.HasExited) { & { $ErrorActionPreference = 'Continue'; & taskkill.exe /PID $proc.Id /T /F 2>$null | Out-Null }; [void]$proc.WaitForExit(5000) }
} finally {
    Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}
$m = [regex]::Match($html, 'KONTROLL (\{.*?\}) SLUT', 'Singleline')
if (-not $m.Success) { Stop-Deploy "Fick inget resultat från kontrollen av brand.json i Edge." }
$result = [Net.WebUtility]::HtmlDecode($m.Groups[1].Value) | ConvertFrom-Json
$errors = @($result.errors)

# ---------- 2. Bilderna ----------
$imageFiles = @(Get-ChildItem -LiteralPath $brandDir -File | Where-Object { $images -contains $_.Extension.ToLower() })
foreach ($f in $imageFiles) { if ($f.Length -gt $maxImage) { $errors += "Bilden $($f.Name) är större än 1 MB ($([math]::Round($f.Length / 1MB, 1)) MB)" } }
if ($result.logo -and $result.logo -notmatch '^https://' -and -not (Test-Path -LiteralPath (Join-Path $brandDir $result.logo))) { $errors += "Loggan $($result.logo) finns inte i $brandDir" }
if ($errors.Count) { Stop-Deploy $errors }
Write-Host "  brand.json och bilderna är godkända." -ForegroundColor Green

# ---------- 3. Mailtillägget ----------
$mailDir = Join-Path $brandDir 'mail'
if (Test-Path -LiteralPath (Join-Path $mailDir 'tsconfig.json')) {
    Write-Host "== Mailtillägget (mail\) ==" -ForegroundColor Cyan
    Copy-Item (Join-Path $root 'kundregister\mail-api.d.ts') $mailDir -Force
    if ((Invoke-Child (Join-Path $root 'tools\tsc.ps1') @('-Project', $mailDir)) -ne 0) { Stop-Deploy "Mailtillägget i $mailDir kunde inte byggas (se typfelen ovan)." }
    if (-not (Test-Path -LiteralPath (Join-Path $mailDir 'mail.js'))) { Stop-Deploy "Mailtillägget byggdes men gav ingen mail\mail.js (heter källfilen mail.ts?)." }
}
$mailJs = Join-Path $mailDir 'mail.js'
$hasMail = Test-Path -LiteralPath $mailJs

# ---------- 4. Tester ----------
$brandTests = Join-Path $brandDir 'run-tests.ps1'
if (Test-Path -LiteralPath $brandTests) {
    Write-Host "== Varumärkets tester (run-tests.ps1) ==" -ForegroundColor Cyan
    if ((Invoke-Child $brandTests @('-Repo', $root)) -ne 0) { Stop-Deploy "Varumärkets tester i $brandTests misslyckades." }
}
if ($SkipRepoTests) { Write-Host "  Repots tester hoppades över (-SkipRepoTests)." -ForegroundColor Yellow }
else {
    Write-Host "== Repots tester (run-tests.ps1) ==" -ForegroundColor Cyan
    if ((Invoke-Child (Join-Path $root 'run-tests.ps1')) -ne 0) { Stop-Deploy "Repots tester misslyckades." }
}

# ---------- 5. Publiceringsmappen ----------
New-Item -ItemType Directory -Force $out | Out-Null
Get-ChildItem -LiteralPath $out -File -Force | ForEach-Object { $_.Delete() }
Copy-Item (Join-Path $root 'kundregister\index.html'), (Join-Path $root 'kundregister\logic.js') $out
[IO.File]::WriteAllText((Join-Path $out 'brand.js'), "window.BRAND = $($brandText.Trim());`n", $utf8)
foreach ($f in $imageFiles) { Copy-Item -LiteralPath $f.FullName $out }
if ($hasMail) { Copy-Item -LiteralPath $mailJs $out }
$files = @(Get-ChildItem -LiteralPath $out -File | Sort-Object Name | ForEach-Object Name)
Write-Host "`nPubliceringsmappen är klar: $out" -ForegroundColor Green
Write-Host "  Sidan: index.html. Extra filer: $(($files | Where-Object { $_ -ne 'index.html' }) -join ', ')"
Write-Host "  Be Claude publicera index.html som artifact med de extra filerna bredvid (se README.txt, Kom igång)."
exit 0
