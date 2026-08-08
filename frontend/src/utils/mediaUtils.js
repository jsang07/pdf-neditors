export const getVideoFrameUrl = (videoFile, time) => {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => resolve(null), 5000);
    const video = document.createElement("video");

    video.src = URL.createObjectURL(videoFile);
    
    // ★ [핵심] 모바일 브라우저 방어 코드
    video.preload = "metadata"; 
    video.muted = true;
    video.playsInline = true;
    // 일부 안드로이드는 crossOrigin이 없으면 캔버스 안됨
    video.crossOrigin = "anonymous"; 

    // 1. 메타데이터 로드되면 시간 이동
    video.onloadedmetadata = () => {
      video.currentTime = time;
    };

    // 2. 시간 이동 완료되면 캡처
    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // 화질 0.9 설정
        const imageUrl = canvas.toDataURL("image/jpeg", 0.9);
        
        clearTimeout(timeoutId);
        // URL.revokeObjectURL(video.src); // 재사용을 위해 주석 유지
        resolve(imageUrl);
      } catch (e) {
        console.warn("캡처 실패:", e);
        // 실패 시 null 반환 -> 회색 박스 뜸
        resolve(null);
      }
    };

    // 3. 에러 핸들링
    video.onerror = () => {
      clearTimeout(timeoutId);
      resolve(null);
    };

    // ★ [핵심 2] 강제 로딩 트리거 (순서 중요)
    video.load();
    
    // ★ [핵심 3] 재생 시도 
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        video.pause();
      }).catch(() => {
      });
    }
  });
};