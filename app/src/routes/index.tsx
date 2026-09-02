import { createFileRoute } from "@tanstack/react-router";
import { LibraryView } from "@/components/studio/LibraryView";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <LibraryView />;
}
