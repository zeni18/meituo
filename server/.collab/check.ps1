. (Join-Path $PSScriptRoot 'common.ps1')
$failed=$false
foreach($file in Get-ChildItem -LiteralPath $PSScriptRoot -Filter '*.ps1'){
    $tokens=$null;$parseErrors=$null
    [Management.Automation.Language.Parser]::ParseFile($file.FullName,[ref]$tokens,[ref]$parseErrors)|Out-Null
    if($parseErrors){$failed=$true;$parseErrors|ForEach-Object{Write-Output ($file.Name+': '+$_.Message)}}
}
foreach($file in Get-ChildItem -LiteralPath $PSScriptRoot -Filter '*.cjs'){
    & node --check $file.FullName
    if($LASTEXITCODE -ne 0){$failed=$true}
}
$root=Split-Path -Parent $PSScriptRoot
& node (Join-Path $PSScriptRoot 'audit-secrets.cjs') $root
if($LASTEXITCODE -ne 0){$failed=$true}
if($failed){throw 'Collaboration checks failed.'}
Write-Output 'PowerShell parsing, Node syntax and tracked-file audit passed. This does not replace app-specific tests or QA.'
