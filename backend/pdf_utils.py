import os
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from PIL import Image
import io
from datetime import datetime
import math 

# 최적화 헬퍼 함수
def optimize_image_for_pdf(image_bytes, target_w, target_h):
    if not image_bytes: return None
    try:
        img = Image.open(io.BytesIO(image_bytes))
        if img.mode in ("RGBA", "P"): img = img.convert("RGB") 

        target_pixel_w = int(target_w * 2)
        target_pixel_h = int(target_h * 2)
        img.thumbnail((target_pixel_w, target_pixel_h), Image.LANCZOS)

        #  JPEG로 재압축 (메모리 버퍼에 저장)
        out = io.BytesIO()
        img.save(out, format="JPEG", quality=70, optimize=True)
        out.seek(0)
        
        return ImageReader(out) # ReportLab용 객체 반환
    except:
        return None

# --- 폰트 설정 ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FONT_DIR = os.path.join(BASE_DIR, "fonts")

# 1. 기본/이모지/한중일
FONT_NAME = "Pretendard"
FONT_REGULAR_PATH = os.path.join(FONT_DIR, "Pretendard-Regular.ttf")

FONT_EMOJI = "NotoEmoji"
FONT_EMOJI_PATH = os.path.join(FONT_DIR, "NotoEmoji-Regular.ttf")

FONT_CJK = "NotoSansCJK"
FONT_CJK_PATH = os.path.join(FONT_DIR, "NotoSansCJKkr-Regular.ttf")

FONT_MATH = "NotoSansMath"
FONT_MATH_PATH = os.path.join(FONT_DIR, "NotoSansMath-Regular.ttf")

FONT_SYMBOL = "NotoSansSymbols2"
FONT_SYMBOL_PATH = os.path.join(FONT_DIR, "NotoSansSymbols2-Regular.ttf")

FONT_KANNADA = "NotoSansKannada"
FONT_KANNADA_PATH = os.path.join(FONT_DIR, "NotoSansKannada-Regular.ttf")

try:
    pdfmetrics.registerFont(TTFont(FONT_NAME, FONT_REGULAR_PATH))
    pdfmetrics.registerFont(TTFont(FONT_EMOJI, FONT_EMOJI_PATH))
    pdfmetrics.registerFont(TTFont(FONT_CJK, FONT_CJK_PATH))
    pdfmetrics.registerFont(TTFont(FONT_MATH, FONT_MATH_PATH))
    pdfmetrics.registerFont(TTFont(FONT_SYMBOL, FONT_SYMBOL_PATH))
    pdfmetrics.registerFont(TTFont(FONT_KANNADA, FONT_KANNADA_PATH))
    print("모든 폰트(6종) 로드 성공")
except Exception as e:
    print(f"폰트 로드 실패: {e}")


class PDFGenerator:
    def __init__(self, filename, title=None):
        self.filename = filename
        self.width = 1458
        self.height = 819
        self.c = canvas.Canvas(filename, pagesize=(self.width, self.height))
        if title:
            self.c.setTitle(title)

    # [1페이지] 표지
    def draw_cover_page(self, brand_name, receiver, created_at):
        if brand_name:
            brand_name = brand_name.replace('\n', ' ').replace('\r', ' ')
        if receiver:
            receiver = receiver.replace('\n', ' ').replace('\r', ' ')
            
        self.c.setFont(FONT_NAME, 14)
        self.c.setFillColorRGB(0, 0, 0)
        self.c.drawString(60, self.height - 60, "발신 : 주식회사 아이즈")
        self.c.drawString(60, self.height - 85, f"수신 : {receiver}")

        self.c.setFont(FONT_NAME, 60)
        full_text = f"[{brand_name}] 유가시안"
        
        # 제목 줄바꿈 스코어링 로직
        def get_text_score(text):
            score = 0
            for char in text:
                if ord(char) > 127: score += 1.6
                elif char.isupper(): score += 1.2
                else: score += 1.0
            return score
        
        LIMIT_SCORE = 32
        final_lines = []
        
        if get_text_score(full_text) <= LIMIT_SCORE:
            final_lines = [full_text]
        else:
            brand_part = f"[{brand_name}]"
            if get_text_score(brand_part) <= LIMIT_SCORE:
                final_lines = [brand_part, "유가시안"]
            else:
                current_line = ""
                current_score = 0
                for char in full_text:
                    char_score = 1.6 if ord(char) > 127 else (1.2 if char.isupper() else 1.0)
                    if current_score + char_score > LIMIT_SCORE:
                        final_lines.append(current_line)
                        current_line = char
                        current_score = char_score
                    else:
                        current_line += char
                        current_score += char_score
                if current_line:
                    final_lines.append(current_line)

        line_height = 80
        total_h = len(final_lines) * line_height
        start_y = (self.height / 2) + (total_h / 2) - line_height + 10
        
        for line in final_lines:
            self.c.drawString(60, start_y, line.strip())
            start_y -= line_height

        self.c.setFont(FONT_NAME, 12)
        date_str = created_at.strftime("%Y.%m.%d")
        self.c.drawString(60, 60, f"제작 일자 : {date_str}")
        self.c.drawString(60, 35, "매체 : 아이즈매거진")
        self.c.showPage()

    # [2페이지...N페이지] 본문
    def draw_content_page(self, advertiser, account_tags, comment_hashtags, content, image_bytes_list, upload_date, preview_bytes):
        # 1. 배경 채우기 (검은색)
        self.c.setFillColorRGB(0, 0, 0)
        self.c.rect(0, 0, self.width, self.height, fill=1, stroke=0)
        
        # =========================================================================
        # ★★★ [설정] 좌표 및 크기 변수 ★★★
        # =========================================================================
        
        # 전체 페이지 기준
        page_top = self.height  # 819
        page_left_margin = 50   
        
        # 1. 타이틀 "인스타그램" 위치
        title_y = page_top - 60 
        
        # 2. 본문 시작 Y 좌표 (Top 102px 지점)
        content_start_y = page_top - 102 
        
        # 3. [왼쪽] 인스타그램 카드 변수
        card_x = page_left_margin
        card_w = 327  
        card_h = 615  
        card_bottom_y = content_start_y - card_h 
        
        # 4. [오른쪽] 테이블 변수
        table_x = 409 
        
        # [상단 테이블 T1]
        t1_header_h = 52   # 헤더 높이
        
        media_count = len(image_bytes_list) if image_bytes_list else 0
        if media_count > 10:
            t1_body_h = 265 
        else:
            t1_body_h = 158 
        
        t1_header_y = content_start_y
        t1_body_y = t1_header_y - t1_header_h
        
        col1_w = 139  # 업로드 일자
        col2_w = 130  # 계정 태그
        col3_w = 731  # 업로드 순서
        
        # 테이블 간격
        gap_h = 33
        
        # [하단 테이블 T2]
        t2_header_h = 52
        
        # 하단 테이블 높이 자동 계산
        total_used_height = t1_header_h + t1_body_h + gap_h + t2_header_h
        t2_body_h = card_h - total_used_height 
        
        if t2_body_h < 100: t2_body_h = 100
        
        t2_header_y = t1_body_y - t1_body_h - gap_h 
        t2_body_top_y = t2_header_y - t2_header_h
        
        t2_col1_w = 710 # 내용
        t2_col2_w = 290 # 댓글 해시태그

        # =========================================================================
        # [그리기 시작]
        # =========================================================================

        # 1. 타이틀 
        self.c.setFillColorRGB(1, 1, 1)
        self.c.setFont(FONT_NAME, 30) 
        self.c.drawString(page_left_margin + 5, title_y, "인스타그램")

        # 2. 왼쪽 인스타그램 카드
        if preview_bytes:
            try:
                img = Image.open(io.BytesIO(preview_bytes))
                img_reader = ImageReader(img)
                self.c.setFillColorRGB(0, 0, 0)
                self.c.rect(card_x, card_bottom_y, card_w, card_h, fill=1, stroke=0)
                self.draw_image_fixed_height(img_reader, card_x, card_bottom_y, card_w, card_h)
            except Exception as e:
                print(f"캡처본 그리기 실패: {e}")
                self.c.setFillColorRGB(0.2, 0.2, 0.2)
                self.c.rect(card_x, card_bottom_y, card_w, card_h, fill=1, stroke=0)
        else:
            self.c.setFillColorRGB(0, 0, 0)
            self.c.rect(card_x, card_bottom_y, card_w, card_h, fill=1, stroke=0)

        # 3. 오른쪽 테이블 그리기
        
        # [상단 테이블] 헤더
        self.draw_table_cell(table_x, t1_header_y, col1_w, t1_header_h, "업로드 일자", True, font_size=16)
        self.draw_table_cell(table_x + col1_w, t1_header_y, col2_w, t1_header_h, "계정 태그", True, font_size=16)
        self.draw_table_cell(table_x + col1_w + col2_w, t1_header_y, col3_w, t1_header_h, "업로드 순서", True, font_size=16)
        
        # [상단 테이블] 본문
        self.draw_table_cell(table_x, t1_body_y, col1_w, t1_body_h, upload_date, font_size=14)

        tag_lines = []
        current_line_chars = []
        current_score = 0
        
        # 1. 글자 단위로 돌면서 점수 채우기 
        for char in account_tags:
            char_score = 1.5 if ord(char) > 127 else 1.0
            
            # 만약 13점을 넘으면? -> 지금까지 모은 걸 한 줄로 확정
            if current_score + char_score > 13:
                tag_lines.append("".join(current_line_chars)) # 줄 확정
                current_line_chars = [char]                   # 새로운 줄은 현재 글자로 시작
                current_score = char_score                    # 점수 초기화
            else:
                # 아직 안 넘었으면 계속 뒤에 붙임
                current_line_chars.append(char)
                current_score += char_score
        
        # 반복문 끝나고 남은 글자들 마지막 줄로 추가
        if current_line_chars:
            tag_lines.append("".join(current_line_chars))
            
        # 2. 직접 그리기
        cell_x = table_x + col1_w
        cell_w = col2_w
        cell_h = t1_body_h
        cell_bottom_y = t1_body_y - cell_h

        # (1) 하얀 박스 그리기
        self.c.setFillColorRGB(1, 1, 1)
        self.c.rect(cell_x, cell_bottom_y, cell_w, cell_h, fill=1, stroke=1)
        self.c.setFillColorRGB(0, 0, 0)

        # (2) 텍스트 배치 (중앙 정렬되도록 계산)
        base_font_size = 14
        line_height = base_font_size + 4
        total_text_h = len(tag_lines) * line_height
        
        # 수직 중앙 정렬 시작 Y 좌표
        current_y = cell_bottom_y + (cell_h / 2) + (total_text_h / 2) - line_height + 3

        for line in tag_lines:
            # 혹시 줄바꿈 때문에 맨 앞에 공백이 생기면 제거 (선택 사항)
            line = line.strip() 
            if not line: continue
            
            self.c.setFont(FONT_NAME, base_font_size)
            
            # 가로 중앙 정렬
            text_w = self.c.stringWidth(line, FONT_NAME, base_font_size)
            center_x = cell_x + (cell_w - text_w) / 2
            
            self.c.drawString(center_x, current_y, line)
            current_y -= line_height
        
        # ★ 썸네일
        self.draw_thumbnail_cell(table_x + col1_w + col2_w, t1_body_y, col3_w, t1_body_h, image_bytes_list)

        # [하단 테이블] 헤더
        self.draw_table_cell(table_x, t2_header_y, t2_col1_w, t2_header_h, "내용", True, font_size=16)
        self.draw_table_cell(table_x + t2_col1_w, t2_header_y, t2_col2_w, t2_header_h, "댓글 해시태그", True, font_size=16)
        
        # [하단 테이블] 본문
        self.draw_emoji_cell(table_x, t2_body_top_y, t2_col1_w, t2_body_h, content, font_size=14)
        self.draw_table_cell(table_x + t2_col1_w, t2_body_top_y, t2_col2_w, t2_body_h, comment_hashtags, font_size=14)

        self.c.showPage()

    # (엔딩 페이지 등 헬퍼 함수)
    def draw_ending_page(self, user_info):
        self.c.setFont(FONT_NAME, 50)
        self.c.setFillColorRGB(0, 0, 0)
        text = "감사합니다."
        text_y = (self.height / 2) - 20 
        self.c.drawString(60, text_y, text)

        box_w = 250; box_h = 120
        box_x = self.width - box_w; box_y = 0
        self.c.setFillColorRGB(1, 1, 1) 
        self.c.rect(box_x, box_y, box_w, box_h, fill=1, stroke=0) 
        self.c.setFillColorRGB(0, 0, 0) 
        self.c.setFont(FONT_NAME, 14)
        self.c.drawRightString(self.width - 20, box_y + 80, user_info['name'])
        self.c.setFont(FONT_NAME, 10)
        self.c.drawRightString(self.width - 20, box_y + 65, user_info['role'])
        self.c.setFont(FONT_NAME, 10)
        self.c.drawRightString(self.width - 20, box_y + 35, user_info['phone'])
        self.c.drawRightString(self.width - 20, box_y + 20, user_info['email'])
        self.c.save()

    def draw_image_fixed_height(self, img_reader, x, y, w, h):
        self.c.saveState()
        path = self.c.beginPath()
        path.rect(x, y, w, h)
        self.c.clipPath(path, stroke=0, fill=0)
        iw, ih = img_reader.getSize()
        img_aspect = ih / float(iw)
        dh = h
        dw = dh / img_aspect 
        dx = x + (w - dw) / 2
        dy = y 
        self.c.drawImage(img_reader, dx, dy, width=dw, height=dh, mask='auto')
        self.c.restoreState()

    def draw_image_contain(self, img_reader, x, y, w, h, bg_color=(1, 1, 1)):
        self.c.setFillColorRGB(*bg_color)
        self.c.rect(x, y, w, h, fill=1, stroke=0)
        iw, ih = img_reader.getSize()
        img_aspect = ih / float(iw)    
        box_aspect = h / float(w)      
        if img_aspect > box_aspect:
            dh = h
            dw = h / img_aspect
        else:
            dw = w
            dh = w * img_aspect
        dx = x + (w - dw) / 2
        dy = y + (h - dh) / 2
        self.c.drawImage(img_reader, dx, dy, width=dw, height=dh, mask='auto')

    def draw_image_fill(self, img_reader, x, y, w, h):
        self.c.saveState()
        path = self.c.beginPath()
        path.rect(x, y, w, h)
        self.c.clipPath(path, stroke=0, fill=0)

        iw, ih = img_reader.getSize()
        img_aspect = ih / float(iw)
        box_aspect = h / float(w)

        if img_aspect > box_aspect:
            dw = w
            dh = w * img_aspect
            dx = x
            dy = y + (h - dh) / 2
        else:
            dh = h
            dw = h / img_aspect
            dx = x + (w - dw) / 2
            dy = y

        self.c.drawImage(img_reader, dx, dy, width=dw, height=dh, mask='auto')
        self.c.restoreState()

    def draw_thumbnail_cell(self, x, top_y, w, h, image_bytes_list):
        bottom_y = top_y - h
        self.c.setFillColorRGB(1, 1, 1)
        self.c.rect(x, bottom_y, w, h, fill=1, stroke=1)
        
        if not image_bytes_list: return
        
        total_count = min(len(image_bytes_list), 20)
        
        padding = 2   
        
        # ★ [gap 설정] 10, 19, 20장일 때만 2px, 그 외는 4px
        if total_count in [10, 19, 20]:
            gap = 2
        else:
            gap = 5
            
        available_w = w - (padding * 2)
        available_h = h - (padding * 2)
        
        start_y_top = top_y - padding 
        start_x_left = x + padding

        # =========================================================
        # [CASE A] 10, 19, 20장일 때
        # -> 높이 90px 고정 / 너비 자동 / contain / 세로 중앙
        # =========================================================
        if total_count in [10, 19, 20]:
            if total_count <= 10:
                total_rows = 1
                max_standard_per_row = 10 
                first_row_count = total_count
            else:
                total_rows = 2
                max_standard_per_row = 10 
                first_row_count = math.ceil(total_count / 2)

            # 너비 자동 계산
            total_gap_w = (max_standard_per_row - 1) * gap
            thumb_w = (available_w - total_gap_w) / max_standard_per_row 
            
            # ★ 높이 90px 고정
            thumb_h = 90

            # ★ 세로 중앙 정렬 계산
            if total_rows == 1:
                block_h = thumb_h
            else:
                block_h = (thumb_h * 2) + gap
            
            y_offset = (available_h - block_h) / 2
            current_start_y = start_y_top - y_offset

            for idx, img_bytes in enumerate(image_bytes_list[:total_count]):
                try:
                    # ★ 리사이징 적용 (thumb_w, thumb_h는 위에서 계산됨)
                    optimized_reader = optimize_image_for_pdf(img_bytes, thumb_w, thumb_h)
                    if not optimized_reader: continue

                    if idx < first_row_count:
                        row_idx = 0; col_idx = idx; items_in_this_row = first_row_count
                    else:
                        row_idx = 1; col_idx = idx - first_row_count; items_in_this_row = total_count - first_row_count

                    current_gap_total = max(0, items_in_this_row - 1) * gap
                    current_row_width = (items_in_this_row * thumb_w) + current_gap_total
                    x_offset = (available_w - current_row_width) / 2
                    target_x = start_x_left + (col_idx * thumb_w) + (col_idx * gap) + x_offset
                    
                    if row_idx == 0: target_y = current_start_y - thumb_h
                    else: target_y = current_start_y - thumb_h - gap - thumb_h

                    self.draw_image_contain(optimized_reader, target_x, target_y, thumb_w, thumb_h, bg_color=(1, 1, 1))
                except Exception as e:
                    print(f"Thumb error (Case A): {e}")

        # =========================================================
        # [CASE B] 그 외 경우 (1~9, 11~18)
        # -> 75x102 고정 / fill / 2줄 왼쪽 정렬 / 세로 중앙
        # =========================================================
        else:
            thumb_w = 75
            thumb_h = 102
            
            if total_count <= 10:
                total_rows = 1
                first_row_count = total_count
            else:
                total_rows = 2
                first_row_count = math.ceil(total_count / 2)

            # ★ 세로 중앙 정렬 계산
            if total_rows == 1:
                block_h = thumb_h
            else:
                block_h = (thumb_h * 2) + gap
            
            y_offset = (available_h - block_h) / 2
            current_start_y = start_y_top - y_offset

            # [정렬 로직] 2번째 줄 왼쪽 정렬 (기준점: 1번째 줄 시작점)
            items_in_row_0 = first_row_count
            row0_width = (items_in_row_0 * thumb_w) + (max(0, items_in_row_0 - 1) * gap)
            start_x_base = x + (w - row0_width) / 2

            for idx, img_bytes in enumerate(image_bytes_list[:total_count]):
                try:
                    # ★ 리사이징 적용
                    optimized_reader = optimize_image_for_pdf(img_bytes, thumb_w, thumb_h)
                    if not optimized_reader: continue

                    if idx < first_row_count:
                        row_idx = 0; col_idx = idx
                    else:
                        row_idx = 1; col_idx = idx - first_row_count

                    target_x = start_x_base + (col_idx * thumb_w) + (col_idx * gap)
                    
                    if row_idx == 0: target_y = current_start_y - thumb_h
                    else: target_y = current_start_y - thumb_h - gap - thumb_h

                    # fill 사용
                    self.draw_image_fill(optimized_reader, target_x, target_y, thumb_w, thumb_h)
                except Exception as e:
                    print(f"Thumb error (Case B): {e}")

    def draw_table_cell(self, x, top_y, w, h, text, is_header=False, font_size=None):
        bottom_y = top_y - h
        self.c.setFillColorRGB(1, 1, 1)
        self.c.rect(x, bottom_y, w, h, fill=1, stroke=1)
        self.c.setFillColorRGB(0, 0, 0)
        
        if not text: return
        
        if font_size:
            max_font_size = font_size
        else:
            max_font_size = 12 if is_header else 10
            
        min_font_size = 6
        if len(text) > 30 or text.count('\n') > 0:
            text = text.replace('\n', ' ').replace('  ', ' ')
        
        current_font = max_font_size
        final_lines = []
        while current_font >= min_font_size:
            self.c.setFont(FONT_NAME, current_font)
            line_height = current_font + 4
            words = text.split(' ')
            temp_lines = []
            current_line = ""
            for word in words:
                test_line = current_line + word + " "
                if self.c.stringWidth(test_line, FONT_NAME, current_font) < w - 8:
                    current_line = test_line
                else:
                    temp_lines.append(current_line)
                    current_line = word + " "
            if current_line:
                temp_lines.append(current_line)
            total_h = len(temp_lines) * line_height
            if total_h <= h - 4:
                final_lines = temp_lines
                break
            else:
                current_font -= 1
        
        if not final_lines: final_lines = temp_lines
        self.c.setFont(FONT_NAME, current_font)
        line_height = current_font + 4
        max_lines_capacity = int((h - 4) / line_height)
        if len(final_lines) > max_lines_capacity:
            final_lines = final_lines[:max_lines_capacity]
            if final_lines:
                last_line = final_lines[-1]
                if len(last_line) > 3:
                    final_lines[-1] = last_line[:-3] + "..."
                else:
                    final_lines[-1] = "..."
        total_text_h = len(final_lines) * line_height
        start_y = bottom_y + (h / 2) + (total_text_h / 2) - line_height + 2
        if start_y > top_y - line_height: start_y = top_y - line_height - 2
        current_y = start_y
        for line in final_lines:
            if current_y < bottom_y: break
            line = line.strip()
            text_w = self.c.stringWidth(line, FONT_NAME, current_font)
            center_x = max(x + 4, x + (w / 2) - (text_w / 2))
            self.c.drawString(center_x, current_y, line)
            current_y -= line_height

    def draw_emoji_cell(self, x, top_y, w, h, text, font_size=10):
        bottom_y = top_y - h
        self.c.setFillColorRGB(1, 1, 1)
        self.c.rect(x, bottom_y, w, h, fill=1, stroke=1)
        self.c.setFillColorRGB(0, 0, 0)
        
        if not text: return

        base_font = FONT_NAME
        
        lines = []
        current_line = []
        current_width = 0
        max_width = w - 20 

        for char in text:
            if char == '\r': continue
            if char == '\n':
                lines.append(current_line)
                current_line = []
                current_width = 0
                continue

            font_to_use = self.get_target_font(char, base_font)
            try:
                char_w = self.c.stringWidth(char, font_to_use, font_size)
            except:
                char_w = self.c.stringWidth(char, base_font, font_size)

            if current_width + char_w > max_width:
                lines.append(current_line)
                current_line = []
                current_width = 0
            
            current_line.append((char, font_to_use, char_w))
            current_width += char_w
            
        if current_line: lines.append(current_line)

        line_height = font_size + 6
        total_text_h = len(lines) * line_height
        start_y = bottom_y + (h / 2) + (total_text_h / 2) - line_height + 3
        
        current_y = start_y
        for line_chars in lines:
            curr_x = x + 10 
            for char, font, width in line_chars:
                self.c.setFont(font, font_size)
                self.c.drawString(curr_x, current_y, char)
                curr_x += width
            current_y -= line_height
   
    def get_target_font(self, char, base_font):
        code = ord(char)
        if (
            (0x1F600 <= code <= 0x1F64F) or 
            (0x1F300 <= code <= 0x1F5FF) or 
            (0x1F680 <= code <= 0x1F6FF) or 
            (0x2600 <= code <= 0x26FF)   or 
            (0x2700 <= code <= 0x27BF)   or 
            (0xFE00 <= code <= 0xFE0F)   or 
            (0x1F900 <= code <= 0x1F9FF) or 
            (0x1FA70 <= code <= 0x1FAFF)
        ):
            return FONT_EMOJI
        if 0x0C80 <= code <= 0x0CFF:
            return FONT_KANNADA
        if (0x4E00 <= code <= 0x9FFF) or \
           (0x3000 <= code <= 0x30FF) or \
           (0xAC00 <= code <= 0xD7AF): 
             if 0xAC00 <= code <= 0xD7AF: return base_font
             return FONT_CJK
        if 0x1D400 <= code <= 0x1D7FF:
            return FONT_MATH
        if (
            (0x2460 <= code <= 0x24FF) or 
            (0x2500 <= code <= 0x257F) or 
            (0x25A0 <= code <= 0x25FF) or 
            (0x2100 <= code <= 0x214F) or 
            (0xFF00 <= code <= 0xFFEF) 
        ):
            return FONT_SYMBOL
        return base_font