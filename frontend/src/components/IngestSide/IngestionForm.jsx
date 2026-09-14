import { useState } from "react";
import { Plus, Loader2, CheckCircle2, AlertCircle, AlertTriangle } from "lucide-react";
import SourceTypeTabs from "./SourceTypeTabs";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function describeIngestError(status, detail) {
  switch (status) {
    case 400:
      return { text: detail || "That request is missing a required field.", severity: "error" };
    case 422:
      return {
        text: detail || "That request wasn't formatted correctly. Please check the fields.",
        severity: "error",
      };
    case 500:
      return {
        text: detail
          ? `Server error while saving: ${detail}`
          : "Something went wrong saving this on the server. Please try again.",
        severity: "error",
      };
    default:
      return { text: detail || `Request failed with status ${status}.`, severity: "error" };
  }
}

export default function IngestionForm({ fetchItems }) {
  const [sourceType, setSourceType] = useState("note");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState(null);

  const isUrlType = sourceType === "url";

  const handleSourceTypeChange = (type) => {
    setSourceType(type);
    setBody("");
    setStatus(null);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setStatus({ type: "error", text: "Title is required." });
      return;
    }
    if (!body.trim()) {
      setStatus({
        type: "error",
        text: isUrlType ? "URL is required." : "Note content is required.",
      });
      return;
    }

    setStatus(null);
    setIsSaving(true);

    const payload = {
      source_type: sourceType,
      title: title.trim(),
      content: isUrlType ? "" : body.trim(),
      url: isUrlType ? body.trim() : "",
    };

    try {
      const response = await fetch(`${API_BASE_URL}/ingest`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        const { text } = describeIngestError(response.status, result?.detail);
        setStatus({ type: "error", text });
        return;
      }

      if (result?.data?.is_duplicate) {
        setStatus({
          type: "info",
          text: result.message || "This source already exists in your inbox.",
        });
        return;
      }

      setStatus({
        type: "success",
        text: result?.message || "Source saved successfully.",
      });
      fetchItems();
      setTitle("");
      setBody("");
    } catch (err) {
      console.error("Ingest failed:", err);
      setStatus({
        type: "error",
        text: "Could not reach the API server. Is it running?",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const statusStyles = {
    error: "text-red-500",
    success: "text-emerald-500",
    info: "text-amber-500",
  };

  const statusIcons = {
    error: AlertCircle,
    success: CheckCircle2,
    info: AlertTriangle,
  };

  return (
    <div className="border-b border-neutral-800 p-4 sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-semibold text-white sm:text-lg">
          Content Ingestion
        </h2>
        <SourceTypeTabs active={sourceType} onChange={handleSourceTypeChange} />
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title or brief identifier..."
        className="mb-3 w-full rounded-md border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm text-white placeholder-neutral-500 outline-none focus:border-neutral-500"
      />

      {isUrlType ? (
        <input
          type="url"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="https://example.com/article"
          className="mb-4 w-full rounded-md border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm text-white placeholder-neutral-500 outline-none focus:border-neutral-500"
        />
      ) : (
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Paste or type notes, snippets, meeting transcripts..."
          rows={5}
          className="mb-4 w-full resize-none rounded-md border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm text-white placeholder-neutral-500 outline-none focus:border-neutral-500"
        />
      )}

      {status && (
        (() => {
          const Icon = statusIcons[status.type];
          return (
            <p className={`mb-3 flex items-center gap-1.5 text-xs ${statusStyles[status.type]}`}>
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {status.text}
            </p>
          );
        })()
      )}

      <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <code className="text-xs text-neutral-500">POST /ingest</code>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center justify-center gap-2 rounded-md bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60 sm:py-2"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {isSaving ? "Saving..." : "Save to Inbox"}
        </button>
      </div>
    </div>
  );
}