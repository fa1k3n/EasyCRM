# Pester-tester för tools\tsc.ps1 (TypeScript-bygget i Edge). Körs i en tillfällig kopia av projektet i $TestDrive,
# så att de riktiga filerna aldrig ändras. Varje bygge startar Edge, så testerna tar några sekunder var.
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

function New-BuildCopy([string]$dir) {
    New-Item -ItemType Directory -Force (Join-Path $dir 'tools'), (Join-Path $dir 'kundregister') | Out-Null
    Copy-Item (Join-Path $root 'tools\tsc.ps1'), (Join-Path $root 'tools\tsc-build.html') (Join-Path $dir 'tools')
    Copy-Item (Join-Path $root 'tools\typescript-6.0.3') (Join-Path $dir 'tools') -Recurse
    Copy-Item (Join-Path $root 'kundregister\logic.ts'), (Join-Path $root 'kundregister\tsconfig.json') (Join-Path $dir 'kundregister')
    [IO.File]::WriteAllText((Join-Path $dir 'kundregister\logic.js'), "// gammal logic.js`n", (New-Object Text.UTF8Encoding $false))
}
function Invoke-Build([string]$dir) {
    # Edge skriver loggrader på stderr; de ska inte räknas som fel även när anroparen kör med ErrorActionPreference Stop
    $ErrorActionPreference = 'Continue'
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $dir 'tools\tsc.ps1') 2>$null | Out-Null
    return $LASTEXITCODE
}

Describe 'tools\tsc.ps1' {
    Context 'utan typfel' {
        $dir = Join-Path $TestDrive 'ok'
        New-BuildCopy $dir
        $code = Invoke-Build $dir
        $js = [IO.File]::ReadAllText((Join-Path $dir 'kundregister\logic.js'))

        It 'avslutar med kod 0' { $code | Should Be 0 }
        It 'skriver logic.js från logic.ts' { $js | Should Match 'CRMLogic' }
        It 'tar bort typerna ur den byggda koden' { $js | Should Not Match 'interface Customer' }
    }

    Context '-Project bygger en annan mapp (t.ex. ett mailtillägg)' {
        $dir = Join-Path $TestDrive 'proj'
        New-BuildCopy $dir
        $extra = Join-Path $TestDrive 'tillagg'
        New-Item -ItemType Directory -Force $extra | Out-Null
        [IO.File]::WriteAllText((Join-Path $extra 'tsconfig.json'), '{"compilerOptions":{"target":"ES2020","strict":true,"noEmitOnError":true},"files":["a.ts","b.ts"]}', (New-Object Text.UTF8Encoding $false))
        [IO.File]::WriteAllText((Join-Path $extra 'a.ts'), "const a: number = 1;`n", (New-Object Text.UTF8Encoding $false))
        [IO.File]::WriteAllText((Join-Path $extra 'b.ts'), "const b: string = 'b';`n", (New-Object Text.UTF8Encoding $false))
        $ErrorActionPreference = 'Continue'
        & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $dir 'tools\tsc.ps1') -Project $extra 2>$null | Out-Null
        $code = $LASTEXITCODE

        It 'avslutar med kod 0' { $code | Should Be 0 }
        It 'skriver alla byggda filer i den mappen' { (Test-Path (Join-Path $extra 'a.js')) -and (Test-Path (Join-Path $extra 'b.js')) | Should Be $true }
        It 'rör inte kundregistrets logic.js' { [IO.File]::ReadAllText((Join-Path $dir 'kundregister\logic.js')) | Should Be "// gammal logic.js`n" }
    }

    Context '-Project med typfel' {
        $dir = Join-Path $TestDrive 'projfel'
        New-BuildCopy $dir
        $extra = Join-Path $TestDrive 'tillaggfel'
        New-Item -ItemType Directory -Force $extra | Out-Null
        [IO.File]::WriteAllText((Join-Path $extra 'tsconfig.json'), '{"compilerOptions":{"target":"ES2020","strict":true,"noEmitOnError":true},"files":["a.ts"]}', (New-Object Text.UTF8Encoding $false))
        [IO.File]::WriteAllText((Join-Path $extra 'a.ts'), "const a: number = 'inte ett tal';`n", (New-Object Text.UTF8Encoding $false))
        $ErrorActionPreference = 'Continue'
        & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $dir 'tools\tsc.ps1') -Project $extra 2>$null | Out-Null
        $code = $LASTEXITCODE

        It 'avslutar med kod 1 och skriver ingen fil' { $code | Should Be 1; Test-Path (Join-Path $extra 'a.js') | Should Be $false }
    }

    Context 'med typfel' {
        $dir = Join-Path $TestDrive 'fel'
        New-BuildCopy $dir
        $ts = Join-Path $dir 'kundregister\logic.ts'
        $text = [IO.File]::ReadAllText($ts) -replace "  'use strict';", "  'use strict';`n  const fel: number = 'inte ett tal';"
        [IO.File]::WriteAllText($ts, $text, (New-Object Text.UTF8Encoding $false))
        $code = Invoke-Build $dir

        It 'avslutar med kod 1' { $code | Should Be 1 }
        It 'lämnar logic.js orörd' { [IO.File]::ReadAllText((Join-Path $dir 'kundregister\logic.js')) | Should Be "// gammal logic.js`n" }
    }
}
