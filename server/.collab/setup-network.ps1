. (Join-Path $PSScriptRoot 'common.ps1')
$roleFile=Join-Path $PSScriptRoot 'local/machine.json'
if(!(Test-Path -LiteralPath $roleFile)){throw 'Set up this machine role first.'}
$role=(Get-Content -LiteralPath $roleFile -Raw -Encoding UTF8|ConvertFrom-Json).role
if($role -notin @('primary','secondary')){throw 'Invalid role.'}
$ts=Join-Path $env:ProgramFiles 'Tailscale/tailscale.exe'
if(!(Test-Path -LiteralPath $ts)){
    if(!(Get-Command winget -ErrorAction SilentlyContinue)){throw 'Install Tailscale from https://tailscale.com/download/windows then rerun.'}
    & winget install --id Tailscale.Tailscale --exact --source winget --silent --accept-source-agreements --accept-package-agreements --disable-interactivity
    if($LASTEXITCODE -ne 0 -or !(Test-Path -LiteralPath $ts)){throw 'Tailscale installation failed. Use the official Windows installer, then rerun.'}
}
$state=& $ts status --json|ConvertFrom-Json
if($state.BackendState -ne 'Running'){
    & $ts up ("--hostname=meituo-dev-$role") --unattended=true --timeout=30s
    $state=& $ts status --json|ConvertFrom-Json
    if($state.BackendState -ne 'Running'){
        Write-Output 'Finish the sign-in URL shown above with the same private network account on BOTH PCs, then rerun this script.'
        exit 2
    }
}
Write-Output ('Private IP: '+($state.TailscaleIPs -join ', '))
Write-Output 'Only your own trusted devices should join this development network. Web preview sharing is still off until share-preview.ps1 is run.'
