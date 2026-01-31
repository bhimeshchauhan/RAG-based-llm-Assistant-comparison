"""
Central configuration for the Kindred RAG ingestion pipeline.

Uses Pinecone's integrated embedding - no external embedding API needed!
"""

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

# Load .env.local from project root
_project_root = Path(__file__).parent.parent
_env_file = _project_root / ".env.local"
if _env_file.exists():
    load_dotenv(_env_file)
else:
    # Fall back to .env
    load_dotenv(_project_root / ".env")


@dataclass
class PineconeConfig:
    """Pinecone configuration with integrated embedding."""
    api_key: str
    index_name: str = "kindred-rag"  # New index with integrated embedding
    
    # Pinecone's hosted embedding model (integrated inference)
    # See: https://docs.pinecone.io/guides/index-data/create-an-index#embedding-models
    embedding_model: str = "multilingual-e5-large"  # 1024 dimensions, good for English
    
    # Cloud/region for serverless
    cloud: str = "aws"
    region: str = "us-east-1"
    
    # Namespaces
    articles_namespace: str = "articles"
    threads_namespace: str = "threads"


@dataclass
class ChunkingConfig:
    """Chunking configuration for articles."""
    target_chunk_size: int = 550  # Target tokens (middle of 400-700 range)
    min_chunk_size: int = 400
    max_chunk_size: int = 700
    overlap_tokens: int = 100


@dataclass
class PathConfig:
    """File path configuration."""
    articles_dir: str = "kindred-dataset/articles"
    threads_dir: str = "kindred-dataset/community-threads"


def get_pinecone_config() -> PineconeConfig:
    """Get Pinecone configuration from environment variables."""
    # Check both PINECONE_API_KEY and VITE_PINECONE_API_KEY
    api_key = os.environ.get("PINECONE_API_KEY") or os.environ.get("VITE_PINECONE_API_KEY")
    if not api_key:
        raise EnvironmentError(
            "PINECONE_API_KEY (or VITE_PINECONE_API_KEY) environment variable is required. "
            "Set it in .env.local or export it."
        )
    return PineconeConfig(api_key=api_key)


def get_chunking_config() -> ChunkingConfig:
    """Get chunking configuration."""
    return ChunkingConfig()


def get_path_config(base_dir: Optional[str] = None) -> PathConfig:
    """
    Get path configuration.
    
    Args:
        base_dir: Base directory for relative paths. If None, uses parent of rag_ingestion/.
    """
    if base_dir is None:
        # Default to parent directory of this script
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    return PathConfig(
        articles_dir=os.path.join(base_dir, "kindred-dataset", "articles"),
        threads_dir=os.path.join(base_dir, "kindred-dataset", "community-threads"),
    )
