import React, { useRef, useState, useEffect } from "react";
import "react-datepicker/dist/react-datepicker.css";
import { MdCalendarToday } from "react-icons/md";
import CustomDateTimePicker from "./CustomerDateTimePicker";
import { BsEmojiSmile } from "react-icons/bs";
import { format } from "date-fns";

const InputSection = ({
  brand,
  setBrand,
  receiver,
  setReceiver,
  currentPage,
  updateCurrentPage,
  handleSmartInput,
  handleDateSelect,
  textAreaRef,
  onEmojiToggle,
}) => {
  // 1. 팝업 열림/닫힘 상태 관리
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const pickerRef = useRef(null); // 외부 클릭 감지용

  // 2. 외부 클릭 시 닫기 (선택사항이지만 UX상 필수)
  useEffect(() => {
    function handleClickOutside(event) {
      if (event.target.classList.contains("picker-popup-container")) {
        setIsPickerOpen(false);
        return;
      }

      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setIsPickerOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  // 3. 날짜 파싱 헬퍼 
  const parseDateString = (dateString) => {
    if (!dateString) return new Date();
    try {
      const [datePart, timePart] = dateString.split(" / ");
      const [year, month, day] = datePart.split(".").map(Number); 
      const [hour, minute] = timePart.split(":").map(Number); 

      // 유효하지 않은 날짜면 현재 시간 반환
      if (isNaN(year) || isNaN(month) || isNaN(day)) return new Date();

      return new Date(year, month - 1, day, hour, minute);
    } catch (e) {
      return new Date();
    }
  };

  // 4. 날짜 변경 핸들러
  const handleCustomDateChange = (date) => {
    handleDateSelect(date);
  };

  const handleFocusMoveToEnd = (e) => {
    const length = e.target.value.length;
    setTimeout(() => {
      e.target.setSelectionRange(length, length);
    }, 0);
  };

  return (
    <div className="form-grid-container">
      <div className="form-column">
        {/* 유가명 (공통) */}
        <div className="input-group">
          <label>유가명</label>
          <textarea
            className="rounded-input medium-textarea"
            placeholder="유가명"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
          ></textarea>
        </div>

        {/* 수신자 (공통) */}
        <div className="input-group">
          <label>광고주</label>
          <textarea
            className="rounded-input medium-textarea"
            placeholder="광고주"
            value={receiver}
            onChange={(e) => setReceiver(e.target.value)}
          ></textarea>
        </div>

        {/* 업로드 일자 */}
        <div className="input-group">
          <label>업로드 일자</label>

          <div
            className="custom-datepicker-wrapper"
            ref={pickerRef}
            style={{ position: "relative" }}
          >
            {/* 1. 보여지는 Input 창 (읽기 전용, 누르면 팝업 열림) */}
            <input
              type="text"
              className="rounded-input medium-textarea"
              value={currentPage.uploadDate || ""}
              placeholder="업로드 일자"
              readOnly 
              onClick={() => setIsPickerOpen(!isPickerOpen)} 
            />

            {/* 2. 달력 아이콘 버튼 */}
            <button
              className="custom-datepicker-icon-btn"
              onClick={() => setIsPickerOpen(!isPickerOpen)}
            >
              <MdCalendarToday size={26} color="#000" />
            </button>

            {/* 3. 커스텀 팝업 */}
            {isPickerOpen && (
              <div className="picker-popup-container">
                <CustomDateTimePicker
                  selectedDate={parseDateString(currentPage.uploadDate)}
                  onChange={handleCustomDateChange}
                />
              </div>
            )}
          </div>
        </div>

        {/* 계정 태그 */}
        <div className="input-group">
          <label>계정 태그</label>
          <textarea
            className="rounded-input medium-textarea account-tag-text"
            placeholder="@eyesmag"
            value={currentPage.accountTagInput}
            onChange={(e) => handleSmartInput(e, "accountTagInput", "@")}
          ></textarea>
        </div>
      </div>

      <div
        className="form-column"
        style={{ display: "flex", flexDirection: "column" }}
      >
        {/* 해시태그 */}
        <div className="input-group">
          <label>댓글 해시태그</label>
          <textarea
            className="rounded-input tag-medium-textarea"
            placeholder="#eyesmag"
            value={currentPage.hashtags}
            onChange={(e) => handleSmartInput(e, "hashtags", "#")}
            onFocus={handleFocusMoveToEnd}
          ></textarea>
        </div>

        {/* 본문 내용 */}
        <div
          className="input-group flex-grow-group"
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
          }}
        >

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <label style={{ marginBottom: 0 }}>내용</label>

            {/* 스마일 버튼 */}
            <BsEmojiSmile
              className="emoji-toggle-btn"
              size={16}
              color="#666"
              style={{ cursor: "pointer" }}
              onClick={onEmojiToggle} // 클릭 시 실행
              title="이모티콘 넣기"
            />
          </div>
          <textarea
            ref={textAreaRef}
            className="rounded-input fill-textarea"
            style={{ height: "300px" }}
            placeholder="#광고"
            value={currentPage.content}
            onChange={(e) => updateCurrentPage("content", e.target.value)}
          ></textarea>
        </div>
      </div>
    </div>
  );
};

export default InputSection;
