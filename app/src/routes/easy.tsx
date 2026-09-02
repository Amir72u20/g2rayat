import { createFileRoute } from "@tanstack/react-router";
import { EasyWizard } from "@/components/studio/easy/EasyWizard";

export const Route = createFileRoute("/easy")({
  // The builder edits canvases and IndexedDB assets — client only.
  ssr: false,
  component: EasyPage,
});

function EasyPage() {
  return <EasyWizard />;
}
