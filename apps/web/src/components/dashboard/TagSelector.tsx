"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Tags, Check } from "lucide-react";
import TagBadge from "./TagBadge";

type Tag = {
  id: number;
  name: string;
  color: string;
};

type TagSelectorProps = {
  conceptId: number;
  assignedTags: Tag[];
  allTags: Tag[];
  onTagsChange: (tags: Tag[]) => void;
};

export default function TagSelector({
  conceptId,
  assignedTags,
  allTags,
  onTagsChange,
}: TagSelectorProps) {
  const supabase = createClient();
  const API_URL = process.env.NEXT_PUBLIC_API_URL;
  const [open, setOpen] = useState(false);

  const assignedIds = new Set(assignedTags.map((t) => t.id));

  async function toggleTag(tag: Tag) {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const isAssigned = assignedIds.has(tag.id);

      if (isAssigned) {
        const res = await fetch(
          `${API_URL}/saved-concepts/${conceptId}/tags/${tag.id}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${session.access_token}` },
          }
        );
        if (res.ok) {
          onTagsChange(assignedTags.filter((t) => t.id !== tag.id));
        } else {
          toast.error("Failed to update tag.");
        }
      } else {
        const res = await fetch(
          `${API_URL}/saved-concepts/${conceptId}/tags`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ tagId: tag.id }),
          }
        );
        if (res.ok) {
          onTagsChange([...assignedTags, tag]);
        } else {
          toast.error("Failed to update tag.");
        }
      }
    } catch (error) {
      console.error("Failed to toggle tag:", error);
      toast.error("Failed to update tag.");
    }
  }

  async function handleRemoveTag(tagId: number) {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(
        `${API_URL}/saved-concepts/${conceptId}/tags/${tagId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );
      if (res.ok) {
        onTagsChange(assignedTags.filter((t) => t.id !== tagId));
      } else {
        toast.error("Failed to remove tag.");
      }
    } catch (error) {
      console.error("Failed to remove tag:", error);
      toast.error("Failed to remove tag.");
    }
  }

  return (
    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-2 flex-wrap">
        {assignedTags.map((tag) => (
          <TagBadge
            key={tag.id}
            name={tag.name}
            color={tag.color}
            onRemove={() => handleRemoveTag(tag.id)}
          />
        ))}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 text-xs gap-1">
              <Tags className="size-3" />
              {assignedTags.length === 0 ? "Add tags" : "+"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search tags..." />
              <CommandList>
                <CommandEmpty>No tags found.</CommandEmpty>
                <CommandGroup>
                  {allTags.map((tag) => (
                    <CommandItem
                      key={tag.id}
                      onSelect={() => toggleTag(tag)}
                      className="gap-2"
                    >
                      <span
                        className="size-3 rounded-full shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="flex-1">{tag.name}</span>
                      {assignedIds.has(tag.id) && (
                        <Check className="size-3.5 text-primary" />
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
