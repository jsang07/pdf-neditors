import React, { useState, useRef, useEffect } from "react";
import { MdFileUpload } from "react-icons/md";
import heic2any from "heic2any"; 

const CoverEditModal = ({ videoMedia, onClose, onComplete }) => {
  const initialTime = videoMedia.selectedTime || 0;
  const [currentTime, setCurrentTime] = useState(initialTime);
  const [duration, setDuration] = useState(0);
  
  const [videoSrc, setVideoSrc] = useState("");
  const [corsAttribute, setCorsAttribute] = useState(undefined);

  const [customThumbnail, setCustomThumbnail] = useState(null);

  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const videoRef = useRef(null);
  const fileInputRef = useRef(null); 

  // [초기화 useEffect]
  useEffect(() => {
    // 1. 비디오 소스 설정 (기존 로직)
    if (videoMedia.file) {
      const objectUrl = URL.createObjectURL(videoMedia.file);
      setVideoSrc(objectUrl);
      setCorsAttribute(undefined);
      
      if (videoMedia.thumbnailUrl && videoMedia.isManual) {
         setCustomThumbnail(videoMedia.thumbnailUrl);
      }

      return () => URL.revokeObjectURL(objectUrl);

    } else if (videoMedia.url) {
      // 2. 저장된 원격 URL인 경우 (수정 모드 등)
      setVideoSrc(`${videoMedia.url}?t=${Date.now()}`); 
      setCorsAttribute("anonymous");

      if (videoMedia.thumbnailUrl) {
        setCustomThumbnail(videoMedia.thumbnailUrl);
      }
    }
  }, [videoMedia]);

  const handleFileProcess = async (file) => {
    if (!file) return;

    const name = file.name.toLowerCase();
    const isHeic = name.endsWith(".heic") || name.endsWith(".heif");

    if (!isHeic && !file.type.startsWith("image/")) {
      alert("이미지 파일(JPG, PNG, HEIC 등)만 업로드 가능합니다.");
      return;
    }

    setIsProcessing(true);

    try {
      let fileToRead = file;

      if (isHeic) {
        // [1] 파일 데이터를 ArrayBuffer로 (PC 호환성용)
        const arrayBuffer = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = (e) => reject(e);
          reader.readAsArrayBuffer(file);
        });

        // [2] 변환 시도
        try {
          // image/heic 달고 변환
          const heicBlob = new Blob([arrayBuffer], { type: "image/heic" });
          const convertedBlob = await heic2any({
            blob: heicBlob,
            toType: "image/jpeg",
            quality: 0.8,
          });
          fileToRead = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
        
        } catch (firstError) {
          // 실패 시
          try {
             console.warn("1차 변환 실패, HEIF로 재시도...");
             // image/heif 명찰 달고 재시도
             const heifBlob = new Blob([arrayBuffer], { type: "image/heif" });
             const convertedBlob = await heic2any({
               blob: heifBlob,
               toType: "image/jpeg",
               quality: 0.8,
             });
             fileToRead = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
          
          } catch (finalError) {
             console.error("HEIC 변환 최종 실패:", finalError);
             setIsProcessing(false);
             
             alert("고화질(Raw) 또는 모션 포토(Live Photo)가 포함된 HEIC 이미지는 브라우저에서 변환할 수 없습니다.\n\n일반 JPG로 변환해서 업로드해주시거나, '정지된' HEIC 이미지를 사용해주세요.");
             return; 
          }
        }
      }

      // 변환 성공한 파일(또는 일반 이미지) 읽기
      const reader = new FileReader();
      reader.onload = (e) => {
        setCustomThumbnail(e.target.result);
        setIsProcessing(false);
      };
      reader.readAsDataURL(fileToRead);

    } catch (error) {
      console.error("파일 처리 중 알 수 없는 오류:", error);
      alert("이미지 처리에 실패했습니다.");
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    handleFileProcess(file);
    e.target.value = ""; 
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const file = e.dataTransfer.files[0];
    handleFileProcess(file);
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      if (initialTime > 0) {
        videoRef.current.currentTime = initialTime;
      }
    }
  };

  const handleSliderChange = (e) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
  
    if (customThumbnail) {
      setCustomThumbnail(null); 
    }
    
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  const handleConfirm = () => {
    if (customThumbnail) {
      onComplete(videoMedia.id, customThumbnail, currentTime);
      return;
    }

    const video = videoRef.current;
    if (!video) {
      onClose();
      return;
    }

    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const finalImageUrl = canvas.toDataURL("image/jpeg", 0.9);

      onComplete(videoMedia.id, finalImageUrl, currentTime);
    } catch (e) {
      console.error("썸네일 캡처 실패:", e);
      onClose();
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>썸네일 선택</h3>
          <div 
            className="manual-upload-btn" 
            onClick={() => !isProcessing && fileInputRef.current.click()} 
            title="이미지를 직접 업로드하거나 드래그하세요"
            style={{ opacity: isProcessing ? 0.6 : 1, cursor: isProcessing ? 'wait' : 'pointer' }}
          >
            <MdFileUpload size={16} style={{ marginRight: 4 }} />
            {isProcessing ? "변환 중..." : "이미지 직접 선택"}
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            style={{ display: "none" }} 
            accept="image/*, .heic, .HEIC" 
            onChange={handleFileChange}
          />
        </div>
        
        <div 
          className={`video-preview-container ${isDragOver ? "drag-active" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isProcessing ? (
            <div style={{ color: "white", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div className="spinner" style={{ width: 30, height: 30, border: "3px solid #666", borderTop: "3px solid #fff", marginBottom: 10 }}></div>
              <span style={{ fontSize: 14 }}>이미지 변환 중...</span>
            </div>
          ) 
          : customThumbnail ? (
            <div className="custom-preview-wrapper">
              <img src={customThumbnail} alt="Custom Thumbnail" className="cover-preview" />
              {/* <div className="custom-badge">직접 선택한 이미지</div> */}
            </div>
          ) 
          : (
            videoSrc && (
              <video
                ref={videoRef}
                src={videoSrc}
                onLoadedMetadata={handleLoadedMetadata}
                className="cover-preview"
                muted
                playsInline
                crossOrigin={corsAttribute} 
              />
            )
          )}
          
          {isDragOver && (
            <div className="drag-overlay-text">
              이미지를 놓아서 썸네일 변경 (HEIC 가능)
            </div>
          )}
        </div>

        <div className="timeline-container">
          <input
            type="range"
            min="0"
            max={duration || 100}
            step="0.1"
            value={currentTime}
            onChange={handleSliderChange}
            className="timeline-slider"
            disabled={isProcessing} 
          />
          <p className="guide-text">
            {customThumbnail 
              ? "슬라이더를 움직이면 다시 영상 프레임을 선택합니다." 
              : "슬라이더를 움직여 원하는 장면을 선택하거나, 위 화면에 이미지를 드래그하세요."}
          </p>
        </div>

        <div className="modal-actions">
          <button className="btn-cancel" onClick={onClose}>
            취소
          </button>
          <button className="btn-confirm" onClick={handleConfirm} disabled={isProcessing}>
            {isProcessing ? "처리 중..." : "완료"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CoverEditModal;