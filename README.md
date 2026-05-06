# Matr — Data Analysis Agent

A fullstack web application that transforms a CLI PydanticAI data analysis agent into a real-time streaming chat interface. Ask questions about your CSV data in plain English and get interactive charts, tables, and insights instantly.

![Stack](https://img.shields.io/badge/FastAPI-0.100+-009688?style=flat&logo=fastapi)
![Stack](https://img.shields.io/badge/React-18+-61DAFB?style=flat&logo=react)
![Stack](https://img.shields.io/badge/PydanticAI-latest-E92063?style=flat)
![Stack](https://img.shields.io/badge/DuckDB-latest-FFA500?style=flat)
![Stack](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat&logo=postgresql)

---

## Demo

> Ask: *"What is the monthly revenue trend?"*

The agent queries the data, creates an interactive Plotly chart, and streams its reasoning and answer in real time — all visible in the UI.

---

## What Was Built

The original case provided a CLI agent. This solution transforms it into a production-grade web application:

| Original CLI | This Solution |
|---|---|
| Terminal only | Full responsive web UI |
| Blocking execution | Real-time SSE streaming with typing effect |
| Static Plotly HTML files saved to disk | Interactive Plotly charts rendered in-browser |
| Single dataset | Multi-dataset support with drag-and-drop upload |
| No conversation history | Persistent conversation history with PostgreSQL |
| No tool visibility | Real-time tool call and result display |

---

## Architecture

```
case_fullstack/
├── agent/                        # PydanticAI agent (original + modified)
│   ├── agent.py                  # Agent factory — creates new agent per question
│   ├── context.py                # AgentContext — shared state across tool calls
│   ├── prompt.py                 # System prompt with 17 behavioral rules in 3 groups
│   └── tools/
│       ├── query_data.py         # DuckDB SQL execution — stores results in history
│       └── visualize_web.py      # Returns Plotly JSON instead of saving to disk
│
├── backend/                      # FastAPI backend
│   ├── main.py                   # App entry point — CORS, routes, health check, DB init
│   ├── schemas.py                # Pydantic request/response models
│   ├── database.py               # SQLAlchemy async engine and session factory
│   ├── models.py                 # Conversation and Message ORM models
│   ├── routes/
│   │   ├── chat.py               # SSE streaming, history, datasets, upload endpoints
│   │   └── conversations.py      # Conversation CRUD endpoints
│   └── services/
│       └── stream.py             # Core streaming service — runs agent, emits SSE events
│
├── frontend/                     # React + Vite + TypeScript frontend
│   └── src/
│       ├── types/events.ts       # SSE event type definitions
│       ├── hooks/
│       │   ├── useChat.ts        # SSE streaming state management
│       │   └── useConversations.ts # Conversation history state management
│       └── components/
│           ├── MessageList.tsx       # Conversation renderer
│           ├── ChatInput.tsx         # Auto-expanding input with stop button
│           ├── AgentAvatar.tsx       # Animated thinking/idle logo
│           ├── ThinkingBlock.tsx     # Collapsible agent reasoning
│           ├── ToolCallBlock.tsx     # Tool invocation + result display
│           ├── PlotlyChart.tsx       # Interactive chart via CDN Plotly
│           ├── DataTable.tsx         # Scrollable data table with CSV export
│           ├── WelcomeScreen.tsx     # Landing page with suggested questions
│           ├── ConversationList.tsx  # Sidebar conversation history
│           ├── DatasetUpload.tsx     # Drag and drop CSV upload
│           └── ErrorBoundary.tsx     # Crash fallback UI
│
├── data/                         # CSV datasets — drop files here
├── .env.example                  # Environment variable documentation
├── docker-compose.yml            # Full stack in one command (includes PostgreSQL)
├── Dockerfile                    # Backend container
├── frontend/Dockerfile           # Frontend container (nginx)
├── frontend/nginx.conf           # Nginx config with SSE proxy settings
└── requirements.txt              # Python dependencies
```

---

## Key Technical Decisions

### Why SSE over WebSocket?

SSE is unidirectional — server sends, client receives. This matches our use case exactly: the agent streams events to the frontend. WebSocket adds bidirectional complexity that is not needed here.

### Why per-question AgentContext with dataframe_history?

The agent sometimes batches multiple SQL queries before visualizing. Without history, each new query overwrites `current_dataframe`, causing visualizations to use the wrong data. `dataframe_history` stores a snapshot per query indexed by call order — `visualize_web` references the correct snapshot via `query_index`.

### Why Plotly via CDN?

The `plotly.js` npm package references Node.js globals (`global`) unavailable in Vite's browser environment, causing build errors. CDN loading via `window.Plotly` sidesteps this entirely.

### Why SQLAlchemy async with asyncpg?

FastAPI is fully async. Using a synchronous ORM would block the event loop during database operations, degrading SSE streaming performance. SQLAlchemy's async engine with asyncpg keeps everything non-blocking.

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- Docker Desktop
- An OpenAI API key (or Anthropic/Google — see `.env.example`)

### 1. Clone and configure

```bash
git clone https://github.com/BenBoubakerMajdi/case_fullstack.git
cd case_fullstack
cp .env.example .env
# Edit .env and add your API key
```

### 2. Add your datasets

Drop any CSV files into the `data/` directory:

```bash
cp your-data.csv data/
```

The agent auto-discovers all CSV files on startup. Table names in SQL correspond to sanitized filenames (e.g. `sales_2024.csv` becomes `sales_2024`).

You can also upload CSV files directly from the UI using the drag-and-drop upload in the sidebar.

### 3. Run with Docker (recommended)

```bash
docker compose up
```

This starts three services:
- **PostgreSQL** on port 5432
- **Backend** (FastAPI) on port 8000
- **Frontend** (nginx) on port 5173

Then open [http://localhost:5173](http://localhost:5173)

---

## Features

### Chat interface
- Real-time SSE streaming with progressive tool call display
- Word-by-word typing effect for the final answer
- Multi-turn conversation memory
- Stop button to interrupt the agent mid-response
- Auto-scrolling message list

### Agent transparency
- Tool call blocks showing SQL queries and arguments
- Tool result blocks showing query output
- Interactive Plotly charts with dark theme
- Scrollable data tables with CSV export

### Conversation management
- Persistent conversation history stored in PostgreSQL
- Sidebar with conversation list
- Auto-title from first question
- Rename and delete conversations with inline editing
- New conversation button

### Dataset management
- Multi-dataset support — drop any CSV in `data/`
- Drag-and-drop CSV upload directly from the UI
- Dataset metadata shown in sidebar (rows, columns, column names)

### UI/UX
- Fully responsive — desktop, tablet, and mobile
- Collapsible sidebar with smooth CSS transition
- Dark theme with cyan/emerald accent colors
- Error boundary with branded fallback screen
- Toast notifications for all user actions
- Copy button on all messages

---

## SSE Event Reference

The backend streams newline-delimited JSON events. Each event has a `type` field:

| Event | Description | Frontend component |
|---|---|---|
| `thinking` | Agent reasoning from `<thinking>` tags | `ThinkingBlock` (collapsible) |
| `tool_call` | Tool invocation with name and arguments | `ToolCallBlock` |
| `tool_result` | Raw tool return value | `ToolCallBlock` |
| `visualization` | Plotly figure JSON | `PlotlyChart` |
| `table` | Tabular data | `DataTable` |
| `text_delta` | Single word for typing effect | Accumulated into `streaming_text` |
| `final` | Complete answer — replaces `text_delta` events | `ReactMarkdown` |
| `error` | Error message | Error alert block |
| `done` | Stream completion signal | Marks message as no longer streaming |

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/chat/stream` | Stream agent response as SSE |
| `DELETE` | `/api/chat/history` | Clear in-memory conversation history |
| `GET` | `/api/datasets` | List available datasets with metadata |
| `POST` | `/api/datasets/upload` | Upload a CSV dataset |
| `GET` | `/api/conversations` | List all conversations |
| `POST` | `/api/conversations` | Create a new conversation |
| `GET` | `/api/conversations/{id}` | Get conversation with messages |
| `PATCH` | `/api/conversations/{id}` | Update conversation title |
| `DELETE` | `/api/conversations/{id}` | Delete a conversation |
| `GET` | `/health` | Health check |
| `GET` | `/docs` | Interactive API documentation (Swagger) |

---

## Agent Prompt Rules

The system prompt contains 17 rules in 3 groups that govern agent behavior:

**Group A — Behavior:** Never explain before acting, clarify ambiguous requests, always regenerate on request, concise summaries only.

**Group B — SQL:** SQL first, query before visualize, DuckDB double-quotes for column names, date casting, never conclude from previews, domain accuracy, derive metrics when possible.

**Group C — Visualization:** No imports, no `fig.show()`, always use `visualize_web` for tables, always visualize numeric results, no duplicate visualizations, always use `query_index`.

---

## Environment Variables

See `.env.example` for full documentation. Required variables:

| Variable | Description |
|---|---|
| `MODEL` | PydanticAI model string e.g. `openai:gpt-4o` |
| `OPENAI_API_KEY` | Required if using OpenAI models |
| `DATABASE_URL` | PostgreSQL connection string |
| `ALLOWED_ORIGIN` | Frontend URL for production CORS (leave empty for local dev) |

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Agent | PydanticAI + GPT-4o | Reliable tool call execution with type-safe dependency injection |
| SQL Engine | DuckDB | In-memory SQL on DataFrames — no database setup needed |
| Backend | FastAPI | Async SSE streaming, automatic OpenAPI docs |
| Database | PostgreSQL + SQLAlchemy async | Persistent conversation history, async to avoid blocking SSE |
| Charts | Plotly.js (CDN) | Interactive charts, avoids Vite/Node.js build issues |
| Frontend | React + TypeScript + Vite | Fast HMR, type safety, modern tooling |
| Styling | Tailwind CSS + CSS variables | Dark theme with consistent design tokens |
| Toasts | react-hot-toast | User feedback for errors and copy actions |
| Container | Docker + nginx | One command to run the full stack |

---

## CI/CD

GitHub Actions runs on every push to `main`:
- Python import validation and syntax checks
- FastAPI health check verification
- TypeScript type checking
- Frontend production build verification

---

## Resources

- [PydanticAI Documentation](https://ai.pydantic.dev/)
- [PydanticAI Streaming](https://ai.pydantic.dev/streaming/)
- [PydanticAI Tools](https://ai.pydantic.dev/tools/)
- [FastAPI Streaming Response](https://fastapi.tiangolo.com/advanced/custom-response/#streamingresponse)
- [Server-Sent Events (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [Plotly.js Documentation](https://plotly.com/javascript/)
- [DuckDB Documentation](https://duckdb.org/docs/)
- [SQLAlchemy Async](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html)