param(
    [Parameter(Mandatory=$true)][ValidateSet('primary','secondary')][string]$Role,
    [string]$Destination = 'D:\meituo-dev\project',
    [string]$RepoUrl = 'https://github.com/yfl117/meituo-ai-marketing.git',
    [switch]$ProvisionRuntime
)
. (Join-Path $PSScriptRoot 'common.ps1')
foreach ($tool in @('git','gh','node')) { if (!(Get-Command $tool -ErrorAction SilentlyContinue)) { throw "Missing $tool. Install Git.Git, GitHub.cli and OpenJS.NodeJS.LTS using winget, then open a new PowerShell." } }
& gh auth status 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    & gh auth login --hostname github.com --git-protocol https --web --skip-ssh-key
    if ($LASTEXITCODE -ne 0) { throw 'Complete GitHub authorization and rerun.' }
}
$repoName = ($RepoUrl -replace '^https://github.com/','' -replace '\.git$','')
$info = & gh repo view $repoName --json isPrivate,isEmpty | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or !$info.isPrivate -or $info.isEmpty) { throw 'Expected a non-empty private GitHub repository.' }
if (Test-Path -LiteralPath $Destination) { throw "Destination exists; choose a NEW directory: $Destination" }
New-Item -ItemType Directory -Path (Split-Path -Parent $Destination) -Force | Out-Null
& gh auth setup-git --hostname github.com
if ($LASTEXITCODE -ne 0) { throw 'Git credential helper setup failed.' }
Invoke-Git -Repo (Get-Location).Path -Arguments @('clone','--', $RepoUrl,$Destination) | Out-Host
Invoke-Git -Repo $Destination -Arguments @('config','core.hooksPath','.collab/hooks') | Out-Null
Invoke-Git -Repo $Destination -Arguments @('config','pull.ff','only') | Out-Null
Invoke-Git -Repo $Destination -Arguments @('config','push.default','current') | Out-Null
Invoke-Git -Repo $Destination -Arguments @('config','fetch.prune','true') | Out-Null
$login = (& gh api user --jq .login).Trim()
if ($LASTEXITCODE -ne 0) { throw 'GitHub account lookup failed.' }
Invoke-Git -Repo $Destination -Arguments @('config','user.name',$login) | Out-Null
Invoke-Git -Repo $Destination -Arguments @('config','user.email',($login+'@users.noreply.github.com')) | Out-Null
$taskBranch = 'dev/'+$Role+'/initial-'+(Get-Date -Format 'yyyyMMdd-HHmmss')
Invoke-Git -Repo $Destination -Arguments @('switch','-c',$taskBranch,'origin/main') | Out-Host
$local = Join-Path $Destination '.collab/local'
New-Item -ItemType Directory -Path $local -Force | Out-Null
@{ role=$Role; repository=$RepoName; machine=$env:COMPUTERNAME; webPort=8090 } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $local 'machine.json') -Encoding UTF8
Write-Output "Code ready: $Destination"
Write-Output "Role: $Role; branch: $taskBranch"
Write-Output 'Next: read .collab/README.md; install the portable development runtime and initialize a separate local database.'
if($ProvisionRuntime){
    $dbPort=3311; $webPort=8090
    if($Role -eq 'secondary'){$dbPort=3312;$webPort=8091}
    & (Join-Path $Destination '.collab/provision-runtime.ps1') -DbPort $dbPort -WebPort $webPort
}
