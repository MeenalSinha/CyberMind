import React from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Home } from "lucide-react";

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
      <div className="card p-10 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <Shield size={28} className="text-primary-600" />
        </div>
        <h1 className="font-display font-bold text-neutral-900 text-2xl mb-2">404</h1>
        <p className="text-neutral-500 text-sm mb-6">
          This page does not exist or has been moved.
        </p>
        <button
          onClick={() => navigate("/")}
          className="btn-primary inline-flex items-center gap-2"
        >
          <Home size={15} />
          Return to Dashboard
        </button>
      </div>
    </div>
  );
}
