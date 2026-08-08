import axios from "axios";
import { toBlob } from "html-to-image";

// test urls
// const API_BASE_URL = "http://127.0.0.1:8000";
// const API_BASE_URL = "http://192.168.45.222:8000";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// --- [1] 요소 캡처 (Canvas -> Blob) ---
export const captureElement = async (elementRef) => {
  if (!elementRef) throw new Error("캡처할 요소가 없습니다.");

  try {
    const dynamicHeight = elementRef.offsetHeight;

    const blob = await toBlob(elementRef, {
      cacheBust: false,
      pixelRatio: 2, 
      backgroundColor: "#ffffff",
      skipOnError: true,
      width: 360, 
      height: dynamicHeight, 
      fetchRequestInit: {
        mode: "cors",
        cache: "no-cache",
      },
    });

    if (!blob) {
      console.error("Blob 생성 실패 대상:", elementRef);
      throw new Error("이미지 캡처 실패 (Blob 생성 불가)");
    }

    return blob;
  } catch (error) {
    console.error("Capture Error:", error);
    throw error;
  }
};

// --- [2] 미디어 URL을 File 객체로 변환 (백엔드 전송용) ---
const fetchMediaAsFiles = async (mediaFiles, pageIndex) => {
  const filePromises = mediaFiles.map(async (media, i) => {
    // 파일명에 페이지 번호(pIndex)와 순서(i)를 붙여서 디버깅 쉽게 함
    const uniqueName = `p${pageIndex}_m${i}`;

    // A. 비디오 썸네일 처리
    if (media.type === "video" && media.thumbnailUrl) {
      try {
        // Blob URL이나 Data URL인 경우 fetch로 변환
        const res = await fetch(media.thumbnailUrl);
        const blob = await res.blob();
        // 백엔드에서 'thumb'나 'video'가 이름에 있으면 영상으로 인식
        return new File([blob], `video_thumb_${uniqueName}.jpg`, {
          type: "image/jpeg",
        });
      } catch {
        return null;
      }
    }

    // B. 이미지 처리
    if (media.file) return media.file; 

    if (media.url) {
      // 기존 Firebase URL -> Blob -> File 변환
      try {
        const res = await fetch(media.url);
        const blob = await res.blob();
        return new File([blob], `image_${uniqueName}.jpg`, {
          type: "image/jpeg",
        });
      } catch {
        return null;
      }
    }
    return null;
  });

  // null 값 제거하고 유효한 파일만 리턴
  return (await Promise.all(filePromises)).filter((f) => f !== null);
};

// --- [3] PDF 생성 요청 ---
export const generatePdfApi = async ({
  brand,
  receiver,
  pages,
  userInfo,
  pageCaptures, 
  signal,
}) => {
  console.log("=== 🚀 PDF 생성 요청 시작 ===");
  
  // [체크 1] 캡처본 배열 상태 확인 (로그용)
  if (pageCaptures) {
    pageCaptures.forEach((blob, i) => {
      if (!blob) {
        console.warn(`⚠️ [주의] ${i+1}번 페이지 캡처본이 비어있습니다. -> 빈 파일로 대체될 예정`);
      } else {
        console.log(`📸 캡처 ${i+1}:`, `Size: ${blob.size}, Type: ${blob.type}`);
      }
    });
  } else {
    console.error("🚨 pageCaptures 배열 자체가 없습니다!");
  }

  const formData = new FormData();

  formData.append("brand", brand);
  formData.append("receiver", receiver);
  formData.append("creatorName", userInfo.name);
  formData.append("creatorRole", userInfo.companyRank || userInfo.rank || "에디터");
  formData.append("creatorPhone", userInfo.phoneNum || userInfo.phone || "");
  formData.append("creatorEmail", userInfo.email);

  //  ★★★ [핵심: JSON 다이어트] ★★★
  // Base64 썸네일과 Blob URL 등 무거운 데이터를 제거한 가벼운 JSON 생성
  const sanitizedPages = pages.map((page) => ({
    ...page,
    mediaFiles: (page.mediaFiles || []).map((media) => ({
      ...media,
      // ▼ 서버 전송 시 필요 없는 무거운 데이터들을 null/빈값 처리
      file: null,          
      url: "",             
      thumbnailUrl: ""     
    })),
  }));

  // 가벼워진 데이터를 문자열로 변환해서 전송
  const jsonString = JSON.stringify(sanitizedPages);
  console.log(`📉 JSON 데이터 다이어트 완료: 길이 ${jsonString.length} chars (매우 가벼움)`);
  formData.append("pagesData", jsonString);

  // 3. [핵심: 빈 파일 방어] 캡처 이미지 담기
  if (pageCaptures && pageCaptures.length > 0) {
    pageCaptures.forEach((blob, index) => {
      if (blob) {
        // 정상적인 캡처본이 있으면 그대로 넣기
        formData.append("previewImages", blob, `preview_${index}.png`);
      } else {
        // 캡처가 실패해서 null -> '빈 파일'을 만들어 끼워 넣음 (순서 밀림 방지)
        const emptyBlob = new Blob([""], { type: "image/png" }); // 0바이트 빈 이미지
        const emptyFile = new File([emptyBlob], `empty_preview_${index}.png`, { type: "image/png" });
        formData.append("previewImages", emptyFile);
        
        console.warn(`⚠️ ${index+1}페이지 캡처가 없어 '빈 파일'로 대체하여 전송합니다.`);
      }
    });
  } else {
    // pageCaptures 자체가 없을 때
    console.warn("🚨 pageCaptures 배열이 비어있습니다. 전체를 빈 파일들로 채웁니다.");
    pages.forEach((_, i) => {
        const emptyBlob = new Blob([""], { type: "image/png" });
        formData.append("previewImages", new File([emptyBlob], `empty_fallback_${i}.png`));
    });
  }

  // 4. 미디어 파일 변환 및 추가
  const nestedFilesPromises = pages.map((page, index) =>
    fetchMediaAsFiles(page.mediaFiles || [], index)
  );
  const nestedFiles = await Promise.all(nestedFilesPromises);
  const allFiles = nestedFiles.flat();

  console.log(`📂 변환된 미디어 파일 개수: ${allFiles.length}개`);
  
  allFiles.forEach((f) => {
    // 파일 객체가 맞는지 확인 후 추가
    if (f instanceof File || f instanceof Blob) {
      formData.append("files", f);
    } else {
      console.error("🚨 파일이 아닌 것이 섞여 있습니다:", f);
    }
  });

  // ★★★ [최종 점검] 전송 직전 FormData 내부 까보기 (로그) ★★★
  console.log("--- 📦 최종 전송 데이터(FormData) 목록 ---");
  for (let [key, value] of formData.entries()) {
    if (value instanceof File || value instanceof Blob) {
      console.log(`📎 [File] ${key}: ${value.name} (${value.size} bytes)`);
    } else {
      // 텍스트 내용은 너무 길면 자르기
      const textVal = value.toString();
      const displayVal = textVal.length > 100 ? textVal.substring(0, 100) + "..." : textVal;
      console.log(`📝 [Text] ${key}: ${displayVal}`);
    }
  }
  console.log("---------------------------------------");

  // 5. 전송
  try {
    const response = await axios.post(`${API_BASE_URL}/api/generate`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      responseType: "blob",
      signal: signal,
    });
    console.log("✅ PDF 생성 성공!");
    return response.data;
  } catch (err) {
    console.error("🔥 Axios 요청 에러:", err);
    throw err;
  }
};