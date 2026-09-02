import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LibraryView } from "@/components/studio/LibraryView";
import { EditorView } from "@/components/studio/EditorView";
import { ReaderView } from "@/components/studio/ReaderView";
import { NavProvider, type GoFn } from "@/lib/comic/nav";
import "./styles.css";

type Screen = { view: "library" } | { view: "editor"; id: string } | { view: "reader"; id: string };

function parseHash(): Screen {
  const raw = (location.hash || "#/").replace(/^#/, "");
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  const studio = path.match(/^\/studio\/([^/]+)\/?$/);
  if (studio) return { view: "editor", id: decodeURIComponent(studio[1]) };
  const read = path.match(/^\/read\/([^/]+)\/?$/);
  if (read) return { view: "reader", id: decodeURIComponent(read[1]) };
  return { view: "library" };
}

function App() {
  const [screen, setScreen] = useState<Screen>(() => parseHash());

  useEffect(() => {
    const onHash = () => setScreen(parseHash());
    window.addEventListener("hashchange", onHash);
    if (!location.hash) location.hash = "#/";
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go: GoFn = (to, params) => {
    if (to === "/") location.hash = "#/";
    else if (to === "/studio/$id") location.hash = `#/studio/${params?.id ?? ""}`;
    else location.hash = `#/read/${params?.id ?? ""}`;
  };

  return (
    <NavProvider go={go}>
      <TooltipProvider>
        {screen.view === "library" && <LibraryView />}
        {screen.view === "editor" && <EditorView id={screen.id} />}
        {screen.view === "reader" && <ReaderView id={screen.id} />}
        <Toaster theme="dark" position="top-center" richColors={false} />
      </TooltipProvider>
    </NavProvider>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
