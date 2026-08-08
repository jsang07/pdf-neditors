import React, { useRef, useState, useEffect } from "react";
import { MdAddCircleOutline, MdFormatListNumbered } from "react-icons/md";
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCorners, 
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  rectSortingStrategy, 
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import "../styles/home.css";

// -------------------------------------------------------------
// [1] 공통 UI 컴포넌트 (PC/모바일 공용)
// -------------------------------------------------------------

const HorizontalScrollBox = React.forwardRef(({ children, className }, ref) => {
  const localRef = useRef(null);

  // PC에서 마우스 휠로 가로 스크롤 지원
  useEffect(() => {
    const el = localRef.current;
    if (!el) return;
    const isTouch = typeof window !== "undefined" && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    if (isTouch) return; // 모바일은 터치 스크롤 사용

    const onWheel = (e) => {
      if (e.deltaY === 0) return;
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div ref={(node) => { localRef.current = node; if (ref) ref.current = node; }} className={className}>
      {children}
    </div>
  );
});

// [2] 미디어 아이템 (썸네일)
const MediaItem = React.forwardRef(
  ({ media, index, removeMedia, onThumbnailClick, style, isOverlay, isDraggable = true, ...props }, ref) => {
    const displaySrc = media.thumbnailUrl || media.url;
    
    const [isLoaded, setIsLoaded] = useState(false);

    return (
      <div
        ref={ref}
        style={{
          ...style,
          cursor: isDraggable ? (isOverlay ? "grabbing" : "grab") : "default",
          touchAction: isDraggable ? (isOverlay ? "none" : "manipulation") : "auto",
          position: "relative", 
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
          ...(isOverlay && {
            zIndex: 9999, opacity: 1, boxShadow: "0px 10px 20px rgba(0,0,0,0.3)",
            transform: "scale(1.05)", borderRadius: "8px", background: "white",
          }),
        }}
        className={`media-thumbnail ${isDraggable ? 'draggable' : ''} ${index === 0 ? "main-media" : ""}`}
        {...props}
      >
        {!isLoaded && (
          <div className="thumb-loading-overlay">
            <div className="mini-spinner"></div>
          </div>
        )}

        <img
          src={displaySrc}
          className="thumb-img"
          alt="media-thumb"
          draggable={false}
          crossOrigin="anonymous"
          
          onLoad={() => setIsLoaded(true)}
          
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: "8px",
            opacity: isLoaded ? 1 : 0, 
            transition: "opacity 0.2s"
          }}
        />

        {media.type === "video" && !isOverlay && (
          <button
            className="mini-thumb-btn"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onThumbnailClick(media); }}
          >
            썸네일 설정
          </button>
        )}

        <span className="order-badge">{index + 1}</span>

        {!isOverlay && (
          <button
            className="media-delete-btn"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => removeMedia(e, media.id)}
          >
            ×
          </button>
        )}
      </div>
    );
  }
);

// PC용 Sortable 래퍼
function SortableMediaItem({ media, index, removeMedia, onThumbnailClick }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: String(media.id) });
  const style = {
    transform: CSS.Translate.toString(transform ? { ...transform, y: 0 } : null),
    transition,
    opacity: isDragging ? 0.3 : 1
  };
  return (
    <MediaItem
      ref={setNodeRef} style={style} media={media} index={index}
      removeMedia={removeMedia} onThumbnailClick={onThumbnailClick}
      isOverlay={false} isDraggable={true}
      {...attributes} {...listeners}
    />
  );
}

// -------------------------------------------------------------
// [2] 모바일 전용: 순서 변경 모달 (ReorderModal)
// -------------------------------------------------------------
// [모바일 전용] 순서 변경 모달 아이템
const GridItem = ({ media, index, onRemove }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: String(media.id) });
  
  const [isLoaded, setIsLoaded] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    touchAction: "manipulation",
  };

  return (
    <div ref={setNodeRef} style={style} className={`grid-item ${isDragging ? 'dragging' : ''}`} {...attributes} {...listeners}>
      {!isLoaded && (
        <div className="thumb-loading-overlay" style={{borderRadius: "5px"}}>
          <div className="mini-spinner"></div>
        </div>
      )}

      <img 
        src={media.thumbnailUrl || media.url} 
        className="grid-img" 
        alt="" 
        crossOrigin="anonymous" 
        draggable={false}
        
        onLoad={() => setIsLoaded(true)}
        style={{
            opacity: isLoaded ? 1 : 0,
            transition: "opacity 0.2s"
        }}
      />
      
      <div className="grid-number">{index + 1}</div>

      {!isDragging && (
        <button 
          className="grid-delete-btn"
          onPointerDown={(e) => e.stopPropagation()} 
          onTouchStart={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation(); 
            onRemove(media.id);
          }}
        >
          ×
        </button>
      )}
    </div>
  );
};

// [모바일 전용] 인스타 스타일 순서 선택 모달 
const ReorderModal = ({ isOpen, initialMedia, onClose, onSave }) => {
  const [selectedOrder, setSelectedOrder] = useState([]);
  const [previewId, setPreviewId] = useState(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"; 
      const allIds = initialMedia.map(m => m.id);
      setSelectedOrder(allIds);
      setPreviewId(allIds[0] || null);
    } else {
      document.body.style.overflow = ""; 
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen, initialMedia]);

  const handleItemClick = (id) => { 
    setPreviewId(id);
    setSelectedOrder((prev) => {
      if (prev.includes(id)) return prev.filter((itemId) => itemId !== id);
      else return [...prev, id];
    });
  };
  const handleReset = () => { setSelectedOrder([]); };
  const handleComplete = () => {
    const newOrderedMedia = selectedOrder
      .map(id => initialMedia.find(m => m.id === id))
      .filter(m => m !== undefined);

    const unselectedMedia = initialMedia.filter(m => !selectedOrder.includes(m.id));

    onSave([...newOrderedMedia, ...unselectedMedia]);
  };

  if (!isOpen) return null;
  const previewMedia = initialMedia.find(m => m.id === previewId);

  return (
    <div className="reorder-modal-overlay">
      <div className="reorder-modal-content">
        
        {/* 헤더 */}
        <div className="reorder-header-bar">
          <button className="header-btn cancel" onClick={onClose}>취소</button>
          <div className="reorder-header-title"></div>
          <button 
            className="header-btn next" 
            onClick={handleComplete}
            disabled={selectedOrder.length === 0}
          >
            다음
          </button>
        </div>

        <div className="reorder-scroll-container">
          
          <div className="big-preview-container">
            {previewMedia ? (
              <img 
                src={previewMedia.thumbnailUrl || previewMedia.url} 
                className="big-preview-img" 
                alt="preview" 
              />
            ) : (
              <div className="big-preview-placeholder">
                <span>선택된 사진 없음</span>
              </div>
            )}
          </div>

          {/* 컨트롤 바 */}
          <div className="control-bar">
            <button className="reset-btn-circle" onClick={handleReset}>
              선택 초기화
            </button>
          </div>

          {/* 하단 그리드 */}
          <div className="selection-grid">
            {initialMedia.map((media) => {
              const orderIndex = selectedOrder.indexOf(media.id);
              const isSelected = orderIndex !== -1;

              return (
                <div 
                  key={media.id} 
                  className={`select-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleItemClick(media.id)}
                >
                  <img 
                    src={media.thumbnailUrl || media.url} 
                    className="select-img" 
                    alt="" 
                  />
                  
                  <div className="select-circle">
                    {isSelected && <span className="select-number">{orderIndex + 1}</span>}
                  </div>
                </div>
              );
            })}
          </div>

        </div> 
        
      </div>
    </div>
  );
};


// -------------------------------------------------------------
// [3] 메인 컴포넌트: UploadSection
// -------------------------------------------------------------
const UploadSection = ({
  mediaFiles,
  handleFileUpload,
  removeMedia,
  onThumbnailClick,
  onDragEnd, 
  onReorderComplete, 
}) => {
  const fileInputRef = useRef(null);
  const scrollContainerRef = useRef(null);

  const [activeId, setActiveId] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // PC용 센서
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 0 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  // PC용 핸들러
  const handleDragStart = (e) => setActiveId(e.active.id);
  const handleDragEndWrapper = (e) => { onDragEnd(e); setActiveId(null); };
  const activeItem = mediaFiles.find((m) => String(m.id) === String(activeId));
  const activeIndex = mediaFiles.findIndex((m) => String(m.id) === String(activeId));

  const handleMobileReorderSave = (newItems) => {
    if (onReorderComplete) {
      onReorderComplete(newItems);
    }
    setIsReorderModalOpen(false);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const onDragLeave = (e) => {
    e.preventDefault();
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setIsDragOver(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);

    // 드롭된 파일이 있으면 handleFileUpload 호출
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const fakeEvent = {
        target: {
          files: e.dataTransfer.files
        }
      };
      handleFileUpload(fakeEvent);
    }
  };

  return (
    <div className="upload-section">
      <input
        type="file" accept="image/*, video/mp4, video/quicktime, video/webm, .heic, .HEIC"
        multiple ref={fileInputRef} style={{ display: "none" }}
        onClick={(e) => (e.target.value = null)} onChange={handleFileUpload}
      />

      {/* =======================
          [A] 모바일 뷰 (Mobile View)
         ======================= */}
      {isMobile ? (
        <>
          {/* 1. 상단 버튼 2개 (업로드 / 순서변경) */}
          <div className="mobile-action-header">
            <div className="mobile-action-btn" onClick={() => fileInputRef.current.click()}>
              <MdAddCircleOutline size={24} color="#555" style={{ marginBottom: 4 }} />
              사진/영상 추가
            </div>
            <div className="mobile-action-btn" onClick={() => {
              if (mediaFiles.length === 0) return alert("순서를 변경할 이미지가 없습니다.");
              setIsReorderModalOpen(true);
            }}>
              <MdFormatListNumbered size={24} color="#555" style={{ marginBottom: 4 }} />
              순서 변경
            </div>
          </div>

          {/* 2. 하단 단순 리스트 (드래그 X, 스크롤만 O) */}
          {mediaFiles.length > 0 && (
            <div className="mobile-list-container">
              <HorizontalScrollBox className="upload-list">
                {mediaFiles.map((media, index) => (
                  <MediaItem
                    key={String(media.id)}
                    media={media}
                    index={index}
                    removeMedia={removeMedia}
                    onThumbnailClick={onThumbnailClick}
                    isDraggable={false} 
                    isOverlay={false}
                  />
                ))}
              </HorizontalScrollBox>
            </div>
          )}

          {/* 3. 순서 변경 모달 */}
          <ReorderModal
            isOpen={isReorderModalOpen}
            initialMedia={mediaFiles}
            onClose={() => setIsReorderModalOpen(false)}
            onSave={handleMobileReorderSave}
          />
        </>
      ) : (
        /* =======================
            [B] PC 뷰 (Desktop View) 
           ======================= */
        <div 
          className={`upload-box-container ${isDragOver ? "drag-active" : ""}`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          style={isDragOver ? { border: "2px dashed #424242", backgroundColor: "#f0f0f0" } : {}}
        >
          <div className="upload-add-btn" onClick={() => fileInputRef.current.click()}>
            <div className="upload-icon-placeholder"><MdAddCircleOutline size={28} color="#555" /></div>
            <span style={{ fontSize: "12px", color: "#666" }}>사진/영상 추가</span>
          </div>

          <HorizontalScrollBox ref={scrollContainerRef} className="upload-list">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEndWrapper} modifiers={[restrictToHorizontalAxis]} autoScroll={{ enabled: true, acceleration: 10 }}>
              <SortableContext items={mediaFiles.map((m) => String(m.id))} strategy={horizontalListSortingStrategy}>
                {mediaFiles.map((media, index) => (
                  <SortableMediaItem key={String(media.id)} media={media} index={index} removeMedia={removeMedia} onThumbnailClick={onThumbnailClick} />
                ))}
              </SortableContext>
              <DragOverlay adjustScale={true} zIndex={9999}>
                {activeId && activeItem ? <MediaItem media={activeItem} index={activeIndex} isOverlay={true} removeMedia={() => { }} onThumbnailClick={() => { }} /> : null}
              </DragOverlay>
            </DndContext>
          </HorizontalScrollBox>
        </div>
      )}
    </div>
  );
};

export default UploadSection;