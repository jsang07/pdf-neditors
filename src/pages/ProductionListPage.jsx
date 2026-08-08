import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MdKeyboardArrowDown,
  MdOutlineFileDownload,
  MdArrowDropUp,
  MdArrowDropDown,
  MdOutlineImage,
  MdOutlineDelete,
  MdDelete,
} from "react-icons/md";
import "../styles/productionList.css";

// 파이어베이스 & 라이브러리
import { auth, db, storage } from "../firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  writeBatch,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { listAll, deleteObject, ref } from "firebase/storage";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import logo from "../assets/logo.png";
import { performLogout } from "../utils/authUtils";


const ThumbnailImage = ({ src, alt }) => {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div className="thumbnail-item" style={{ position: "relative" }}>
      {/* 이미지가 로딩 안 됐을 때 보여줄 미니 스피너 */}
      {!isLoaded && (
        <div className="thumb-loading-overlay">
          <div className="mini-spinner"></div>
        </div>
      )}

      <img
        src={src}
        alt={alt}
        className="table-thumb"
        onLoad={() => setIsLoaded(true)} // 다 읽어오면 로딩 끝
        style={{
          objectFit: "cover",
          width: "100%",
          height: "100%",
          opacity: isLoaded ? 1 : 0, // 로딩 전엔 숨김 (깜빡임 방지)
          transition: "opacity 0.3s"
        }}
      />
    </div>
  );
};

const HorizontalScrollBox = ({ children, className }) => {
  const scrollRef = React.useRef(null);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onWheel = (e) => {
      if (e.deltaY === 0) return;
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    };

    el.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      el.removeEventListener("wheel", onWheel);
    };
  }, []);

  return (
    <div ref={scrollRef} className={className}>
      {children}
    </div>
  );
};

const ProductionListPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    window.recoverTouch = () => {
      document.body.style.backgroundColor = 'red';
      setTimeout(() => document.body.style.backgroundColor = '', 100);

      console.log("Flutter 요청 수신: 강력한 높이 변형 핵 실행");
      
      const originalMinHeight = document.body.style.minHeight;
      document.body.style.minHeight = "101vh"; 

      setTimeout(() => {
        const x = window.scrollX;
        const y = window.scrollY;
        window.scrollTo(x, y + 1);

        setTimeout(() => {
          window.scrollTo(x, y);
          document.body.style.minHeight = originalMinHeight;
          if (document.activeElement && document.activeElement.blur) {
             document.activeElement.blur();
          }
          window.focus();
        }, 50);
      }, 10);
    };
}, []);

  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  //const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [userInfo, setUserInfo] = useState({
    name: "사용자",
    rank: "", 
    phone: "", 
  });
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // 정렬 상태 관리
  const [sortKey, setSortKey] = useState("updatedAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [isAssetDownloading, setIsAssetDownloading] = useState(false);

  // ★ [롱프레스 로직] 터치 타이머 관리를 위한 Refs
  const timerRef = React.useRef(null);
  const isLongPress = React.useRef(false);
  const isTouch = React.useRef(false);

  // 1. 사용자 정보 가져오기
  useEffect(() => {
    const fetchUserData = async () => {
      const currentUser = auth.currentUser;
      if (currentUser) {
        try {
          const docRef = doc(db, "userData", currentUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUserInfo({
              name: data.Name || currentUser.displayName || "사용자",
              rank: data.CompanyRank || "",
              phone: data.PhoneNum || "",
              email: data.Email || currentUser.email,
            });
          }
        } catch (error) {
          console.error(error);
        }
      }
    };
    fetchUserData();
  }, []);

  // 2. 프로젝트 목록 불러오기
  const fetchProjects = async () => {
    if (!auth.currentUser) return;
    setIsLoading(true);
    try {
      let q = query(
        collection(db, "pdf_projects"),
        where("uid", "==", auth.currentUser.uid)
      );

      const snapshot = await getDocs(q);
      let list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      list.sort((a, b) => {
        let valA = a[sortKey];
        let valB = b[sortKey];

        if (valA && typeof valA.toDate === "function") valA = valA.toDate();
        if (valB && typeof valB.toDate === "function") valB = valB.toDate();

        if (sortKey === "uploadDate") {
          valA = valA ? new Date(valA) : new Date(0);
          valB = valB ? new Date(valB) : new Date(0);
        }

        if (valA < valB) return sortOrder === "asc" ? -1 : 1;
        if (valA > valB) return sortOrder === "asc" ? 1 : -1;
        return 0;
      });

      setProjects(list);
    } catch (error) {
      console.error("목록 로드 실패:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [sortKey, sortOrder]);

  // 정렬 핸들러
  const handleSort = (key, specificOrder = null) => {
    if (specificOrder) {
      // 1. 특정 화살표를 눌렀을 때 (강제 적용)
      setSortKey(key);
      setSortOrder(specificOrder);
    } else {
      // 2. 그냥 텍스트나 모바일 버튼 눌렀을 때 (토글)
      if (sortKey === key) {
        setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
      } else {
        setSortKey(key);
        setSortOrder("desc");
      }
    }
  };

  // 체크박스 핸들러
  const handleCheck = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleCheckAll = () => {
    if (selectedIds.length === projects.length && projects.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(projects.map((p) => p.id));
    }
  };

  // 삭제 관련
  const handleDeleteButton = () => {
    if (selectedIds.length === 0) {
      alert("삭제할 항목을 선택해주세요.");
      return;
    }
    setShowDeleteModal(true);
  };

  const deleteFolderRecursive = async (folderRef) => {
    try {
      const listResult = await listAll(folderRef);
      
      // 1. 현재 폴더 내 파일들 삭제
      const fileDeletePromises = listResult.items.map((itemRef) => 
        deleteObject(itemRef).catch(e => console.log("파일 삭제 무시:", e.code))
      );

      // 2. 하위 폴더들 재귀 호출
      const folderDeletePromises = listResult.prefixes.map((subFolderRef) => 
        deleteFolderRecursive(subFolderRef)
      );

      await Promise.all([...fileDeletePromises, ...folderDeletePromises]);
    } catch (e) {
      console.log("폴더 삭제 건너뜀 (없거나 오류):", e.code);
    }
  };

  // [삭제 실행 함수]
  const executeDelete = async () => {
    setShowDeleteModal(false);
    setIsDeleting(true);
    try {
      const batch = writeBatch(db);
      const user = auth.currentUser;

      for (const id of selectedIds) {
        const project = projects.find((p) => p.id === id);
        
        // 1. DB 문서 삭제
        const docRef = doc(db, "pdf_projects", id);
        batch.delete(docRef);

        // 2. 슬롯 초기화 
        if (user) {
          const pagesRef = collection(db, "userData", user.uid, "pages");
          const q = query(pagesRef, where("projectId", "==", id));
          const pageSnaps = await getDocs(q);
          const emptyData = { /* ...초기화 데이터... */
            brand: "", receiver: "", content: "", accountTags: "", hashtags: "",
            media: [], pages: [], captureImage: "", uploadDate: "",
            active: false, projectId: null, updatedAt: serverTimestamp(),
          };
          pageSnaps.forEach((pageDoc) => { batch.update(pageDoc.ref, emptyData); });
        }

        // 3. ★★★ 폴더 단위 완전 삭제 ★★★
        if (user) {
          const projectFolderRef = ref(storage, `uploads/${user.uid}/projects/${id}`);
        
          await deleteFolderRecursive(projectFolderRef); 
        }

        // 4. 구버전 데이터(폴더 구조 아님) 처리
        const legacyPromises = [];
        let allMedia = [];
        if (project.pages) allMedia = project.pages.flatMap(p => p.mediaFiles || []);
        if (project.media) allMedia = [...allMedia, ...project.media];

        allMedia.forEach((media) => {
          if (media.url && !media.url.includes("/projects/")) {
             legacyPromises.push(deleteObject(ref(storage, media.url)).catch(()=> {}));
          }
          if (media.thumbnailUrl && !media.thumbnailUrl.includes("/projects/")) {
             legacyPromises.push(deleteObject(ref(storage, media.thumbnailUrl)).catch(()=> {}));
          }
        });
        
        if (project.captureImage && !project.captureImage.includes("/projects/")) {
           legacyPromises.push(deleteObject(ref(storage, project.captureImage)).catch(()=> {}));
        }

        await Promise.all(legacyPromises);
      }

      await batch.commit();

      setProjects((prev) => prev.filter((p) => !selectedIds.includes(p.id)));
      setSelectedIds([]);
      //setShowDeleteModal(false);
    } catch (error) {
      console.error("삭제 중 오류:", error);
      alert("삭제 실패");
    } finally {
      setIsDeleting(false);
    }
  };


  // ★ [다운로드 PC] 원본 + 썸네일 포함 (영상은 video 폴더로 분리)
  const handleDownloadZip = async (project) => {
    const allMedia = project.pages
      ? project.pages.flatMap((page) => page.mediaFiles || [])
      : [];

    if (allMedia.length === 0) {
      alert("다운로드할 미디어가 없습니다.");
      return;
    }

    if (!window.confirm(`${allMedia.length}개의 미디어(썸네일 포함)를 다운로드합니다.`))
      return;

    setIsAssetDownloading(true);
    
    const zip = new JSZip();
    // 1. 루트 폴더 생성
    const rootFolder = zip.folder(
      `[eyesmag] ${project.brand}_${project.receiver || "media"}`
    );
    // 2. ★ video 서브 폴더 생성
    const videoFolder = rootFolder.folder("video");

    let count = 0;
    try {
      await Promise.all(
        allMedia.map(async (media, index) => {
          // 1. 본문 파일 다운로드
          const targetUrl = media.originalUrl || media.url;
          if (targetUrl) {
            try {
              const response = await fetch(targetUrl);
              const blob = await response.blob();
              
              let ext = "png";
              if (media.type === "video") ext = "mp4";
              else if (blob.type.includes("jpeg")) ext = "jpg";
              else if (blob.type.includes("pdf")) ext = "pdf";

              const fileName = `${index + 1}_${project.brand}.${ext}`;

              if (media.type === "video") {
                videoFolder.file(fileName, blob); // 영상은 video 폴더에
              } else {
                rootFolder.file(fileName, blob);  // 이미지는 루트에
              }
              count++;
            } catch (err) {
              console.error(`파일(${index}) 로드 실패:`, err);
            }
          }

          // 2. 썸네일 다운로드 (영상인 경우)
          if (media.type === "video" && media.thumbnailUrl) {
            try {
              const thumbRes = await fetch(media.thumbnailUrl);
              const thumbBlob = await thumbRes.blob();
              
              const thumbName = `${index + 1}_${project.brand}_thumb.jpg`;
              
              // ★ 썸네일도 video 폴더에 저장
              videoFolder.file(thumbName, thumbBlob);
              
            } catch (err) {
              console.error(`썸네일(${index}) 로드 실패:`, err);
            }
          }
        })
      );

      if (count > 0) {
        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, `[eyesmag] ${project.brand}_원본패키지.zip`);
      }
    } catch (error) {
      console.error("ZIP 생성 실패:", error);
      alert("다운로드 실패");
    } finally {
      setIsAssetDownloading(false);
    }
  };

  // ★ [다운로드 모바일] 원본 + 썸네일 포함 (영상은 video 폴더로 분리)
  const handleMobileDownloadZip = async (project) => {
    const allMedia = project.pages
      ? project.pages.flatMap((page) => page.mediaFiles || [])
      : [];

    if (allMedia.length === 0) {
      alert("다운로드할 미디어가 없습니다.");
      return;
    }

    if (allMedia.length > 20) {
      if (!window.confirm("파일이 많아 모바일에서 멈출 수 있습니다. 진행할까요?")) return;
    } else {
      if (!window.confirm(`모바일 환경입니다. 다운로드를 시작합니다.`)) return;
    }

    setIsAssetDownloading(true);

    const zip = new JSZip();
    // 1. 루트 폴더 생성
    const rootFolder = zip.folder(
      `[eyesmag] ${project.brand}_${project.receiver || "media"}`
    );
    // 2. video 서브 폴더 생성
    const videoFolder = rootFolder.folder("video");

    let count = 0;

    try {
      await Promise.all(
        allMedia.map(async (media, index) => {
          const targetUrl = media.originalUrl || media.url;
          if (targetUrl) {
            try {
              const response = await fetch(targetUrl);
              const blob = await response.blob();

              let ext = "png";
              if (media.type === "video") ext = "mp4";
              else if (blob.type.includes("jpeg")) ext = "jpg";

              const fileName = `${index + 1}_${project.brand}.${ext}`;
              
              // 타입에 따라 폴더 분리
              if (media.type === "video") {
                videoFolder.file(fileName, blob);
              } else {
                rootFolder.file(fileName, blob);
              }
              count++;
            } catch (err) {
              console.error("파일 로드 실패:", err);
            }
          }

          // 2. 썸네일 추가
          if (media.type === "video" && media.thumbnailUrl) {
            try {
              const thumbRes = await fetch(media.thumbnailUrl);
              const thumbBlob = await thumbRes.blob();
              const thumbName = `${index + 1}_${project.brand}_thumb.jpg`;
              
              // 썸네일도 video 폴더로
              videoFolder.file(thumbName, thumbBlob);
              
            } catch (err) { console.error("썸네일 실패:", err); }
          }
        })
      );

      if (count === 0) {
        alert("다운로드할 수 있는 파일이 없습니다.");
        return;
      }

      const content = await zip.generateAsync({ type: "blob" });
      const fileName = `[eyesmag] ${project.brand}_원본패키지.zip`;

      if (window.FileDownload) {
        // [A] 플러터 앱: Bridge로 전송 (터치 복구)
        console.log("플러터 앱 감지됨: ZIP 파일 전송");
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result.split(",")[1];
          const message = JSON.stringify({
            filename: fileName,
            data: base64data,
          });
          window.FileDownload.postMessage(message);
        };
        reader.readAsDataURL(content);
        
      } else {

      const file = new File([content], fileName, { type: "application/zip" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: fileName,
            text: "파일을 저장하거나 공유하세요.",
          });
        } catch (error) {
          if (error.name !== "AbortError") forceDownload(content, fileName);
        }
      } else {
        forceDownload(content, fileName);
      }
    }
    } catch (error) {
      console.error("ZIP 실패:", error);
      alert("모바일 다운로드 실패. PC에서 시도해주세요.");
    } finally {
      setIsAssetDownloading(false);
    }
  };

  // [헬퍼] 강제 다운로드
  const forceDownload = (blob, fileName) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.target = "_blank"; 
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  // [1] 모바일 감지 및 분기 처리
  const handleUnifiedDownload = (e, project) => {
    e.stopPropagation(); 
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile) {
      handleMobileDownloadZip(project);
    } else {
      handleDownloadZip(project);
    }
  };

  // 날짜 포맷
  const formatDate = (timestamp) => {
    if (!timestamp) return "-";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return String(timestamp);
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(
      2,
      "0"
    )}.${String(date.getDate()).padStart(2, "0")} ${String(
      date.getHours()
    ).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  };

  // 썸네일 렌더링
  const renderThumbnail = (mediaList) => {
    if (!mediaList || mediaList.length === 0) {
      return <div className="no-media-box">-</div>;
    }

    return (
      <HorizontalScrollBox className="thumbnail-scroll-container">
        {mediaList.map((media, index) => {
          if (!media.url && !media.thumbnailUrl) return null;
          const src = media.thumbnailUrl || media.url;

          return (
            <ThumbnailImage
              key={index}
              src={src}
              alt={`thumb-${index}`}
            />
          );
        })}
      </HorizontalScrollBox>
    );
  };



  const handleEdit = (project) => {
    if (!project || !project.id) {
      console.error("수정할 프로젝트 ID가 없습니다:", project);
      alert("문서 정보를 불러올 수 없습니다. (ID 누락)");
      return;
    }
    navigate(`/app/edit/${project.id}`);
  };


  const handleBackgroundClick = (e) => {
    if (selectedIds.length === 0) return;

    if (!e.target.closest("tr")) {
      setSelectedIds([]); 
      setShowDeleteModal(false); 
    }
  };

  // ★ 남은 시간 계산 함수 (24시간 이내 경고용)
  const getRemainingTime = (scheduledDeleteAt) => {
    if (!scheduledDeleteAt) return null;

    const targetDate = scheduledDeleteAt.toDate
      ? scheduledDeleteAt.toDate()
      : new Date(scheduledDeleteAt);
    const now = new Date();
    const diffMs = targetDate - now; 

    // 1. 이미 지난 경우
    if (diffMs <= 0) return "삭제됨";

    // 2. 24시간보다 많이 남았으면 표시 X
    const oneDayMs = 24 * 60 * 60 * 1000;
    if (diffMs > oneDayMs) return null;

    // 3. 시간/분 계산
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);

    // 4. 요구사항에 따른 포맷팅
    if (diffHours >= 1) {
      return `(${diffHours}시간 후에 삭제)`;
    } else {
      return `(${diffMinutes}분 후에 삭제)`;
    }
  };

  const handlePressStart = (id, e) => {
    if (window.innerWidth > 1024) return;

    if (e.type === "touchstart") {
      isTouch.current = true;
    }
    else if (e.type === "mousedown" && isTouch.current) {
      return;
    }
    if (e.type === "mousedown" && e.button !== 0) return;

    isLongPress.current = false;

    timerRef.current = setTimeout(() => {
      isLongPress.current = true;
      handleCheck(id);

    }, 250);
  };

  const handlePressEnd = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleCardClick = (e, project) => {
    if (window.innerWidth > 1024) {
      handleEdit(project);
      return;
    }
    if (isLongPress.current) {
      isLongPress.current = false;
      return;
    }

    if (selectedIds.length > 0) {
      handleCheck(project.id);
    } else {
      handleEdit(project);
    }
  };


  return (
    <div className="list-container-dark" onClick={handleBackgroundClick}>
      {isDeleting && (
        <div className="loading-overlay" style={{ zIndex: 9999 }}> 
          <div className="spinner"></div>
          <p>삭제 중입니다...</p>
        </div>
      )}

      {isAssetDownloading && (
        <div className="loading-overlay" style={{ zIndex: 9999 }}>
          <div className="spinner"></div>
          <p style={{ whiteSpace: "pre-line", textAlign: "center", lineHeight: "1.5" }}>
            에셋을 다운로드 중입니다...<br />
            (창을 닫지 마세요, 다른 탭 이동 가능)
          </p>
        </div>
      )}

      <header className="header" onClick={(e) => e.stopPropagation()}>
        <div className="header-logo">
          <img
            src={logo}
            onClick={() => navigate("/list")}
            alt="Eyesmag Logo"
          />
        </div>
        <div className="header-links notranslate">
          <span onClick={() => navigate("/app")}>제작</span>
          <span>{userInfo.name} 님</span>
          <span
            onClick={() => performLogout(navigate)}
            style={{ cursor: "pointer" }}
          >
            로그아웃
          </span>
        </div>
      </header>

      <main className="list-content">
        <div className="list-title-row">
          <h1>목록</h1>
          <div className="title-actions" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-sort-control">
              {/* (A) 정렬 기준 선택 (텍스트 + 화살표) -> 드롭다운 토글 */}
              <div
                className="sort-label-group"
                onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
              >
                <span className="current-sort-label">
                  {sortKey === "uploadDate" ? "업로드 일자" : "마지막 수정"}
                </span>
                <MdKeyboardArrowDown
                  className={`arrow-icon ${isSortMenuOpen ? "open" : ""}`}
                />
              </div>

              {/* (B) 순서 변경 (아이콘) */}
              <button
                className="sort-order-btn"
                onClick={() => handleSort(sortKey)}
              >
                {/* desc(최신)일 때 위 화살표, asc(과거)일 때 아래 화살표 */}
                {sortOrder === "desc" ? (
                  <MdArrowDropUp size={28} color="#333" />
                ) : (
                  <MdArrowDropDown size={28} color="#333" />
                )}
              </button>

              {/* (C) 드롭다운 메뉴 (기준 선택용) */}
              {isSortMenuOpen && (
                <ul className="sort-dropdown-menu">
                  <li
                    className={sortKey === "uploadDate" ? "active" : ""}
                    onClick={() => {
                      if (sortKey !== "uploadDate") handleSort("uploadDate");
                      setIsSortMenuOpen(false);
                    }}
                  >
                    업로드 일자
                  </li>
                  <li
                    className={sortKey === "updatedAt" ? "active" : ""}
                    onClick={() => {
                      if (sortKey !== "updatedAt") handleSort("updatedAt");
                      setIsSortMenuOpen(false);
                    }}
                  >
                    마지막 수정
                  </li>
                </ul>
              )}
            </div>
            <button
              className={`delete-trigger-btn ${selectedIds.length > 0 ? "show" : ""
                }`}
              onClick={handleDeleteButton}
              disabled={selectedIds.length === 0}
            >
              <MdDelete size={20} color="#fff" />{" "}
              <span className="btn-text">삭제</span>
            </button>
          </div>
        </div>

        <div className="table-container">
          <table className="dark-table">
            <thead>
              <tr>
                <th width="5%">
                  <input
                    type="checkbox"
                    className="custom-checkbox"
                    checked={
                      projects.length > 0 &&
                      selectedIds.length === projects.length
                    }
                    onChange={handleCheckAll}
                  />
                </th>
                <th width="30%">사진/영상</th>
                <th width="10%">유가명</th>
                <th width="10%">수신자</th>

                {/* 마지막 수정 날짜 */}
                <th
                  width="12%"
                  className="sortable-th"
                  title="수정일 순 정렬"
                  onClick={() => handleSort("updatedAt")}
                >
                  <div className="th-content">
                    마지막 수정 날짜
                    <div className="sort-icons-stack">
                      {/* ▲ 위 화살표: 최신순 (desc) */}
                      <MdArrowDropUp
                        size={24}
                        className={`sort-arrow-btn up-arrow ${sortKey === "updatedAt" && sortOrder === "desc"
                          ? "active"
                          : ""
                          }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSort("updatedAt", "desc"); 
                        }}
                      />
                      {/* ▼ 아래 화살표: 오래된 순 (asc) */}
                      <MdArrowDropDown
                        size={24}
                        className={`sort-arrow-btn down-arrow ${sortKey === "updatedAt" && sortOrder === "asc"
                          ? "active"
                          : ""
                          }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSort("updatedAt", "asc"); 
                        }}
                      />
                    </div>
                  </div>
                </th>

                {/* 업로드 일자 */}
                <th
                  width="12%"
                  className="sortable-th"
                  title="업로드일 순 정렬"
                  onClick={() => handleSort("uploadDate")}
                >
                  <div className="th-content">
                    업로드 일자
                    <div className="sort-icons-stack">
                      {/* ▲ 위 화살표: 최신순 (가까운 날짜, desc) */}
                      <MdArrowDropUp
                        size={24}
                        className={`sort-arrow-btn up-arrow ${sortKey === "uploadDate" && sortOrder === "desc"
                          ? "active"
                          : ""
                          }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSort("uploadDate", "desc");
                        }}
                      />
                      {/* ▼ 아래 화살표: 오래된 순 (먼 날짜, asc) */}
                      <MdArrowDropDown
                        size={24}
                        className={`sort-arrow-btn down-arrow ${sortKey === "uploadDate" && sortOrder === "asc"
                          ? "active"
                          : ""
                          }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSort("uploadDate", "asc");
                        }}
                      />
                    </div>
                  </div>
                </th>

                <th width="8%">상태</th>
                <th width="6%">
                  에셋 <br />
                  다운로드
                </th>
              </tr>
            </thead>

            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan="10" className="loading-td">
                    <div className="table-loading-container">
                      <div
                        className="spinner"
                        style={{ width: "30px", height: "30px", borderWidth: "3px" }}
                      ></div>
                      <span
                        style={{ marginTop: "10px", fontSize: "14px", color: "#666" }}
                      >
                        목록을 불러오는 중...
                      </span>
                    </div>
                  </td>
                </tr>
              )}

              {/* 로딩이 끝났을 때만 목록 렌더링 */}
              {!isLoading &&
                projects.map((p) => {
                  // 삭제 시간이 지났으면 화면에서 숨김 처리
                  if (p.scheduledDeleteAt) {
                    const now = new Date();
                    const deleteDate = p.scheduledDeleteAt.toDate
                      ? p.scheduledDeleteAt.toDate()
                      : new Date(p.scheduledDeleteAt);

                    if (deleteDate <= now) {
                      return null;
                    }
                  }

                  // 가장 빠른 업로드 날짜 찾기 및 '외 N건' 계산
                  const pageDates = (p.pages || [])
                    .map((page) => page.uploadDate)
                    .filter((d) => d) // 빈 값 제거
                    .map((d) => {
                      try {
                        const cleanStr = d.replace(/\./g, "/").replace(" /", "");
                        return new Date(cleanStr);
                      } catch (e) {
                        return null;
                      }
                    })
                    .filter((d) => d && !isNaN(d.getTime()));

                  // 1. 화면에 표시할 날짜
                  let displayDate = p.uploadDate || "-";

                  if (pageDates.length > 0) {
                    const earliest = new Date(Math.min(...pageDates));
                    const yy = String(earliest.getFullYear()).slice(2);
                    const mm = String(earliest.getMonth() + 1).padStart(2, "0");
                    const dd = String(earliest.getDate()).padStart(2, "0");
                    const hh = String(earliest.getHours()).padStart(2, "0");
                    const mi = String(earliest.getMinutes()).padStart(2, "0");
                    displayDate = `${yy}.${mm}.${dd} ${hh}:${mi}`;
                  }

                  // 2. 외 N건 계산
                  const totalCount = p.pages ? p.pages.length : 0;
                  const extraCount = totalCount - 1;
                  // ---------------------------------------------------------------

                  return (
                    <tr
                      key={p.id}
                      className={selectedIds.includes(p.id) ? "selected-card" : ""}
                      // 터치 (모바일/DevTools)
                      onTouchStart={(e) => handlePressStart(p.id, e)}
                      onTouchEnd={handlePressEnd}
                      onTouchMove={handlePressEnd} 
                      // 마우스 (PC 반응형 테스트용)
                      onMouseDown={(e) => handlePressStart(p.id, e)}
                      onMouseUp={handlePressEnd}
                      onMouseLeave={handlePressEnd} 
                      // 클릭 (수정 페이지 이동 or 토글)
                      onClick={(e) => handleCardClick(e, p)}
                    >
                      <td>
                        <input
                          type="checkbox"
                          className="custom-checkbox"
                          checked={selectedIds.includes(p.id)}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => handleCheck(p.id)}
                        />
                      </td>
                      <td>
                        {renderThumbnail(
                          p.pages
                            ? p.pages.flatMap((page) => page.mediaFiles || [])
                            : p.media
                        )}
                      </td>
                      <td className={extraCount > 0 ? "has-extra" : ""}>{p.brand}</td>
                      <td>{p.receiver}</td>
                      <td>{formatDate(p.updatedAt)}</td>

                      <td>
                        {displayDate}
                        {extraCount > 0 && (
                          <span className="date-extra-info" style={{ color: "#424242" }}>
                            외 {extraCount}건
                          </span>
                        )}
                      </td>

                      <td>
                        <span className={`status-badge ${p.status}`}>
                          {p.status === "completed" ? "생성됨" : "수정중"}
                        </span>{" "}
                        <br />
                        {p.scheduledDeleteAt && (
                          <span
                            style={{
                              color: "#ff4444",
                              fontSize: "13px",
                              fontWeight: "bold",
                            }}
                          >
                            {getRemainingTime(p.scheduledDeleteAt)}
                          </span>
                        )}
                      </td>

                      <td>
                        <button
                          className="icon-btn"
                          onClick={(e) => handleUnifiedDownload(e, p)}
                          title="에셋 다운로드"
                        >
                          <MdOutlineImage size={22} />
                        </button>
                      </td>
                    </tr>
                  );
                })}

              {/* 3. 데이터 없을 때 메시지 (로딩 끝났는데 데이터 0개일 때) */}
              {!isLoading && projects.length === 0 && (
                <tr className="empty-row"> 
                  <td colSpan="8" className="empty-msg"> 
                    저장된 기록이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>

      {showDeleteModal && (
        <div className="modal-overlay">
          <div
            className="confirm-modal-box"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="confirm-message">
              선택한{" "}
              <span style={{ color: "#ef4444", fontWeight: "bold" }}>
                {selectedIds.length}
              </span>
              개의 항목을 삭제하시겠습니까?
            </p>

            <div className="confirm-actions">
              <button
                className="btn-cancel"
                onClick={() => setShowDeleteModal(false)}
              >
                취소
              </button>
              <button className="btn-delete-confirm" onClick={executeDelete}>
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductionListPage;
