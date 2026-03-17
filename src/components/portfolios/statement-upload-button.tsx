"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";

export interface UploadResult {
  statementId: string;
  brokerageName?: string;
  statementDate?: string;
  holdingCount: number;
  holdings: {
    id: string;
    ticker?: string | null;
    securityName: string;
    assetClass: string;
    shares?: number | null;
    pricePerShare?: number | null;
    marketValue: number;
    percentOfAccount?: number | null;
  }[];
}

interface Props {
  accountId?: string;
  onUploadComplete: (result: UploadResult) => void;
  onError?: (msg: string) => void;
}

export function StatementUploadButton({ accountId, onUploadComplete, onError }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      if (accountId) form.append("accountId", accountId);

      const res = await fetch("/api/statements/upload", { method: "POST", body: form });
      const data = await res.json();

      if (!res.ok) {
        onError?.(data.error ?? "Upload failed");
        return;
      }
      onUploadComplete(data);
    } catch {
      onError?.("Network error during upload");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.txt,.csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        <Upload className="h-4 w-4" />
        {uploading ? "Analyzing…" : "Upload Statement"}
      </button>
    </>
  );
}
