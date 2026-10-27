param([int]$LocalPort=8090,[int]$PrivatePort=18090,[switch]$Stop)
. (Join-Path $PSScriptRoot 'common.ps1')
$ts = Get-Tailscale
if ($Stop) { & $ts serve "--tcp=$PrivatePort" off; if($LASTEXITCODE -ne 0){throw 'Failed to stop preview sharing.'}; exit 0 }
$state = & $ts status --json | ConvertFrom-Json
if ($state.BackendState -ne 'Running') { throw 'Sign in to Tailscale first; both machines must use the same private network.' }
$code = & curl.exe --noproxy '*' -s --max-time 5 -o NUL -w '%{http_code}' "http://127.0.0.1:$LocalPort/login"
if ($code -ne '200') { throw 'Local preview is not healthy.' }
& $ts serve --bg --yes "--tcp=$PrivatePort" "tcp://127.0.0.1:$LocalPort"
if ($LASTEXITCODE -ne 0) { throw 'Private preview could not be enabled.' }
Write-Output 'Preview is available to devices allowed by your tailnet policy. Only join your own trusted devices to this development network.'
Write-Output ('Peer address: '+$state.TailscaleIPs[0]+':'+$PrivatePort)
