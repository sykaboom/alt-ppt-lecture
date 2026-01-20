$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$templatePath = Join-Path $root "web-src/player.html"
$cssPath = Join-Path $root "web-src/styles/main.css"
$orderPath = Join-Path $root "web-src/order.txt"
$outDir = Join-Path $root "web-dist"
$outPlayer = Join-Path $outDir "player.html"

if (-not (Test-Path $templatePath)) {
    throw "Template not found: $templatePath"
}
if (-not (Test-Path $cssPath)) {
    throw "CSS not found: $cssPath"
}
if (-not (Test-Path $orderPath)) {
    throw "Script order not found: $orderPath"
}

$css = Get-Content $cssPath -Raw -Encoding UTF8
$scriptList = Get-Content $orderPath -Encoding UTF8 | Where-Object { $_ -and -not $_.StartsWith("#") }
$scriptPaths = @()
foreach ($entry in $scriptList) {
    $path = Join-Path $root (Join-Path "web-src" $entry)
    if (-not (Test-Path $path)) {
        throw "Script not found: $path"
    }
    $scriptPaths += $path
}

$scriptParts = @()
foreach ($path in $scriptPaths) {
    $scriptParts += Get-Content $path -Raw -Encoding UTF8
}
$js = $scriptParts -join "`n"

$template = Get-Content $templatePath -Raw -Encoding UTF8
if ($template -notmatch "\/\* @inline-style \*\/") {
    throw "Missing style placeholder in template."
}
if ($template -notmatch "\/\* @inline-script \*\/") {
    throw "Missing script placeholder in template."
}

$rendered = $template.Replace("/* @inline-style */", $css.TrimEnd())
$rendered = $rendered.Replace("/* @inline-script */", $js.TrimEnd())

if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir | Out-Null
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($outPlayer, $rendered, $utf8NoBom)

Write-Host "Built player.html -> $outPlayer"
