import { db, storage } from "../firebase";
import {
  doc,
  setDoc,
  getDoc,
  addDoc,
  updateDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, uploadBytesResumable } from "firebase/storage";


// [헬퍼] 모바일 최적화 업로드 함수 (Resumable 적용) - 기존 유지
const uploadFileMobileOptimized = (storageRef, file) => {
  return new Promise((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      "state_changed",
      null, 
      (error) => {
        console.error("업로드 실패:", error);
        reject(error); 
      },
      () => {
        getDownloadURL(uploadTask.snapshot.ref).then(resolve);
      }
    );
  });
};

// [헬퍼] 저장 경로 생성 함수 (프로젝트 ID별 폴더링) ★★★ 신규 추가
const getStoragePath = (uid, projectId, filename, subfolder = "") => {
  const folder = subfolder ? `${subfolder}/` : "";
  // uploads/uid/projects/프로젝트ID/폴더/파일명 구조로 저장
  return `uploads/${uid}/projects/${projectId}/${folder}${filename}`;
};

// [1] 프로젝트 불러오기 (수정 모드 & 일반 모드 공용)
export const fetchProjectForEdit = async (projectId) => {
  try {
    const docRef = doc(db, "pdf_projects", projectId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    console.error("Edit Load Error:", error);
    throw error;
  }
};

// [2] 기존 슬롯 데이터 불러오기
export const fetchProjectData = async (uid, projectId) => {
  if (!uid) {
    console.error("UID Missing");
    return null;
  }
  try {
    if (projectId) {
      const projectData = await fetchProjectForEdit(projectId);
      if (projectData) return { projectData, pages: projectData.pages || [] };
    }
    return null;
  } catch (error) {
    console.error("Fetch Error:", error);
    throw error;
  }
};

// [3] 저장 함수 (폴더 구조 적용)
export const saveProjectData = async (
  currentProjectId,
  uid,
  userInfo,
  validPages,
  status,
  captureBlob,
  isEditMode
) => {
  if (!uid) throw new Error("로그인 필요");

  // 모바일 환경 감지
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  console.log(`환경: ${isMobile ? "모바일 (3개씩 배치 업로드)" : "PC (전체 병렬)"}`);

  try {
    let finalProjectId = currentProjectId;
    let docRef = null;

    if (!finalProjectId) {
      docRef = doc(collection(db, "pdf_projects")); 
      finalProjectId = docRef.id; 
    } else {
      docRef = doc(db, "pdf_projects", finalProjectId);
    }

    let processedPages = [];

    // [헬퍼] 미디어 처리 (processMediaItem)
    const processMediaItem = async (media, pageIndex) => {
      const mediaId = media.id
        ? String(media.id)
        : `saved-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // (A) 이미 파이어베이스 URL인 경우 
      // 단, 썸네일이 blob이면 업로드해줘야 함
      const isFirebaseUrl = typeof media.url === "string" && media.url.includes("firebase");
      const isBase64Thumb = media.thumbnailUrl && (media.thumbnailUrl.startsWith("data:") || media.thumbnailUrl.startsWith("blob:"));

      if (isFirebaseUrl && !isBase64Thumb) {
        return { ...media, id: mediaId };
      }

      let lightUrl = media.url;
      let originalUrl = media.originalUrl || media.url;

      try {
        // -------------------------------------------------------------
        // 1. [본문 파일 업로드] (프로젝트 폴더 안에 저장)
        // -------------------------------------------------------------
        if (media.file || media.originalFile) {
          const lightFile = media.file || media.originalFile; 
          
          // ★ 경로 변경: projects/{id}/files/...
          const lightPath = getStoragePath(uid, finalProjectId, `${Date.now()}_p${pageIndex}_comp_${lightFile.name}`, "files");
          const lightRef = ref(storage, lightPath);
          
          if (isMobile) await uploadFileMobileOptimized(lightRef, lightFile);
          else await uploadBytes(lightRef, lightFile);
          
          lightUrl = await getDownloadURL(lightRef);
          originalUrl = lightUrl; 

          if (media.originalFile) {
            // ★ 경로 변경: projects/{id}/originals/...
            const originPath = getStoragePath(uid, finalProjectId, `${Date.now()}_p${pageIndex}_origin_${media.originalFile.name}`, "originals");
            const originRef = ref(storage, originPath);
            
            if (isMobile) await uploadFileMobileOptimized(originRef, media.originalFile);
            else await uploadBytes(originRef, media.originalFile);

            originalUrl = await getDownloadURL(originRef);
          }
        }

        // -------------------------------------------------------------
        // 2. [썸네일 업로드] (프로젝트 폴더 안에 저장)
        // -------------------------------------------------------------
        let finalThumbnailUrl = media.thumbnailUrl;

        // 동영상 썸네일 존재시, 그게 로컬 데이터(blob/data)라면 업로드 수행
        if (media.type === "video" && media.thumbnailUrl) {
          if (media.thumbnailUrl.startsWith("data:") || media.thumbnailUrl.startsWith("blob:")) {
            try {
                const thumbResp = await fetch(media.thumbnailUrl);
                const thumbBlob = await thumbResp.blob();
                
                // ★ 경로 변경: projects/{id}/thumbs/...
                const thumbName = `${Date.now()}_p${pageIndex}_thumb_${mediaId}.jpg`;
                const thumbPath = getStoragePath(uid, finalProjectId, thumbName, "thumbs");
                const thumbRef = ref(storage, thumbPath);
                
                await uploadBytes(thumbRef, thumbBlob);
                finalThumbnailUrl = await getDownloadURL(thumbRef);
            } catch(e) { 
              console.warn("썸네일 실패:", e); 
            }
          } 
        } else if (media.type === "image") {
          // 이미지는 압축본이 썸네일
          finalThumbnailUrl = lightUrl; 
        }

        // DB에 저장할 객체 반환
        return {
          id: mediaId,
          type: media.type,
          url: lightUrl,
          originalUrl: originalUrl,
          thumbnailUrl: finalThumbnailUrl,
          isManual: media.isManual || false,
          selectedTime: media.selectedTime || 0,
          file: null, 
          originalFile: null 
        };
      } catch (e) {
        console.error("미디어 업로드 실패:", e);
        return null; 
      }
    };

    // ============================================================
    // [CASE 1] 모바일 환경 -> 3개씩 끊어서 병렬 처리
    // ============================================================
    if (isMobile) {
      const MOBILE_BATCH_SIZE = 3;

      for (let i = 0; i < validPages.length; i++) {
        const page = validPages[i];
        let processedMediaFiles = [];

        if (page.mediaFiles && page.mediaFiles.length > 0) {
          const mediaList = page.mediaFiles;
          for (let j = 0; j < mediaList.length; j += MOBILE_BATCH_SIZE) {
            const batch = mediaList.slice(j, j + MOBILE_BATCH_SIZE);
            const batchResults = await Promise.all(
              batch.map((media) => processMediaItem(media, i))
            );
            processedMediaFiles.push(...batchResults.filter(r => r !== null));
          }
        }

        processedPages.push({
          ...page,
          mediaFiles: processedMediaFiles,
          accountTags: page.accountTagInput || "",
        });
      }
    } 
    // ============================================================
    // [CASE 2] PC 환경 -> 전체 병렬
    // ============================================================
    else {
      processedPages = await Promise.all(
        validPages.map(async (page, index) => {
          const uploadedMedia = await Promise.all(
            (page.mediaFiles || []).map((media) => processMediaItem(media, index))
          );
          return {
            ...page,
            mediaFiles: uploadedMedia.filter((m) => m !== null),
            accountTags: page.accountTagInput || "",
          };
        })
      );
    }

    // ------------------------------------------------------------
    // 3. 캡처본 업로드 (프로젝트 폴더 안에 저장)
    // ------------------------------------------------------------
    let captureImageUrl = "";
    if (captureBlob) {
      try {
        // ★ 경로 변경: projects/{id}/captures/...
        const capturePath = getStoragePath(uid, finalProjectId, `${Date.now()}_cover.png`, "captures");
        const captureRef = ref(storage, capturePath);
        await uploadBytes(captureRef, captureBlob);
        captureImageUrl = await getDownloadURL(captureRef);
      } catch (err) { console.error("캡처 실패:", err); }
    }

    // 4. 날짜 및 DB 데이터 구성
    const timestamps = validPages
      .map((p) => p.uploadDate)
      .filter((d) => d)
      .map((dateStr) => {
        try {
          const cleanStr = dateStr.replace(/\./g, "/").replace(" /", "");
          const d = new Date(cleanStr);
          return isNaN(d.getTime()) ? null : d.getTime();
        } catch (e) { return null; }
      })
      .filter((ts) => ts !== null);

    let earliestDate = new Date(); 
    let latestDate = new Date();   

    if (timestamps.length > 0) {
      earliestDate = new Date(Math.min(...timestamps)); 
      latestDate = new Date(Math.max(...timestamps));   
    }

    const deleteDate = new Date(latestDate);
    if (status === "draft") {
      deleteDate.setDate(deleteDate.getDate() + 14);
    } else {
      deleteDate.setDate(deleteDate.getDate() + 1);
    }

    const coverPage = validPages[0] || {};

    const projectData = {
      uid,
      brand: coverPage.brand || "",
      receiver: coverPage.receiver || "",
      pages: processedPages,
      captureImage: captureImageUrl, // 새로 생성된 URL
      status,
      updatedAt: serverTimestamp(),
      uploadDate: coverPage.uploadDate || "",
      creatorName: userInfo.name || "사용자",
      scheduledDeleteAt: deleteDate,
    };

    await setDoc(docRef, projectData, { merge: true });

    return {
      success: true,
      projectId: finalProjectId,
      processedPage: processedPages,
    };

  } catch (error) {
    console.error("Project Save Error:", error);
    throw error;
  }
};

export const clearPageSlot = async (uid, pageIndex) => {
  return {
    brand: "",
    receiver: "",
    content: "",
    accountTags: "",
    hashtags: "",
    media: [],
    active: false,
  };
};