import React, { useState, useRef, useEffect } from "react";
import "../styles/home.css";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";

// [Firebase]
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";

// [Services]
import {
  fetchProjectData,
  fetchProjectForEdit,
  saveProjectData,
} from "../services/firebaseService";
import { captureElement, generatePdfApi } from "../services/pdfApiService";

// [Hooks]
import { useMediaLogic } from "../hooks/useMediaLogic";
import { useInputLogic } from "../hooks/useInputLogic";
import { arrayMove } from "@dnd-kit/sortable";

// [Components]
import PreviewSection from "../components/PreviewSection";
import InputSection from "../components/InputSection";
import UploadSection from "../components/UploadSection";
import CoverEditModal from "../components/CoverEditModal";
import {
  ConfirmThumbnailModal,
  DraftSavedModal,
  FloatingEmojiPicker,
  UnsavedCheckModal,
} from "../components/CommonModals";

// [Utils]
import { getCursorXY } from "../utils/getCursorXY";
import { performLogout } from "../utils/authUtils";
import { MdAddCircleOutline } from "react-icons/md";
import logo from "../assets/logo.png";

//preview
import defaultImage from "../assets/default-image.jpg";
import eyesmagLogo from "../assets/eyes-logo.png";
import { parseContentWithTags } from "../utils/formatUtils";
import instaHeaderImg from "../assets/insta-header.png";
import instaIconsLeft from "../assets/insta-icons-left.png";
import instaIconsRight from "../assets/insta-icons-rigth.png";

// [헬퍼] 데이터 존재 여부 확인
const hasData = (page) => {
  if (!page) return false;
  return (
    page.active === true ||
    (page.brand && page.brand.trim() !== "") ||
    (page.content && page.content.trim() !== "") ||
    (page.mediaFiles && page.mediaFiles.length > 0)
  );
};

const Home = () => {
  const navigate = useNavigate();

  useEffect(() => {
    window.recoverTouch = () => {
      console.log("Flutter 요청 수신: 스크롤 핵으로 터치 복구 시도");

      const x = window.scrollX;
      const y = window.scrollY;

      window.scrollTo(x, y + 1);

      setTimeout(() => {
        window.scrollTo(x, y);
        console.log("터치 복구 완료");
      }, 50);
    };
  }, []);

  const [searchParams, setSearchParams] = useSearchParams();
  const docIdFromUrl = searchParams.get("id");

  const { id: editModeId } = useParams();
  const isEditMode = Boolean(editModeId);

  const [userInfo, setUserInfo] = useState({
    name: "사용자",
    rank: "",
    phone: "",
    email: "",
  });

  // --- 슬롯 관리 (10개 고정) ---
  const createEmptySlot = (index) => ({
    id: `page${index + 1}`,
    pageNumber: index + 1,
    active: false,
    brand: "",
    receiver: "",
    accountTagInput: "@",
    hashtags: "",
    content: "",
    uploadDate: "",
    mediaFiles: [],
  });

  const [pages, setPages] = useState(() =>
    Array.from({ length: 10 }, (_, i) => createEmptySlot(i))
  );

  const [activePageIndex, setActivePageIndex] = useState(0);
  const currentPage = pages[activePageIndex];

  // 기타 UI 상태
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pickerPosition, setPickerPosition] = useState({ x: 0, y: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("처리 중입니다...");

  const [currentProjectId, setCurrentProjectId] = useState(
    isEditMode ? editModeId : docIdFromUrl || null
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentVideoForThumbnail, setCurrentVideoForThumbnail] =
    useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  const cardRef = useRef(null);
  const textAreaRef = useRef(null);
  const hiddenCaptureRefs = useRef([]);
  const abortControllerRef = useRef(null);
  const isGeneratingPdfRef = useRef(false);

  const handleCancelLoading = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    isGeneratingPdfRef.current = false;

    setIsLoading(false);
  };

  // --- 데이터 업데이트 헬퍼 ---
  const updateCurrentPage = (key, value) => {
    setIsDirty(true);

    setPages((prevPages) => {
      const newPages = [...prevPages];
      const latestCurrentPage = newPages[activePageIndex];
      const resolvedValue =
        typeof value === "function" ? value(latestCurrentPage[key]) : value;

      newPages[activePageIndex] = {
        ...latestCurrentPage,
        [key]: resolvedValue,
        active: true, 
      };
      return newPages;
    });
  };

  const handleAddPage = () => {
    
    const emptyIndex = pages.findIndex((p, idx) => idx > 0 && !hasData(p));
    if (emptyIndex === -1) {
      alert("최대 10장까지만 생성 가능합니다.");
      return;
    }
    setPages((prev) => {
      const newPages = [...prev];
      const prevPage = newPages[activePageIndex]; 

      newPages[emptyIndex] = {
        ...newPages[emptyIndex],
        brand: prevPage.brand || "",
        receiver: prevPage.receiver || "",
        accountTagInput: prevPage.accountTagInput || "@",
        hashtags: prevPage.hashtags || "",
        active: true, 
      };
      return newPages;
    });
    setActivePageIndex(emptyIndex);
  };

  const handlePageChange = (index) => {
    setActivePageIndex(index);
  };

  const handleDeletePage = async (index) => {
    const activePagesCount = pages.filter((p) => hasData(p)).length;

    let confirmMsg = "";

    // [상황 A] 페이지가 1개만 남았을 때 -> 초기화만 (1페이지는 안 지워짐)
    if (activePagesCount <= 1) {
      confirmMsg = "페이지가 1개만 남아있습니다.\n내용을 초기화하시겠습니까?";
    }
    // [상황 B] 2개 이상일 때 -> 삭제하고 당기기
    else {
      confirmMsg = `${index + 1}페이지를 삭제하시겠습니까?\n(뒤쪽 페이지들이 앞으로 당겨집니다)`;
    }

    if (!window.confirm(confirmMsg)) return;

    // -------------------------------------------------------
    // 1. 데이터 처리 (Array 조작)
    // -------------------------------------------------------
    setPages((prev) => {
      // [A] 1개일 땐 초기화만
      if (activePagesCount <= 1) {
        const newPages = [...prev];
        newPages[index] = createEmptySlot(index);
        return newPages;
      }

      // [B] 여러 개일 땐 삭제 후 당기기
      const newPages = [...prev];
      newPages.splice(index, 1); 
      newPages.push(createEmptySlot(prev.length - 1)); 
      return newPages;
    });

    // -------------------------------------------------------
    // 2. ★★★ [핵심] 보고 있는 페이지(activePageIndex) 위치 조정
    // -------------------------------------------------------

    // [상황 A] 1개만 남았을 땐 이동할 필요 없음 (그냥 초기화된 화면 봄)
    if (activePagesCount <= 1) return;

    // [상황 B] 삭제 시 위치 보정 로직
    // 1. 내가 "삭제한 페이지보다 뒤쪽"을 보고 있었다면? 
    //    -> 내 페이지가 앞으로 당겨졌으니 나도 -1 해서 따라가야 함.
    if (activePageIndex > index) {
      setActivePageIndex((prev) => Math.max(0, prev - 1));
    }
    // 2. 내가 "삭제한 페이지(현재 보고 있는 거)"를 지웠다면?
    else if (activePageIndex === index) {
      // 만약 "맨 마지막 페이지"를 지웠다면? -> 앞 페이지로 이동
      // (예: 1, 2, 3 중 3번 지움 -> 2번 보여줌)
      if (index === activePagesCount - 1) {
        setActivePageIndex((prev) => Math.max(0, prev - 1));
      }
      // "중간 페이지"를 지웠다면? -> 가만히 있음
      // (예: 1, 2, 3 중 2번 지움 -> 뒤에 있던 3번이 2번 자리로 오니까 가만히 있으면 3번 내용이 보임)
    }
  };

  // --- 데이터 로드 로직 ---
  useEffect(() => {
    const loadData = async () => {
      const user = auth.currentUser;
      if (!user) return;

      setIsLoading(true);
      try {
        // 1. 가져올 문서 ID 결정
        const targetId = isEditMode ? editModeId : docIdFromUrl;

        if (targetId) {
          // ★ [통합] 수정모드 일반모드 프로젝트(전체 페이지)를 불러오는 건 동일
          const projectData = await fetchProjectForEdit(targetId);

          if (projectData && projectData.pages) {
            const newSlots = Array.from({ length: 10 }, (_, i) =>
              createEmptySlot(i)
            );

            projectData.pages.forEach((pageData, idx) => {
              if (idx < 10) {
                const safeMedia = (pageData.mediaFiles || []).map((m) => ({
                  ...m,
                  id: m.id
                    ? String(m.id)
                    : `existing-${Date.now()}-${Math.random()}`,
                }));

                newSlots[idx] = {
                  ...newSlots[idx], 
                  ...pageData, 
                  mediaFiles: safeMedia,
                  active: true, 
                  accountTagInput: pageData.accountTagInput || "@",
                  hashtags: pageData.hashtags || "",
                };
              }
            });

            setPages(newSlots);
            setIsDirty(false);
            setCurrentProjectId(projectData.id);

            const firstActive = newSlots.findIndex((p) => hasData(p));
            setActivePageIndex(firstActive !== -1 ? firstActive : 0);
          } else {
            if (isEditMode) {
              alert("문서를 불러올 수 없습니다.");
              navigate("/list");
            }
          }
        } else {
          // ID가 없을시 새 작업 
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (!isGeneratingPdfRef.current) {
          setIsLoading(false);
        }
      }
    };

    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) loadData();
      else setIsLoading(false);
    });
    return () => unsubscribe();
  }, [docIdFromUrl, isEditMode, editModeId, navigate]);

  // 사용자 정보 로드
  useEffect(() => {
    const fetchUserData = async () => {
      const currentUser = auth.currentUser;
      if (currentUser) {
        try {
          const docRef = doc(db, "userData", currentUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists())
            setUserInfo({
              ...docSnap.data(),
              name: docSnap.data().Name || currentUser.displayName,
              email: docSnap.data().Email || currentUser.email,
              rank: docSnap.data().CompanyRank || "",
              phone: docSnap.data().PhoneNum || "",
            });
        } catch (error) {
          console.error(error);
        }
      }
    };
    fetchUserData();
  }, []);

  // 이모지, 단축키 로직
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && (e.key === "`" || e.key === "~")) {
        e.preventDefault();
        const textarea = textAreaRef.current;
        if (textarea) {
          const rect = textarea.getBoundingClientRect();
          const cursorPos = getCursorXY(textarea, textarea.selectionStart);
          setPickerPosition({
            x: rect.left + cursorPos.x + 10,
            y: rect.top + cursorPos.y - 8,
          });
        }
        setTimeout(() => {
          setShowEmojiPicker((prev) => !prev);
        }, 0);
      }
      if (e.key === "Escape") setShowEmojiPicker(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);


  const handleEmojiButtonToggle = (e) => {
    e.preventDefault();

    const textarea = textAreaRef.current;

    if (textarea) {
      const rect = textarea.getBoundingClientRect();
      const cursorPos = getCursorXY(textarea, textarea.selectionStart);

      setPickerPosition({
        x: rect.left + cursorPos.x + 10,
        y: rect.top + cursorPos.y - 8,
      });

      textarea.focus();
    }

    setShowEmojiPicker((prev) => !prev);
  };


  const handleSaveProject = async (status, keepLoading = false) => {
    if (!auth.currentUser) {
      alert("로그인이 필요합니다.");
      if (!keepLoading) setIsLoading(false);
      return null;
    }

    // 캡처본 생성 (대표 썸네일용)
    let captureBlob = null;
    if (cardRef.current) {
      try {
        captureBlob = await captureElement(cardRef.current);
      } catch (e) {
        console.error("캡처 생성 실패:", e);
      }
    }

    try {
      const validPages = pages.filter((p) => hasData(p));

      if (validPages.length === 0) {
        alert("저장할 내용이 없습니다.");
        return; 
      }

      const result = await saveProjectData(
        currentProjectId,
        auth.currentUser.uid,
        userInfo,
        validPages, 
        status,
        captureBlob,
        isEditMode
      );

      if (result.success) {
        const newProjectId = result.projectId;
        setCurrentProjectId(newProjectId);
        setIsDirty(false);

        if (!isEditMode && !docIdFromUrl) {
          setSearchParams({ id: newProjectId });
        }

        if (status === "draft") {
          setShowDraftModal(true);
        }
        return result.processedPage;
      }
    } catch (error) {
      alert("저장 중 오류 발생: " + error.message);
      return null;
    } finally {
      if (!keepLoading) {
        setIsLoading(false);
      }
    }
  };

  const handleSaveDraft = async () => {
    if (!currentPage.brand) {
      alert("유가명을 입력해주세요!");
      return;
    }
    if (!currentPage.receiver) {
      alert("수신자를 입력해주세요!");
      return;
    }
    if (!currentPage.uploadDate) {
      alert("업로드 일자를 선택해주세요!");
      return;
    }
    setLoadingText(isEditMode ? "저장 중입니다..." : "임시 저장 중입니다...");
    setIsLoading(true);

    try {
      await handleSaveProject("draft", false);
    } catch (error) {
      console.error("저장 실패:", error);
      setIsLoading(false); 
    }
  };

  // 1. PDF 생성 및 저장 (다운로드)
  const processPdfGeneration = async () => {
    const validPages = pages.filter((p) => hasData(p));

    if (validPages.length === 0) {
      alert("생성할 페이지가 없습니다.");
      return;
    }

    setLoadingText(
      isEditMode ? "수정사항 저장 및 PDF 제작 중입니다.\n탭을 떠나지 말아주세요!" : "PDF 제작 중입니다.\n탭을 떠나지 말아주세요!"
    );
    setIsLoading(true);
    isGeneratingPdfRef.current = true;

    // 중단 컨트롤러 생성
    abortControllerRef.current = new AbortController();

    try {
      const savedPages = await handleSaveProject("completed", true);

      // 만약 저장이 실패했거나 데이터가 없으면 중단
      if (!savedPages) {
        throw new Error("데이터 저장에 실패하여 PDF를 생성할 수 없습니다.");
      }

      // ============================================================
      // ★★★ [2단계] PDF용 전체 페이지 캡처 (저장 끝난 후 실행) ★★★
      // ============================================================
      const capturePromises = validPages.map((_, index) => {
        const targetEl = hiddenCaptureRefs.current[index];
        if (targetEl) return captureElement(targetEl);
        return null;
      });

      const pageCaptures = await Promise.all(capturePromises);
      const validCaptures = pageCaptures.filter((blob) => blob !== null);

      if (validCaptures.length === 0) {
        throw new Error("페이지 캡처에 실패했습니다.");
      }

      // [3] 데이터 가공 (엔터 처리 등)
      const sanitizedPages = savedPages.map((page) => {
        return {
          ...page,
          content: sanitizeContent(page.content),
        };
      });

      const mappedUserInfo = {
        ...userInfo,
        companyRank: userInfo.rank || "",
        phoneNum: userInfo.phone || "",
      };

      // ★★★ [4단계] API 호출 (PDF Blob 생성) ★★★
      const pdfBlob = await generatePdfApi({
        brand: currentPage.brand,
        receiver: currentPage.receiver,
        pages: sanitizedPages,
        userInfo: mappedUserInfo,
        pageCaptures: validCaptures,
        signal: abortControllerRef.current.signal,
      });

      // [5단계] 다운로드 처리
      // 오늘 날짜(YYMMDD) 구하기
      const date = new Date();
      const year = date.getFullYear().toString().slice(2);
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const yymmdd = `${year}${month}${day}`; 
      const fileName = `[eyesmag] ${currentPage.brand} 유가시안_${yymmdd}.pdf`;

      // 플러터 앱 환경인지 체크 (window.FileDownload 채널 유무)
      if (window.FileDownload) {
        // --- [A] 플러터 앱인 경우: Base64로 변환해서 앱으로 던짐 ---
        console.log("플러터 앱 감지됨: Bridge로 PDF 전송 시도");
        
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result.split(",")[1];

          // JSON으로 포장해서 전송
          const message = JSON.stringify({
            filename: fileName,
            data: base64data,
          });

          window.FileDownload.postMessage(message);
        };
        reader.readAsDataURL(pdfBlob);

      } else {
        // --- [B] 일반 웹 브라우저 (PC/모바일 사파리/크롬) ---
        const url = window.URL.createObjectURL(pdfBlob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", fileName);
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => window.URL.revokeObjectURL(url), 100);
      }

      isGeneratingPdfRef.current = false;
      setIsLoading(false);
      navigate("/list");

    } catch (error) {
      if (
        error.name === "AbortError" ||
        error.code === "ERR_CANCELED" ||
        error.name === "CanceledError"
      ) {
        console.log("취소됨");
      } else {
        console.error(error);
        alert("작업 실패: " + error.message);
      }
      isGeneratingPdfRef.current = false;
      setIsLoading(false);
    }
  };

  // 생성 전 유효성 검사 
  const checkBeforeGenerate = () => {
    if (!currentPage.brand) {
      alert("유가명을 입력해주세요!");
      return;
    }
    if (!currentPage.receiver) {
      alert("수신자를 입력해주세요!");
      return;
    }
    if (!currentPage.uploadDate) {
      alert("업로드 일자를 선택해주세요!"); 
      return;
    }
    // 현재 페이지 미디어 체크 (동영상 수동 캡처 확인)
    if (
      currentPage.mediaFiles[0]?.type === "video" &&
      !currentPage.mediaFiles[0].isManual
    ) {
      setShowConfirmModal(true);
      return;
    }
    processPdfGeneration();
  };


  // PDF 전송용 텍스트 다듬기 헬퍼 함수
  const sanitizeContent = (text) => {
    if (!text) return "";

    // 1. 엔터(\n) 개수
    const newlineCount = (text.match(/\n/g) || []).length;

    // 2. 전체 글자수
    const totalLength = text.length;

    // 3. ★ 높이 점수 계산
    const heightScore = newlineCount * 80 + totalLength;
    if (heightScore >= 1200) {
      return text.replace(/\n/g, " / ");
    }

    return text;
  };

  // 드래그 앤 드롭
  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!active || !over || active.id === over.id) return;

    setPages((prevPages) => {
      const currentPageData = prevPages[activePageIndex];
      const oldList = currentPageData.mediaFiles;
      const oldIndex = oldList.findIndex(
        (item) => String(item.id) === String(active.id)
      );
      const newIndex = oldList.findIndex(
        (item) => String(item.id) === String(over.id)
      );

      if (oldIndex === -1 || newIndex === -1) return prevPages;
      const newMediaFiles = arrayMove(oldList, oldIndex, newIndex);
      const newPages = [...prevPages];
      newPages[activePageIndex] = {
        ...currentPageData,
        mediaFiles: newMediaFiles,
      };
      return newPages;
    });
  };

  // [모바일용 순서 전체 업데이트 함수]
const handleReorderComplete = (newMediaFiles) => {
  setPages((prevPages) => {
    const newPages = [...prevPages];
    newPages[activePageIndex] = {
      ...newPages[activePageIndex],
      mediaFiles: newMediaFiles,
    };
    return newPages;
  });
};

  // 페이지 이동 전 확인 함수 (새로고침 등)
  const handleNavigationWithCheck = (action) => {
    if (!isDirty) {
      if (typeof action === "function") action();
      else navigate(action);
      return;
    }

    setPendingAction(() => action); 
    setShowUnsavedModal(true);
  };


  const handleConfirmUnsaved = async () => {
    if (!currentPage.brand || !currentPage.brand.trim()) {
      alert("유가명을를 입력해주세요!");
      setShowUnsavedModal(false); 
      return; 
    }
    if (!currentPage.receiver || !currentPage.receiver.trim()) {
      alert("수신자를 입력해주세요!");
      setShowUnsavedModal(false);
      return;
    }
    if (!currentPage.uploadDate) {
      alert("업로드 일자를 선택해주세요!");
      setShowUnsavedModal(false);
      return;
    }

    setShowUnsavedModal(false);

    try {
      setLoadingText("임시 저장 중입니다...");
      setIsLoading(true);

      const validPages = pages.filter((p) => hasData(p));

      if (validPages.length === 0) {
        setIsLoading(false);
        setIsDirty(false);
        executePendingAction();
        return;
      }

      const result = await saveProjectData(
        currentProjectId,
        auth.currentUser.uid,
        userInfo,
        validPages,
        "draft",
        null,
        isEditMode
      );

      setIsLoading(false);

      if (result.success) {
        setIsDirty(false);
        executePendingAction();
      }
    } catch (error) {
      setIsLoading(false);
      alert("저장에 실패하여 이동하지 않았습니다.");
    }
  };

  const handleDiscardUnsaved = () => {
    setShowUnsavedModal(false);
    setIsDirty(false);
    executePendingAction();
  };

  // 저장된 목적지로 이동하는 헬퍼
  const executePendingAction = () => {
    if (!pendingAction) return;
    if (typeof pendingAction === "function") pendingAction();
    else navigate(pendingAction);
    setPendingAction(null);
  };

  // 브라우저 탭 닫기/새로고침 방지 (브라우저 기본 경고)
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = ""; // Chrome 표준
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const { handleSmartInput, handleDateSelect, onEmojiClick } = useInputLogic(
    updateCurrentPage,
    textAreaRef
  );

  const { handleFileUpload, removeMedia, handleModalComplete } = useMediaLogic(
    currentPage,
    updateCurrentPage
  );

  return (
    <div className="home-container">
      {isLoading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <p style={{ whiteSpace: "pre-wrap", textAlign: "center", marginTop: "10px", color: "white" }}>{loadingText}</p>
          <button
            className="loading-cancel-btn"
            onClick={handleCancelLoading}
            title="취소하기"
          >
            ✕
          </button>
        </div>
      )}

      {/* 모달 */}
      {isModalOpen && currentVideoForThumbnail && (
        <CoverEditModal
          videoMedia={currentVideoForThumbnail}
          onClose={() => setIsModalOpen(false)}
          onComplete={(id, url, time) =>
            handleModalComplete(
              id,
              url,
              time,
              setIsModalOpen,
              setCurrentVideoForThumbnail
            )
          }
        />
      )}
      {showConfirmModal && (
        <ConfirmThumbnailModal
          onConfirm={() => {
            setShowConfirmModal(false);
            processPdfGeneration();
          }}
          onCancel={() => {
            setShowConfirmModal(false);
            setCurrentVideoForThumbnail(currentPage.mediaFiles[0]);
            setIsModalOpen(true);
          }}
        />
      )}
      {showDraftModal && (
        <DraftSavedModal
          onConfirm={() => {
            setShowDraftModal(false);
            navigate("/list");
          }}
        />
      )}
      {showUnsavedModal && (
        <UnsavedCheckModal
          onConfirm={handleConfirmUnsaved} 
          onCancel={handleDiscardUnsaved} 
        />
      )}

      {showEmojiPicker && (
        <FloatingEmojiPicker
          position={pickerPosition}
          onEmojiClick={(emojiData, event) => {
            onEmojiClick(emojiData, event); 
            setShowEmojiPicker(false);   
          }}
          onClose={() => setShowEmojiPicker(false)}
        />
      )}

      <header className="header">
        <div className="header-logo">
          <img
            src={logo}
            onClick={() => handleNavigationWithCheck("/list")}
            alt="Eyesmag Logo"
          />
        </div>
        <div className="header-links notranslate">
          <span onClick={() => handleNavigationWithCheck("/list")}>
            목록
          </span>
          {/* {isEditMode && <span className="mode-badge">수정 모드</span>} */}
          <span>{userInfo.name} 님</span>
          <span
            onClick={() =>
              handleNavigationWithCheck(() => performLogout(navigate))
            }
            style={{ cursor: "pointer" }}
          >
            로그아웃
          </span>
        </div>
      </header>

      <main className="main-content">
        <PreviewSection
          cardRef={cardRef}
          currentPage={currentPage}
          checkBeforeGenerate={checkBeforeGenerate}
          // handleRealPreview={handleRealPreview}
          handleSaveDraft={handleSaveDraft}
        />

        <div className="vertical-divider"></div>

        <section className="content-center" key={activePageIndex}>
          <InputSection
            brand={currentPage.brand}
            setBrand={(val) => updateCurrentPage("brand", val)}
            receiver={currentPage.receiver}
            setReceiver={(val) => updateCurrentPage("receiver", val)}
            currentPage={currentPage}
            updateCurrentPage={updateCurrentPage}
            handleSmartInput={handleSmartInput}
            handleDateSelect={handleDateSelect}
            textAreaRef={textAreaRef}
            onEmojiToggle={handleEmojiButtonToggle}
          />
          <UploadSection
            mediaFiles={currentPage.mediaFiles}
            handleFileUpload={handleFileUpload}
            removeMedia={removeMedia}
            onDragEnd={handleDragEnd}
            onReorderComplete={handleReorderComplete}
            onThumbnailClick={(media) => {
              setCurrentVideoForThumbnail(media);
              setIsModalOpen(true);
            }}
          />
        </section>

        <aside className="sidebar-right">
          <div className="page-navigation-container">
            {pages.map((page, index) => {
              const isVisible =
                index === 0 || hasData(page) || index === activePageIndex;

              if (!isVisible) return null;

              return (
                <div
                  key={index}
                  className={`page-btn ${index === activePageIndex ? "active" : ""
                    }`}
                  onClick={() => handlePageChange(index)}
                  style={{ position: "relative" }}
                >
                  Page {index + 1}
                  {index === activePageIndex && hasData(page) && (
                    <button
                      className="page-delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePage(index);
                      }}
                      title={index === 0 ? "내용 초기화" : "페이지 비우기"}
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}

            {pages.some((p, i) => i > 0 && !hasData(p)) && (
              <div className="page-btn add-btn" onClick={handleAddPage}>
                <MdAddCircleOutline size={24} color="#424242" />
              </div>
            )}
          </div>
        </aside>
      </main>

      {/* ================================================================================== */}
      {/* ★★★ 하이브리드 캡처 영역 (PC/Mobile 공통: 강제 로딩 적용) ★★★ */}
      {/* ================================================================================== */}
      {(() => {
        // [1] 모바일(아이폰/안드로이드) 감지
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

        // 렌더링할 데이터 필터링
        const validPages = pages.filter((p) => hasData(p));

        return (
          <div
            className="ghost-capture-container"
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              zIndex: -1000,
              opacity: 0,
              pointerEvents: "none",
              width: isMobile ? "360px" : "auto",
              height: isMobile ? "0px" : "auto",
              overflow: "visible",
            }}
          >
            {validPages.map((page, index) => {
              const mediaCount = page.mediaFiles.length;
              const firstMedia = page.mediaFiles[0];
              const timestamp = new Date().getTime();

              // 캐시 방지용 함수
              const addTime = (url) => {
                if (!url) return "";
                if (url.startsWith("data:") || url.startsWith("blob:")) return url;
                return url.includes("?") ? `${url}&t=${timestamp}` : `${url}?t=${timestamp}`;
              };

              // -------------------------------------------------------------
              // [A] 미디어 소스 및 CORS 결정 로직 (공통)
              // -------------------------------------------------------------
              // 동영상이면 썸네일을, 이미지면 원본을 targetSrc로 설정
              const targetSrc = firstMedia?.thumbnailUrl || firstMedia?.url;

              // 로컬(blob)이면 crossOrigin 끄기, 아니면 켜기
              const isLocal = targetSrc && (targetSrc.startsWith("blob:") || targetSrc.startsWith("data:"));
              const imgProps = !isLocal ? { crossOrigin: "anonymous" } : {};

              return (
                <div
                  key={`hidden-capture-${index}`}
                  ref={(el) => (hiddenCaptureRefs.current[index] = el)}
                  className="insta-card"
                  style={{
                    width: "360px",
                    height: "auto",
                    minHeight: "680px", // 짤림 방지 고정
                    margin: 0,
                    boxShadow: "none",
                    backgroundColor: "#ffffff",
                    overflow: "visible",
                    // 모바일: 겹쳐두기 / PC: 나열하기
                    position: isMobile ? "absolute" : "static",
                    top: isMobile ? 0 : "auto",
                    left: isMobile ? 0 : "auto",
                  }}
                >
                  {/* [1] 헤더 */}
                  <div className="card-header-image-wrapper">
                    <img
                      src={instaHeaderImg}
                      alt="Instagram Header"
                      loading="eager"
                      decoding="sync"
                      style={{ width: '100%', height: 'auto', display: 'block' }}
                    />
                  </div>

                  {/* [2] 미디어 영역 */}
                  <div className="card-media-area" style={{ backgroundColor: "#000" }}>

                    {/* ========== [분기] 모바일 vs PC 렌더링 ========== */}
                    {isMobile ? (
                      // [모바일용] 동영상도 썸네일(img)로 처리됨 
                      page.mediaFiles.length > 0 ? (
                        <img
                          src={addTime(targetSrc)} 
                          className="card-media-preview"
                          alt="media-preview"
                          {...imgProps}

                          loading="eager"
                          decoding="sync"

                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          onError={(e) => { e.target.style.display = "none"; }}
                        />
                      ) : (
                        <img src={defaultImage} className="card-media-preview" style={{ objectFit: "cover" }} alt="" />
                      )
                    ) : (
                      //  PC용] Video 태그 허용 
                      page.mediaFiles.length > 0 ? (
                        firstMedia.thumbnailUrl ? (
                          <img
                            src={firstMedia.thumbnailUrl}
                            className="card-media-preview"
                            {...imgProps}
                            loading="eager" decoding="sync" 
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            alt=""
                          />
                        ) : firstMedia.type === "video" ? (
                          // [PC] 진짜 Video 태그
                          <video
                            src={firstMedia.url}
                            className="card-media-preview"
                            muted
                            playsInline
                            {...imgProps}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        ) : (
                          // [PC] 일반 이미지
                          <img
                            src={firstMedia.url}
                            className="card-media-preview"
                            {...imgProps}
                            loading="eager" decoding="sync" 
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            alt=""
                          />
                        )
                      ) : (
                        <img src={defaultImage} className="card-media-preview" alt="Default" style={{ objectFit: "cover" }} />
                      )
                    )}

                    {mediaCount > 1 && <div className="media-counter">1/{mediaCount}</div>}
                  </div>

                  {/* [3] 푸터 & 캡션 */}
                  <div className="card-footer" style={{ height: "auto", flex: 1 }}>
                    {mediaCount > 1 && (
                      <div className="carousel-indicators">
                        {[...Array(Math.min(mediaCount, 4))].map((_, i) => (
                          <div key={i} className={`indicator-dot ${i === 0 ? "active" : ""}`}></div>
                        ))}
                      </div>
                    )}


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
                          loading="eager" 
                          decoding="sync" 
                          style={{
                            height: '24px',  
                            width: 'auto', 
                            display: 'block'
                          }}
                        />
                        <img
                          src={instaIconsRight}
                          alt="Instagram Icons"
                          loading="eager" 
                          decoding="sync" 
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
                      <span className="caption-content">{parseContentWithTags(page.content)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

    </div>
  );
};

export default Home;
