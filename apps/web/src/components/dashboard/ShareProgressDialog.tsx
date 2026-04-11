"use client";

/**
 * "Share my progress" dialog.
 *
 * Opens a preview of the server-rendered OG image at
 * `/dashboard/progress/share`, and offers two follow-up actions:
 *
 *   - Download — fetch the PNG and trigger a save-as. We go through
 *     fetch + blob instead of a direct `<a download>` because the
 *     route is auth-gated and some browsers refuse to honor `download`
 *     cross-origin or for responses without a filename hint.
 *   - Copy Link — copy the absolute URL of the share route. The URL
 *     only resolves while the pasting user is signed in, which is the
 *     same constraint as the route itself. For fully public unfurls,
 *     a future iteration could swap auth for a signed token.
 *
 * Cache-busting: the `v={timestamp}` query param forces the preview
 * to re-render each time the dialog opens, so a user who just finished
 * a review session sees fresh numbers instead of a stale image from an
 * earlier modal invocation.
 */

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Share2, Download, Link2, Loader2 } from "lucide-react";

export default function ShareProgressDialog() {
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Bump the cache-buster each time the dialog opens so the preview
  // re-fetches. Otherwise the browser sees the same URL and may serve
  // a stale copy from its memory cache.
  const [cacheKey, setCacheKey] = useState(0);
  const previewSrc = useMemo(
    () => `/dashboard/progress/share?v=${cacheKey}`,
    [cacheKey]
  );

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) setCacheKey(Date.now());
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await fetch(previewSrc, { cache: "no-store" });
      if (!res.ok) {
        toast.error("Could not download image.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "my-language-progress.png";
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download share image:", error);
      toast.error("Could not download image.");
    } finally {
      setDownloading(false);
    }
  }

  async function handleCopyLink() {
    try {
      const url = new URL(
        "/dashboard/progress/share",
        window.location.origin
      ).toString();
      await navigator.clipboard.writeText(url);
      toast.success("Link copied.");
    } catch (error) {
      console.error("Failed to copy link:", error);
      toast.error("Could not copy link.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Share2 />
          Share Progress
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Share your progress</DialogTitle>
          <DialogDescription>
            A snapshot of your learning progress, rendered as a 1200x630
            image you can download or link.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg overflow-hidden border bg-muted/20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewSrc}
            alt="Your language progress card"
            className="w-full h-auto block"
            width={1200}
            height={630}
          />
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={handleCopyLink}>
            <Link2 className="size-4 mr-2" />
            Copy Link
          </Button>
          <Button onClick={handleDownload} disabled={downloading}>
            {downloading ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Downloading…
              </>
            ) : (
              <>
                <Download className="size-4 mr-2" />
                Download
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
