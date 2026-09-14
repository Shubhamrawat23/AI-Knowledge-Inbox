import { useState } from "react";
import { Clock, RefreshCcw, ShieldAlert, ServerCrash, AlertCircle } from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function describeQueryError(status, detail) {
  switch (status) {
    case 422:
      return {
        text: detail || "That question wasn't valid. Try rephrasing it.",
        icon: AlertCircle,
        retryable: false,
      };
    case 429:
      return {
        text: "The AI provider is rate-limiting requests right now. Wait a moment and try again.",
        icon: Clock,
        retryable: true,
      };
    case 502:
      return {
        text: "The AI service returned an error. Try again in a moment.",
        icon: ServerCrash,
        retryable: true,
      };
    case 503:
      return {
        text: detail || "The AI service is unavailable right now. Try again shortly.",
        icon: ServerCrash,
        retryable: true,
      };
    case 504:
      return {
        text: "The AI service timed out. Try again.",
        icon: Clock,
        retryable: true,
      };
    case 500:
      return {
        text: detail
          ? `Something went wrong processing your question: ${detail}`
          : "Something went wrong processing your question.",
        icon: ShieldAlert,
        retryable: false,
      };
    default:
      return {
        text: detail || `Request failed with status ${status}.`,
        icon: AlertCircle,
        retryable: false,
      };
  }
}

export default function QueryPanel() {
  const [question, setQuestion] = useState("");
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const runQuery = async (q) => {
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/query`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question: q }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        const { text, icon, retryable } = describeQueryError(response.status, result?.detail);
        setResults((prev) => [
          ...prev,
          { question: q, error: text, errorIcon: icon, retryable, status: response.status },
        ]);
        return;
      }

      setResults((prev) => [
        ...prev,
        {
          question: result.data.question,
          answer: result.data.answer,
          source: result.data.source || [],
        },
      ]);
    } catch (err) {
      console.error("Query failed:", err);
      setResults((prev) => [
        ...prev,
        {
          question: q,
          error: "Could not reach the API server. Is it running?",
          errorIcon: ServerCrash,
          retryable: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAsk = () => {
    const q = question.trim();
    if (!q) return;
    setQuestion("");
    runQuery(q);
  };

  const handleRetry = (q) => {
    runQuery(q);
  };

  return (
    <div className="col-span-12 md:col-span-6 md:min-h-0 flex flex-1 flex-col">
      <div className="flex flex-col gap-1 border-b border-neutral-800 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
        <h2 className="text-sm font-semibold text-white sm:text-base">
          RAG Query Engine
        </h2>
        <div className="text-xs text-neutral-400">Model: nvidia/nemotron-3</div>
      </div>

      <div className="md:flex-1 h-[8rem] space-y-6 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
        {results.length === 0 && !isLoading && (
          <p className="text-sm text-neutral-500">
            Ask a question about your saved notes.
          </p>
        )}

        {results.map((r, i) => {
          const ErrorIcon = r.errorIcon;
          return (
            <div key={i}>
              <p className="mb-2 text-sm font-semibold text-white">{r.question}</p>

              {r.error ? (
                <div>
                  <p className="flex items-center gap-1.5 text-sm text-red-500">
                    {ErrorIcon && <ErrorIcon className="h-3.5 w-3.5 shrink-0" />}
                    {r.error}
                  </p>
                  {r.retryable && (
                    <button
                      onClick={() => handleRetry(r.question)}
                      disabled={isLoading}
                      className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-neutral-300 underline underline-offset-2 hover:text-white disabled:opacity-50"
                    >
                      <RefreshCcw className="h-3 w-3" />
                      Retry
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-neutral-300">
                    {r.answer}
                  </p>
                  {r.source.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {r.source.map((s) => (
                        <span
                          key={s.id}
                          className="rounded border border-neutral-700 px-2 py-0.5 text-xs text-neutral-400"
                        >
                          {s.title} ({s.source_type})
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}

        {isLoading && <p className="text-sm text-neutral-400">Thinking...</p>}
      </div>

      <div className="border-t border-neutral-800 px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAsk()}
            placeholder="Ask anything about your saved notes..."
            className="flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm text-white placeholder-neutral-500 outline-none focus:border-neutral-500"
          />
          <button
            onClick={handleAsk}
            disabled={isLoading}
            className="rounded-md bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Ask
          </button>
        </div>
      </div>
    </div>
  );
}