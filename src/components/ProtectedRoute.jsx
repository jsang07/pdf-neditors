import React, { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { auth } from "../firebase"; 
import { onAuthStateChanged } from "firebase/auth";

const ProtectedRoute = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
        <div style={{ 
            height: "100vh", 
            display: "flex", 
            justifyContent: "center", 
            alignItems: "center", 
            backgroundColor: "#111", 
            color: "#fff" 
        }}>
            Loading...
        </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;