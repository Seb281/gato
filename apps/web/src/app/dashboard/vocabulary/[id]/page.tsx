import ConceptDetail from "@/components/dashboard/ConceptDetail";

export default async function ConceptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <ConceptDetail conceptId={id} />;
}
