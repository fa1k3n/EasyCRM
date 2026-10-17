# Pester-tester för tools\deploy.ps1: kontrollen av ett varumärke och publiceringsmappen.
# Varumärkena byggs från exempel\ i $TestDrive, så att inga riktiga filer ändras. Varje körning startar Edge,
# så testerna tar några sekunder var. -SkipRepoTests används eftersom repots tester (där den här filen ingår)
# annars skulle köra sig själva.
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$script = Join-Path $root 'tools\deploy.ps1'
$utf8 = New-Object Text.UTF8Encoding $false

# Ett varumärke i $TestDrive: exemplets brand.json, ändrad av $change (som får texten och returnerar ny text), och loggan
function New-Brand([string]$name, [scriptblock]$change = { param($t) $t }) {
    $dir = Join-Path $TestDrive $name
    New-Item -ItemType Directory -Force $dir | Out-Null
    $text = & $change ([IO.File]::ReadAllText((Join-Path $root 'exempel\brand.json'), $utf8))
    [IO.File]::WriteAllText((Join-Path $dir 'brand.json'), $text, $utf8)
    Copy-Item (Join-Path $root 'exempel\logo.svg') $dir
    return $dir
}
function Invoke-Deploy([string]$brand, [string]$out) {
    # Edge skriver loggrader på stderr; de ska inte räknas som fel
    $ErrorActionPreference = 'Continue'
    $text = & powershell -NoProfile -ExecutionPolicy Bypass -File $script -Brand $brand -OutDir $out -SkipRepoTests 2>$null | Out-String
    return @{ Code = $LASTEXITCODE; Output = $text }
}
function Set-Field([string]$text, [string]$from, [string]$to) { $text.Replace($from, $to) }

Describe 'tools\deploy.ps1' {
    Context 'exempelvarumärket i repot (exempel\)' {
        $out = Join-Path $TestDrive 'ut-exempel'
        $r = Invoke-Deploy (Join-Path $root 'exempel') $out

        It 'godkänns och avslutar med kod 0' { $r.Code | Should Be 0 }
        It 'skriver index.html, logic.js, brand.js och loggan' {
            foreach ($f in 'index.html', 'logic.js', 'brand.js', 'logo.svg') { Test-Path (Join-Path $out $f) | Should Be $true }
        }
        It 'tar inte med något mailtillägg' { Test-Path (Join-Path $out 'mail.js') | Should Be $false }
        It 'index.html och logic.js är repots filer' {
            [IO.File]::ReadAllText((Join-Path $out 'index.html')) | Should Be ([IO.File]::ReadAllText((Join-Path $root 'kundregister\index.html')))
            [IO.File]::ReadAllText((Join-Path $out 'logic.js')) | Should Be ([IO.File]::ReadAllText((Join-Path $root 'kundregister\logic.js')))
        }
        It 'brand.js sätter window.BRAND till brand.json' {
            $js = [IO.File]::ReadAllText((Join-Path $out 'brand.js'), $utf8)
            $js.StartsWith('window.BRAND = {') | Should Be $true
            $js | Should Match 'Exempelstudion AB'
        }
        It 'skriver inget i exempel\' { Test-Path (Join-Path $root 'exempel\publicera') | Should Be $false }
    }

    Context 'brand.json saknas' {
        $dir = Join-Path $TestDrive 'tom'
        New-Item -ItemType Directory -Force $dir | Out-Null
        $out = Join-Path $TestDrive 'ut-tom'
        $r = Invoke-Deploy $dir $out
        It 'avslutar med kod 1 och säger vad som saknas' { $r.Code | Should Be 1; $r.Output | Should Match 'brand\.json' }
        It 'skriver ingen publiceringsmapp' { Test-Path $out | Should Be $false }
    }

    Context 'trasiga varumärken stoppas med ett tydligt fel' {
        $cases = @(
            @{ Name = 'ogiltig JSON'; Change = { param($t) $t.TrimEnd().TrimEnd('}') + ',}' }; Match = 'JSON' },
            @{ Name = 'företagsnamn saknas'; Change = { param($t) Set-Field $t '"company": {"name": "Exempelstudion AB"}' '"company": {}' }; Match = 'company\.name' },
            @{ Name = 'ogiltig färg'; Change = { param($t) Set-Field $t '"accent": "#0f766e"' '"accent": "grön"' }; Match = 'colors\.accent' },
            @{ Name = 'för låg kontrast'; Change = { param($t) Set-Field $t '"ink": "#1f2933"' '"ink": "#d0d4d4"' }; Match = 'kontrast' },
            @{ Name = 'kundtyp-id som inte är unikt'; Change = { param($t) Set-Field $t '"id": "projekt"' '"id": "konsultation"' }; Match = 'unikt' },
            @{ Name = 'kundtyp med okänd avsändare'; Change = { param($t) Set-Field $t '"icon": "stjarna"}' '"icon": "stjarna", "sender": "finns-inte"}' }; Match = 'finns-inte' },
            @{ Name = 'loggan finns inte'; Change = { param($t) Set-Field $t '"logo": "logo.svg"' '"logo": "saknas.png"' }; Match = 'saknas\.png' }
        )
        foreach ($c in $cases) {
            $dir = New-Brand ('fel-' + [array]::IndexOf($cases, $c)) $c.Change
            $out = Join-Path $dir 'ut'
            $r = Invoke-Deploy $dir $out
            It "$($c.Name): kod 1, felet namnges och ingen publiceringsmapp skrivs" {
                $r.Code | Should Be 1
                $r.Output | Should Match $c.Match
                Test-Path $out | Should Be $false
            }
        }
    }

    Context 'en bild större än 1 MB' {
        $dir = New-Brand 'stor-bild'
        [IO.File]::WriteAllBytes((Join-Path $dir 'stor.png'), (New-Object byte[] (1MB + 1)))
        $r = Invoke-Deploy $dir (Join-Path $dir 'ut')
        It 'stoppas och bilden namnges' { $r.Code | Should Be 1; $r.Output | Should Match 'stor\.png'; $r.Output | Should Match '1 MB' }
    }

    Context 'mailtillägg' {
        $dir = New-Brand 'mail-js'
        New-Item -ItemType Directory -Force (Join-Path $dir 'mail') | Out-Null
        [IO.File]::WriteAllText((Join-Path $dir 'mail\mail.js'), "window.CRM_MAIL = {};`n", $utf8)
        $out = Join-Path $dir 'ut'
        $r = Invoke-Deploy $dir $out
        It 'en färdig mail\mail.js tas med' { $r.Code | Should Be 0; [IO.File]::ReadAllText((Join-Path $out 'mail.js')) | Should Be "window.CRM_MAIL = {};`n" }

        $stale = New-Brand 'mail-gammal'
        $staleOut = Join-Path $stale 'ut'
        New-Item -ItemType Directory -Force $staleOut | Out-Null
        [IO.File]::WriteAllText((Join-Path $staleOut 'mail.js'), "// från en tidigare körning`n", $utf8)
        $before = Test-Path (Join-Path $staleOut 'mail.js')
        $r2 = Invoke-Deploy $stale $staleOut
        It 'en mail.js från en tidigare körning tas bort när tillägget inte finns längre' { $before | Should Be $true; $r2.Code | Should Be 0; Test-Path (Join-Path $staleOut 'mail.js') | Should Be $false }
    }

    Context 'mailtillägg i TypeScript (mail\tsconfig.json)' {
        $dir = New-Brand 'mail-ts'
        $mail = Join-Path $dir 'mail'
        New-Item -ItemType Directory -Force $mail | Out-Null
        [IO.File]::WriteAllText((Join-Path $mail 'tsconfig.json'), '{"compilerOptions":{"target":"ES2020","strict":true,"noEmitOnError":true},"files":["mail.ts","mail-api.d.ts"]}', $utf8)
        [IO.File]::WriteAllText((Join-Path $mail 'mail.ts'), "const mod: CrmMailModule | undefined = undefined;`n", $utf8)
        $out = Join-Path $dir 'ut'
        $r = Invoke-Deploy $dir $out
        It 'byggs mot kontraktet i repot och tas med' {
            $r.Code | Should Be 0
            Test-Path (Join-Path $mail 'mail-api.d.ts') | Should Be $true
            [IO.File]::ReadAllText((Join-Path $out 'mail.js')) | Should Match 'const mod = undefined'
        }

        $bad = New-Brand 'mail-ts-fel'
        New-Item -ItemType Directory -Force (Join-Path $bad 'mail') | Out-Null
        [IO.File]::WriteAllText((Join-Path $bad 'mail\tsconfig.json'), '{"compilerOptions":{"target":"ES2020","strict":true,"noEmitOnError":true},"files":["mail.ts"]}', $utf8)
        [IO.File]::WriteAllText((Join-Path $bad 'mail\mail.ts'), "const a: number = 'inte ett tal';`n", $utf8)
        $rb = Invoke-Deploy $bad (Join-Path $bad 'ut')
        It 'ett typfel stoppar publiceringen' { $rb.Code | Should Be 1; $rb.Output | Should Match 'mail'; Test-Path (Join-Path $bad 'ut') | Should Be $false }
    }

    Context 'varumärkets egna tester (run-tests.ps1 i varumärkesmappen)' {
        $ok = New-Brand 'tester-ok'
        [IO.File]::WriteAllText((Join-Path $ok 'run-tests.ps1'), "param([string]`$Repo)`n[IO.File]::WriteAllText((Join-Path `$PSScriptRoot 'repo.txt'), `$Repo)`nexit 0`n", $utf8)
        $r = Invoke-Deploy $ok (Join-Path $ok 'ut')
        It 'körs med -Repo och en lyckad körning godkänns' {
            $r.Code | Should Be 0
            [IO.File]::ReadAllText((Join-Path $ok 'repo.txt')).TrimEnd('\') | Should Be $root.TrimEnd('\')
        }

        $bad = New-Brand 'tester-fel'
        [IO.File]::WriteAllText((Join-Path $bad 'run-tests.ps1'), "exit 1`n", $utf8)
        $rb = Invoke-Deploy $bad (Join-Path $bad 'ut')
        It 'ett misslyckat test stoppar publiceringen' { $rb.Code | Should Be 1; $rb.Output | Should Match 'tester'; Test-Path (Join-Path $bad 'ut') | Should Be $false }
    }

    Context 'publiceringsmappen' {
        $dir = New-Brand 'mapp'
        $out = Join-Path $dir 'ut'
        New-Item -ItemType Directory -Force $out | Out-Null
        [IO.File]::WriteAllText((Join-Path $out 'anteckningar.txt'), 'mitt', $utf8)
        $r = Invoke-Deploy $dir $out
        It 'en mapp med andra filer än deploy skriver används inte, och filerna lämnas orörda' {
            $r.Code | Should Be 1
            $r.Output | Should Match 'anteckningar\.txt'
            [IO.File]::ReadAllText((Join-Path $out 'anteckningar.txt')) | Should Be 'mitt'
            Test-Path (Join-Path $out 'index.html') | Should Be $false
        }

        $dir2 = New-Brand 'standardmapp'
        $r2 = & { $ErrorActionPreference = 'Continue'; & powershell -NoProfile -ExecutionPolicy Bypass -File $script -Brand $dir2 -SkipRepoTests 2>$null | Out-Null; $LASTEXITCODE }
        It 'utan -OutDir skrivs den till publicera\ i varumärkesmappen' { $r2 | Should Be 0; Test-Path (Join-Path $dir2 'publicera\brand.js') | Should Be $true }
    }

    # Utan -Brand används varumarke\ i repots rot. Körs i en tillfällig kopia av det deploy behöver,
    # så att repots egen rot aldrig får en varumarke\.
    Context 'utan -Brand' {
        function New-RepoCopy([string]$name) {
            $dir = Join-Path $TestDrive $name
            New-Item -ItemType Directory -Force (Join-Path $dir 'tools'), (Join-Path $dir 'kundregister') | Out-Null
            Copy-Item $script (Join-Path $dir 'tools')
            Copy-Item (Join-Path $root 'kundregister\index.html'), (Join-Path $root 'kundregister\logic.js'), (Join-Path $root 'kundregister\mail-api.d.ts') (Join-Path $dir 'kundregister')
            Copy-Item (Join-Path $root 'exempel') (Join-Path $dir 'exempel') -Recurse
            return $dir
        }
        $med = New-RepoCopy 'repo-med'
        Copy-Item (Join-Path $med 'exempel') (Join-Path $med 'varumarke') -Recurse
        $ErrorActionPreference = 'Continue'
        $rMed = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $med 'tools\deploy.ps1') -SkipRepoTests 2>$null | Out-String
        $codeMed = $LASTEXITCODE
        It 'används varumarke\ i repots rot, och publiceringsmappen blir varumarke\publicera' {
            $codeMed | Should Be 0
            [IO.File]::ReadAllText((Join-Path $med 'varumarke\publicera\brand.js'), $utf8) | Should Match 'Exempelstudion AB'
        }

        $utan = New-RepoCopy 'repo-utan'
        $rUtan = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $utan 'tools\deploy.ps1') -SkipRepoTests 2>$null | Out-String
        $codeUtan = $LASTEXITCODE
        It 'saknas varumarke\ blir det kod 1 och ett fel som säger hur den skapas från exempel' {
            $codeUtan | Should Be 1
            $rUtan | Should Match 'varumarke'
            $rUtan | Should Match 'exempel'
        }
    }
}
