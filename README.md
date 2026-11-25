# 프로젝트 보드 (PM Board)

여러 프로젝트를 동시에 관리하는 팀용 윈도우 앱입니다. 각자 PC에 앱을 설치하고 로그인하면, 같은 서버의 데이터를 함께 보고 고칩니다.

```
[윈도우 앱 (Tauri + React)]  ──HTTPS/HTTP──▶  [서버 (Spring Boot)]  ──▶  [MySQL]
  각자 PC에 설치                               팀 서버 1대                  팀 서버
                                               └ 첨부파일 폴더, AI 호출, 보고서 자동 생성
```

| 폴더 | 내용 |
|---|---|
| `desktop/` | 윈도우 앱. 화면은 React(TypeScript), 창·설치 파일은 Tauri 2 |
| `server/` | API 서버. Spring Boot 3.4, Java 21, JPA, Flyway, Spring Security(JWT) |
| `docs/ARCHITECTURE.md` | 구조, DB 테이블, API 목록, 권한, 다음 개발 순서 |
| `scripts/setup-local-mysql.ps1` | 개발용 로컬 MySQL 초기화·서비스 등록·DB 생성 |

## 1. 개발 환경 준비 (윈도우 PC)

| 설치할 것 | 용도 | 비고 |
|---|---|---|
| JDK 21 | 서버 | Temurin 등 |
| Node.js 20 이상 | 앱 화면 | |
| Rust (rustup) | 앱 설치 파일 빌드 | https://rustup.rs |
| Visual Studio Build Tools | Rust 빌드 | "C++를 사용한 데스크톱 개발" 워크로드 |
| MySQL 8.0 / 8.4 | DB | `winget install Oracle.MySQL` (Docker 불필요) |

WebView2는 Windows 10/11에 이미 들어 있습니다. 없는 PC에서는 설치 프로그램이 알아서 내려받습니다.

## 2. DB 만들기

**개발 PC (로컬 MySQL, Docker 없이)**

```powershell
winget install Oracle.MySQL
# 관리자 PowerShell에서 (데이터 폴더 초기화, MySQL84 서비스 등록, pmboard DB·계정 생성)
powershell -ExecutionPolicy Bypass -File scripts\setup-local-mysql.ps1
```

개발용 계정은 `root`/`root`, `pmboard`/`pmboard`입니다. 서비스로 등록되어 PC를 켜면 자동으로 실행됩니다.

**회사 MySQL 서버**를 쓸 때는 DBA에게 아래를 요청하세요.

```sql
CREATE DATABASE pmboard CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER 'pmboard'@'%' IDENTIFIED BY '비밀번호';
GRANT ALL ON pmboard.* TO 'pmboard'@'%';
```

테이블은 서버가 처음 뜰 때 Flyway가 `server/src/main/resources/db/migration/V1__init.sql`로 만듭니다. 스키마를 바꿀 때는 이 파일을 고치지 말고 `V2__설명.sql`처럼 새 파일을 추가하세요.

## 3. 서버 실행

**개발 PC에서는 스크립트 하나로 실행합니다.**

```powershell
cd server
.\run-dev.ps1              # http://localhost:8080
.\run-dev.ps1 -Port 8081   # 8080을 다른 프로그램이 쓰고 있을 때
```

`server\.env`가 없으면 스크립트가 `.env.example`을 바탕으로 개발용 값(JWT 키, 암호화 키, 관리자 비밀번호 `admin1234`)을 만들어 저장하고, 설치된 JDK 21을 찾아 `gradlew bootRun`을 실행합니다. 값을 바꾸려면 `server\.env`를 고치세요(커밋하지 않음).

환경변수를 직접 넣어 실행하려면 `server/.env.example`을 참고하세요. 처음에 꼭 정해야 하는 값은 세 가지입니다.

```powershell
# PowerShell 예시
$env:PMBOARD_JWT_SECRET = "32자-이상의-아무-문자열을-넣으세요-1234567890"
$env:PMBOARD_ADMIN_PASSWORD = "처음-관리자-비밀번호"

# AI 키 암호화용 32바이트 키 만들기 (한 번 만들어 계속 같은 값 사용)
$b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)
$env:PMBOARD_SECRET_KEY = "위에서 나온 값"

cd server
.\gradlew.bat bootRun
```

- 서버가 뜨면 `admin` / `PMBOARD_ADMIN_PASSWORD`로 로그인할 수 있습니다. 관리자 계정은 사용자가 한 명도 없을 때만 만들어집니다.
- 운영 배포: `.\gradlew.bat bootJar` → `build\libs\pmboard-server-0.1.0.jar`를 `java -jar`로 실행합니다. 윈도우 서버라면 WinSW 같은 도구로 서비스 등록, 리눅스라면 systemd에 등록하세요.
- 확인: 브라우저에서 `http://서버주소:8080/api/health` → `{"status":"ok"}`

## 4. 윈도우 앱 실행·빌드

```powershell
cd desktop
npm install

npm run tauri dev      # 개발: 앱 창이 뜨고, 코드를 고치면 바로 반영
npm run tauri build    # 설치 파일 만들기
```

설치 파일 위치:
- `desktop\src-tauri\target\release\bundle\nsis\PMBoard_0.1.0_x64-setup.exe` (권장: 관리자 권한 없이 설치)
- `desktop\src-tauri\target\release\bundle\msi\PMBoard_0.1.0_x64_ko-KR.msi`

팀원에게는 setup.exe를 나눠 주고, 첫 로그인 화면에서 **서버 주소**(예: `http://10.0.0.15:8080`)를 넣게 하면 됩니다. 서버 주소는 PC마다 한 번만 넣으면 기억합니다.

> 화면만 빠르게 확인할 때는 `npm run dev` 후 브라우저에서 http://localhost:1420 을 열어도 됩니다 (첨부파일 저장만 브라우저 다운로드로 동작).

## 5. 처음 써 볼 때

1. 관리자로 로그인 → **설정 › 팀원 계정**에서 팀원 계정 만들기
2. 오른쪽 위 **+ 새 프로젝트** → 참여자에 함께 관리할 팀원 선택
3. 프로젝트 화면에서 마일스톤과 할일 추가 → 할일을 누르면 상세 팝업
4. (관리자) **설정 › AI 연결**에서 API 키 등록 → **보고서**에서 "AI로 작성"

## 권한 규칙

- 로그인한 사람은 모든 프로젝트를 **볼 수** 있습니다.
- 프로젝트와 그 안의 할일·노트·첨부·마일스톤은 **그 프로젝트의 참여자(책임자 포함)만 고칠 수** 있습니다. 관리자라도 참여자가 아니면 읽기 전용입니다.
- 프로젝트 **삭제**는 **책임자와 관리자만** 할 수 있습니다. 할일·노트·첨부(파일 포함)·마일스톤·결정 로그가 함께 지워지며 되돌릴 수 없습니다.
- 코멘트는 **참여자만** 남길 수 있고, 수정·삭제는 **쓴 사람만** 할 수 있습니다.
- 할일 담당자는 **그 프로젝트의 참여자(책임자 포함)** 중에서만 고를 수 있습니다.
- 메모장과 보고서는 **본인 것만** 보입니다.
- AI 키, 보고서 설정, 계정 만들기는 **관리자만** 할 수 있습니다.

## 알아 둘 점

- 이 코드는 프로젝트 뼈대입니다. 화면은 타입 검사와 빌드를 통과했고, DB 스키마와 검색 SQL은 MySQL 8.0에서 실행해 확인했습니다. 서버 Java 코드는 작성 환경에서 Maven 저장소에 접속할 수 없어 컴파일을 돌려 보지 못했습니다. 처음 `gradlew bootRun`을 할 때 컴파일 오류가 나면 메시지대로 고쳐 주세요.
- 서버와 앱 사이를 회사 밖으로 열 경우에는 서버 앞에 HTTPS(리버스 프록시)를 두세요.
- 다음 개발 순서는 `docs/ARCHITECTURE.md` 맨 아래에 있습니다.
