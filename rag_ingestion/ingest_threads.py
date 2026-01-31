#!/usr/bin/env python3
"""
Ingest community thread JSON files into Pinecone using integrated embedding.

No external embedding API needed - Pinecone generates embeddings automatically!

Usage:
    python ingest_threads.py

Environment variables required:
    PINECONE_API_KEY (or VITE_PINECONE_API_KEY) - Your Pinecone API key
"""

import os
import sys
import glob
import json
import logging
import time
from typing import List, Tuple

from pinecone import Pinecone

from config import get_pinecone_config, get_path_config, PineconeConfig
from chunking import ThreadChunker, ThreadPostChunk

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


class ThreadIngester:
    """Handles ingestion of community thread JSON files into Pinecone with integrated embedding."""
    
    def __init__(self, pinecone_config: PineconeConfig):
        self.config = pinecone_config
        
        # Initialize Pinecone client
        self.pc = Pinecone(api_key=pinecone_config.api_key)
        
        # Initialize chunker
        self.chunker = ThreadChunker()
        
        # Get or create index with integrated embedding
        self.index = self._get_or_create_index()
    
    def _get_or_create_index(self):
        """Get existing index or create with integrated embedding model."""
        existing_indexes = [idx.name for idx in self.pc.list_indexes()]
        
        if self.config.index_name not in existing_indexes:
            logger.info(f"Creating index '{self.config.index_name}' with integrated embedding...")
            logger.info(f"  Embedding model: {self.config.embedding_model}")
            
            # Create index with integrated embedding
            self.pc.create_index_for_model(
                name=self.config.index_name,
                cloud=self.config.cloud,
                region=self.config.region,
                embed={
                    "model": self.config.embedding_model,
                    "field_map": {"text": "text"}
                }
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
    
    def load_threads(self, threads_dir: str) -> List[Tuple[str, dict]]:
        """Load all JSON thread files from the threads directory."""
        pattern = os.path.join(threads_dir, "*.json")
        files = glob.glob(pattern)
        
        if not files:
            raise FileNotFoundError(
                f"No JSON files found in {threads_dir}. "
                "Ensure the kindred-dataset/community-threads/ directory exists and contains .json files."
            )
        
        threads = []
        for filepath in sorted(files):
            filename = os.path.basename(filepath)
            with open(filepath, 'r', encoding='utf-8') as f:
                try:
                    data = json.load(f)
                    threads.append((filename, data))
                    logger.debug(f"Loaded: {filename}")
                except json.JSONDecodeError as e:
                    logger.warning(f"Skipping invalid JSON file {filename}: {e}")
        
        logger.info(f"Loaded {len(threads)} thread files")
        return threads
    
    def chunk_threads(self, threads: List[Tuple[str, dict]]) -> List[ThreadPostChunk]:
        """Chunk all threads into post-based chunks."""
        all_chunks = []
        
        for filename, thread_data in threads:
            chunks = self.chunker.chunk_thread(thread_data)
            all_chunks.extend(chunks)
            logger.debug(f"Chunked {filename} into {len(chunks)} post chunks")
        
        logger.info(f"Created {len(all_chunks)} total chunks from {len(threads)} threads")
        return all_chunks
    
    def upsert_to_pinecone(self, chunks: List[ThreadPostChunk], batch_size: int = 96) -> int:
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
                "type": "thread",
                "thread_id": chunk.thread_id,
                "url": chunk.url,
                "author": chunk.author,
                "timestamp": chunk.timestamp,
                "post_id": chunk.post_id,
            }
            records.append(record)
        
        # Upsert in batches
        total_upserted = 0
        total_batches = (len(records) + batch_size - 1) // batch_size
        
        for i in range(0, len(records), batch_size):
            batch = records[i:i + batch_size]
            batch_num = i // batch_size + 1
            
            logger.info(f"Upserting batch {batch_num}/{total_batches} ({len(batch)} records)...")
            
            self.index.upsert_records(
                namespace=self.config.threads_namespace,
                records=batch
            )
            total_upserted += len(batch)
        
        logger.info(f"Upserted {total_upserted} records to namespace '{self.config.threads_namespace}'")
        return total_upserted
    
    def run(self, threads_dir: str) -> dict:
        """Run the full ingestion pipeline."""
        logger.info("=" * 60)
        logger.info("Starting thread ingestion pipeline")
        logger.info("  Using Pinecone integrated embedding (no OpenAI needed!)")
        logger.info("=" * 60)
        
        # Load threads
        threads = self.load_threads(threads_dir)
        
        # Chunk threads (one chunk per post)
        chunks = self.chunk_threads(threads)
        
        # Upsert to Pinecone (embeddings generated automatically)
        upserted_count = self.upsert_to_pinecone(chunks)
        
        # Count total posts
        total_posts = sum(len(thread_data.get("posts", [])) for _, thread_data in threads)
        
        summary = {
            "files_processed": len(threads),
            "posts_found": total_posts,
            "chunks_created": len(chunks),
            "records_upserted": upserted_count,
        }
        
        logger.info("=" * 60)
        logger.info("Thread ingestion complete!")
        logger.info(f"  Files processed: {summary['files_processed']}")
        logger.info(f"  Posts found: {summary['posts_found']}")
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
        
        # Validate threads directory exists
        if not os.path.isdir(path_config.threads_dir):
            logger.error(f"Threads directory not found: {path_config.threads_dir}")
            logger.error("Please ensure the kindred-dataset/community-threads/ directory exists")
            sys.exit(1)
        
        # Run ingestion
        ingester = ThreadIngester(pinecone_config)
        summary = ingester.run(path_config.threads_dir)
        
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
