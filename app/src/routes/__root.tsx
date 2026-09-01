import { createRootRoute, HeadContent, Outlet, Scripts, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NavProvider, type GoFn } from "@/lib/comic/nav";
import appCss from "../styles.css?url";

const APP_NAME = "کادر";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: APP_NAME },
      { name: "theme-color", content: "#0c0d10" },
      { name: "description", content: "استودیوی ساخت کمیک با قاب، ویدئو، حباب و موسیقی — روی همین دستگاه." },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=Vazirmatn:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  component: RootDocument,
});

function RouterNav({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const go: GoFn = (to, params) => {
    if (to === "/") void navigate({ to: "/" });
    else if (to === "/studio/$id") void navigate({ to: "/studio/$id", params: { id: params!.id } });
    else void navigate({ to: "/read/$id", params: { id: params!.id } });
  };
  return <NavProvider go={go}>{children}</NavProvider>;
}

function RootDocument() {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="antialiased">
        <PreviewHostBridge />
        <AuthProvider>
          <TooltipProvider>
            <RouterNav>
              <Outlet />
              <Toaster theme="dark" position="top-center" richColors={false} />
            </RouterNav>
          </TooltipProvider>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}
