$ErrorActionPreference = 'Stop'
function Invoke-Git {
    param([string[]]$Arguments, [string]$Repo = (Get-Location).Path)
    $result = & git -C $Repo @Arguments
    if ($LASTEXITCODE -ne 0) { throw ('Git failed: ' + ($Arguments -join ' ')) }
    return $result
}
function Get-RepoRoot {
    $root = (& git rev-parse --show-toplevel 2>$null)
    if ($LASTEXITCODE -ne 0) { throw 'Run this command inside the collaboration repository.' }
    return $root.Trim()
}
function Assert-Clean([string]$Repo) {
    if (Invoke-Git -Repo $Repo -Arguments @('status','--porcelain')) { throw 'Working tree has changes. Commit named files or preserve them before switching tasks.' }
}
function Get-Tailscale {
    $ts = Join-Path $env:ProgramFiles 'Tailscale\tailscale.exe'
    if (!(Test-Path -LiteralPath $ts)) { throw 'Install Tailscale and join the same private network on both PCs.' }
    return $ts
}
