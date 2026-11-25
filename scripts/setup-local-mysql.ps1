# 로컬 MySQL 8.4 초기화 + Windows 서비스(MySQL84) 등록 + pmboard DB/계정 생성 (Docker 대신 사용)
# 먼저 설치:  winget install Oracle.MySQL
# 실행 (관리자 PowerShell):  powershell -ExecutionPolicy Bypass -File scripts\setup-local-mysql.ps1
# 결과: root / root, pmboard / pmboard, DB pmboard (utf8mb4, +09:00). 개발용 비밀번호이므로 운영에서 쓰지 말 것.
$ErrorActionPreference = 'Stop'
$log = "$env:TEMP\pmboard-mysql-setup.log"
Start-Transcript -Path $log -Force
try {
  $base = 'C:\Program Files\MySQL\MySQL Server 8.4'
  $dataRoot = 'C:\ProgramData\MySQL\MySQL Server 8.4'
  $ini = Join-Path $dataRoot 'my.ini'
  New-Item -ItemType Directory -Force $dataRoot | Out-Null
  $dataDir = (Join-Path $dataRoot 'Data') -replace '\\','/'
  $baseFwd = $base -replace '\\','/'
  @"
[mysqld]
basedir="$baseFwd"
datadir="$dataDir"
port=3306
character-set-server=utf8mb4
collation-server=utf8mb4_0900_ai_ci
default-time-zone=+09:00

[client]
port=3306
default-character-set=utf8mb4
"@ | Set-Content -Encoding ascii $ini

  if (-not (Test-Path (Join-Path $dataRoot 'Data'))) {
    & "$base\bin\mysqld.exe" "--defaults-file=$ini" --initialize-insecure --console
    if ($LASTEXITCODE -ne 0) { throw "initialize failed" }
  }
  if (-not (Get-Service MySQL84 -ErrorAction SilentlyContinue)) {
    & "$base\bin\mysqld.exe" --install MySQL84 "--defaults-file=$ini"
  }
  Start-Service MySQL84
  Start-Sleep 5
  $sql = @"
ALTER USER 'root'@'localhost' IDENTIFIED BY 'root';
CREATE DATABASE IF NOT EXISTS pmboard CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER IF NOT EXISTS 'pmboard'@'localhost' IDENTIFIED BY 'pmboard';
CREATE USER IF NOT EXISTS 'pmboard'@'%' IDENTIFIED BY 'pmboard';
GRANT ALL ON pmboard.* TO 'pmboard'@'localhost';
GRANT ALL ON pmboard.* TO 'pmboard'@'%';
FLUSH PRIVILEGES;
"@
  $sql | & "$base\bin\mysql.exe" -uroot
  if ($LASTEXITCODE -ne 0) { throw "sql failed" }
  "SETUP_OK"
} catch { "SETUP_FAILED: $_" } finally { Stop-Transcript }
