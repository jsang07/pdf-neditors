import { getVideoFrameUrl } from "../utils/mediaUtils";
import heic2any from "heic2any";
import imageCompression from "browser-image-compression";

// [헬퍼] Base64 문자열을 실제 파일 객체로 변환 (PDF 전송용)
const dataURLtoFile = (dataurl, filename) => {
  if (!dataurl) return null;
  try {
    const arr = dataurl.split(",");
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  } catch (e) {
    return null;
  }
};

// [헬퍼] 썸네일 실패 시 보여줄 기본 이미지 생성기
const createFallbackThumbnail = (filename) => {
  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = 180;
  const ctx = canvas.getContext("2d");
  // 회색 배경
  ctx.fillStyle = "#555555";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // 글자
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 24px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("VIDEO", canvas.width / 2, canvas.height / 2);
  
  return canvas.toDataURL("image/jpeg", 0.7);
};

export const useMediaLogic = (currentPage, updateCurrentPage) => {

const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    e.target.value = null;

    if (currentPage.mediaFiles.length + files.length > 20) {
      alert("이미지는 최대 20장까지만 업로드할 수 있습니다.");
      return; 
    }

    const newMediaPromises = files.map(async (rawFile) => {
      let originalFile = rawFile;
      let file = rawFile;

      // [타입 보정] 확장자 확인 및 비디오 타입 강제 주입
      const ext = file.name.split('.').pop().toLowerCase();
      const VIDEO_EXTS = ['mp4', 'mov', 'avi', 'webm', 'mkv'];
      let isVideo = file.type.startsWith("video") || VIDEO_EXTS.includes(ext);

      if (isVideo && !file.type) {
         try { file = new File([rawFile], rawFile.name, { type: 'video/mp4' }); } catch(e) {}
      }

      try {
        // [A] 이미지 처리
        if (!isVideo) {
          const name = file.name.toLowerCase();
          const isHeic = name.endsWith(".heic") || name.endsWith(".heif");

          if (isHeic) {
            try {
              // 1. PC 호환성을 위해 ArrayBuffer로 데이터 추출
              const arrayBuffer = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = (e) => reject(e);
                reader.readAsArrayBuffer(file);
              });

              let convertedBlob = null;

              // 2. 변환 시도 (2중 안전장치: heic -> heif)
              try {
                const heicBlob = new Blob([arrayBuffer], { type: "image/heic" });
                convertedBlob = await heic2any({ blob: heicBlob, toType: "image/jpeg", quality: 0.8 });
              } catch (e1) {
                try {
                  const heifBlob = new Blob([arrayBuffer], { type: "image/heif" });
                  convertedBlob = await heic2any({ blob: heifBlob, toType: "image/jpeg", quality: 0.8 });
                } catch (e2) {
                  throw new Error("HEIC_CONVERT_FAIL"); 
                }
              }

              // 3. 변환 성공 시 파일 교체
              const finalBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
              file = new File(
                [finalBlob], 
                file.name.replace(/\.heic$/i, ".jpg").replace(/\.heif$/i, ".jpg"), 
                { type: "image/jpeg", lastModified: Date.now() }
              );

            } catch (err) { 
              console.error(`HEIC 변환 실패 (${file.name}):`, err);
              alert(`파일 "${file.name}"은(는) 고화질(Raw) 또는 모션 포토 정보가 포함되어 있어 브라우저 변환이 불가능합니다.\nJPG로 변환하여 업로드해주세요.`);
              return null; 
            }
          }

          // 2. 이미지 압축
          const options = {
            maxSizeMB: 2,
            maxWidthOrHeight: 1920, 
            useWebWorker: false,    
            fileType: "image/jpeg",
            initialQuality: 0.8,
          };

          try {
            const compressedBlob = await imageCompression(file, options);
            file = new File([compressedBlob], file.name, { type: "image/jpeg", lastModified: Date.now() });
          } catch (err) {
             if (!file.type) file = new File([rawFile], rawFile.name, { type: 'image/jpeg' });
          }
        }

        // [B] 동영상 썸네일 처리
        const url = URL.createObjectURL(file);
        let initialThumbUrl = null; 
        let thumbnailFile = null;

        if (isVideo) {
          try {
            const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 1500));
            const thumbPromise = getVideoFrameUrl(file, 0.5);
            const thumbBase64 = await Promise.race([thumbPromise, timeoutPromise]);

            if (thumbBase64) {
                initialThumbUrl = thumbBase64;
                thumbnailFile = dataURLtoFile(thumbBase64, file.name + "_thumb.jpg");
            } else {
                throw new Error("썸네일 시간 초과");
            }
          } catch (e) { 
            console.warn("썸네일 실패 -> 기본 이미지 사용");
            const fallbackUrl = createFallbackThumbnail(file.name);
            initialThumbUrl = fallbackUrl;
            thumbnailFile = dataURLtoFile(fallbackUrl, file.name + "_fallback.jpg");
          }
        } else {
            initialThumbUrl = url;
            thumbnailFile = file;
        }

        return {
          id: Date.now() + Math.random(),
          url: url,
          type: isVideo ? "video" : "image",
          file: file,
          originalFile: originalFile,
          thumbnailUrl: initialThumbUrl,
          thumbnailFile: thumbnailFile,
          isManual: false,
          selectedTime: 0,
        };

      } catch (error) {
        // 기타 에러 발생 시 원본으로 진행
        return {
            id: Date.now() + Math.random(),
            url: URL.createObjectURL(rawFile),
            type: "image",
            file: rawFile,
            originalFile: rawFile,
            thumbnailUrl: URL.createObjectURL(rawFile),
            thumbnailFile: rawFile,
            isManual: false,
            selectedTime: 0,
        };
      }
    });

    try {
        const results = await Promise.all(newMediaPromises);
        const validMedia = results.filter((m) => m !== null);
        
        if (validMedia.length > 0) {
            updateCurrentPage("mediaFiles", [...currentPage.mediaFiles, ...validMedia]);
        }
    } catch(e) {
        console.error(e);
    }
  };

  const removeMedia = (e, id) => {
    e.stopPropagation();
    const target = currentPage.mediaFiles.find((m) => m.id === id);
    if (target && target.url) URL.revokeObjectURL(target.url);
    const newMedia = currentPage.mediaFiles.filter((m) => m.id !== id);
    updateCurrentPage("mediaFiles", newMedia);
  };

  const handleModalComplete = (id, url, time, setIsModalOpen, setTargetVideo) => {
    updateCurrentPage("mediaFiles", (prevMediaFiles) => {
      return prevMediaFiles.map((m) => {
        if (String(m.id) === String(id)) {
          const baseName = m.file?.name || m.name || `video_${id}`;
          
          const newThumbFile = dataURLtoFile(url, baseName + "_manual.jpg");
          
          return {
            ...m,
            thumbnailUrl: url,
            thumbnailFile: newThumbFile,
            isManual: true,
            selectedTime: time,
          };
        }
        return m;
      });
    });
    setIsModalOpen(false);
    setTargetVideo(null);
  };

  return {
    handleFileUpload,
    removeMedia,
    handleModalComplete,
  };
};