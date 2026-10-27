param([int]$DbPort=3311,[int]$WebPort=8090)
. (Join-Path $PSScriptRoot 'common.ps1')
$local=Join-Path $PSScriptRoot 'local'
$downloads=Join-Path $local 'downloads'
if(Test-Path -LiteralPath (Join-Path (Split-Path -Parent $PSScriptRoot) '.env')){throw 'This machine is already configured. Use start-web.ps1 instead of provisioning again.'}
New-Item -ItemType Directory -Path $downloads -Force|Out-Null
$zip=Join-Path $downloads 'meituo-windows-runtime.zip'
$checksum=$zip+'.sha256'
& gh release download dev-runtime-20261022 --repo yfl117/meituo-ai-marketing --pattern meituo-windows-runtime.zip --pattern meituo-windows-runtime.zip.sha256 --dir $downloads --clobber
if($LASTEXITCODE -ne 0){throw 'Private runtime download failed. Check gh auth status and repository access.'}
$expected=(Get-Content -LiteralPath $checksum -Raw).Trim().Split(' ')[0]
if($expected -notmatch '^[a-fA-F0-9]{64}$' -or (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash -ne $expected){throw 'Archive checksum mismatch; do not use this download.'}
$expanded=Join-Path $downloads ('runtime-'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
Expand-Archive -LiteralPath $zip -DestinationPath $expanded
& (Join-Path $PSScriptRoot 'setup-runtime.ps1') -RuntimePackage $expanded -DbPort $DbPort
& (Join-Path $PSScriptRoot 'start-web.ps1') -Port $WebPort
