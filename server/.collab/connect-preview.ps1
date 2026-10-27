param([Parameter(Mandatory=$true)][string]$Peer,[int]$PrivatePort=18090,[int]$LocalPort=18091)
. (Join-Path $PSScriptRoot 'common.ps1')
$ts = Get-Tailscale
$state = & $ts status --json | ConvertFrom-Json
if ($state.BackendState -ne 'Running') { throw 'Sign in to the same Tailscale private network first.' }
if ($Peer -notmatch '^100\.(?:\d{1,3}\.){2}\d{1,3}$|^[a-zA-Z0-9][a-zA-Z0-9.-]+$') { throw 'Use a Tailscale IPv4 address or device DNS name.' }
Write-Output "Peer login page: http://localhost:$LocalPort/login ; Ctrl+C closes the tunnel."
& node (Join-Path $PSScriptRoot 'tcp-forward.cjs') $Peer $PrivatePort $LocalPort
if ($LASTEXITCODE -ne 0) { throw 'Preview tunnel stopped with an error.' }
