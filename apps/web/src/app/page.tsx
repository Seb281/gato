import { Button } from "@/components/ui/button";
import { ArrowRight, Languages } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8 text-center bg-background text-foreground">
      <div className="max-w-2xl space-y-8">
        <div className="flex justify-center">
          <div className="p-4 rounded-full bg-primary/10">
            <Languages className="size-12 text-primary" />
          </div>
        </div>
        
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          Context-Aware Translator
        </h1>
        
        <p className="text-xl text-muted-foreground">
          Review and master the concepts you've translated. Your personal vocabulary builder, powered by AI.
        </p>

        <div className="flex justify-center gap-4">
          {user ? (
            <Link href="/dashboard">
              <Button size="lg" className="gap-2">
                Go to Dashboard
                <ArrowRight className="size-4" />
              </Button>
            </Link>
          ) : (
            <Link href="/sign-in">
              <Button size="lg">Sign In to Start</Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
