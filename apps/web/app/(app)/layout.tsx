"use client";

import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Cargando...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 relative overflow-y-auto scroll-smooth bg-background p-6">
          {/* Scroll depth cue - subtle gradient overlay */}
          <div
            className="pointer-events-none sticky top-0 left-0 right-0 h-1 -mt-6 -mx-6 mb-5 z-10"
            style={{
              background:
                "linear-gradient(180deg, rgba(0,0,0,0.03) 0%, transparent 100%)",
            }}
          />
          {children}
        </main>
      </div>
    </div>
  );
}
