# 產生 extension icons (16/48/128 px)
# 執行：pwsh -File generate_icons.ps1

param([string]$OutDir = "$PSScriptRoot\icons")

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

function New-SplitIcon {
  param([int]$Size, [string]$Path)

  Add-Type -AssemblyName System.Drawing

  $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
  $g   = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

  # Background — dark navy
  $bg = [System.Drawing.Color]::FromArgb(26, 26, 46)
  $g.Clear($bg)

  # Rounded rect border
  $penW   = [Math]::Max(1, [int]($Size / 20))
  $pen    = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(0, 212, 255), $penW)
  $margin = $penW + 1
  $g.DrawRectangle($pen, $margin, $margin, $Size - $margin*2 - 1, $Size - $margin*2 - 1)

  # Vertical split line (full height)
  $splitPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(0, 212, 255), [Math]::Max(1, [int]($Size/18)))
  $mid = [int]($Size / 2)
  $g.DrawLine($splitPen, $mid, $margin+1, $mid, $Size - $margin - 2)

  # Horizontal line — left pane only (tmux top/bottom split indicator)
  $g.DrawLine($splitPen, $margin+1, $mid, $mid-1, $mid)

  $g.Dispose()
  $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "  icon${Size}.png → $Path"
}

Write-Host "Generating icons..."
New-SplitIcon -Size 16  -Path "$OutDir\icon16.png"
New-SplitIcon -Size 48  -Path "$OutDir\icon48.png"
New-SplitIcon -Size 128 -Path "$OutDir\icon128.png"
Write-Host "Done."
