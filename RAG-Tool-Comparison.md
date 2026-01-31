# RAG Tool Comparison for Kindred

## Executive Summary

| Criteria | CustomGPT | Botpress | Pinecone Assistant |
|----------|-----------|----------|-------------------|
| **API for KB Ingestion** | ✅ Full API | ⚠️ Partial (requires studio) | ✅ Full API |
| **Citation Links** | ✅ Strong | ✅ Strong | ❌ Weak |
| **Chat History Storage** | ✅ Built-in | ✅ Built-in | ⚠️ Client-side only |
| **User Context Injection** | ✅ Works well | ✅ Works well | ✅ Works well |
| **Response Quality** | ✅ Excellent | ✅ Excellent | ⚠️ Inconsistent |
| **Average Response Time** | ~8-13s | ~20-40s | ~5-10s |

---

## 1. API Endpoint(s) for Knowledge Base Ingestion from Hygraph CMS

### CustomGPT ✅ Recommended

- **Endpoint**: `POST /api/v1/projects/{projectId}/sources`
- Accepts file uploads via multipart form-data
- Automatic processing and indexing
- Can programmatically push content from Hygraph via API
- **Status**: Production-ready

### Pinecone Assistant ✅ Good

- **Endpoints**:
    - `POST /assistant/assistants` (create assistant)
    - `POST /assistant/files/{assistant_name}` (upload files)
- Supports file uploads with automatic chunking
- Two separate API bases (control plane vs data plane)
- **Status**: Production-ready

### Botpress ⚠️ Limited

- **Endpoint**: `PUT /v1/files` (requires Bot ID and Bearer token)
- Primary ingestion method is through **Botpress Studio UI**, not API
- Files API exists but Knowledge Agent configuration requires studio setup
- Would require manual/semi-automated workflow for Hygraph sync
- **Status**: Requires more manual setup

---

## 2. Citation Links in Responses

### CustomGPT ✅ Excellent

- Returns structured `citations` array with `title`, `url`, `snippet`
- Also embeds URLs inline in response text
- Consistent citation quality across all test questions

**Example output:**
> [Reducing Caregiver Burnout](https://kindred.app/resources/reducing-caregiver-burnout)
> [Respite Care Options](https://kindred.app/resources/respite-care-options)

### Botpress ✅ Good

- URLs embedded in response markdown
- Knowledge Agent retrieves and references sources
- Citations extracted from response text

**Example output:**
> [Reducing Caregiver Burnout](https://kindred.app/resources/reducing-caregiver-burnout)
> [Community: Emotional Support](https://kindred.app/community/thread-emotional-support)

### Pinecone ❌ Weak

- Citations return file references, not Kindred URLs
- Only shows `signed_url` to the uploaded file (not app content URLs)
- Would require custom URL mapping layer
- Many responses showed: **⚠️ No related resources**

---

## 3. Chat History Storage

### CustomGPT ✅ Built-in

- Maintains conversation history via `messages[]` array
- Session-based conversation continuity
- Server-side storage

### Botpress ✅ Built-in

- Conversations stored server-side per user
- `conversationId` tracks sessions
- User authentication via `x-user-key`
- Full message history accessible via `listMessages()`

### Pinecone ⚠️ Client-side only

- Conversation history maintained in request body
- No server-side persistence
- Would require custom implementation for "Ask GiGi" style history

---

## 4. Personal Information in Chat Prompts

All three support user context injection by prepending personalized information to messages.

### CustomGPT ✅

```
[User Context: Caregiver: Sarah, Caring for: Mom, Diagnosis: early-stage dementia, Relationship: daughter]
```

### Botpress ✅

```
My name is Sarah. I'm caring for Mom. They have early-stage dementia. I am their daughter.
```

### Pinecone ✅

```
[User Context: Caregiver: Sarah, Caring for: Mom, Diagnosis: early-stage dementia, Relationship: daughter]
```

All three successfully personalized responses using this context (e.g., "Sarah, what you're feeling is deeply normal...").

---

## 5. Response Quality Analysis

Tested with 10 evaluation questions covering various caregiver scenarios.

| Question Type | CustomGPT | Botpress | Pinecone |
|--------------|-----------|----------|----------|
| Q1: Partial Failure (respite resistance) | ✅ Excellent | ✅ Excellent | ⚠️ Good |
| Q2: Sibling Conflict | ✅ Excellent | ✅ Excellent | ⚠️ Good |
| Q3: Multi-Part (mornings, sleep, grief) | ✅ Excellent | ✅ Excellent | ❌ Poor |
| Q4: Hallucination Test (ALS) | ✅ Honest | ✅ Honest | ✅ Honest |
| Q5: Emotional Support | ✅ Excellent | ✅ Excellent | ⚠️ Good |
| Q6: Work + Caregiving | ✅ Excellent | ✅ Excellent | ⚠️ Good |
| Q7: Spouse of Caregiver | ✅ Excellent | ✅ Excellent | ⚠️ Good |
| Q8: Legal/Financial | ✅ Excellent | ✅ Excellent | ⚠️ Good |
| Q9: Success then Setback | ✅ Excellent | ✅ Excellent | ⚠️ Good |
| Q10: Comprehensive (hardest) | ✅ Excellent | ✅ Excellent | ❌ Poor |

### Key Observations

- **CustomGPT**: Consistently high quality, good citations, ~7-13 second response times
- **Botpress**: Equally high quality, good citations, but ~20-40 second response times (2-3x slower)
- **Pinecone**: Often responded with "I couldn't find specific information in the uploaded documents" even when content existed. Fastest responses but weakest retrieval.

---

## Recommendation Matrix

| Priority | Best Choice | Reason |
|----------|-------------|--------|
| **Best Overall** | CustomGPT | Strong API, citations, quality, speed |
| **Best for Complex Workflows** | Botpress | Visual flow builder, multi-channel support |
| **Best for Custom Infrastructure** | Pinecone | Full control, but requires more development |

---

## Cost Considerations

| Tool | Pricing Model |
|------|---------------|
| CustomGPT | Per-project plans, starts ~$49/mo |
| Botpress | Free tier + usage-based |
| Pinecone | Usage-based (vectors + queries) + LLM costs |

---

## Bottom Line

For the specific requirements:

1. **API ingestion from Hygraph**: CustomGPT or Pinecone
2. **Citation links**: CustomGPT (best) or Botpress
3. **Chat history**: CustomGPT or Botpress
4. **User context**: All three work

### Recommendation: CustomGPT

Best balance of API flexibility, citation quality, response quality, and speed. Botpress is a strong second choice if you need visual workflow building or multi-channel deployment.
