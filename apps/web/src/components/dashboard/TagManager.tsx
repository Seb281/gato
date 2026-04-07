"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Tags, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import TagBadge from "./TagBadge";
import { useTranslation } from "@/lib/i18n/useTranslation";

type Tag = {
  id: number;
  name: string;
  color: string;
};

const PRESET_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#6b7280", // gray
  "#78716c", // stone
];

export default function TagManager() {
  const supabase = createClient();
  const { t } = useTranslation();
  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#3b82f6");
  const [creating, setCreating] = useState(false);

  // Edit dialog state
  const [editTag, setEditTag] = useState<Tag | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [saving, setSaving] = useState(false);

  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    fetchTags();
  }, []);

  async function fetchTags() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      const res = await fetch(`${API_URL}/tags`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTags(data.tags);
      }
    } catch (error) {
      console.error("Failed to fetch tags:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`${API_URL}/tags`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ name: newName.trim(), color: newColor }),
      });

      if (res.ok) {
        const data = await res.json();
        setTags((prev) => [...prev, data.tag]);
        setNewName("");
        setNewColor("#3b82f6");
        setCreateOpen(false);
      } else {
        const err = await res.json();
        if (err.error?.includes("already exists")) {
          alert(t("tags.duplicateError"));
        }
      }
    } catch (error) {
      console.error("Failed to create tag:", error);
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdate() {
    if (!editTag || !editName.trim()) return;
    setSaving(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`${API_URL}/tags/${editTag.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ name: editName.trim(), color: editColor }),
      });

      if (res.ok) {
        const data = await res.json();
        setTags((prev) =>
          prev.map((t) => (t.id === editTag.id ? data.tag : t))
        );
        setEditTag(null);
      } else {
        toast.error("Failed to update tag.");
      }
    } catch (error) {
      console.error("Failed to update tag:", error);
      toast.error("Failed to update tag.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(tagId: number) {
    setDeletingId(tagId);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`${API_URL}/tags/${tagId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        setTags((prev) => prev.filter((t) => t.id !== tagId));
      } else {
        toast.error("Failed to delete tag.");
      }
    } catch (error) {
      console.error("Failed to delete tag:", error);
      toast.error("Failed to delete tag.");
    } finally {
      setDeletingId(null);
    }
  }

  function openEdit(tag: Tag) {
    setEditTag(tag);
    setEditName(tag.name);
    setEditColor(tag.color);
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-32">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Tags className="size-5 text-muted-foreground" />
            {t("tags.yourTags")}
          </CardTitle>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1">
                <Plus className="size-4" />
                {t("tags.newTag")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("tags.createTag")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tag-name">{t("tags.name")}</Label>
                  <Input
                    id="tag-name"
                    placeholder="e.g. Food, Travel, Work"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreate();
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("tags.color")}</Label>
                  <div className="flex gap-2 flex-wrap">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`size-7 rounded-full ring-2 ring-offset-2 ring-offset-background transition-all ${
                          newColor === c
                            ? "ring-foreground scale-110"
                            : "ring-transparent"
                        }`}
                        style={{ backgroundColor: c }}
                        onClick={() => setNewColor(c)}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Label htmlFor="custom-color" className="text-xs">
                      {t("tags.custom")}
                    </Label>
                    <input
                      id="custom-color"
                      type="color"
                      value={newColor}
                      onChange={(e) => setNewColor(e.target.value)}
                      className="size-7 rounded cursor-pointer"
                    />
                    <span className="text-xs text-muted-foreground">
                      {newColor}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {t("tags.preview")}
                  </span>
                  <TagBadge
                    name={newName || t("tags.name")}
                    color={newColor}
                  />
                </div>
                <Button
                  onClick={handleCreate}
                  disabled={creating || !newName.trim()}
                  className="w-full"
                >
                  {creating && (
                    <Loader2 className="size-4 animate-spin mr-2" />
                  )}
                  {t("tags.createTag")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {tags.length === 0 ? (
          <div className="text-center py-12 space-y-4">
            <div className="flex justify-center">
              <div className="p-4 rounded-full bg-muted">
                <Tags className="size-8 text-muted-foreground" />
              </div>
            </div>
            <h3 className="text-lg font-medium">{t("tags.noTags")}</h3>
            <p className="text-muted-foreground max-w-sm mx-auto">
              {t("tags.noTagsDesc")}
            </p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4 mr-2" />
              {t("tags.createTag")}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {tags.map((tag) => (
              <div
                key={tag.id}
                className="flex items-center justify-between rounded-md bg-secondary px-3 py-2"
              >
                <TagBadge name={tag.name} color={tag.color} />
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => openEdit(tag)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(tag.id)}
                    disabled={deletingId === tag.id}
                  >
                    {deletingId === tag.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog
          open={editTag !== null}
          onOpenChange={(open) => {
            if (!open) setEditTag(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("tags.editTag")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-tag-name">{t("tags.name")}</Label>
                <Input
                  id="edit-tag-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleUpdate();
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("tags.color")}</Label>
                <div className="flex gap-2 flex-wrap">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`size-7 rounded-full ring-2 ring-offset-2 ring-offset-background transition-all ${
                        editColor === c
                          ? "ring-foreground scale-110"
                          : "ring-transparent"
                      }`}
                      style={{ backgroundColor: c }}
                      onClick={() => setEditColor(c)}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Label htmlFor="edit-custom-color" className="text-xs">
                    {t("tags.custom")}
                  </Label>
                  <input
                    id="edit-custom-color"
                    type="color"
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                    className="size-7 rounded cursor-pointer"
                  />
                  <span className="text-xs text-muted-foreground">
                    {editColor}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{t("tags.preview")}</span>
                <TagBadge name={editName || t("tags.name")} color={editColor} />
              </div>
              <Button
                onClick={handleUpdate}
                disabled={saving || !editName.trim()}
                className="w-full"
              >
                {saving && (
                  <Loader2 className="size-4 animate-spin mr-2" />
                )}
                {t("tags.saveChanges")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
