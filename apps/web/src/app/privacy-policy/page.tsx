import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy – Context-Aware Translator",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: April 7, 2026</p>

        <div className="space-y-10 text-muted-foreground">

          {/* 1. Introduction */}
          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">1. Introduction</h2>
            <p>
              This Privacy Policy describes how Context-Aware Translator ("we", "our", or "us") collects, uses, and
              protects information when you use the Context-Aware Translator Chrome extension and its companion web
              dashboard (collectively, the "Service"). By using the Service you agree to the practices described here.
            </p>
          </section>

          {/* 2. Information We Collect */}
          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">2. Information We Collect</h2>

            <h3 className="font-bold text-foreground mb-2">Extension data</h3>
            <ul className="list-disc pl-6 space-y-1 mb-4">
              <li>
                <span className="font-medium text-foreground">Selected text</span> — the word or phrase you highlight on
                a webpage, sent to our API to produce a translation.
              </li>
              <li>
                <span className="font-medium text-foreground">Surrounding context</span> — a window of text around the
                selection, sent with the translation request to improve accuracy.
              </li>
              <li>
                <span className="font-medium text-foreground">Personal context string</span> — an optional description
                you provide (e.g. "I am an intermediate Spanish learner") that personalises translations. Stored in
                Chrome sync storage and on our server.
              </li>
              <li>
                <span className="font-medium text-foreground">Language preferences</span> — your chosen source and
                target languages. Stored in Chrome sync storage and on our server.
              </li>
            </ul>

            <h3 className="font-bold text-foreground mb-2">Account data</h3>
            <ul className="list-disc pl-6 space-y-1 mb-4">
              <li>
                <span className="font-medium text-foreground">Email address</span> — collected when you create an
                account via Supabase Auth.
              </li>
              <li>
                <span className="font-medium text-foreground">Saved translation concepts</span> — translations you
                choose to save, stored server-side in our PostgreSQL database.
              </li>
              <li>
                <span className="font-medium text-foreground">Custom AI provider API keys</span> — if you supply your
                own API key for a provider (e.g. OpenAI), it is stored server-side in encrypted form and used only to
                make translation requests on your behalf.
              </li>
            </ul>

            <h3 className="font-bold text-foreground mb-2">Usage and error data</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <span className="font-medium text-foreground">Crash and error reports</span> — collected via Sentry
                with a privacy-minimal configuration. Reports contain stack traces and browser environment metadata;
                they do not include page content or personal text.
              </li>
            </ul>
          </section>

          {/* 3. How We Use Your Information */}
          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Provide, operate, and improve the translation service.</li>
              <li>Authenticate your account and synchronise preferences across devices.</li>
              <li>Store and display your saved translation concepts in the dashboard.</li>
              <li>Forward selected text and context to AI providers to generate translations.</li>
              <li>Diagnose bugs and monitor service reliability via error reporting.</li>
            </ul>
            <p className="mt-3">
              We do not sell your data, use it for advertising, or share it with third parties except as described in
              Section 5.
            </p>
          </section>

          {/* 4. Data Storage & Retention */}
          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">4. Data Storage &amp; Retention</h2>
            <p className="mb-3">
              Preferences and account data are stored in a PostgreSQL database hosted on Railway. Auth data is managed
              by Supabase. The web dashboard is hosted on Vercel.
            </p>
            <p className="mb-3">
              We retain your data for as long as your account is active. You may request deletion at any time (see
              Section 7). Extension-local data (Chrome sync storage) is managed by your browser and can be cleared
              through your browser settings.
            </p>
            <p>
              Text you highlight on webpages is transmitted to our API for the purpose of translation and is not
              persistently stored on our servers unless you explicitly save the concept.
            </p>
          </section>

          {/* 5. Third-Party Services */}
          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">5. Third-Party Services</h2>
            <p className="mb-3">
              The following third-party services process data on our behalf. Each is bound by its own privacy policy.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left font-bold text-foreground py-2 pr-4">Service</th>
                    <th className="text-left font-bold text-foreground py-2 pr-4">Purpose</th>
                    <th className="text-left font-bold text-foreground py-2">Data involved</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="py-2 pr-4 font-medium text-foreground">Supabase</td>
                    <td className="py-2 pr-4">Authentication &amp; database</td>
                    <td className="py-2">Email, saved concepts, preferences</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium text-foreground">Railway</td>
                    <td className="py-2 pr-4">API hosting</td>
                    <td className="py-2">Translation requests, API keys</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium text-foreground">Vercel</td>
                    <td className="py-2 pr-4">Dashboard hosting</td>
                    <td className="py-2">Standard web request logs</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium text-foreground">Sentry</td>
                    <td className="py-2 pr-4">Error monitoring</td>
                    <td className="py-2">Stack traces, browser metadata</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium text-foreground">DeepL</td>
                    <td className="py-2 pr-4">Primary translation provider</td>
                    <td className="py-2">Selected text and surrounding context</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium text-foreground">Google Gemini / OpenAI / Anthropic / Mistral</td>
                    <td className="py-2 pr-4">Enrichment data &amp; translation fallback (server-side)</td>
                    <td className="py-2">Selected text and surrounding context</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3">
              AI provider calls are made server-side from our API; your raw browser session is not shared with AI
              providers directly.
            </p>
          </section>

          {/* 6. Chrome Extension Permissions Explained */}
          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">6. Chrome Extension Permissions Explained</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <span className="font-medium text-foreground">storage</span> — used to persist your authentication
                token, language preferences, and personal context string locally and via Chrome sync.
              </li>
              <li>
                <span className="font-medium text-foreground">tabs</span> — used to send messages to content scripts in
                active tabs and detect whether the content script is already running. Tab URLs are not stored or
                transmitted.
              </li>
              <li>
                <span className="font-medium text-foreground">activeTab</span> — grants temporary access to the
                currently active tab only when you invoke the extension (via the selection tooltip, context menu, or the
                keyboard shortcut <span className="font-mono text-sm">Alt+T</span>). The extension has no passive
                access to background tabs.
              </li>
              <li>
                <span className="font-medium text-foreground">scripting</span> — injects the translation UI into the
                active tab on demand. On sites you enable, the content script is registered persistently so it
                activates on page load. On other sites, it only runs when you explicitly trigger a translation via the
                context menu; it is not present on pages passively.
              </li>
              <li>
                <span className="font-medium text-foreground">contextMenus</span> — adds a "Translate" option to the
                right-click menu so you can translate selected text on any page without pre-enabling the site.
              </li>
              <li>
                <span className="font-medium text-foreground">sidePanel</span> — opens a sidebar workspace with
                translation, history, saved concepts, spaced repetition review, and settings. No data is collected by
                the side panel beyond what is described elsewhere in this policy.
              </li>
              <li>
                <span className="font-medium text-foreground">alarms</span> — schedules periodic checks for spaced
                repetition items that are due for review. No data leaves the browser via this permission.
              </li>
              <li>
                <span className="font-medium text-foreground">notifications</span> — sends a local browser
                notification when you have vocabulary items due for review, if you have enabled reminders in settings.
              </li>
              <li>
                <span className="font-medium text-foreground">Optional host permissions</span> — when you enable the
                extension on a specific site, Chrome prompts you to grant access to that site. This is requested
                per-site at runtime rather than granted broadly at install time. The extension never has blanket access
                to all websites.
              </li>
            </ul>
          </section>

          {/* 7. Your Rights */}
          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">7. Your Rights</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <span className="font-medium text-foreground">Access</span> — you can view all saved concepts and
                preferences in the dashboard at any time.
              </li>
              <li>
                <span className="font-medium text-foreground">Deletion</span> — you can delete individual saved concepts
                from the dashboard, or request full account deletion by contacting us (see Section 10). We will process
                deletion requests within 30 days.
              </li>
              <li>
                <span className="font-medium text-foreground">Opt-out of error reporting</span> — error reporting can
                be disabled; contact us if you wish to opt out.
              </li>
              <li>
                <span className="font-medium text-foreground">Data portability</span> — contact us to request an export
                of your saved data.
              </li>
            </ul>
            <p className="mt-3">
              If you are in the European Economic Area or United Kingdom you may also have rights under GDPR/UK GDPR,
              including the right to lodge a complaint with your supervisory authority.
            </p>
          </section>

          {/* 8. Data Security */}
          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">8. Data Security</h2>
            <p>
              All data in transit is encrypted via TLS. Custom API keys are stored encrypted at rest. We follow
              industry-standard practices for access control and secret management. No method of transmission or storage
              is 100% secure; we cannot guarantee absolute security, but we take reasonable steps to protect your data.
            </p>
          </section>

          {/* 9. Changes to This Policy */}
          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">9. Changes to This Policy</h2>
            <p>
              We may update this policy from time to time. When we do, we will revise the "Last updated" date at the
              top of this page. Continued use of the Service after changes are posted constitutes your acceptance of the
              revised policy. For material changes we will make reasonable efforts to notify you (e.g. via the
              dashboard).
            </p>
          </section>

          {/* 10. Contact */}
          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">10. Contact</h2>
            <p>
              If you have questions about this policy or wish to exercise your rights, please contact us at{" "}
              <a
                href="mailto:gbkp677zzb@privaterelay.appleid.com"
                className="text-foreground underline underline-offset-4 hover:opacity-70"
              >
                gbkp677zzb@privaterelay.appleid.com
              </a>
              .
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
