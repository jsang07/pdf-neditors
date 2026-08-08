import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/login.css";
import logoImage from "../assets/logo.png";
import { LuFileInput } from "react-icons/lu";

// Firebase
import { auth, db } from "../firebase";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        navigate("/list", { replace: true });
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setIsLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      const userDocRef = doc(db, "userData", user.uid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        console.log("기존 유저 데이터 있다");
      }

      navigate("/list");
    } catch (error) {
      console.error("로그인 에러:", error.code);
      setIsLoading(false);

      if (
        error.code === "auth/invalid-credential" ||
        error.code === "auth/user-not-found" ||
        error.code === "auth/wrong-password"
      ) {
        setErrorMsg("이메일이나 비밀번호가 틀렸습니다.");
      } else if (error.code === "auth/invalid-email") {
        setErrorMsg("이메일 형식이 올바르지 않습니다.");
      } else if (error.code === "auth/too-many-requests") {
        setErrorMsg("시도가 너무 많습니다. 잠시 후 다시 시도해주세요.");
      } else {
        setErrorMsg("로그인 중 오류가 발생했습니다.");
      }
    }
  };

  return (
    <div className="login-root">
      {/* 로딩 오버레이 */}
      {isLoading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <p>로그인 중입니다...</p>
        </div>
      )}

      <div className="login-box">
        <div className="login-logo-container">
          <img
            src={logoImage}
            alt="NED ITORS Logo"
            className="login-logo-img"
          />
          <LuFileInput className="logo-badge-icon" size={24} />
        </div>
        {/* 폼 전체 */}
        <form onSubmit={handleSubmit} className="login-form-container">
          <div className="login-input-group">
            <input
              type="email"
              placeholder="enter neditors id"
              className="login-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />

            <div className="password-container">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="enter neditors password"
                className="login-input password-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
              <button
                type="button"
                className="eye-icon-btn"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex="-1" 
              >
                {showPassword ? (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                ) : (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button className="login-button-side" disabled={isLoading}>
            {isLoading ? "Login" : "Login"}
          </button>
        </form>

        {errorMsg && <div className="error-message">{errorMsg}</div>}
      </div>
    </div>
  );
}

export default LoginPage;
