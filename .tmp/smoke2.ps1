$ErrorActionPreference = 'Continue'
$base = 'http://localhost:3001/api'
$body = @{ email='admin@ais.local'; password='2212' } | ConvertTo-Json
$r = Invoke-RestMethod -Uri "$base/auth/login" -Method POST -Body $body -ContentType 'application/json'
$h = @{ Authorization = "Bearer $($r.accessToken)" }

# взять реальные id из зеркала
$groups = Invoke-RestMethod -Uri "$base/poozabeduapi/mirror/groups?limit=3" -Headers $h
$students = Invoke-RestMethod -Uri "$base/poozabeduapi/mirror/students?limit=3" -Headers $h
$gid = $groups.items[0].externalId
$sid = $students.items[0].externalId
Write-Output "Test group externalId=$gid, student externalId=$sid"

$endpoints = @(
  '/lookup/order?fullName=Иванов Иван',
  '/grades/sheets?limit=5',
  '/curriculum/disciplines?limit=5',
  '/curriculum/plans?limit=5',
  '/chtotib/snapshot',
  ('/chtotib/group?name=' + [uri]::EscapeDataString($groups.items[0].name)),
  ('/chtotib/week/group?name=' + [uri]::EscapeDataString($groups.items[0].name)),
  ('/poozabeduapi/students/' + $sid),
  ('/poozabeduapi/students/' + $sid + '/college-gpa'),
  ('/poozabeduapi/groups/' + $gid + '/debts'),
  ('/poozabeduapi/journal/groups/' + $gid + '/entries')
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
    try {
      $sr = New-Object IO.StreamReader($_.Exception.Response.GetResponseStream())
      $msg = $sr.ReadToEnd()
      if ($msg.Length -gt 240) { $msg = $msg.Substring(0,240)+'…' }
    } catch {}
    Write-Output ("{0,3} {1,6}ms  {2}  ::  {3}" -f $code, $ms, $u, $msg)
  }
}

Write-Output ""
Write-Output "--- invalid input checks ---"
$bad = @(
  '/lookup/order?fullName=a',
  '/users?limit=99999',
  '/poozabeduapi/students/99999999',
  '/poozabeduapi/students/abc'
)
foreach ($u in $bad) {
  try {
    $res = Invoke-WebRequest -Uri "$base$u" -Method GET -Headers $h -TimeoutSec 30 -UseBasicParsing
    Write-Output ("{0,3}  {1}  (expected 4xx?)" -f $res.StatusCode, $u)
  } catch {
    $code = [int]$_.Exception.Response.StatusCode
    Write-Output ("{0,3}  {1}" -f $code, $u)
  }
}

Write-Output ""
Write-Output "--- auth flow ---"
# refresh
$rb = @{ refreshToken = $r.refreshToken } | ConvertTo-Json
try {
  $rr = Invoke-RestMethod -Uri "$base/auth/refresh" -Method POST -Body $rb -ContentType 'application/json'
  Write-Output "refresh: OK (new token len=$($rr.accessToken.Length))"
} catch { Write-Output "refresh: FAIL ($($_.Exception.Message))" }

# invalid token
try {
  $resp = Invoke-WebRequest -Uri "$base/users" -Headers @{ Authorization='Bearer xxx' } -UseBasicParsing
  Write-Output "invalid token: leaked! got $($resp.StatusCode)"
} catch {
  $code = [int]$_.Exception.Response.StatusCode
  Write-Output "invalid token: $code (expect 401)"
}

# wrong password
try {
  $wb = @{ email='admin@ais.local'; password='wrong' } | ConvertTo-Json
  Invoke-RestMethod -Uri "$base/auth/login" -Method POST -Body $wb -ContentType 'application/json' | Out-Null
  Write-Output "wrong pwd: leaked!"
} catch {
  $code = [int]$_.Exception.Response.StatusCode
  Write-Output "wrong pwd: $code (expect 401)"
}
