import { useState, useEffect } from "react";
import { RefreshCcw } from "lucide-react";
import IngestionForm from "./IngestionForm";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function describeItemsError(status, detail) {
  if (status === 500) {
    return detail
      ? `Server error loading saved items: ${detail}`
      : "Server error loading saved items. Please try again.";
  }
  return detail || `Failed to fetch items (status ${status}).`;
}

export default function IngestionPanel() {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchItems = async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/items`, {
        headers: { Accept: "application/json" },
      });
      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(describeItemsError(response.status, result?.detail));
      }

      setItems(result?.data || []);
    } catch (err) {
      const message =
        err instanceof TypeError
          ? "Could not reach the API server. Is it running?"
          : err.message;
      console.error("Failed to fetch items:", err);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  return (
    <div className="col-span-12 md:col-span-6 flex h-auto w-full flex-col md:overflow-hidden border-b border-neutral-800  lg:h-full lg:max-h-none lg:border-b-0 lg:border-r">
      <IngestionForm fetchItems={fetchItems} />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-white sm:text-sm">
            Saved Items ({items.length})
          </h2>
          {!isLoading && (
            <button
              onClick={fetchItems}
              className="p-1 text-neutral-500 hover:text-neutral-300"
              title="Refresh"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="h-[10rem] md:h-auto overflow-y-auto">
          {isLoading && (
            <p className="px-4 py-4 text-sm text-neutral-400 sm:px-6">
              Loading...
            </p>
          )}

          {!isLoading && error && (
            <div className="px-4 py-4 sm:px-6">
              <p className="mb-2 text-sm text-red-500">{error}</p>
              <button
                onClick={fetchItems}
                className="text-xs font-semibold text-neutral-300 underline underline-offset-2 hover:text-white"
              >
                Retry
              </button>
            </div>
          )}

          {!isLoading && !error && items.length === 0 && (
            <p className="px-4 py-4 text-sm text-neutral-500 sm:px-6">
              No items saved yet.
            </p>
          )}

          {!isLoading &&
            !error &&
            items.map((item) => (
              <div
                key={item.id}
                className="border-b border-neutral-800 px-4 py-4 sm:px-6"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span
                    className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold ${
                      item.source_type === "url"
                        ? "bg-blue-500/10 text-blue-400"
                        : "bg-neutral-700/50 text-neutral-300"
                    }`}
                  >
                    {item.source_type === "url" ? (
                      <a href={item.url} target="_blank" rel="noopener noreferrer">
                        URL
                      </a>
                    ) : (
                      "NOTE"
                    )}
                  </span>
                  <h3 className="text-sm font-semibold text-white">
                    {item.title}
                  </h3>
                </div>
                <p className="line-clamp-2 text-sm leading-relaxed text-neutral-400">
                  {item.content}
                </p>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}