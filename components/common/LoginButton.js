"use client";

import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useState } from "react";

const LoginButton = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = () => {
    setIsLoading(true);
    // Store the current path to redirect back after login
    const redirectPath = pathname.startsWith("/publicAgent") ? "/publicAgent/login" : "/login";
    router.push(redirectPath);
  };

  return (
    <button
      data-testid="login-button"
      id="login-button"
      onClick={handleLogin}
      disabled={isLoading}
      className="btn btn-primary flex items-center"
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Redirecting...
        </>
      ) : (
        "Login"
      )}
    </button>
  );
};

export default LoginButton;
