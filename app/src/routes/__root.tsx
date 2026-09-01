import { createRootRoute, HeadContent, Outlet, Scripts, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { DirectionProvider } from "@radix-ui/react-direction";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NavProvider, type GoFn } from "@/lib/comic/nav";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";
import appCss from "../styles.css?url";

const APP_NAME = "کادر";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        // `interactive-widget` keeps the layout above the Android keyboard
        // instead of letting it slide the whole shell up.
        content:
          "width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content",
      },
      { title: APP_NAME },
      { name: "theme-color", content: "#0a0b10" },
      { name: "color-scheme", content: "dark light" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      {
        name: "description",
        content: "استودیوی ساخت کمیک با قاب، ویدئو، حباب و موسیقی — روی همین دستگاه.",
      },
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
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=Lalezar&family=Vazirmatn:wght@400;500;600;700;800&display=swap",
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
    <html lang="fa" dir="rtl" data-theme="dark" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="antialiased">
        <PreviewHostBridge />
        <AuthProvider>
          {/* Radix reads direction from context, not from the DOM: without this
              sliders fill from the wrong edge and menus align backwards. */}
          <DirectionProvider dir="rtl">
            <TooltipProvider>
              <RouterNav>
                <Outlet />
                <Toaster
                  position="top-center"
                  offset={16}
                  richColors={false}
                  toastOptions={{
                    unstyled: true,
                    classNames: {
                      toast:
                        "flex w-full items-center gap-2.5 rounded-xl bg-elevated px-3.5 py-3 text-sm text-fg shadow-[var(--shadow-lift)] animate-pop",
                      title: "font-medium",
                      description: "text-muted text-xs",
                      icon: "shrink-0",
                      success: "[&_[data-icon]]:text-ok",
                      error: "[&_[data-icon]]:text-danger",
                    },
                  }}
                />
              </RouterNav>
            </TooltipProvider>
          </DirectionProvider>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}
