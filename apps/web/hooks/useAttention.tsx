"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { attentionApi, type AttentionItem } from "@/lib/api-client";

// Roles que ven el aviso de gestión.
const ELIGIBLE_ROLES = ["QA_ANALYST", "QA_LEAD", "ADMIN"];
const SESSION_KEY = "attention-popup-seen";

interface AttentionContextType {
  items: AttentionItem[];
  count: number;
  loading: boolean;
  open: boolean;
  openDialog: () => void;
  closeDialog: () => void;
  eligible: boolean;
}

const AttentionContext = createContext<AttentionContextType>({
  items: [],
  count: 0,
  loading: false,
  open: false,
  openDialog: () => {},
  closeDialog: () => {},
  eligible: false,
});

export function AttentionProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const eligible = !!user && ELIGIBLE_ROLES.includes(user.role.name);

  const [items, setItems] = useState<AttentionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (authLoading || !eligible) return;
    let cancelled = false;
    setLoading(true);
    attentionApi
      .list()
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        // Auto-abrir una sola vez por sesión si hay temas.
        const seen = typeof window !== "undefined" && sessionStorage.getItem(SESSION_KEY);
        if (res.items.length > 0 && !seen) {
          setOpen(true);
          sessionStorage.setItem(SESSION_KEY, "1");
        }
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, eligible]);

  const openDialog = useCallback(() => setOpen(true), []);
  const closeDialog = useCallback(() => setOpen(false), []);

  return (
    <AttentionContext.Provider
      value={{ items, count: items.length, loading, open, openDialog, closeDialog, eligible }}
    >
      {children}
    </AttentionContext.Provider>
  );
}

export function useAttention() {
  return useContext(AttentionContext);
}
