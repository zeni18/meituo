param(
    [ValidateSet('status','begin','publish','pull','push')][string]$Action = 'status',
    [string]$Task
)
. (Join-Path $PSScriptRoot 'common.ps1')
$repo = Get-RepoRoot

if ($Action -eq 'status') {
    Invoke-Git -Repo $repo -Arguments @('status','--short','--branch') | Out-Host
    exit 0
}

# Task remains accepted for older callers; syncing never creates a branch.
Assert-Clean $repo
$branch = (Invoke-Git -Repo $repo -Arguments @('branch','--show-current')).Trim()
if (!$branch) { throw 'Detached HEAD. Choose the intended branch before syncing; no files were changed.' }

Invoke-Git -Repo $repo -Arguments @('fetch','origin','--prune') | Out-Host
$remoteRef = 'refs/remotes/origin/' + $branch
& git -C $repo show-ref --verify --quiet $remoteRef
$remoteCheck = $LASTEXITCODE
if ($remoteCheck -notin @(0,1)) { throw 'Could not inspect the fetched remote branch; no local changes were discarded.' }
$remoteExists = $remoteCheck -eq 0

if ($Action -in @('begin','pull')) {
    if (!$remoteExists) { throw "No origin/$branch branch exists. Publish this branch first or choose the intended branch; local commits are preserved." }
    Invoke-Git -Repo $repo -Arguments @('pull','--ff-only','origin',$branch) | Out-Host
    Write-Output "Updated current branch: $branch"
    exit 0
}

if ($remoteExists) {
    & git -C $repo merge-base --is-ancestor $remoteRef HEAD
    $ancestorCheck = $LASTEXITCODE
    if ($ancestorCheck -eq 1) { throw 'The remote has commits missing locally. Pull and compare first; nothing was pushed or discarded.' }
    if ($ancestorCheck -ne 0) { throw 'Could not compare local and remote commits; nothing was pushed.' }
}

& node (Join-Path $PSScriptRoot 'audit-secrets.cjs') $repo
if ($LASTEXITCODE -ne 0) { throw 'Credential/file audit failed. Review findings before publishing.' }
Invoke-Git -Repo $repo -Arguments @('push','--set-upstream','origin',('HEAD:refs/heads/' + $branch)) | Out-Host
Write-Output "Published current branch: $branch"
