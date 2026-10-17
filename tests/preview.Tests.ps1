# Pester-tester för tools\preview.ps1: vilket varumärke förhandsvisningen använder utan -Brand.
# Körs i en tillfällig kopia av det förhandsvisningen behöver, så att repots egen rot aldrig får en varumarke\.
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$utf8 = New-Object Text.UTF8Encoding $false

function New-RepoCopy([string]$name) {
    $dir = Join-Path $TestDrive $name
    New-Item -ItemType Directory -Force (Join-Path $dir 'tools'), (Join-Path $dir 'kundregister') | Out-Null
    Copy-Item (Join-Path $root 'tools\preview.ps1'), (Join-Path $root 'tools\preview-stub.js') (Join-Path $dir 'tools')
    Copy-Item (Join-Path $root 'kundregister\index.html'), (Join-Path $root 'kundregister\logic.js'), (Join-Path $root 'kundregister\logo.svg') (Join-Path $dir 'kundregister')
    return $dir
}
function Invoke-Preview([string]$repo, [string]$out) {
    $ErrorActionPreference = 'Continue'
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repo 'tools\preview.ps1') -OutDir $out 2>$null | Out-Null
    return $LASTEXITCODE
}

Describe 'tools\preview.ps1 utan -Brand' {
    Context 'med varumarke\ i repots rot' {
        $repo = New-RepoCopy 'med'
        New-Item -ItemType Directory -Force (Join-Path $repo 'varumarke') | Out-Null
        [IO.File]::WriteAllText((Join-Path $repo 'varumarke\brand.json'), '{"company": {"name": "Provbolaget AB"}}', $utf8)
        $out = Join-Path $TestDrive 'med-ut'
        $code = Invoke-Preview $repo $out
        It 'använder varumarke\ (brand.js sätts från dess brand.json)' {
            $code | Should Be 0
            [IO.File]::ReadAllText((Join-Path $out 'brand.js'), $utf8) | Should Match 'Provbolaget AB'
        }
    }

    Context 'utan varumarke\' {
        $repo = New-RepoCopy 'utan'
        $out = Join-Path $TestDrive 'utan-ut'
        $code = Invoke-Preview $repo $out
        It 'visar exempelföretaget (ingen brand.js)' { $code | Should Be 0; Test-Path (Join-Path $out 'brand.js') | Should Be $false; Test-Path (Join-Path $out 'preview.html') | Should Be $true }
    }
}
