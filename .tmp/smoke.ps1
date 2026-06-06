$ErrorActionPreference = 'Continue'
$base = 'http://localhost:3001/api'
$body = @{ email='admin@ais.local'; password='2212' } | ConvertTo-Json
try {
  $r = Invoke-RestMethod -Uri "$base/auth/login" -Method POST -Body $body -ContentType 'application/json'
} catch {
  Write-Output "LOGIN FAILED: $($_.Exception.Message)"
  exit 1
}
$h = @{ Authorization = "Bearer $($r.accessToken)" }
Write-Output "Logged in. Token len = $($r.accessToken.Length)"
Write-Output ""

$endpoints = @(
  '/health','/integrations/max/status','/users?limit=5','/audit?limit=5',
  '/lookup/order?q=test','/comment-options','/applications?limit=5',
  '/passes?limit=5','/certificates?limit=5','/students?limit=5',
  '/admissions?limit=5','/grades','/curriculum','/reports',
  '/poozabeduapi/ping','/poozabeduapi/mirror/departments',
  '/poozabeduapi/mirror/groups?limit=3','/poozabeduapi/mirror/students?limit=3',
  '/poozabeduapi/employees','/poozabeduapi/journal/groups',
  '/chtotib/today','/chtotib/groups','/chtotib/teachers','/chtotib/snapshot','/chtotib/week'
)

foreach ($u in $endpoints) {
  $t0 = Get-Date
  try {
    $res = Invoke-WebRequest -Uri "$base$u" -Method GET -Headers $h -TimeoutSec 30 -UseBasicParsing
    $ms = [int]((Get-Date) - $t0).TotalMilliseconds
    Write-Output ("{0,3} {1,6}ms  {2}" -f $res.StatusCode, $ms, $u)
  } catch {
    $ms = [int]((Get-Date) - $t0).TotalMilliseconds
    $code = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 }
    $msg = $_.Exception.Message
    if ($code -ge 400 -and $_.Exception.Response.GetResponseStream) {
      try {
        $sr = New-Object IO.StreamReader($_.Exception.Response.GetResponseStream())
        $bodyTxt = $sr.ReadToEnd()
        if ($bodyTxt.Length -gt 220) { $bodyTxt = $bodyTxt.Substring(0,220)+'…' }
        $msg = $bodyTxt
      } catch {}
    }
    Write-Output ("{0,3} {1,6}ms  {2}  ::  {3}" -f $code, $ms, $u, $msg)
  }
}
