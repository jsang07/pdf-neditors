# PDF Neditors

광고 시안 작성부터 PDF 생성까지의 반복 작업을 줄이기 위해 만든 사내 웹 도구입니다.

React로 시안 편집 화면을 구현했고, 프로젝트 데이터와 미디어는 Firebase에서 관리합니다.  
PDF 생성은 별도의 FastAPI 서버에서 처리하며, ReportLab으로 다중 페이지 PDF를 생성합니다.

실제 고객사 내부 업무에 사용된 외주 프로젝트입니다.  
공개 Repository에는 민감정보, 운영 Credential, 라이선스 제한 리소스를 제외한 핵심 소스만 포함되어 있습니다.

---

## Tech Stack

**Frontend**

- React / Vite
- JavaScript
- Firebase Authentication
- Firestore
- Firebase Storage

**Backend**

- Python
- FastAPI
- ReportLab
- Pillow
- Uvicorn / Gunicorn

**Deployment**

- Firebase Hosting
- Docker
- Google Cloud Run
- GitHub Actions

---

## Architecture

```text
React / Vite
   │
   ├── Firebase Authentication
   ├── Firestore
   └── Firebase Storage
   │
   │ multipart/form-data
   ▼
FastAPI
   │
   ├── 페이지 데이터 파싱
   ├── 이미지 처리
   └── ReportLab PDF 생성
   │
   ▼
io.BytesIO
   │
   ▼
StreamingResponse
   │
   ▼
PDF Download
```

프론트에서 페이지 정보와 이미지 파일을 `multipart/form-data`로 전달하면  
FastAPI 서버에서 데이터를 페이지 순서에 맞게 조합해 PDF를 생성합니다.

Frontend는 Firebase Hosting, Backend는 Docker 이미지로 구성해 Google Cloud Run에서 운영했습니다.

---

## 주요 기능

### 광고 시안 편집

하나의 프로젝트에서 여러 광고 페이지를 추가하고 각각의 콘텐츠를 편집할 수 있습니다.

- 광고주 및 수신 정보 입력
- 광고 문구 편집
- 계정 태그 / 해시태그 입력
- 이미지 및 미디어 업로드
- 페이지별 업로드 일정 설정
- 실시간 Preview
- 다중 페이지 추가 / 수정
- 프로젝트 저장 후 재편집

### 프로젝트 저장 및 재편집

초기에는 React의 로컬 상태를 중심으로 편집 데이터를 관리했지만,  
새로고침 시 작성 중이던 데이터가 사라지는 문제가 있었습니다.

프로젝트 데이터를 Firestore에 저장하고 Project ID를 URL과 연결하도록 변경했습니다.

```text
프로젝트 생성
    ↓
Firestore Document 생성
    ↓
Document ID 반환
    ↓
URL에 Project ID 반영
    ↓
새로고침 / 재접속
    ↓
Firestore에서 기존 프로젝트 조회
```

이를 통해 기존 광고 시안을 다시 불러와 이어서 편집할 수 있도록 했습니다.

### Firebase 기반 데이터 관리

Firebase를 이용해 프로젝트에서 필요한 인증과 데이터를 관리했습니다.

- Firebase Authentication 기반 로그인
- Firestore 기반 프로젝트 데이터 저장 / 조회
- Firebase Storage 기반 이미지 및 미디어 저장
- 인증되지 않은 사용자의 편집 화면 접근 제한

### PDF 자동 생성

페이지 데이터와 Preview 이미지, 업로드된 미디어를 FastAPI 서버로 전달하고  
Backend에서 표지 → 광고 페이지 → 담당자 정보 페이지 순서로 PDF를 생성합니다.

```text
React Editor
    ↓
Page Data
+ Preview Images
+ Media Files
    ↓
FastAPI
    ↓
PDFGenerator
    ↓
ReportLab
    ↓
PDF Buffer
    ↓
StreamingResponse
```

최종 PDF는 `io.BytesIO` 메모리 버퍼에 생성한 뒤 바로 응답으로 반환합니다.

```python
pdf_buffer = io.BytesIO()

pdf_gen = PDFGenerator(
    pdf_buffer,
    title=display_title
)

# PDF rendering ...

pdf_buffer.seek(0)

return StreamingResponse(
    pdf_buffer,
    media_type="application/octet-stream"
)
```

---

## Troubleshooting

### Cloud Run에서 PDF 생성 중 메모리 사용량 증가

고해상도 이미지가 여러 장 포함된 PDF를 반복 생성할 때  
Cloud Run 컨테이너의 메모리 사용량이 증가하면서 PDF 변환이 불안정해지는 문제가 있었습니다.

PDF 생성 과정에서 사용하던 파일 처리와 이미지 데이터의 생명주기를 확인했고,  
최종 PDF를 `io.BytesIO`에 생성해 요청 처리 안에서 바로 반환하도록 구조를 변경했습니다.

또한 이미지 및 중간 데이터를 요청 단위로 처리하도록 PDF 생성 흐름을 정리했습니다.

이후 반복적인 PDF 생성 과정에서 발생하던 메모리 관련 오류를 줄일 수 있었습니다.

### Firebase Storage 이미지 CORS

Firebase Storage에 저장된 이미지를 다시 불러와 Preview나 Canvas 처리에 사용하려 할 때  
브라우저의 CORS 정책 때문에 이미지 접근이 차단되는 문제가 있었습니다.

Storage Bucket의 CORS 설정에서 서비스 Origin과 HTTP Method를 명시하고,  
이미지 로딩 및 처리 시점을 함께 수정했습니다.

이후 Storage에 저장된 이미지를 Preview와 PDF 생성 과정에서 정상적으로 사용할 수 있게 했습니다.

### 편집 UI 좌표 오차

편집 화면에서 특정 UI를 사용자의 입력 위치에 표시할 때  
Scroll 상태에 따라 위치가 어긋나는 문제가 있었습니다.

초기에는 `getBoundingClientRect()`의 좌표만 사용했지만,  
Scroll Offset을 함께 반영하도록 좌표 계산 방식을 수정했습니다.

```text
Element Position
      +
Scroll Offset
      ↓
Actual UI Position
```

페이지를 이동한 이후에도 편집 UI가 올바른 위치에 표시되도록 수정했습니다.

---

## Project Structure

```text
pdf-neditors/
│
├── frontend/
│   ├── public/
│   │
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── styles/
│   │   ├── utils/
│   │   ├── App.jsx
│   │   ├── firebase.js
│   │   └── main.jsx
│   │
│   ├── firebase.json
│   ├── eslint.config.js
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   └── vite.config.js
│
├── backend/
│   ├── Dockerfile
│   ├── main.py
│   ├── pdf_utils.py
│   └── requirements.txt
│
├── .gitignore
└── README.md
```

---

## Backend API

PDF 생성은 하나의 FastAPI Endpoint에서 처리합니다.

```http
POST /api/generate
Content-Type: multipart/form-data
```

주요 전달 데이터는 다음과 같습니다.

```text
brand
receiver
pagesData

creatorName
creatorRole
creatorPhone
creatorEmail

previewImages[]
files[]
```

`pagesData`에는 각 페이지의 콘텐츠 정보가 JSON 형태로 들어가며,  
Preview 이미지와 미디어 파일은 Multipart 요청으로 함께 전달합니다.

Backend에서는 페이지 정보와 파일 순서를 매칭한 뒤 최종 PDF를 생성합니다.

---

## Deployment

Frontend는 Firebase Hosting에 배포했습니다.

```text
React / Vite
    ↓
Firebase Hosting
```

Backend는 FastAPI 애플리케이션을 Docker 이미지로 구성해 Google Cloud Run에 배포했습니다.

```text
FastAPI
   ↓
Docker
   ↓
Google Cloud Run
```

실제 운영 Backend는 별도의 Private Repository에서 관리했으며,  
GitHub Actions를 이용해 Cloud Run으로 자동 배포했습니다.

```text
Backend Push
    ↓
GitHub Actions
    ↓
Docker Build
    ↓
Google Cloud Run
```

---

## Repository Notice

본 프로젝트는 실제 고객사 내부 업무에 사용된 외주 프로젝트입니다.

현재 Repository는 프로젝트 완료 후 포트폴리오 공개를 위해 별도로 정리한 버전입니다.

다음 항목은 공개 Repository에서 제외했습니다.

- `.env`
- API Key 및 Secret
- Firebase / Google Cloud Credential
- Service Account 정보
- GitHub Actions 배포 Secret
- 고객사 내부 운영 설정
- 재배포 권한을 확인할 수 없는 Font 파일 및 일부 리소스

실제 운영에 사용된 원본 Repository는 별도의 Private Repository로 관리하고 있습니다.

따라서 현재 Repository의 Commit History는 실제 프로젝트 전체 개발 기간의 Git History를 나타내지 않습니다.
