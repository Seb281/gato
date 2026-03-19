import { LogOut, Languages, User } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";
import ExtensionBridge from "@/components/ExtensionBridge";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 font-semibold"
          >
            <Languages className="size-5 text-primary" />
            <span>Context-Aware Translator</span>
          </Link>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-4 w-4 text-primary" />
              </div>
              <span className="hidden sm:inline">{user?.email}</span>
            </div>
            <form action={signOut}>
              <Button variant="ghost" size="sm" type="submit">
                <LogOut className="size-4 mr-2" />
                Sign Out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <ExtensionBridge />
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  );
}