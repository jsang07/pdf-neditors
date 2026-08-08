import React, { useEffect } from "react"; // ★ useEffect 추가
import { Routes, Route, Navigate, useNavigate } from "react-router-dom"; // ★ useNavigate 추가
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import ProductionListPage from "./pages/ProductionListPage";
import ProtectedRoute from "./components/ProtectedRoute";
import RootRedirect from "./components/RootRedirect";

import { auth } from "./firebase"; 
import { signInWithCustomToken } from "firebase/auth";

function App() {
  const navigate = useNavigate();

  // ★ [핵심] Flutter와의 통신 브릿지 설치
  useEffect(() => {
    window.flutterWebLogin = async (token) => {
      console.log("Flutter에서 토큰 받음!");

      try {
        await signInWithCustomToken(auth, token);
        
        console.log("자동 로그인 성공!");

        if (window.LoginDone) {
          window.LoginDone.postMessage("Success");
        }
        
        navigate("/list", { replace: true });

      } catch (error) {
        console.error("자동 로그인 실패:", error);
        
        if (window.LoginDone) {
          window.LoginDone.postMessage("Fail");
        }
      }
    };

    return () => {
      window.flutterWebLogin = undefined;
    };
  }, [navigate]);

  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<HomePage />} />
        <Route path="/app/edit/:id" element={<HomePage />} />
        <Route path="/list" element={<ProductionListPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;