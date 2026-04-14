import { createClient } from "@/lib/supabase/server";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import FeedbackPageClient from "./FeedbackPageClient";

/**
 * Public feedback page — accessible without authentication.
 * Server component resolves auth state and passes it to the client form.
 */
export default async function FeedbackPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <I18nProvider>
      <FeedbackPageClient
        isLoggedIn={!!user}
        userEmail={user?.email ?? null}
      />
    </I18nProvider>
  );
}
