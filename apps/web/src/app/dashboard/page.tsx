import ConceptsList from "@/components/dashboard/ConceptsList";
import SettingsForm from "@/components/dashboard/SettingsForm";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Manage your saved vocabulary and translation preferences.
        </p>
      </div>
      <Separator />
      
      <Tabs defaultValue="vocabulary" className="space-y-4">
        <TabsList>
          <TabsTrigger value="vocabulary">Vocabulary</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="vocabulary" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Saved Concepts</h2>
          </div>
          <ConceptsList />
        </TabsContent>
        <TabsContent value="settings" className="space-y-4">
          <SettingsForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}
