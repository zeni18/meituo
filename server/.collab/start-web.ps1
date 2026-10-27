param([int]$Port=8090, [switch]$Stop)
. (Join-Path $PSScriptRoot 'common.ps1')
$repo = Split-Path -Parent $PSScriptRoot
$local = Join-Path $PSScriptRoot 'local'
New-Item -ItemType Directory -Path $local -Force | Out-Null
$config = Join-Path $local 'runtime.json'
if (!(Test-Path -LiteralPath $config)) { throw 'Run setup-runtime.ps1 first. This web launcher never starts job workers.' }
$runtime = Get-Content -LiteralPath $config -Raw -Encoding UTF8 | ConvertFrom-Json
$pidFile = Join-Path $local "web-$Port.pid"
if ($Stop) {
    if (Test-Path -LiteralPath $pidFile) {
        $webPid = [int](Get-Content -LiteralPath $pidFile -Raw)
        $web = Get-CimInstance Win32_Process -Filter "ProcessId=$webPid" -ErrorAction SilentlyContinue
        if ($web -and $web.Name -eq 'php.exe' -and $web.CommandLine -like "*127.0.0.1:$Port*" -and $web.CommandLine -like '*local-router.php*') { Stop-Process -Id $webPid }
    }
    exit 0
}
if (!(Test-Path -LiteralPath (Join-Path $repo '.env'))) { throw 'Missing machine-specific .env.' }
if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) { throw "Port $Port is already occupied. Inspect its owner or choose another port." }
$dbConnection = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort $runtime.dbPort -State Listen -ErrorAction SilentlyContinue
if (!$dbConnection) {
    Start-Process -FilePath $runtime.dbBinary -ArgumentList ('--defaults-file="'+$runtime.dbConfig+'"') -WorkingDirectory (Split-Path -Parent $runtime.dbConfig) -WindowStyle Hidden | Out-Null
    $ready=$false
    for($attempt=0;$attempt -lt 30;$attempt++) {
        if (Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort $runtime.dbPort -State Listen -ErrorAction SilentlyContinue) { $ready=$true; break }
        Start-Sleep -Milliseconds 500
    }
    if (!$ready) { throw 'Local database did not start. Read .collab/local/mariadb.log.' }
}
$router = Join-Path $repo 'scripts/local-router.php'
$publicPath = Join-Path $repo 'public'
$webArgs = @('-d','extension=gd','-d','extension=zip','-d','memory_limit=512M','-d','upload_max_filesize=128M','-d','post_max_size=128M','-S',"127.0.0.1:$Port",'-t',('"'+$publicPath+'"'),('"'+$router+'"'))
$process = Start-Process -FilePath $runtime.php -ArgumentList $webArgs -WorkingDirectory $repo -RedirectStandardOutput (Join-Path $local "web-$Port.stdout.log") -RedirectStandardError (Join-Path $local "web-$Port.stderr.log") -WindowStyle Hidden -PassThru
$process.Id | Set-Content -LiteralPath $pidFile
$healthy=$false
for($attempt=0;$attempt -lt 20;$attempt++) {
    $code = & curl.exe --noproxy '*' -s --max-time 3 -o NUL -w '%{http_code}' "http://localhost:$Port/login"
    if ($code -eq '200') { $healthy=$true; break }
    Start-Sleep -Milliseconds 300
}
if (!$healthy) { throw 'Login page is not healthy. Read the local web error log.' }
Write-Output "Healthy: http://localhost:$Port/login"
Write-Output 'No AI, publishing, collection or sync workers were started.'
