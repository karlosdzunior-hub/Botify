import { Layout } from "@/components/layout";
import { Construction } from "lucide-react";

export default function SettingsPage() {
  return (
    <Layout title="Settings">
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4 px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
          <Construction className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-semibold">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Settings page is under construction. Check back soon!
        </p>
      </div>
    </Layout>
  );
}
