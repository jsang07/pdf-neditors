import React, { useRef } from "react"; // ★ useRef 추가
import DatePicker from "react-datepicker";
import { addHours, format } from "date-fns";
import { ko } from "date-fns/locale";
import { MdKeyboardArrowUp, MdKeyboardArrowDown } from "react-icons/md";
import "react-datepicker/dist/react-datepicker.css";
import "../styles/CustomDateTimePicker.css";

const CustomDateTimePicker = ({ selectedDate, onChange }) => {
  const date = selectedDate || new Date();

  const touchStartY = useRef(null);

  const handleTimeChange = (type, direction) => {
    let newDate = new Date(date);

    if (type === "hour") {
      newDate = addHours(newDate, direction);
    } else if (type === "minute") {
      const currentMinute = newDate.getMinutes();
      if (direction > 0) {
        if (currentMinute < 30) {
          newDate.setMinutes(30);
        } else {
          newDate = addHours(newDate, 1);
          newDate.setMinutes(0);
        }
      } else {
        if (currentMinute >= 30) {
          newDate.setMinutes(0);
        } else {
          newDate = addHours(newDate, -1);
          newDate.setMinutes(30);
        }
      }
    }
    onChange(newDate);
  };

  // PC 마우스 휠 핸들러
  const handleWheel = (e, type) => {
    const direction = e.deltaY < 0 ? 1 : -1;
    handleTimeChange(type, direction);
  };

  // 모바일 터치 시작
  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
  };

  // 모바일 터치 이동 (스와이프)
  const handleTouchMove = (e, type) => {
    if (touchStartY.current === null) return;

    const touchCurrentY = e.touches[0].clientY;
    const diff = touchStartY.current - touchCurrentY; 

    if (Math.abs(diff) > 30) {
      // 위로 스와이프(diff > 0) -> 숫자 증가 (1)
      // 아래로 스와이프(diff < 0) -> 숫자 감소 (-1)
      const direction = diff > 0 ? 1 : -1;
      
      handleTimeChange(type, direction);
      touchStartY.current = touchCurrentY;
    }
  };

  // 모바일 터치 종료
  const handleTouchEnd = () => {
    touchStartY.current = null;
  };

  const formattedFullDate = format(date, "yyyy-MM-dd HH:mm");
  const formattedHour = format(date, "HH");
  const formattedMinute = format(date, "mm");

  return (
    <div className="custom-datetime-card">
      <div className="datetime-header">
        <h3>업로드 일자</h3>
      </div>
      <div className="current-selection-display">{formattedFullDate}</div>

      <div className="datetime-content">
        <div className="time-picker-section">
          <div className="time-date-label">{format(date, "yyyy-MM-dd")}</div>

          <div className="digital-clock-container">
            
            {/* 시간(Hour) 영역 */}
            <div 
              className="time-column"
              onWheel={(e) => handleWheel(e, "hour")} // PC 휠
              // ★ 모바일 터치 이벤트 연결
              onTouchStart={handleTouchStart}
              onTouchMove={(e) => handleTouchMove(e, "hour")}
              onTouchEnd={handleTouchEnd}
            >
              <button
                type="button"
                onClick={() => handleTimeChange("hour", 1)}
                className="arrow-btn up"
              >
                <MdKeyboardArrowUp size={30} />
              </button>
              
              <div className="time-value">{formattedHour}</div>
              
              <button
                type="button"
                onClick={() => handleTimeChange("hour", -1)}
                className="arrow-btn down"
              >
                <MdKeyboardArrowDown size={30} />
              </button>
            </div>

            <div className="time-separator">:</div>

            {/* 분(Minute) 영역 */}
            <div 
              className="time-column"
              onWheel={(e) => handleWheel(e, "minute")} // PC 휠
              // ★ 모바일 터치 이벤트 연결
              onTouchStart={handleTouchStart}
              onTouchMove={(e) => handleTouchMove(e, "minute")}
              onTouchEnd={handleTouchEnd}
            >
              <button
                type="button"
                onClick={() => handleTimeChange("minute", 1)}
                className="arrow-btn up"
              >
                <MdKeyboardArrowUp size={30} />
              </button>
              
              <div className="time-value">{formattedMinute}</div>
              
              <button
                type="button"
                onClick={() => handleTimeChange("minute", -1)}
                className="arrow-btn down"
              >
                <MdKeyboardArrowDown size={30} />
              </button>
            </div>
          </div>
        </div>

        <div className="date-vertical-divider"></div>

        <div className="date-picker-section">
          <DatePicker
            selected={date}
            onChange={(date) => onChange(date)}
            inline
            locale={ko}
            calendarClassName="embedded-calendar"
          />
        </div>
      </div>
    </div>
  );
};

export default CustomDateTimePicker;