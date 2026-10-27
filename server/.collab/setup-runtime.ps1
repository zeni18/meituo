param([Parameter(Mandatory=$true)][string]$RuntimePackage,[int]$DbPort=3311)
. (Join-Path $PSScriptRoot 'common.ps1')
$repo = Split-Path -Parent $PSScriptRoot
$local = Join-Path $PSScriptRoot 'local'
$roleFile = Join-Path $local 'machine.json'
if (!(Test-Path -LiteralPath $roleFile)) { throw 'Run setup-machine.ps1 first.' }
$role = (Get-Content -LiteralPath $roleFile -Raw -Encoding UTF8 | ConvertFrom-Json).role
if ($role -notin @('primary','secondary') -or $DbPort -lt 3310 -or $DbPort -gt 65535) { throw 'Invalid role or isolated database port.' }
if (Test-Path -LiteralPath (Join-Path $repo '.env')) { throw 'An .env already exists. Refusing to overwrite machine credentials.' }
if (Get-NetTCPConnection -LocalPort $DbPort -State Listen -ErrorAction SilentlyContinue) { throw "Database port $DbPort is occupied; choose another port >=3310." }
$package = (Resolve-Path -LiteralPath $RuntimePackage).Path
$manifestPath = Join-Path $package 'SHA256SUMS.json'
if (!(Test-Path -LiteralPath $manifestPath)) { throw 'Runtime package is missing its checksum manifest.' }
$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
foreach($entry in $manifest){
    $entryPath = [IO.Path]::GetFullPath((Join-Path $package $entry.path))
    if (!$entryPath.StartsWith($package.TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe runtime package path.' }
    if (!(Test-Path -LiteralPath $entryPath) -or (Get-FileHash -LiteralPath $entryPath -Algorithm SHA256).Hash -ne $entry.sha256) { throw ('Runtime checksum mismatch: '+$entry.path) }
}
$runtimePath = Join-Path $PSScriptRoot 'runtime'
if (Test-Path -LiteralPath $runtimePath) { throw 'Runtime folder already exists. Inspect the previous installation first.' }
Copy-Item -LiteralPath $package -Destination $runtimePath -Recurse
$php = Join-Path $runtimePath 'php/php.exe'
$maria = Join-Path $runtimePath 'mariadb'
$data = Join-Path $local ("mysql-$DbPort")
$dbConfig = Join-Path $local 'mysql.ini'
$password = [Guid]::NewGuid().ToString('N')+[Guid]::NewGuid().ToString('N')
$salt = [Guid]::NewGuid().ToString('N')
$phpExt = (Join-Path $runtimePath 'php/ext').Replace('\','/')
$phpConfig = @"
[PHP]
extension_dir="$phpExt"
extension=curl
extension=fileinfo
extension=mbstring
extension=mysqli
extension=pdo_mysql
extension=openssl
extension=intl
extension=exif
extension=sodium
date.timezone=Asia/Singapore
memory_limit=512M
display_errors=Off
log_errors=On
"@
[IO.File]::WriteAllText((Join-Path $runtimePath 'php/php.ini'),$phpConfig,[Text.UTF8Encoding]::new($false))
& $php -r "if (!extension_loaded('pdo_mysql')) exit(1); echo PHP_VERSION, PHP_EOL;"
if ($LASTEXITCODE -ne 0) { throw 'Portable PHP cannot run. Install the official Microsoft Visual C++ 2015-2022 x64 runtime if its DLLs are missing.' }
$dbInitArgs=@(('"--datadir='+$data+'"'),("--password=$password"),("--port=$DbPort"))
$dbInit=Start-Process -FilePath (Join-Path $maria 'bin/mariadb-install-db.exe') -ArgumentList $dbInitArgs -WorkingDirectory $maria -RedirectStandardOutput (Join-Path $local 'db-init.stdout.log') -RedirectStandardError (Join-Path $local 'db-init.stderr.log') -WindowStyle Hidden -Wait -PassThru
if ($dbInit.ExitCode -ne 0) { throw 'Could not initialize the NEW isolated database directory. Read .collab/local/db-init.*.log.' }
$mariaPath=$maria.Replace('\','/');$dataPath=$data.Replace('\','/');$logFile=(Join-Path $local 'mariadb.log').Replace('\','/')
$dbText = @"
[mysqld]
basedir=$mariaPath
datadir=$dataPath
port=$DbPort
bind-address=127.0.0.1
character-set-server=utf8mb4
collation-server=utf8mb4_unicode_ci
max_allowed_packet=128M
innodb_buffer_pool_size=128M
log-error=$logFile
"@
[IO.File]::WriteAllText($dbConfig,$dbText,[Text.UTF8Encoding]::new($false))
$envText = @"
APP_DEBUG = false
[APP]
DEFAULT_TIMEZONE = Asia/Singapore
[DATABASE]
TYPE = mysql
HOSTNAME = 127.0.0.1
DATABASE = aigc_dev_${role}_${DbPort}
USERNAME = root
PASSWORD = $password
HOSTPORT = $DbPort
CHARSET = utf8mb4
PREFIX = la_
[PROJECT]
UNIQUE_IDENTIFICATION = $salt
DEFAULT_PASSWORD = $password
HTTP_HOST = localhost
DEMO_ENV = false
[CACHE]
DRIVER = file
"@
[IO.File]::WriteAllText((Join-Path $repo '.env'),$envText,[Text.UTF8Encoding]::new($false))
$runtime = @{php=$php;dbBinary=(Join-Path $maria 'bin/mysqld.exe');dbConfig=$dbConfig;dbPort=$DbPort}
$runtime | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $local 'runtime.json') -Encoding UTF8
Start-Process -FilePath $runtime.dbBinary -ArgumentList ('--defaults-file="'+$dbConfig+'"') -WorkingDirectory $local -WindowStyle Hidden | Out-Null
$ready=$false
for($attempt=0;$attempt -lt 40;$attempt++) { if(Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort $DbPort -State Listen -ErrorAction SilentlyContinue){$ready=$true;break}; Start-Sleep -Milliseconds 500 }
if(!$ready){throw 'Database did not start. Read .collab/local/mariadb.log.'}
& $php (Join-Path $PSScriptRoot 'init-dev.php')
if($LASTEXITCODE -ne 0){throw 'Seed initialization failed. Existing database contents will not be overwritten on retry.'}
Write-Output 'Isolated runtime ready. Start with .collab/start-web.ps1 and read .collab/local/accounts.txt locally.'
