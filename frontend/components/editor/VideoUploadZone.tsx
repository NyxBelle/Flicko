"use client";

import { useCallback, useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { Upload, X, Plus, AlertCircle } from "lucide-react";
import { formatFileSize } from "@/lib/utils";

interface UploadedFile {
  file: File;
  preview: string;
  id: string;
}

interface VideoUploadZoneProps {
  files: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
  maxFiles?: number;
}

export type { UploadedFile };

export default function VideoUploadZone({ files, onChange, maxFiles = 5 }: VideoUploadZoneProps) {
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    (accepted: File[], rejected: FileRejection[]) => {
      setError(null);
      if (rejected.length > 0) { setError("Only MP4, MOV, and WebM files are accepted."); return; }
      if (files.length + accepted.length > maxFiles) { setError(`Maximum ${maxFiles} videos per edit.`); return; }
      const newFiles: UploadedFile[] = accepted.map((file) => ({
        file, preview: URL.createObjectURL(file), id: Math.random().toString(36).slice(2),
      }));
      onChange([...files, ...newFiles]);
    },
    [files, onChange, maxFiles]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "video/mp4": [".mp4"], "video/quicktime": [".mov"], "video/webm": [".webm"] },
    maxSize: 500 * 1024 * 1024,
  });

  const removeFile = (id: string) => {
    const removed = files.find((f) => f.id === id);
    if (removed) URL.revokeObjectURL(removed.preview);
    onChange(files.filter((f) => f.id !== id));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {files.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 10 }}>
          {files.map((f) => (
            <div
              key={f.id}
              style={{
                position: "relative", borderRadius: 12, overflow: "hidden",
                border: "1px solid var(--line)", background: "var(--paper-2)",
              }}
              className="upload-card"
            >
              <video src={f.preview} style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block" }} muted preload="metadata" />
              <div style={{ position: "absolute", top: 6, right: 6 }}>
                <button
                  type="button"
                  onClick={() => removeFile(f.id)}
                  style={{
                    width: 26, height: 26, borderRadius: "50%",
                    background: "rgba(239,68,68,0.9)", border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <X size={12} color="#fff" />
                </button>
              </div>
              <div style={{ padding: "6px 8px" }}>
                <p style={{ fontSize: 11, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.file.name}</p>
                <p style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{formatFileSize(f.file.size)}</p>
              </div>
            </div>
          ))}

          {files.length < maxFiles && (
            <div
              {...getRootProps()}
              style={{
                aspectRatio: "16/9", border: `2px dashed ${isDragActive ? "var(--accent)" : "var(--line-2)"}`,
                borderRadius: 12, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", cursor: "pointer",
                background: isDragActive ? "var(--accent-soft)" : "transparent",
                transition: "all 0.15s",
              }}
            >
              <input {...getInputProps()} />
              <Plus size={18} color="var(--muted)" />
              <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>Add more</p>
            </div>
          )}
        </div>
      )}

      {files.length === 0 && (
        <div
          {...getRootProps()}
          style={{
            border: `2px dashed ${isDragActive ? "var(--accent)" : "var(--line-2)"}`,
            borderRadius: 14, padding: "40px 24px",
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", cursor: "pointer", textAlign: "center",
            background: isDragActive ? "var(--accent-soft)" : "transparent",
            transition: "all 0.15s",
          }}
        >
          <input {...getInputProps()} />
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: "var(--paper-2)", border: "1px solid var(--line)",
            display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14,
          }}>
            <Upload size={20} color={isDragActive ? "var(--accent)" : "var(--muted)"} />
          </div>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 5 }}>
            {isDragActive ? "Drop your videos here" : "Drop your footage here"}
          </p>
          <p style={{ fontSize: 12.5, color: "var(--muted)" }}>
            MP4, MOV, or WebM · Up to {maxFiles} videos · 500MB each
          </p>
          <p style={{ fontSize: 12, color: "var(--accent)", fontWeight: 500, marginTop: 10 }}>Or click to browse</p>
        </div>
      )}

      {error && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8, fontSize: 12,
          color: "#c0392b", background: "#fce8e8", border: "1px solid #f5c6c6",
          borderRadius: 8, padding: "8px 12px",
        }}>
          <AlertCircle size={13} />
          {error}
        </div>
      )}
    </div>
  );
}
