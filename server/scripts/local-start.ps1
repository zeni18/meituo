$ErrorActionPreference = 'Stop'
$repoPath = Split-Path -Parent $PSScriptRoot
$runtimePath = Join-Path $env:USERPROFILE '.codex\local-runtimes\likeadmin-aigc'
$dbBinary = Join-Path $runtimePath 'bin\mariadb-11.4.5-winx64\bin\mysqld.exe'
$dbConfig = Join-Path $runtimePath 'mysql.ini'
$logsPath = Join-Path $repoPath 'runtime\local'
New-Item -ItemType Directory -Path $logsPath -Force | Out-Null
if (-not (Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort 3307 -State Listen -ErrorAction SilentlyContinue)) {
    $dbProcess = Start-Process -FilePath $dbBinary -ArgumentList "--defaults-file=$dbConfig" -WorkingDirectory $runtimePath -WindowStyle Hidden -PassThru
    $dbProcess.Id | Set-Content -LiteralPath (Join-Path $runtimePath 'mysql-process.pid')
}
if (-not (Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort 8090 -State Listen -ErrorAction SilentlyContinue)) {
    $phpArgs = @('-d', 'extension=gd', '-d', 'extension=zip', '-d', 'memory_limit=512M', '-d', 'upload_max_filesize=128M', '-d', 'post_max_size=128M', '-d', 'max_execution_time=120', '-S', '127.0.0.1:8090', '-t', 'public', 'scripts/local-router.php')
    $webProcess = Start-Process -FilePath 'C:\xampp\php\php.exe' -ArgumentList $phpArgs -WorkingDirectory $repoPath -RedirectStandardOutput (Join-Path $logsPath 'web.stdout.log') -RedirectStandardError (Join-Path $logsPath 'web.stderr.log') -WindowStyle Hidden -PassThru
    $webProcess.Id | Set-Content -LiteralPath (Join-Path $logsPath 'web-process.pid')
}
$clipWorkerPidFile = Join-Path $logsPath 'merchant-clip-worker.pid'
$clipWorkerAlive = $false
if (Test-Path -LiteralPath $clipWorkerPidFile) {
    $clipWorkerPidText = (Get-Content -LiteralPath $clipWorkerPidFile -Raw).Trim()
    if ($clipWorkerPidText -match '^\d+$') {
        $clipWorkerInfo = Get-CimInstance Win32_Process -Filter "ProcessId=$clipWorkerPidText" -ErrorAction SilentlyContinue
        $clipWorkerAlive = $clipWorkerInfo -and $clipWorkerInfo.Name -eq 'php.exe' -and $clipWorkerInfo.CommandLine -like '*merchant-clip:work*'
    }
}
if (-not $clipWorkerAlive) {
    $clipWorkerProcess = Start-Process -FilePath 'C:\xampp\php\php.exe' -ArgumentList @('-d', 'extension=gd', '-d', 'extension=zip', 'think', 'merchant-clip:work') -WorkingDirectory $repoPath -RedirectStandardOutput (Join-Path $logsPath 'merchant-clip-worker.stdout.log') -RedirectStandardError (Join-Path $logsPath 'merchant-clip-worker.stderr.log') -WindowStyle Hidden -PassThru
    $clipWorkerProcess.Id | Set-Content -LiteralPath $clipWorkerPidFile
}
$taskWorkerPidFile = Join-Path $logsPath 'merchant-task-worker.pid'
$taskWorkerAlive = $false
if (Test-Path -LiteralPath $taskWorkerPidFile) {
    $taskWorkerPidText = (Get-Content -LiteralPath $taskWorkerPidFile -Raw).Trim()
    if ($taskWorkerPidText -match '^\d+$') {
        $taskWorkerInfo = Get-CimInstance Win32_Process -Filter "ProcessId=$taskWorkerPidText" -ErrorAction SilentlyContinue
        $taskWorkerAlive = $taskWorkerInfo -and $taskWorkerInfo.Name -eq 'php.exe' -and $taskWorkerInfo.CommandLine -like '*merchant-tasks:work*'
    }
}
if (-not $taskWorkerAlive) {
    $taskWorkerProcess = Start-Process -FilePath 'C:\xampp\php\php.exe' -ArgumentList @('-d', 'extension=gd', '-d', 'extension=zip', 'think', 'merchant-tasks:work') -WorkingDirectory $repoPath -RedirectStandardOutput (Join-Path $logsPath 'merchant-task-worker.stdout.log') -RedirectStandardError (Join-Path $logsPath 'merchant-task-worker.stderr.log') -WindowStyle Hidden -PassThru
    $taskWorkerProcess.Id | Set-Content -LiteralPath $taskWorkerPidFile
}
$pressWorkerPidFile = Join-Path $logsPath 'media-press-worker.pid'
$pressWorkerAlive = $false
if (Test-Path -LiteralPath $pressWorkerPidFile) {
    $pressWorkerPidText = (Get-Content -LiteralPath $pressWorkerPidFile -Raw).Trim()
    if ($pressWorkerPidText -match '^\d+$') {
        $pressWorkerInfo = Get-CimInstance Win32_Process -Filter "ProcessId=$pressWorkerPidText" -ErrorAction SilentlyContinue
        $pressWorkerAlive = $pressWorkerInfo -and $pressWorkerInfo.Name -eq 'php.exe' -and $pressWorkerInfo.CommandLine -like '*media-press:work*'
    }
}
if (-not $pressWorkerAlive) {
    $pressWorkerProcess = Start-Process -FilePath 'C:\xampp\php\php.exe' -ArgumentList @('-d', 'extension=gd', '-d', 'extension=zip', 'think', 'media-press:work') -WorkingDirectory $repoPath -RedirectStandardOutput (Join-Path $logsPath 'media-press-worker.stdout.log') -RedirectStandardError (Join-Path $logsPath 'media-press-worker.stderr.log') -WindowStyle Hidden -PassThru
    $pressWorkerProcess.Id | Set-Content -LiteralPath $pressWorkerPidFile
}
$geoWorkerPidFile = Join-Path $logsPath 'merchant-geo-worker.pid'
$geoWorkerAlive = $false
if (Test-Path -LiteralPath $geoWorkerPidFile) {
    $geoWorkerPidText = (Get-Content -LiteralPath $geoWorkerPidFile -Raw).Trim()
    if ($geoWorkerPidText -match '^\d+$') {
        $geoWorkerInfo = Get-CimInstance Win32_Process -Filter "ProcessId=$geoWorkerPidText" -ErrorAction SilentlyContinue
        $geoWorkerAlive = $geoWorkerInfo -and $geoWorkerInfo.Name -eq 'php.exe' -and $geoWorkerInfo.CommandLine -like '*merchant-geo:work*'
    }
}
if (-not $geoWorkerAlive) {
    $geoWorkerProcess = Start-Process -FilePath 'C:\xampp\php\php.exe' -ArgumentList @('-d', 'extension=gd', '-d', 'extension=zip', 'think', 'merchant-geo:work') -WorkingDirectory $repoPath -RedirectStandardOutput (Join-Path $logsPath 'merchant-geo-worker.stdout.log') -RedirectStandardError (Join-Path $logsPath 'merchant-geo-worker.stderr.log') -WindowStyle Hidden -PassThru
    $geoWorkerProcess.Id | Set-Content -LiteralPath $geoWorkerPidFile
}
$pressSyncPidFile = Join-Path $logsPath 'media-press-sync.pid'
$pressSyncAlive = $false
if (Test-Path -LiteralPath $pressSyncPidFile) {
    $pressSyncPidText = (Get-Content -LiteralPath $pressSyncPidFile -Raw).Trim()
    if ($pressSyncPidText -match '^\d+$') {
        $pressSyncInfo = Get-CimInstance Win32_Process -Filter "ProcessId=$pressSyncPidText" -ErrorAction SilentlyContinue
        $pressSyncAlive = $pressSyncInfo -and $pressSyncInfo.Name -eq 'php.exe' -and $pressSyncInfo.CommandLine -like '*media-press:sync --work*'
    }
}
if (-not $pressSyncAlive) {
    $pressSyncProcess = Start-Process -FilePath 'C:\xampp\php\php.exe' -ArgumentList @('think', 'media-press:sync', '--work') -WorkingDirectory $repoPath -RedirectStandardOutput (Join-Path $logsPath 'media-press-sync.stdout.log') -RedirectStandardError (Join-Path $logsPath 'media-press-sync.stderr.log') -WindowStyle Hidden -PassThru
    $pressSyncProcess.Id | Set-Content -LiteralPath $pressSyncPidFile
}
Write-Output 'Media resource sync worker: media-press:sync --work'
Write-Output 'GEO worker: merchant-geo:work (capabilities disabled until configured)'
Write-Output 'Media press worker: media-press:work (provider disabled until configured)'
Write-Output 'Employee task worker: merchant-tasks:work'
Write-Output 'New clip worker: merchant-clip:work'
Write-Output 'Platform: http://127.0.0.1:8090/platform/'
Write-Output 'Tenant:   http://localhost:8090/admin/'
Write-Output 'Frontend: http://localhost:8090/'

$automationPidFile = Join-Path $logsPath 'merchant-automation-worker.pid'
$automationAlive = $false
if (Test-Path -LiteralPath $automationPidFile) {
    $automationPidText = (Get-Content -LiteralPath $automationPidFile -Raw).Trim()
    if ($automationPidText -match '^\d+$') {
        $automationInfo = Get-CimInstance Win32_Process -Filter "ProcessId=$automationPidText" -ErrorAction SilentlyContinue
        $automationAlive = $automationInfo -and $automationInfo.Name -eq 'php.exe' -and $automationInfo.CommandLine -like '*merchant-automation:work*'
    }
}
if (-not $automationAlive) {
    $automationProcess = Start-Process -FilePath 'C:\xampp\php\php.exe' -ArgumentList @('think', 'merchant-automation:work') -WorkingDirectory $repoPath -RedirectStandardOutput (Join-Path $logsPath 'merchant-automation-worker.stdout.log') -RedirectStandardError (Join-Path $logsPath 'merchant-automation-worker.stderr.log') -WindowStyle Hidden -PassThru
    $automationProcess.Id | Set-Content -LiteralPath $automationPidFile
}
Write-Output 'Automation worker: merchant-automation:work (only explicitly enabled plans run)'
