import { createFileRoute } from "@tanstack/react-router";
import { ReaderView } from "@/components/studio/ReaderView";

export const Route = createFileRoute("/read/$id")({
  component: ReadPage,
});

function ReadPage() {
  const { id } = Route.useParams();
  return <ReaderView id={id} />;
}
