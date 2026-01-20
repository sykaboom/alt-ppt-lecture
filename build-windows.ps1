$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
Set-Location $root
$projectPath = Join-Path $root "desktop\AltPptPlayer\AltPptPlayer.csproj"
if (-not (Test-Path $projectPath)) {
    Write-Error "Project not found: $projectPath"
}

$dotnet = Get-Command dotnet -ErrorAction SilentlyContinue
if (-not $dotnet) {
    Write-Error "dotnet not found. Install .NET SDK 6+ and try again."
}
$sdkList = & dotnet --list-sdks 2>$null
if (-not $sdkList) {
    throw "No .NET SDKs found. Install .NET SDK 6+ and try again."
}

$distRoot = Join-Path $root "dist"
$distDir = Join-Path $distRoot "AltPptPlayer"
if (Test-Path $distRoot) {
    Remove-Item -Recurse -Force $distRoot
}
New-Item -ItemType Directory -Path $distRoot | Out-Null

Write-Host "Building AltPptPlayer..."
$runtime = "win-x64"
$selfContained = $true
$singleFile = $true
$enableCompression = $true
dotnet publish $projectPath -c Release -r $runtime --self-contained $selfContained `
    -p:PublishSingleFile=$singleFile `
    -p:IncludeAllContentForSelfExtract=true `
    -p:IncludeNativeLibrariesForSelfExtract=true `
    -p:EnableCompressionInSingleFile=$enableCompression `
    -p:DebugType=None `
    -p:DebugSymbols=false `
    -o $distDir
if ($LASTEXITCODE -ne 0) {
    throw "dotnet publish failed with exit code $LASTEXITCODE."
}

Write-Host "Build complete. Output: $distDir"
