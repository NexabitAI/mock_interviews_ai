"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const onClick = async () => {
    try {
      setLoading(true);
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      // router.replace("/sign-in"); // goes directly to /sign-in
      // router.refresh(); 
      window.location.href = "/sign-in";          // bust any cached user state
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="px-3 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-100 disabled:opacity-50"
      aria-label="Sign out"
    >
      {loading ? "Signing out..." : "Sign out"}
    </button>
  );
}
