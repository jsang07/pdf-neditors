import React from "react";
import defaultImage from "../assets/default-image.jpg"; // 경로 확인 필요
import { parseContentWithTags } from "../utils/formatUtils"; // 경로 확인 필요
import "../styles/home.css";

import instaHeaderImg from "../assets/insta-header.png";
import instaIconsLeft from "../assets/insta-icons-left.png";
import instaIconsRight from "../assets/insta-icons-rigth.png";

const PreviewSection = ({
  cardRef,
  currentPage,
  checkBeforeGenerate,
  // handleRealPreview,
  handleSaveDraft,
}) => {
  const mediaCount = currentPage.mediaFiles.length;

  return (
    <section className="content-left">
      <div className="insta-card" ref={cardRef}>

        {/* 헤더 영역 */}
        <div className="card-header-image-wrapper">
          <img
            src={instaHeaderImg}
            alt="Instagram Header"
            style={{ width: '100%', height: 'auto', display: 'block' }}
          />
        </div>

        {/* 미디어 미리보기 영역 */}
        <div className="card-media-area">
          {currentPage.mediaFiles.length > 0 ? (
            <>
              {currentPage.mediaFiles[0].thumbnailUrl ? (
                <img
                  src={currentPage.mediaFiles[0].thumbnailUrl}
                  className="card-media-preview"
                  alt=""
                />
              ) : currentPage.mediaFiles[0].type === "video" ? (
                <video
                  src={currentPage.mediaFiles[0].url}
                  className="card-media-preview"
                  muted
                  playsInline
                />
              ) : (
                <img
                  src={currentPage.mediaFiles[0].url}
                  className="card-media-preview"
                  alt=""
                />
              )}
              {mediaCount > 1 && (
                <div className="media-counter">1/{mediaCount}</div>
              )}
            </>
          ) : (
            <img
              src={defaultImage}
              className="card-media-preview"
              alt="Default"
            />
          )}
        </div>

        <div className="card-footer">
          {mediaCount > 1 && (
            <div className="carousel-indicators">
              {[...Array(Math.min(mediaCount, 4))].map((_, i) => (
                <div
                  key={i}
                  className={`indicator-dot ${i === 0 ? "active" : ""}`}
                ></div>
              ))}
            </div>
          )}

          {/* 아이콘 영역 */}
          <div className="card-icons-image-wrapper"
            style={{
              paddingTop: '2px',
              paddingBottom: '6px',
              width: '100%' 
            }}>

            <div className="insta-icons" style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              width: '100%'
            }}>
              <img
                src={instaIconsLeft}
                alt="Instagram Icons"
                style={{
                  height: '24px',  
                  width: 'auto',   
                  display: 'block'
                }}
              />
              <img
                src={instaIconsRight}
                alt="Instagram Icons"
                style={{
                  height: '24px',  
                  width: 'auto',
                  display: 'block'
                }}
              />
            </div>
          </div>

          <div className="card-caption">
            <span className="caption-id">eyesmag</span>
            <span className="caption-content">
              {parseContentWithTags(currentPage.content)}
            </span>
          </div>
        </div>
      </div>

      <div className="action-buttons">
        <>
          <button className="btn-generate" onClick={checkBeforeGenerate}>
            생성
          </button>
          <button className="btn-save-draft" onClick={handleSaveDraft}>
            임시 저장
          </button>
        </>
      </div>
    </section>
  );
};

export default PreviewSection;