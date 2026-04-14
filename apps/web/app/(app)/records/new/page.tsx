"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ManualEntryRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/mi-semana");
  }, [router]);
  return (
    <div className="p-6 text-sm text-gray-500">
      Redirigiendo al registro diario...
    </div>
  );
}
