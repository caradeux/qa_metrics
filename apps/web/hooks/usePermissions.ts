"use client";

import { useAuth } from "./useAuth";

export function usePermissions() {
  const { user } = useAuth();

  const can = (resource: string, action: string): boolean => {
    return (
      user?.role.permissions.some(
        (p) => p.resource === resource && p.action === action
      ) ?? false
    );
  };

  return { can };
}
