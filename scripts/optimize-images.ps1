param(
  [string]$ImagesDir = "Images",
  [string]$ManifestPath = "images.json",
  [string]$BackupDir = "Images-backup",
  [int]$SingleLongEdge = 2400,
  [int]$SpreadLongEdge = 3600,
  [int]$CoverLongEdge = 2800,
  [int]$JpegQuality = 82,
  [int]$SkipBelowBytes = 1200000
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

function Get-JpegEncoder {
  return [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
    Where-Object { $_.MimeType -eq "image/jpeg" } |
    Select-Object -First 1
}

function Save-Jpeg {
  param(
    [System.Drawing.Image]$Image,
    [string]$Path,
    [int]$Quality
  )

  $encoder = Get-JpegEncoder
  $qualityEncoder = [System.Drawing.Imaging.Encoder]::Quality
  $encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
  $encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter($qualityEncoder, [long]$Quality)

  try {
    $Image.Save($Path, $encoder, $encoderParams)
  }
  finally {
    $encoderParams.Dispose()
  }
}

function Get-TargetLongEdge {
  param(
    [string]$Name,
    [System.Collections.Generic.HashSet[string]]$SpreadFiles
  )

  if ($Name -ieq "Cover.jpg") {
    return $CoverLongEdge
  }

  if ($Name -ieq "inside cover.JPG") {
    return $SpreadLongEdge
  }

  if ($SpreadFiles.Contains($Name.ToLowerInvariant())) {
    return $SpreadLongEdge
  }

  return $SingleLongEdge
}

function Add-SpreadFiles {
  param(
    [object]$Node,
    [System.Collections.Generic.HashSet[string]]$Set
  )

  if ($null -eq $Node) {
    return
  }

  if ($Node -is [string]) {
    return
  }

  if ($Node -is [System.Collections.IEnumerable] -and -not ($Node -is [System.Collections.IDictionary])) {
    foreach ($item in $Node) {
      Add-SpreadFiles -Node $item -Set $Set
    }
    return
  }

  if ($Node.PSObject.Properties.Name -contains "spread") {
    $spreadSpec = $Node.spread
    if ($spreadSpec -is [string]) {
      [void]$Set.Add($spreadSpec.ToLowerInvariant())
    }
    elseif ($spreadSpec -and $spreadSpec.file) {
      [void]$Set.Add($spreadSpec.file.ToLowerInvariant())
    }
  }
}

if (-not (Test-Path -LiteralPath $ImagesDir)) {
  throw "Images directory not found: $ImagesDir"
}

if (-not (Test-Path -LiteralPath $ManifestPath)) {
  throw "Manifest not found: $ManifestPath"
}

$manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
$spreadFiles = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
Add-SpreadFiles -Node $manifest -Set $spreadFiles

if (-not (Test-Path -LiteralPath $BackupDir)) {
  New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

$beforeTotal = 0L
$afterTotal = 0L
$processed = @()

$files = Get-ChildItem -LiteralPath $ImagesDir -File | Where-Object {
  $_.Extension -match '^\.(jpe?g)$'
}

foreach ($file in $files) {
  $beforeTotal += $file.Length

  $targetLongEdge = Get-TargetLongEdge -Name $file.Name -SpreadFiles $spreadFiles
  $backupPath = Join-Path $BackupDir $file.Name

  if (-not (Test-Path -LiteralPath $backupPath)) {
    Copy-Item -LiteralPath $file.FullName -Destination $backupPath
  }

  $bytes = [System.IO.File]::ReadAllBytes($file.FullName)
  $stream = New-Object System.IO.MemoryStream(,$bytes)
  $image = [System.Drawing.Image]::FromStream($stream)

  try {
    $longEdge = [Math]::Max($image.Width, $image.Height)
    $shouldResize = $longEdge -gt $targetLongEdge
    $shouldReencode = $file.Length -gt $SkipBelowBytes

    if (-not $shouldResize -and -not $shouldReencode) {
      $afterTotal += $file.Length
      continue
    }

    if ($shouldResize) {
      if ($image.Width -ge $image.Height) {
        $newWidth = $targetLongEdge
        $newHeight = [int][Math]::Round(($image.Height * $targetLongEdge) / $image.Width)
      }
      else {
        $newHeight = $targetLongEdge
        $newWidth = [int][Math]::Round(($image.Width * $targetLongEdge) / $image.Height)
      }
    }
    else {
      $newWidth = $image.Width
      $newHeight = $image.Height
    }

    $bitmap = New-Object System.Drawing.Bitmap($newWidth, $newHeight)
    $bitmap.SetResolution(72, 72)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)

    try {
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
      $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
      $graphics.DrawImage($image, 0, 0, $newWidth, $newHeight)
    }
    finally {
      $graphics.Dispose()
    }

    $tempPath = "$($file.FullName).tmp"

    try {
      Save-Jpeg -Image $bitmap -Path $tempPath -Quality $JpegQuality
      Remove-Item -LiteralPath $file.FullName -Force
      Move-Item -LiteralPath $tempPath -Destination $file.FullName
    }
    finally {
      if (Test-Path -LiteralPath $tempPath) {
        Remove-Item -LiteralPath $tempPath -Force
      }
      $bitmap.Dispose()
    }

    $updatedFile = Get-Item -LiteralPath $file.FullName
    $afterTotal += $updatedFile.Length

    $processed += [PSCustomObject]@{
      Name = $file.Name
      BeforeKB = [Math]::Round($file.Length / 1KB)
      AfterKB = [Math]::Round($updatedFile.Length / 1KB)
      Width = $newWidth
      Height = $newHeight
      Target = $targetLongEdge
    }
  }
  finally {
    $image.Dispose()
    $stream.Dispose()
  }
}

$savedMB = [Math]::Round(($beforeTotal - $afterTotal) / 1MB, 2)
$beforeMB = [Math]::Round($beforeTotal / 1MB, 2)
$afterMB = [Math]::Round($afterTotal / 1MB, 2)

Write-Host "Optimized $($processed.Count) JPEG files."
Write-Host "Before: $beforeMB MB"
Write-Host "After:  $afterMB MB"
Write-Host "Saved:  $savedMB MB"
Write-Host ""
$processed | Sort-Object { $_.BeforeKB - $_.AfterKB } -Descending | Select-Object -First 20 | Format-Table -AutoSize
