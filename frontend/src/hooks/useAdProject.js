import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchProjectData, saveProjectData } from "../utils/firebaseService";
import { auth } from "../firebase";

// 초기 페이지 생성기
const createNewPage = () => ({
  id: Date.now() + Math.random(),
  accountTagInput: "",
  hashtags: "",
  content: "",
  uploadDate: "",
  mediaFiles: [],
});

export const useAdProject = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const docIdFromUrl = searchParams.get("id");

  // --- State 관리 ---
  const [pages, setPages] = useState([createNewPage()]);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [brand, setBrand] = useState("");
  const [receiver, setReceiver] = useState("");
  const [currentDocId, setCurrentDocId] = useState(docIdFromUrl || null);
  const [isLoading, setIsLoading] = useState(false);

  // 현재 페이지 편의 변수
  const currentPage = pages[activePageIndex] || pages[0];

  // --- 1. 데이터 로드 로직 ---
  useEffect(() => {
    if (!docIdFromUrl) return;
    const loadData = async () => {
      setIsLoading(true);
      try {
        const data = await fetchProjectData(docIdFromUrl);
        setBrand(data.brand || "");
        setReceiver(data.receiver || "");
        setCurrentDocId(data.id);
        if (data.pages?.length > 0) setPages(data.pages);
        else setPages([{ ...createNewPage(), ...data }]); // 호환성
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [docIdFromUrl]);

  // --- 2. 페이지 조작 로직 ---
  const handleAddPage = () => {
    if (pages.length >= 10) return alert("최대 10장까지만 생성 가능합니다.");
    setPages((prev) => [...prev, createNewPage()]);
    setActivePageIndex((prev) => prev + 1);
  };

  const updateCurrentPage = (key, value) => {
    setPages((prev) => {
      const newPages = [...prev];
      newPages[activePageIndex] = {
        ...newPages[activePageIndex],
        [key]: value,
      };
      return newPages;
    });
  };

  const handlePageChange = (index) => setActivePageIndex(index);

  // --- 3. 저장 로직 ---
  const saveProject = async (status, userInfo) => {
    if (!auth.currentUser) return alert("로그인이 필요합니다.");
    setIsLoading(true);
    try {
      const result = await saveProjectData(
        currentDocId,
        auth.currentUser.uid,
        userInfo,
        brand,
        receiver,
        pages,
        status
      );
      setPages(result.processedPages);
      if (result.docId) {
        setCurrentDocId(result.docId);
        setSearchParams({ id: result.docId });
      }
      return true; // 성공 신호 반환
    } catch (e) {
      alert("저장 실패: " + e.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    // State
    pages,
    currentPage,
    activePageIndex,
    brand,
    receiver,
    isLoading,
    currentDocId,
    // Setters (필요한 것만)
    setBrand,
    setReceiver,
    setPages,
    // Actions
    handleAddPage,
    handlePageChange,
    updateCurrentPage,
    saveProject,
  };
};
