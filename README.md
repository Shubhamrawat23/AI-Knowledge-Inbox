# AI Knowledge Inbox

A lightweight, single-user RAG application for saving notes/URLs and asking questions over them using a simple Retrieval-Augmented Generation (RAG) pipeline.

Save a note or a link → it gets chunked and embedded → ask a question → the app retrieves the most relevant chunks and asks an LLM to answer, citing which saved item(s) it used.

Built as a single-user MVP (no auth, no distributed infra) per the assignment scope.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React (Vite) + Tailwind CSS |
| Backend | FastAPI (Python) |
| Storage | SQLite (raw content, metadata, and embeddings) |
| Embeddings | Local model — `BAAI/bge-small-en-v1.5` (sentence-transformers) |
| LLM (Q&A) | OpenRouter API — `nvidia/nemotron-3-super-120b-a12b:free` |
| Similarity search | NumPy cosine similarity over vectors loaded from SQLite |

---

## Project Structure

```
ragChat/
├── backend/
│   ├── app/
│   │   ├── modules/
│   │   │   ├── repository.py       # DB access layer (SQLite reads/writes)
│   │   │   ├── routers.py          # FastAPI route definitions
│   │   │   ├── schemas.py          # Pydantic request/response models
│   │   │   ├── services.py         # Business logic: chunking, RAG, orchestration
│   │   │   └── utils/
│   │   │       └── external_services.py   # Embedding model + OpenRouter LLM calls
│   │   ├── db_creation.py          # SQLite schema/table setup
│   │   └── main.py                 # FastAPI app entrypoint
│   ├── knowledge_inbox.db          # SQLite database file (created on first run)
│   └── requirements.txt
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── chat/
    │   │   │   └── QueryPanel.jsx       # Ask-a-question UI + answer/source display
    │   │   ├── header/
    │   │   │   └── TopBar.jsx
    │   │   └── IngestSide/
    │   │       ├── IngestionForm.jsx    # Note/URL input form
    │   │       ├── IngestionPanel.jsx   # List of saved items
    │   │       └── SourceTypeTabs.jsx   # Toggle between "note" / "url" input
    │   ├── App.jsx
    │   └── main.jsx
    ├── .env
    ├── package.json
    └── vite.config.js
```

---

## Setup & Running Locally

### Prerequisites
- Python 3.10+
- Node.js 18+
- An [OpenRouter](https://openrouter.ai) API key

### 1. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate     # Windows: .venv\Scripts\activate

pip install -r requirements.txt
```

> **Note:** Create a .env file in the backend root and add your OpenRouter API key: OPENROUTER_API_KEY=your_api_key_here)

The first time you run the app, `db_creation.py` initializes the SQLite schema (`knowledge_inbox.db`) automatically — no manual migration step needed.

The first run will also download the `BAAI/bge-small-en-v1.5` embedding model locally (via sentence-transformers), so expect a one-time delay.

Start the server:

```bash
uvicorn app.main:app --reload --port 8000
```

Backend runs at `http://localhost:8000`.

### 2. Frontend

In a separate terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`.

### 3. Use it

Open `http://localhost:5173`, add a note or a URL, then ask a question about what you've saved.

---

## API Design

All endpoints return a consistent envelope shape (`schema.APIResponse`):

```json
{
  "status": "success" | "error",
  "code": 200,
  "message": "Human-readable summary",
  "data": null,
  "error": null
}
```

### `POST /ingest`
Add a note or a URL to the knowledge base.

**Request**
```json
{
  "source_type": "note",
  "title": "Deployment notes",
  "content": "Plain text note content...",
  "url": ""
}
```
- `source_type` must be `"note"` or `"url"`.
- If `source_type = "url"`: `url` is required.
- If `source_type = "note"`: `content` and `title` are both required.

For `source_type: "url"`, the server fetches and scrapes the page server-side (title + raw text), stores that as the source, then chunks and embeds it the same way as a note.

Before inserting, the backend checks for an existing source with the same `url`, `content`, or `title` and skips re-ingesting a duplicate.

**Response `200 OK` — new source ingested**
```json
{
  "status": "success",
  "code": 200,
  "message": "Source saved successfully",
  "data": {
    "source_id": 12,
    "chunks_count": 3
  },
  "error": null
}
```

**Response `200 OK` — duplicate detected (not re-ingested)**
```json
{
  "status": "success",
  "code": 200,
  "message": "Source with matching Title, URL or Content already exists.",
  "data": {
    "source_id": 5,
    "is_duplicate": true
  },
  "error": null
}
```

**Error cases**
- `400 Bad Request` — `url` missing when `source_type = "url"`, or `content`/`title` missing when `source_type = "note"` (checked explicitly in the router)
- `422 Unprocessable Entity` — request body fails Pydantic schema validation (e.g. invalid `source_type` value, wrong field types) — handled automatically by FastAPI
- `500 Internal Server Error` — any failure during scraping, chunking, embedding, or DB insert (caught generically and re-raised with the underlying error message)

### `GET /items`
List all saved sources (full records, not just previews).

**Response `200 OK`**
```json
{
  "status": "success",
  "code": 200,
  "message": "Retrieved saved items",
  "data": [
    {
      "id": 12,
      "source_type": "note",
      "title": "Deployment notes",
      "content": "Full stored content...",
      "created_at": "2026-09-14T10:32:00Z"
    }
  ],
  "error": null
}
```
Returns an empty `data: []` array (still `200 OK`) if nothing has been saved yet — there is no dedicated "not found" case here.

**Error cases**
- `500 Internal Server Error` — DB read failure

### `POST /query`
Ask a question over the saved knowledge base.

**Request**
```json
{
  "question": "What did I save about deployment strategies?"
}
```

**Response `200 OK`**
```json
{
  "status": "success",
  "code": 200,
  "message": "Answer generated successfully",
  "data": {
    "question": "What did I save about deployment strategies?",
    "answer": "You saved a note mentioning blue-green deployments...",
    "source": [
      {
        "id": 12,
        "source_type": "note",
        "title": "Deployment notes",
        "content": "Full stored content of the source used...",
        "created_at": "2026-09-14T10:32:00Z"
      }
    ]
  },
  "error": null
}
```
`source` lists the **full source record(s)** that the top matching chunks came from (deduplicated by source id) — not individual chunk snippets or similarity scores. If no chunk clears the similarity threshold, `answer` explains that nothing relevant was found and `source` is an empty array.

**Error cases**

The router catches the OpenRouter (OpenAI-SDK-shaped) exception hierarchy explicitly and maps each one to a distinct HTTP status, so the client can tell an upstream LLM problem apart from an internal bug:

| Status | Exception caught | Meaning |
|---|---|---|
| `422 Unprocessable Entity` | Pydantic validation | Missing/invalid `question` field |
| `429 Too Many Requests` | `RateLimitError` | OpenRouter rate limit hit |
| `504 Gateway Timeout` | `APITimeoutError` | LLM call timed out |
| `503 Service Unavailable` | `APIConnectionError` | Couldn't reach the LLM provider |
| `503 Service Unavailable` | `RuntimeError` | Internal service-layer failure surfaced as a runtime error (e.g. embedding/model not ready) |
| `502 Bad Gateway` | `APIStatusError` | LLM provider responded with a non-2xx status |
| `500 Internal Server Error` | Any other `Exception` | Unexpected failure (embedding generation, similarity computation, DB read, or any unhandled bug) — logged with a full traceback via `logger.exception` |

This means "upstream LLM unavailable" and "internal bug" are no longer collapsed into a single generic `500` — each upstream failure mode has its own status code, and only truly unanticipated errors fall through to `500`.

---

## RAG Pipeline

### 1. Chunking
Content is split with a simple, intentional sliding-window strategy over whitespace-tokenized text:

- Split the full content on whitespace into a list of words.
- Take a window of **400 words**, then slide forward by **200 words** for the next chunk (50% overlap): `[0:400]`, `[200:600]`, `[400:800]`, and so on.

**Why this approach:** It's dependency-free, deterministic, and doesn't need sentence/paragraph boundary detection (which gets messy with scraped web content). The 50% overlap means a fact that lands near a chunk boundary is still very likely to appear fully inside at least one chunk, which matters more for retrieval recall than perfectly "clean" semantic boundaries at this scale.

**Tradeoff:** It can occasionally split a sentence awkwardly in the middle, and the overlap roughly doubles the number of vectors stored/searched compared to non-overlapping chunks.

### 2. Embeddings
Each chunk is embedded locally using `BAAI/bge-small-en-v1.5` via `sentence-transformers`. Local embeddings were chosen to avoid per-request API cost/latency for a task that runs many small chunk embeddings, and to keep ingestion working without an external API being on the critical path.
Similarity is calculated using a dot product because both chunk and query embeddings are explicitly generated with `normalize_embeddings=True`, making the dot product equivalent to cosine similarity.

### 3. Vector Storage
Vectors are stored as JSON-serialized arrays (`json.dumps(vector.tolist())`) in SQLite columns alongside their source chunk text and metadata.

**Why SQLite + JSON instead of a dedicated vector DB:** For a single-user MVP with a small number of items, this avoids standing up (and the user having to install) a separate vector database like Pinecone, Weaviate, or pgvector. Retrieval works by loading all vectors into memory and computing cosine similarity with NumPy — simple, transparent, and fast enough at this scale.

**Tradeoff:** This does a full linear scan (no ANN index), so query time grows linearly with the number of stored chunks, and every query pays the cost of loading + deserializing all vectors from SQLite into memory.

### 4. Retrieval + Generation
1. The question is embedded with the same local model (`BAAI/bge-small-en-v1.5`).
2. Cosine similarity is computed against every stored chunk vector in one vectorized NumPy operation (`vectors_array @ question_vector`).
3. Chunks below a **0.60 similarity threshold** are discarded; the remaining chunks are sorted and the **top 3** are kept as context.
4. The text of those top chunks is concatenated and sent, along with the question, to `nvidia/nemotron-3-super-120b-a12b:free` (via OpenRouter) to synthesize an answer grounded in that context.
5. The **source records** (not raw chunks) that the top chunks belong to are looked up and deduplicated by `source_id`, then returned alongside the answer so the frontend can show which saved note(s)/URL(s) it came from.
6. If nothing clears the 0.60 threshold, the pipeline skips the LLM call entirely and returns a fixed "nothing relevant found" message with an empty source list.

---

## Tradeoff Awareness & What Breaks at Scale

| Concern | Current approach | Breaks at scale because... | Production fix |
|---|---|---|---|
| Chunking | Fixed word-window with overlap | No awareness of sentence/semantic boundaries; overlap wastes storage | Token-aware chunking (e.g. tiktoken-based), sentence-boundary snapping |
| Vector search | Full in-memory linear scan via NumPy | O(n) per query; degrades as items/chunks grow into the thousands+ | Dedicated vector store/index (pgvector, Qdrant, FAISS with ANN) |
| Storage | SQLite, single file, single process | No concurrent-write safety, no horizontal scaling, file grows large with JSON vectors | Postgres + pgvector, or a managed vector DB |
| Ingestion | Synchronous request (embed + fetch inline) | Large URLs or many concurrent ingests keep requests open and consume server resources. | Background job queue (Celery/RQ) with async ingestion + status polling |
| Auth | None (single-user) | No isolation between users, no rate limiting | Add auth (JWT/session), per-user data partitioning |
| API key handling | Static key hardcoded in source | Security risk, can't rotate without redeploying, can't differ per environment | Load from `.env` / secrets manager, never commit to source control |
| LLM calls | Synchronous call per query, with typed exception handling (`RateLimitError`/`APITimeoutError`/`APIConnectionError`/`APIStatusError`) mapped to distinct HTTP statuses, but no automatic retry | Ties up a request thread while waiting on OpenRouter; a transient timeout or rate limit still fails the user's request outright | Async HTTP client, streaming responses, retry-with-backoff on transient errors (429/503/504) |
| Logging | Basic/print-level, with `logger.warning`/`logger.error`/`logger.exception` on the `/query` path | Hard to debug in production outside that one route | Structured logging (e.g. `structlog`/JSON logs) with request IDs across all routes |

---

## Known Limitations

This implementation intentionally avoids authentication, distributed infrastructure, dedicated vector databases, and background workers, because the assignment is scoped as a single-user MVP. The table above describes how the architecture would evolve as data volume and concurrency increase.

Specific current limitations:
- URL ingestion is a simple server-side fetch; it will not render JavaScript-heavy pages correctly.
- No delete/update endpoint for saved items yet — only add (`/ingest`) and list (`/items`).
- No pagination on `GET /items`; response size grows unbounded with the number of saved items.
- Vector search is a full linear scan with no ANN index, so query latency scales with total stored chunks.
- Edge case: if `POST /query` is called while the database has zero chunks, `question_response()` returns a plain string instead of the expected dict, which the router then fails to `.get()` on — this currently surfaces as a `500 Internal Server Error` (caught by the router's generic `except Exception` fallback, with a Python `AttributeError` message) rather than a clean "no results yet" response. Should be fixed to return a proper empty-result response.
- Duplicate detection for notes uses a `LIKE` match on `content`, which is a substring/pattern match rather than an exact-equality check — content containing SQL `LIKE` wildcard characters (`%`, `_`) could match unintended existing rows.
- The granular exception handling on `/query` (429/504/503/502) only covers failures raised by the OpenRouter/OpenAI SDK client. Failures earlier in the pipeline (embedding generation, similarity computation, DB read) are not distinguished from each other and all fall through to the generic `500` handler.

---

## Debuggability

- FastAPI's built-in validation (via Pydantic `schemas.py`) rejects malformed requests early with `422` and a clear error body.
- `400` is used for expected, user-fixable input problems on `/ingest` (missing `url`/`content`/`title` depending on `source_type`), while `500` is used for anything unexpected there (scraping, embedding, DB failures), with the underlying exception message included in `detail` for fast diagnosis.
- `/query` goes further: it catches the OpenRouter SDK's typed exceptions (`RateLimitError`, `APITimeoutError`, `APIConnectionError`, `APIStatusError`) individually and maps each to the HTTP status that best reflects it (`429`, `504`, `503`, `502` respectively), plus a `RuntimeError` case mapped to `503` for internal service-layer failures. Each of these is logged (`logger.warning` for rate limits, `logger.error` for the rest) before the `HTTPException` is raised. Anything not covered by those cases falls through to a generic `500`, logged with `logger.exception` (full traceback) so unanticipated bugs are still fully diagnosable.
- Logic is separated by concern (`repository.py` for DB, `services.py` for business logic, `routers.py` for HTTP layer, `utils/external_services.py` for third-party calls) so a failure can be traced to the right layer quickly.

---

## Code Quality Notes

- **Separation of concerns:** routing, request/response schemas, business logic, DB access, and external API calls each live in their own module.
- **No god files:** ingestion, chunking/embedding, and querying logic are split across `services.py` and `utils/external_services.py` rather than living in `main.py`.
- **Frontend:** components are split by feature area (`chat/`, `header/`, `IngestSide/`) rather than one monolithic page component.