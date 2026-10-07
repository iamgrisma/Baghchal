Add-Type -AssemblyName System.Drawing

function Load-ImageNoLock($path) {
    $bytes = [System.IO.File]::ReadAllBytes($path)
    $ms = New-Object System.IO.MemoryStream(,$bytes)
    return [System.Drawing.Image]::FromStream($ms)
}

$sourceImg = Load-ImageNoLock (Resolve-Path "store-assets\icon-512.png")

function Resize-Image($img, $width, $height, $destPath) {
    $dir = [System.IO.Path]::GetDirectoryName($destPath)
    if (!(Test-Path $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
    $bmp = New-Object System.Drawing.Bitmap($width, $height)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($img, 0, 0, $width, $height)
    $g.Dispose()
    
    # Save as PNG
    $bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Created $destPath ($width x $height)"
}

# Android Mipmap Icons
$densities = @(
    @{ Name = "mipmap-mdpi"; Size = 48; Fore = 108 },
    @{ Name = "mipmap-hdpi"; Size = 72; Fore = 162 },
    @{ Name = "mipmap-xhdpi"; Size = 96; Fore = 216 },
    @{ Name = "mipmap-xxhdpi"; Size = 144; Fore = 324 },
    @{ Name = "mipmap-xxxhdpi"; Size = 192; Fore = 432 }
)

foreach ($d in $densities) {
    $resDir = "android\app\src\main\res\$($d.Name)"
    Resize-Image $sourceImg $d.Size $d.Size "$resDir\ic_launcher.png"
    Resize-Image $sourceImg $d.Size $d.Size "$resDir\ic_launcher_round.png"
    Resize-Image $sourceImg $d.Fore $d.Fore "$resDir\ic_launcher_foreground.png"
}

# Web & PWA Icons
Resize-Image $sourceImg 512 512 "public\pwa-512x512.png"
Resize-Image $sourceImg 512 512 "public\pwa-maskable-512x512.png"
Resize-Image $sourceImg 192 192 "public\pwa-192x192.png"
Resize-Image $sourceImg 180 180 "public\apple-touch-icon.png"

# Play Store 512x512 PNG
Resize-Image $sourceImg 512 512 "store-assets\icon-512.png"

# Also resize feature graphic to exact 1024x500
$featImg = Load-ImageNoLock (Resolve-Path "store-assets\feature-graphic-1024x500.png")
Resize-Image $featImg 1024 500 "store-assets\feature-graphic-1024x500.png"
$featImg.Dispose()

$sourceImg.Dispose()
Write-Host "All Android, Web, and Play Store icons generated successfully!"
