# Kindred RAG Ingestion Pipeline

Automated ingestion pipeline for loading Kindred knowledge base content into Pinecone.

## Overview

This pipeline ingests two types of content:

1. **Caregiver Resource Articles** (`.md` files) - Professional caregiving guides
2. **Community Discussion Threads** (`.json` files) - Peer support conversations

## Prerequisites

- Python 3.9+
- Pinecone account and API key
- OpenAI API key (for embeddings)

## Setup

### 1. Install dependencies

```bash
cd rag_ingestion
pip install -r requirements.txt
```

### 2. Set environment variables

```bash
export PINECONE_API_KEY="your-pinecone-api-key"
export OPENAI_API_KEY="your-openai-api-key"
```

Or create a `.env` file and source it:

```bash
# .env
PINECONE_API_KEY=your-pinecone-api-key
OPENAI_API_KEY=your-openai-api-key
```

```bash
source .env
```

## Usage

### Ingest Articles

```bash
python ingest_articles.py
```

This will:
- Load all `.md` files from `kindred-dataset/articles/`
- Chunk by section headers (400-700 tokens with 100 token overlap)
- Generate embeddings using `text-embedding-3-small`
- Upsert to Pinecone index `kindred` in namespace `articles`

### Ingest Community Threads

```bash
python ingest_threads.py
```

This will:
- Load all `.json` files from `kindred-dataset/community-threads/`
- Create one chunk per post (verbatim text)
- Generate embeddings using `text-embedding-3-small`
- Upsert to Pinecone index `kindred` in namespace `threads`

## Configuration

All configuration is centralized in `config.py`:

| Setting | Default | Description |
|---------|---------|-------------|
| `index_name` | `kindred` | Pinecone index name |
| `metric` | `cosine` | Distance metric |
| `dimension` | `1536` | Embedding dimensions |
| `embedding_model` | `text-embedding-3-small` | OpenAI model |
| `target_chunk_size` | `550` | Target tokens per chunk |
| `overlap_tokens` | `100` | Overlap between chunks |

## Metadata Schema

### Articles

Each article vector includes:

```json
{
  "type": "article",
  "title": "Article Title",
  "url": "https://kindred.app/resources/article-slug",
  "filename": "article-file.md",
  "section": "Section Heading",
  "text": "Truncated chunk text..."
}
```

### Threads

Each thread post vector includes:

```json
{
  "type": "thread",
  "thread_id": "thread-001",
  "url": "https://kindred.app/community/thread-001",
  "author": "username",
  "timestamp": "2025-01-15T10:30:00Z",
  "post_id": "post-001",
  "text": "Full post text..."
}
```

## File Structure

```
rag_ingestion/
├── ingest_articles.py  # Article ingestion script
├── ingest_threads.py   # Thread ingestion script
├── chunking.py         # Chunking logic
├── config.py           # Central configuration
├── requirements.txt    # Python dependencies
└── README.md           # This file
```

## Logging

Both scripts log progress to stdout:

```
2025-01-30 10:00:00 - INFO - Starting article ingestion pipeline
2025-01-30 10:00:01 - INFO - Loaded 10 article files
2025-01-30 10:00:02 - INFO - Created 45 total chunks from 10 articles
2025-01-30 10:00:05 - INFO - Generated 45 embeddings
2025-01-30 10:00:07 - INFO - Upserted 45 vectors to namespace 'articles'
```

## Error Handling

The pipeline fails fast with clear errors:

- Missing API keys: Clear message indicating which key is missing
- Index doesn't exist: Automatically creates the index
- Missing data directory: Clear message with expected path
- Invalid JSON: Warns and skips invalid files

## Extending

### Adding New Content Types

1. Create a new chunker class in `chunking.py`
2. Create a new ingester script (e.g., `ingest_faqs.py`)
3. Add a new namespace in `config.py`

### Customizing Chunking

Edit `ChunkingConfig` in `config.py`:

```python
@dataclass
class ChunkingConfig:
    target_chunk_size: int = 550  # Adjust as needed
    min_chunk_size: int = 400
    max_chunk_size: int = 700
    overlap_tokens: int = 100
```
