"use client";

import { useEffect } from "react";
import { useRouter } from "next/router";
import { CurrentAppPage } from "@/components/unidad/current-app-page";
import { useAuth } from "@/lib/auth";

export default function AppPage() {
  const { loading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      void router.replace("/");
    }
  }, [loading, router, user]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0d0905]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#d29c62] border-t-transparent" />
      </div>
    );
  }

  return <CurrentAppPage />;
}
