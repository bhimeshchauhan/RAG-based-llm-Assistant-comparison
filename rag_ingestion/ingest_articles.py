#!/usr/bin/env python3
"""
Ingest markdown articles into Pinecone using integrated embedding.

No external embedding API needed - Pinecone generates embeddings automatically!

Usage:
    python ingest_articles.py

Environment variables required:
    PINECONE_API_KEY (or VITE_PINECONE_API_KEY) - Your Pinecone API key
"""

import os
import sys
import glob
import logging
import time
from typing import List, Tuple

from pinecone import Pinecone

from config import get_pinecone_config, get_path_config, PineconeConfig
from chunking import ArticleChunker, ArticleChunk, extract_article_metadata

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


class ArticleIngester:
    """Handles ingestion of markdown articles into Pinecone with integrated embedding."""

    def __init__(self, pinecone_config: PineconeConfig):
        self.config = pinecone_config

        # Initialize Pinecone client
        self.pc = Pinecone(api_key=pinecone_config.api_key)

        # Initialize chunker
        self.chunker = ArticleChunker()

        # Get or create index with integrated embedding
        self.index = self._get_or_create_index()

    def _get_or_create_index(self):
        """Get existing index or create with integrated embedding model."""
        existing_indexes = [idx.name for idx in self.pc.list_indexes()]

        if self.config.index_name not in existing_indexes:
            logger.info(
                f"Creating index '{self.config.index_name}' with integrated embedding..."
            )
            logger.info(f"  Embedding model: {self.config.embedding_model}")

            # Create index with integrated embedding
            self.pc.create_index_for_model(
                name=self.config.index_name,
                cloud=self.config.cloud,
                region=self.config.region,
                embed={
                    "model": self.config.embedding_model,
                    "field_map": {"text": "text"},  # Map 'text' field to be embedded
                },
            )

            # Wait for index to be ready
            logger.info("Waiting for index to be ready...")
            while True:
                desc = self.pc.describe_index(self.config.index_name)
                if desc.status.ready:
                    break
                time.sleep(2)

            logger.info(f"Index '{self.config.index_name}' created and ready!")
        else:
            logger.info(f"Using existing index '{self.config.index_name}'")

        return self.pc.Index(self.config.index_name)

    def load_articles(self, articles_dir: str) -> List[Tuple[str, str]]:
        """Load all markdown files from the articles directory."""
        pattern = os.path.join(articles_dir, "*.md")
        files = glob.glob(pattern)

        if not files:
            raise FileNotFoundError(
                f"No markdown files found in {articles_dir}. "
                "Ensure the kindred-dataset/articles/ directory exists and contains .md files."
            )

        articles = []
        for filepath in sorted(files):
            filename = os.path.basename(filepath)
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()
            articles.append((filename, content))
            logger.debug(f"Loaded: {filename}")

        logger.info(f"Loaded {len(articles)} article files")
        return articles

    def chunk_articles(self, articles: List[Tuple[str, str]]) -> List[ArticleChunk]:
        """Chunk all articles into embeddings-ready pieces."""
        all_chunks = []

        for filename, content in articles:
            metadata = extract_article_metadata(content, filename)

            chunks = self.chunker.chunk_article(
                content=content,
                title=metadata["title"],
                url=metadata["url"],
                filename=filename,
            )

            all_chunks.extend(chunks)
            logger.debug(f"Chunked {filename} into {len(chunks)} chunks")

        logger.info(
            f"Created {len(all_chunks)} total chunks from {len(articles)} articles"
        )
        return all_chunks

    def upsert_to_pinecone(
        self, chunks: List[ArticleChunk], batch_size: int = 96
    ) -> int:
        """
        Upsert chunks to Pinecone with integrated embedding.

        Pinecone will automatically generate embeddings from the 'text' field.
        With upsert_records, metadata fields go at the top level of each record.
        """
        # Build records with text for embedding
        # Note: For upsert_records, all fields except _id and text are treated as metadata
        records = []
        for chunk in chunks:
            record = {
                "_id": chunk.chunk_id,
                "text": chunk.text,  # Pinecone embeds this automatically
                # Metadata fields at top level
                "type": "article",
                "title": chunk.title,
                "url": chunk.url,
                "filename": chunk.filename,
                "section": chunk.section,
            }
            records.append(record)

        # Upsert in batches
        total_upserted = 0
        total_batches = (len(records) + batch_size - 1) // batch_size

        for i in range(0, len(records), batch_size):
            batch = records[i : i + batch_size]
            batch_num = i // batch_size + 1

            logger.info(
                f"Upserting batch {batch_num}/{total_batches} ({len(batch)} records)..."
            )

            self.index.upsert_records(
                namespace=self.config.articles_namespace, records=batch
            )
            total_upserted += len(batch)

        logger.info(
            f"Upserted {total_upserted} records to namespace '{self.config.articles_namespace}'"
        )
        return total_upserted

    def run(self, articles_dir: str) -> dict:
        """Run the full ingestion pipeline."""
        logger.info("=" * 60)
        logger.info("Starting article ingestion pipeline")
        logger.info("  Using Pinecone integrated embedding (no OpenAI needed!)")
        logger.info("=" * 60)

        # Load articles
        articles = self.load_articles(articles_dir)

        # Chunk articles
        chunks = self.chunk_articles(articles)

        # Upsert to Pinecone (embeddings generated automatically)
        upserted_count = self.upsert_to_pinecone(chunks)

        summary = {
            "files_processed": len(articles),
            "chunks_created": len(chunks),
            "records_upserted": upserted_count,
        }

        logger.info("=" * 60)
        logger.info("Article ingestion complete!")
        logger.info(f"  Files processed: {summary['files_processed']}")
        logger.info(f"  Chunks created: {summary['chunks_created']}")
        logger.info(f"  Records upserted: {summary['records_upserted']}")
        logger.info("=" * 60)

        return summary


def main():
    """Main entry point."""
    try:
        # Load configuration
        pinecone_config = get_pinecone_config()
        path_config = get_path_config()

        # Validate articles directory exists
        if not os.path.isdir(path_config.articles_dir):
            logger.error(f"Articles directory not found: {path_config.articles_dir}")
            logger.error("Please ensure the kindred-dataset/articles/ directory exists")
            sys.exit(1)

        # Run ingestion
        ingester = ArticleIngester(pinecone_config)
        summary = ingester.run(path_config.articles_dir)

        return summary

    except EnvironmentError as e:
        logger.error(f"Configuration error: {e}")
        sys.exit(1)
    except FileNotFoundError as e:
        logger.error(f"File error: {e}")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        raise


if __name__ == "__main__":
    main()
