// src/utils/authUtils.js
import { signOut } from "firebase/auth";
import { auth } from "../firebase"; // 경로 확인 필요

export const performLogout = async (navigate) => {
  try {
    await signOut(auth);
    navigate("/login");
  } catch (error) {
    console.error("Logout Failed:", error);
  }
};
