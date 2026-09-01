import { createFileRoute } from "@tanstack/react-router";
import { EditorView } from "@/components/studio/EditorView";

export const Route = createFileRoute("/studio/$id")({
  ssr: false,
  component: StudioPage,
});

function StudioPage() {
  const { id } = Route.useParams();
  return <EditorView id={id} />;
}
