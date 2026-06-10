"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function ProfileEditForm({
  initialName,
  userId,
}: {
  initialName: string;
  userId: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [editing, setEditing] = useState(!initialName);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Name cannot be empty"); return; }
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: name.trim() })
        .eq("id", userId);
      if (error) throw error;
      toast.success("Name updated");
      setEditing(false);
      router.refresh();
    } catch {
      toast.error("Failed to update name");
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          placeholder="Your full name"
          style={{
            flex: 1, background: "var(--paper)",
            border: "1px solid var(--ink)",
            borderRadius: 8, padding: "7px 12px",
            fontSize: 14, color: "var(--ink)", outline: "none",
            fontFamily: "var(--font-sans)",
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape" && initialName) { setName(initialName); setEditing(false); }
          }}
        />
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            fontSize: 13, fontWeight: 600, color: "#fff",
            background: "var(--accent)", border: "none",
            padding: "7px 14px", borderRadius: 8,
            cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1,
            whiteSpace: "nowrap",
          }}
        >{saving ? "Saving…" : "Save"}</button>
        {initialName && (
          <button
            onClick={() => { setName(initialName); setEditing(false); }}
            style={{
              fontSize: 13, color: "var(--muted)", background: "none",
              border: "none", cursor: "pointer", padding: "7px",
            }}
          >Cancel</button>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>{name}</span>
      <button
        onClick={() => setEditing(true)}
        style={{
          fontSize: 12.5, color: "var(--accent)", background: "none",
          border: "none", cursor: "pointer", fontWeight: 600, padding: "4px 0",
        }}
      >Edit</button>
    </div>
  );
}
