import React, { useEffect } from "react";
import EmojiPicker, { EmojiStyle } from "emoji-picker-react";
import { useFloating, autoUpdate, offset, flip, shift } from "@floating-ui/react";

// 1. 영상 썸네일 확인 모달
export const ConfirmThumbnailModal = ({ onConfirm, onCancel }) => {
  return (
    <div className="modal-overlay">
      <div className="confirm-modal-box">
        <p className="confirm-message">
          현재 선택된 프레임이 영상의 첫 프레임입니다
          <br />
          썸네일로 사용하시겠습니까?
        </p>
        <div className="confirm-actions">
          <button className="btn-change" onClick={onCancel}>
            취소
          </button>
          <button className="btn-use" onClick={onConfirm}>
            완료
          </button>
        </div>
      </div>
    </div>
  );
};

// 2. 임시 저장 완료 모달
export const DraftSavedModal = ({ onConfirm }) => {
  return (
    <div className="modal-overlay">
      <div className="confirm-modal-box">
        <p className="confirm-message" style={{ margin: "30px 0" }}>
          유가시안이 임시 저장되었습니다
        </p>
        <div className="confirm-actions" style={{ justifyContent: "center" }}>
          <button className="btn-use" onClick={onConfirm}>
            확인
          </button>
        </div>
      </div>
    </div>
  );
};

// 3. 플로팅 이모지 피커
export const FloatingEmojiPicker = ({ position, onEmojiClick, onClose }) => {
  const { refs, floatingStyles } = useFloating({
    placement: "bottom-start", // 기본은 커서의 '오른쪽 아래'에 뜸
    whileElementsMounted: autoUpdate, // 화면 스크롤/리사이즈 시 자동 위치 조정
    middleware: [
      offset(10), 
      flip(),    
      shift({ padding: 10 }), 
    ],
  });

  // 2. 부모에서 받은 좌표(position x,y)를 Floating UI의 기준점(Reference)으로 등록
  useEffect(() => {
    refs.setPositionReference({
      getBoundingClientRect() {
        return {
          width: 0,
          height: 0,
          x: position.x,
          y: position.y,
          top: position.y,
          left: position.x,
          right: position.x,
          bottom: position.y,
        };
      },
    });
  }, [position, refs]);

  return (
    <div
      ref={refs.setFloating}
      style={{
        ...floatingStyles, 
        zIndex: 9999,
        background: "#222",
        borderRadius: "10px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "5px 10px",
          background: "#333",
          color: "#fff",
          display: "flex",
          justifyContent: "flex-end",
          fontSize: "14px",
        }}
      >
      </div>
      <EmojiPicker
        onEmojiClick={onEmojiClick}
        emojiStyle={EmojiStyle.APPLE}
        theme="dark"
        height={380}
        width={350}
      />
    </div>
  );
};

export const UnsavedCheckModal = ({ onConfirm, onCancel }) => {
  return (
    <div className="modal-overlay">
      <div className="confirm-modal-box" onClick={(e) => e.stopPropagation()}>
        <p className="confirm-message" style={{ fontWeight: "bold" }}>
          현재 작성중인 유가시안이 있습니다.
          <br />
          <span style={{ fontWeight: "bold", fontSize: "18px" }}>
            임시저장 하시겠습니까?
          </span>
        </p>

        <div className="confirm-actions">
          <button className="btn-confirm" onClick={onConfirm}>
            확인
          </button>
          <button className="btn-cancel" onClick={onCancel}>
            취소
          </button>
        </div>
      </div>
    </div>
  );
};
