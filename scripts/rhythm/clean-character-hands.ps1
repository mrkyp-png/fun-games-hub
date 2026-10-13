Add-Type -AssemblyName System.Drawing
$sourcePath='C:\Users\master\Desktop\케릭 스프라이트 첫번째.png'
$dest='C:\Users\master\Desktop\fun-games-hub\mole\assets\rhythm-b\character-hand-clean-v1044.png'
$im=[System.Drawing.Bitmap]::new($sourcePath)
$polygons=@(
 @(492,214,502,214,516,213,532,208,536,220,526,235,501,240,489,234,486,222),
 @(567,209,583,213,600,210,610,205,614,222,606,233,588,238,573,232,565,220),
 @(756,562,770,564,789,561,803,555,800,573,785,584,765,585,751,578,749,569),
 @(493,233,533,233,533,246,493,246),
 @(562,216,572,216,572,237,562,237),
 @(758,575,808,575,808,592,758,592)
)
$changed=@()
foreach($coords in $polygons){
 $points=[System.Drawing.PointF[]]::new($coords.Count/2)
 for($j=0;$j -lt $points.Count;$j++){$points[$j]=[System.Drawing.PointF]::new($coords[$j*2],$coords[$j*2+1])}
 $path=[System.Drawing.Drawing2D.GraphicsPath]::new();$path.AddPolygon($points)
 $bounds=$path.GetBounds();$count=0
 for($y=[int]$bounds.Top;$y -le [int]$bounds.Bottom;$y++){for($x=[int]$bounds.Left;$x -le [int]$bounds.Right;$x++){
  if($path.IsVisible($x+0.5,$y+0.5)){$c=$im.GetPixel($x,$y);if($c.A -gt 0){$im.SetPixel($x,$y,[System.Drawing.Color]::FromArgb(0,$c.R,$c.G,$c.B));$count++}}
 }}
 $changed+=$count;$path.Dispose()
}
$im.Save($dest,[System.Drawing.Imaging.ImageFormat]::Png)
$preview=[System.Drawing.Bitmap]::new(810,360);$g=[System.Drawing.Graphics]::FromImage($preview);$g.Clear([System.Drawing.Color]::FromArgb(35,35,35))
$boxes=@([System.Drawing.Rectangle]::new(280,0,270,360),[System.Drawing.Rectangle]::new(545,0,270,360),[System.Drawing.Rectangle]::new(545,355,270,360))
for($i=0;$i -lt 3;$i++){$g.DrawImage($im,[System.Drawing.Rectangle]::new($i*270,0,270,360),$boxes[$i],[System.Drawing.GraphicsUnit]::Pixel)}
$preview.Save('C:\Users\master\Desktop\fun-games-hub\review\character-hands-clean-v1044.png')
$g.Dispose();$preview.Dispose();$im.Dispose()
Write-Output "Changed alpha pixels per hand: $changed"
