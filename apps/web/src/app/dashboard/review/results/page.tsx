import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ReviewResultsPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-4">
      <p className="text-muted-foreground">
        Session results are displayed at the end of each review session.
      </p>
      <Button variant="outline" asChild>
        <Link href="/dashboard/review">Start a Review</Link>
      </Button>
    </div>
  );
}
