# 개발용 서버 실행 스크립트 (Docker 없이 로컬 MySQL 사용)
#   cd server
#   .\run-dev.ps1              # 8080 포트
#   .\run-dev.ps1 -Port 8081   # 다른 포트
#
# - server\.env 가 있으면 그 값을 환경변수로 넣고 실행한다.
# - 없으면 .env.example 을 바탕으로 개발용 값(JWT 키, 암호화 키, 관리자 비밀번호)을 만들어 .env 로 저장한다.
# - JDK 21 이 JAVA_HOME 이 아니면 설치된 JDK 21 을 찾아 쓴다.
param(
    [int]$Port = 0
)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$envFile = Join-Path $PSScriptRoot '.env'
if (-not (Test-Path $envFile)) {
    $bytes = New-Object byte[] 32
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $secretKey = [Convert]::ToBase64String($bytes)
    $jwt = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 48 | ForEach-Object { [char]$_ })

    $content = Get-Content (Join-Path $PSScriptRoot '.env.example') -Encoding UTF8
    $content = $content -replace '^PMBOARD_JWT_SECRET=.*$', "PMBOARD_JWT_SECRET=$jwt"
    $content = $content -replace '^PMBOARD_SECRET_KEY=.*$', "PMBOARD_SECRET_KEY=$secretKey"
    $content = $content -replace '^PMBOARD_ADMIN_PASSWORD=.*$', 'PMBOARD_ADMIN_PASSWORD=admin1234'
    [IO.File]::WriteAllLines($envFile, $content, (New-Object Text.UTF8Encoding $false))
    Write-Host "server\.env 를 새로 만들었습니다. 관리자 계정: admin / admin1234" -ForegroundColor Yellow
}

# .env 읽기 (KEY=VALUE, # 주석과 빈 줄은 건너뜀)
foreach ($line in Get-Content $envFile -Encoding UTF8) {
    $t = $line.Trim()
    if ($t -eq '' -or $t.StartsWith('#')) { continue }
    $i = $t.IndexOf('=')
    if ($i -lt 1) { continue }
    $key = $t.Substring(0, $i).Trim()
    $val = $t.Substring($i + 1).Trim()
    if ($val -ne '') { Set-Item -Path "Env:$key" -Value $val }
}
if ($Port -gt 0) { $env:PORT = "$Port" }

# JDK 21 찾기
function Test-Jdk21([string]$dir) {
    if (-not $dir) { return $false }
    $release = Join-Path $dir 'release'
    return (Test-Path $release) -and ((Get-Content $release -Raw) -match 'JAVA_VERSION="21')
}
if (-not (Test-Jdk21 $env:JAVA_HOME)) {
    $candidates = @(
        Get-ChildItem 'C:\Program Files\Eclipse Adoptium' -Directory -Filter 'jdk-21*' -ErrorAction SilentlyContinue
        Get-ChildItem 'C:\Program Files\Java' -Directory -Filter 'jdk-21*' -ErrorAction SilentlyContinue
        Get-ChildItem 'C:\Program Files\Microsoft' -Directory -Filter 'jdk-21*' -ErrorAction SilentlyContinue
    ) | Sort-Object Name -Descending
    $jdk = $candidates | Where-Object { Test-Jdk21 $_.FullName } | Select-Object -First 1
    if (-not $jdk) { throw 'JDK 21 을 찾지 못했습니다. winget install EclipseAdoptium.Temurin.21.JDK 로 설치하세요.' }
    $env:JAVA_HOME = $jdk.FullName
}
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
Write-Host "JAVA_HOME = $env:JAVA_HOME"
Write-Host "서버 주소 = http://localhost:$(if ($env:PORT) { $env:PORT } else { 8080 })"

& .\gradlew.bat bootRun
exit $LASTEXITCODE
