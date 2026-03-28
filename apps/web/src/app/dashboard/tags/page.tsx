import TagManager from "@/components/dashboard/TagManager";

export default function TagsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Tags</h1>
        <p className="text-muted-foreground">
          Organize your vocabulary by topic.
        </p>
      </div>
      <TagManager />
    </div>
  );
}
