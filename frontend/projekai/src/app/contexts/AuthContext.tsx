"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useRouter } from "next/navigation";

export interface User {
  id: string;
  email: string;
  fullName: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  /** `redirectTo: null` keeps the user on the current page (inline sign-in). */
  login: (token: string, user: User, opts?: { redirectTo?: string | null }) => void;
  /** `redirect: false` clears the session without leaving the page (expired token). */
  logout: (opts?: { redirect?: boolean }) => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Only same-site paths are accepted as a post-login destination. */
export function safeNext(next: string | null): string | null {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    try {
      const storedToken = localStorage.getItem("token");
      const storedUser = localStorage.getItem("user");
      if (storedToken && storedUser) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from localStorage after hydration
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch {
      // Corrupt or blocked storage: treat as signed out.
    }
    setIsLoading(false);
  }, []);

  const login = useCallback<AuthContextType["login"]>(
    (newToken, newUser, opts) => {
      try {
        localStorage.setItem("token", newToken);
        localStorage.setItem("user", JSON.stringify(newUser));
      } catch {
        // Session still works in memory.
      }
      setToken(newToken);
      setUser(newUser);
      const target = opts?.redirectTo === undefined ? "/dashboard" : opts.redirectTo;
      if (target) router.push(target);
    },
    [router],
  );

  const logout = useCallback<AuthContextType["logout"]>(
    (opts) => {
      try {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      } catch {
        // ignore
      }
      setToken(null);
      setUser(null);
      if (opts?.redirect !== false) router.push("/");
    },
    [router],
  );

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
