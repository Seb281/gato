import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions";
import ExtensionBridge from "@/components/ExtensionBridge";
import DashboardShortcuts from "@/components/DashboardShortcuts";
import Sidebar from "@/components/dashboard/Sidebar";
import MobileNav from "@/components/dashboard/MobileNav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar userEmail={user?.email} signOutAction={signOut} />
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-4 md:p-8 lg:p-8 pb-20 lg:pb-8">
          {children}
        </main>
      </div>
      <MobileNav signOutAction={signOut} />
      <ExtensionBridge />
      <DashboardShortcuts />
    </div>
  );
}
