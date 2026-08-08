import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { auth } from "../firebase"; 
import { onAuthStateChanged } from "firebase/auth";

const RootRedirect = () => {
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
    return null; 
  }

  return user ? <Navigate to="/list" replace /> : <Navigate to="/login" replace />;
};

export default RootRedirect;