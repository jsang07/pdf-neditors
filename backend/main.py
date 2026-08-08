from fastapi import FastAPI, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.exceptions import RequestValidationError
from typing import List, Optional
from datetime import datetime, timedelta
import urllib.parse
import json
import io
import os
from pdf_utils import PDFGenerator

app = FastAPI()

# [1] 에러 핸들러: 유효성 검사 실패 시 터미널에 로그 출력
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    print("============== 유효성 검사 에러 발생 ==============")
    print(exc) 
    print("=================================================")
    return JSONResponse(
        status_code=400,
        content={"detail": str(exc)},
    )

# [2] CORS 설정
origins = [
    os.getenv("ALLOWED_ORIGIN"),
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# [3] PDF 생성 API 엔드포인트
@app.post("/api/generate")
async def generate_pdf(
    brand: str = Form(...),
    receiver: str = Form(...),
    pagesData: str = Form(...), 
    
    creatorName: str = Form("임재상"),
    creatorRole: str = Form("에디터"),
    creatorPhone: str = Form("010-0000-0000"),
    creatorEmail: str = Form("email@example.com"),
    
    # 페이지별 캡처본 리스트 (순서대로)
    previewImages: List[UploadFile] = File(default=[]),
    
    # 미디어 파일 리스트 (우측 테이블 썸네일용)
    files: List[UploadFile] = File(default=[]),
):
    print(f"=== 요청 수신: {brand} ===")
    
    try:
        # JSON 문자열 파싱
        pages_list = json.loads(pagesData)
        
        # 1. 페이지별 캡처 이미지 읽기 (메모리 로드)
        preview_bytes_list = []
        for p_img in previewImages:
            data = await p_img.read()
            preview_bytes_list.append(data)
            
        # 2. 미디어 파일 읽기 (메모리 로드)
        all_files_bytes = []
        for file in files:
            data = await file.read()
            all_files_bytes.append({
                "filename": file.filename,
                "data": data
            })

        korea_now = datetime.utcnow() + timedelta(hours=9)
        yymmdd = korea_now.strftime("%y%m%d")    

        display_title = f"{brand} 광고시안_{yymmdd}"
        output_filename = f"{display_title}.pdf"

        # PDF 데이터를 파일 대신 메모리 버퍼에 생성
        
        # 1. 빈 메모리 버퍼 생성 (RAM 사용)
        pdf_buffer = io.BytesIO()

        # 2. PDFGenerator에게 파일명 대신 메모리 버퍼 전달
        pdf_gen = PDFGenerator(pdf_buffer, title=display_title)
        
        # 3. 표지 그리기
        pdf_gen.draw_cover_page(brand, receiver, datetime.now())
        
        # 4. 본문 페이지 반복 생성
        current_file_index = 0
        
        for i, page in enumerate(pages_list):
            account_tags = page.get('accountTagInput', '')
            comment_hashtags = page.get('hashtags', '')
            content = page.get('content', '')
            upload_date = page.get('uploadDate', '')
        
            media_count = len(page.get('mediaFiles', []))
            page_image_bytes = []
            
            for k in range(media_count):
                if current_file_index < len(all_files_bytes):
                    file_info = all_files_bytes[current_file_index]
                    page_image_bytes.append(file_info['data'])
                    current_file_index += 1
            
            # 해당 페이지의 캡처본 매칭
            current_preview_bytes = preview_bytes_list[i] if i < len(preview_bytes_list) else None

            print(f"[{i+1}페이지] 캡처본 적용 중...")

            pdf_gen.draw_content_page(
                advertiser=brand,
                account_tags=account_tags,
                comment_hashtags=comment_hashtags,
                content=content,
                image_bytes_list=page_image_bytes, # 우측 썸네일용
                upload_date=upload_date,
                preview_bytes=current_preview_bytes # 좌측 통캡처용
            )
            
        # 5. 엔딩 페이지
        user_info = {
            "name": creatorName, "role": creatorRole,
            "phone": creatorPhone, "email": creatorEmail
        }
        pdf_gen.draw_ending_page(user_info)
        
        # 생성된 PDF를 스트리밍 응답으로 반환

        # 6. 버퍼 포인터를 맨 앞으로 이동 (처음부터 읽어서 전송해야 함)
        pdf_buffer.seek(0)
        
        encoded_filename = urllib.parse.quote(output_filename)
        
        # 7. StreamingResponse로 반환 (Chunked Transfer)
        # PDF 전체를 메모리에 적재한 뒤 스트리밍 응답으로 반환

        return StreamingResponse(
            pdf_buffer,
            media_type='application/octet-stream', # ★ application/pdf -> application/octet-stream
            headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"}
        )

    except Exception as e:
        print(f"PDF 생성 중 에러 발생: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})