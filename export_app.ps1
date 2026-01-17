$out = "app_export.md"
$root = (Get-Location).Path
$appRoot = Join-Path $root 'app'

Set-Content -Path $out -Value '' -Encoding UTF8

$includeExt = @('.ts','.tsx','.js','.jsx','.css','.scss','.json','.md','.yml','.yaml')

function Get-CodeFenceLang {
  param([string]$path)
  $ext = [System.IO.Path]::GetExtension($path).ToLower()
  switch ($ext) {
    '.tsx'  { 'tsx' }
    '.ts'   { 'ts' }
    '.jsx'  { 'jsx' }
    '.js'   { 'js' }
    '.css'  { 'css' }
    '.scss' { 'scss' }
    '.json' { 'json' }
    '.yml'  { 'yaml' }
    '.yaml' { 'yaml' }
    '.md'   { 'markdown' }
    default { '' }
  }
}

$fence = '```'

$files = Get-ChildItem -Path $appRoot -Recurse -File |
  Where-Object { $includeExt -contains $_.Extension.ToLower() } |
  Sort-Object FullName

foreach ($f in $files) {
  $fullPath = $f.FullName
  $relative = 'app\' + $fullPath.Substring($appRoot.Length).TrimStart('\')
  $lang = Get-CodeFenceLang $fullPath

  Add-Content -Path $out -Encoding UTF8 -Value ''
  Add-Content -Path $out -Encoding UTF8 -Value ('## FILE: ' + $relative)
  Add-Content -Path $out -Encoding UTF8 -Value ''
  Add-Content -Path $out -Encoding UTF8 -Value ($fence + $lang)

  try {
    $content = [System.IO.File]::ReadAllText($fullPath, [System.Text.Encoding]::UTF8)
  } catch {
    $content = [System.IO.File]::ReadAllText($fullPath)
  }

  Add-Content -Path $out -Encoding UTF8 -Value $content
  Add-Content -Path $out -Encoding UTF8 -Value ''
  Add-Content -Path $out -Encoding UTF8 -Value $fence
  Add-Content -Path $out -Encoding UTF8 -Value ''
}

Write-Host ('Klaar: ' + $out + ' (' + $files.Count + ' bestanden uit /app)')
