# RAG Chatbot Comparison Tool

A single-page React application for running a **fair bake-off comparison** of three RAG chatbot approaches:

1. **CustomGPT** (SaaS RAG chatbot)
2. **Botpress Cloud** (Conversational AI platform)
3. **Pinecone-backed Custom RAG** (Vector DB + LLM)

> ⚠️ **LOCAL TESTING ONLY** - This tool exposes API keys in browser requests. Do not deploy to production.

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file in the project root:

```bash
# =============================================================================
# CustomGPT Configuration
# Docs: https://docs.customgpt.ai/reference/quickstart-guide
# =============================================================================
VITE_CUSTOMGPT_API_KEY=your_customgpt_api_key_here
VITE_CUSTOMGPT_PROJECT_ID=your_project_id_here
VITE_CUSTOMGPT_BASE_URL=https://app.customgpt.ai

# =============================================================================
# Botpress Cloud Configuration
# Docs: https://botpress.com/docs/api-reference/introduction
# =============================================================================
VITE_BOTPRESS_BOT_ID=your_bot_id_here
VITE_BOTPRESS_TOKEN=your_personal_access_token_here
VITE_BOTPRESS_INTEGRATION_ID=your_integration_id_here  # Optional
VITE_BOTPRESS_BASE_URL=https://api.botpress.cloud

# =============================================================================
# Pinecone + OpenAI Configuration
# Pinecone Docs: https://docs.pinecone.io/reference/api/introduction
# OpenAI Docs: https://platform.openai.com/docs/api-reference
# =============================================================================
VITE_PINECONE_API_KEY=your_pinecone_api_key_here
VITE_PINECONE_INDEX_HOST=your-index-abc123.svc.environment.pinecone.io
VITE_PINECONE_NAMESPACE=rag-comparison

VITE_OPENAI_API_KEY=your_openai_api_key_here
VITE_OPENAI_EMBEDDING_MODEL=text-embedding-3-small
VITE_OPENAI_CHAT_MODEL=gpt-4o-mini
```

### 3. Run the Application

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📋 Features

### Data Ingestion
- Upload one or more files to all configured providers simultaneously
- Per-provider ingestion status tracking (queued → uploading → indexing → ready)
- Support for re-ingestion (clear and re-upload)

### User Context (Personalization)
- Editable context fields: caregiver name, loved one's name, diagnosis, relationship, care stage
- Persisted to localStorage
- Injected into all chat requests for personalization testing

### Side-by-Side Chat Comparison
- Single input sends to all providers simultaneously
- Responses rendered in aligned columns
- "Related Resources" section under each response with clickable links
- Multi-turn conversation support with provider session continuity

### Question Set Evaluation
- Upload a JSON file with evaluation questions
- Sequential execution with progress tracking
- Support for follow-up questions per main question

### Scoring & Metrics
- Link count and URL validity per response
- Personalization detection (context field usage)
- Continuity indicators (references to prior turns)
- Latency tracking
- Summary scoreboard after running question sets

---

## 📂 Project Structure

```
src/
├── adapters/           # Provider-specific API adapters
│   ├── customgpt.ts    # CustomGPT adapter (sources + conversations API)
│   ├── botpress.ts     # Botpress adapter (Files + Chat API)
│   ├── pinecone.ts     # Pinecone RAG adapter (vector ops + OpenAI)
│   └── index.ts
├── components/         # React UI components
│   ├── SettingsPanel.tsx
│   ├── UserContextPanel.tsx
│   ├── IngestionPanel.tsx
│   ├── ChatPanel.tsx
│   ├── ChatTurn.tsx
│   ├── RelatedResources.tsx
│   ├── QuestionSetPanel.tsx
│   ├── ScoreboardPanel.tsx
│   └── index.ts
├── config/
│   └── env.ts          # Environment variable loader
├── hooks/
│   └── useLocalStorage.ts
├── types/
│   └── index.ts        # TypeScript type definitions
├── utils/
│   └── scoring.ts      # Scoring utilities
├── App.tsx             # Main application component
├── main.tsx            # Entry point
└── index.css           # Tailwind CSS styles
```

---

## 🔧 Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_CUSTOMGPT_API_KEY` | For CustomGPT | API key from CustomGPT dashboard |
| `VITE_CUSTOMGPT_PROJECT_ID` | For CustomGPT | Project/Agent ID |
| `VITE_CUSTOMGPT_BASE_URL` | No | Base URL (default: `https://app.customgpt.ai`) |
| `VITE_BOTPRESS_BOT_ID` | For Botpress | Bot ID from Botpress Cloud |
| `VITE_BOTPRESS_TOKEN` | For Botpress | Personal Access Token (PAT) |
| `VITE_BOTPRESS_INTEGRATION_ID` | No | Chat integration ID if using Chat API |
| `VITE_BOTPRESS_BASE_URL` | No | Base URL (default: `https://api.botpress.cloud`) |
| `VITE_PINECONE_API_KEY` | For Pinecone | Pinecone API key |
| `VITE_PINECONE_INDEX_HOST` | For Pinecone | Full index host (e.g., `index-abc.svc.env.pinecone.io`) |
| `VITE_PINECONE_NAMESPACE` | No | Namespace (default: `rag-comparison`) |
| `VITE_OPENAI_API_KEY` | For Pinecone | OpenAI API key for embeddings + generation |
| `VITE_OPENAI_EMBEDDING_MODEL` | No | Embedding model (default: `text-embedding-3-small`) |
| `VITE_OPENAI_CHAT_MODEL` | No | Chat model (default: `gpt-4o-mini`) |

---

## 📝 Question Set File Format

Create a JSON file with this structure:

```json
{
  "name": "Caregiver Questions v1",
  "description": "Questions for testing caregiver support scenarios",
  "questions": [
    "What are early signs of Alzheimer's?",
    {
      "id": "q2",
      "text": "How do I handle sundowning behavior?",
      "followups": [
        "What specific activities help during sundowning?",
        "Should I adjust lighting in the evening?"
      ]
    },
    {
      "id": "q3",
      "text": "What respite care options are available?",
      "followups": [
        "How much does respite care typically cost?"
      ]
    }
  ]
}
```

**Format Options:**
- Simple strings for standalone questions
- Objects with `id`, `text`, and optional `followups` array
- Follow-ups are sent sequentially after the main question

---

## 🔌 Provider Implementation Details

### CustomGPT

**Endpoints Used:**
- `POST /api/v1/projects/{projectId}/sources` - File ingestion
- `POST /api/v1/projects/{projectId}/conversations` - Create conversation
- `POST /api/v1/projects/{projectId}/conversations/{sessionId}/messages` - Send message
- `GET /api/v1/projects/{projectId}/citations/{citationId}` - Get citation details

**Features:**
- ✅ Native citation support via `citations` field in responses
- ✅ Citation details fetchable via dedicated endpoint
- ✅ Conversation continuity via session IDs
- ✅ File upload for knowledge base

**Personalization:**
- Context prepended to messages (no native context field in message API)

---

### Botpress Cloud

**Endpoints Used:**
- `PUT /v1/files` - Upload and index files
- `POST /v1/chat/conversations` - Create conversation
- `POST /v1/chat/messages` - Send message
- `GET /v1/chat/messages` - Poll for bot response

**Features:**
- ✅ Knowledge Base file upload with indexing
- ✅ User variables for personalization
- ⚠️ **NO native citation support** - RAG happens internally without exposing sources

**Personalization:**
- User tags passed at conversation creation
- Context prepended to messages as fallback

**Known Limitation - Citations:**
Botpress Cloud's Chat API does not return citation/source information from Knowledge Base queries in the message response. The RAG retrieval happens internally and sources are not exposed to API consumers. 

**Workaround implemented:** URLs mentioned in the response text are extracted and shown as "Extracted Links" (clearly labeled as a workaround, not native citations).

---

### Pinecone-backed Custom RAG

**Endpoints Used:**
- Pinecone `POST /vectors/upsert` - Store document chunks
- Pinecone `POST /query` - Retrieve relevant chunks
- OpenAI `POST /v1/embeddings` - Generate embeddings
- OpenAI `POST /v1/chat/completions` - Generate responses

**Features:**
- ✅ Full control over chunking strategy
- ✅ Citations derived from vector metadata (title, URL, snippet)
- ✅ Customizable prompt construction
- ✅ Conversation history maintained client-side

**Personalization:**
- Full user context injected into system prompt
- Complete control over prompt engineering

**Chunking Strategy:**
- Character-based chunking (1000 chars with 200 char overlap)
- Metadata includes: title, URL, snippet, source_file, chunk_index

---

## 📊 Normalized Response Contract

All provider responses are normalized to this structure:

```typescript
interface ProviderResult {
  answer_text: string;
  related_resources: Array<{
    title: string;
    url: string;
    snippet?: string;
    score?: number;
  }>;
  latency_ms?: number;
  error?: string;
  raw?: any; // Original provider response
}

interface Turn {
  id: string;
  user_message: string;
  timestamp: string;
  results: {
    customgpt?: ProviderResult;
    botpress?: ProviderResult;
    pinecone?: ProviderResult;
  };
}
```

---

## 📈 Scoring Metrics

| Metric | Description |
|--------|-------------|
| **Avg Links** | Average number of related resources per response |
| **Valid URL Rate** | Percentage of URLs that are valid/accessible |
| **Personalization** | Percentage of user context fields referenced in response |
| **Continuity** | Number of responses that reference prior conversation turns |
| **Avg Latency** | Average response time in milliseconds |
| **Issues** | Count of responses with no links + error count |

---

## ⚖️ Fairness Notes

### What's Fair
- Same dataset ingested to all providers
- Same questions asked simultaneously
- Same user context provided to all
- Normalized response format for comparison

### Considerations
1. **CustomGPT** has native citation support - this is a platform advantage
2. **Botpress** lacks citation exposure - this is a documented platform limitation, not an implementation bug
3. **Pinecone RAG** has full control but requires more setup - flexibility vs. convenience trade-off

### Recommendations for Evaluation
1. Weight citation quality only for providers that support it
2. Evaluate Botpress on answer quality and personalization rather than citation count
3. Consider latency differences as infrastructure varies significantly

---

## 🚨 Known Limitations

### General
- **Browser CORS**: All API calls made directly from browser; some providers may have CORS restrictions
- **API Key Exposure**: Keys visible in browser DevTools - LOCAL TESTING ONLY
- **Rate Limits**: No built-in rate limiting; may hit provider limits with rapid question sets

### CustomGPT
- File size limited to 100MB per docs
- Indexing is asynchronous; may take time for large files

### Botpress
- **Citations not available** - fundamental platform limitation
- Polling for bot response may timeout for complex queries
- File indexing is asynchronous

### Pinecone
- Requires OpenAI for embeddings (could be swapped for other providers)
- Simple character-based chunking (production would use smarter strategies)
- Conversation history maintained only in memory (lost on refresh)

---

## 📄 License

MIT
