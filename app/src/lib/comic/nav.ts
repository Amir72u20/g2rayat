import { createContext, createElement, useCallback, useContext, type ReactNode } from "react";

export type AppPath = "/" | "/easy" | "/studio/$id" | "/read/$id";
export type GoFn = (to: AppPath, params?: { id: string }) => void;

const NavCtx = createContext<GoFn | null>(null);

export function NavProvider({ go, children }: { go: GoFn; children: ReactNode }) {
  return createElement(NavCtx.Provider, { value: go }, children);
}

export function useAppNav(): GoFn {
  const ctx = useContext(NavCtx);
  return useCallback<GoFn>(
    (to, params) => {
      if (ctx) {
        ctx(to, params);
        return;
      }
      if (to === "/") window.location.assign("/");
      else if (to === "/easy") window.location.assign("/easy");
      else if (to === "/studio/$id") window.location.assign(`/studio/${params?.id ?? ""}`);
      else window.location.assign(`/read/${params?.id ?? ""}`);
    },
    [ctx],
  );
}
