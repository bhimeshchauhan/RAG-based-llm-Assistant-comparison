"""
Reusable chunking logic for the Kindred RAG ingestion pipeline.

Provides intelligent chunking strategies for:
- Markdown articles (section-aware chunking)
- Community threads (post-based chunking)
"""

import re
import hashlib
from dataclasses import dataclass
from typing import List, Optional
import tiktoken

from config import ChunkingConfig, get_chunking_config


@dataclass
class ArticleChunk:
    """Represents a chunk from a markdown article."""
    chunk_id: str
    text: str
    title: str
    url: str
    filename: str
    section: str
    token_count: int


@dataclass
class ThreadPostChunk:
    """Represents a chunk from a community thread post."""
    chunk_id: str
    text: str
    thread_id: str
    url: str
    author: str
    timestamp: str
    post_id: str
    token_count: int


class TokenCounter:
    """Utility for counting tokens using tiktoken."""
    
    def __init__(self, model: str = "text-embedding-3-small"):
        # text-embedding-3-small uses cl100k_base encoding
        self.encoding = tiktoken.get_encoding("cl100k_base")
    
    def count(self, text: str) -> int:
        """Count tokens in text."""
        return len(self.encoding.encode(text))
    
    def truncate_to_tokens(self, text: str, max_tokens: int) -> str:
        """Truncate text to fit within max_tokens."""
        tokens = self.encoding.encode(text)
        if len(tokens) <= max_tokens:
            return text
        return self.encoding.decode(tokens[:max_tokens])


class ArticleChunker:
    """
    Chunks markdown articles by section headers.
    
    Strategy:
    1. Parse markdown to identify sections (## headers)
    2. Chunk each section independently
    3. If a section exceeds max size, split with overlap
    4. Preserve section heading in metadata
    """
    
    def __init__(self, config: Optional[ChunkingConfig] = None):
        self.config = config or get_chunking_config()
        self.token_counter = TokenCounter()
    
    def chunk_article(
        self,
        content: str,
        title: str,
        url: str,
        filename: str,
    ) -> List[ArticleChunk]:
        """
        Chunk a markdown article into semantically meaningful pieces.
        
        Args:
            content: Full markdown content
            title: Article title
            url: Article URL
            filename: Source filename
            
        Returns:
            List of ArticleChunk objects
        """
        chunks = []
        sections = self._parse_sections(content)
        
        for section_heading, section_text in sections:
            section_chunks = self._chunk_section(
                section_text,
                section_heading,
                title,
                url,
                filename,
            )
            chunks.extend(section_chunks)
        
        return chunks
    
    def _parse_sections(self, content: str) -> List[tuple]:
        """
        Parse markdown into sections based on ## headers.
        
        Returns list of (heading, content) tuples.
        """
        # Split by ## headers (level 2)
        section_pattern = r'^(#{1,3})\s+(.+)$'
        lines = content.split('\n')
        
        sections = []
        current_heading = "Introduction"
        current_lines = []
        
        for line in lines:
            match = re.match(section_pattern, line)
            if match:
                # Save previous section if it has content
                if current_lines:
                    section_text = '\n'.join(current_lines).strip()
                    if section_text:
                        sections.append((current_heading, section_text))
                
                # Start new section
                current_heading = match.group(2).strip()
                current_lines = []
            else:
                current_lines.append(line)
        
        # Don't forget the last section
        if current_lines:
            section_text = '\n'.join(current_lines).strip()
            if section_text:
                sections.append((current_heading, section_text))
        
        return sections
    
    def _chunk_section(
        self,
        text: str,
        section_heading: str,
        title: str,
        url: str,
        filename: str,
    ) -> List[ArticleChunk]:
        """
        Chunk a section, splitting if necessary.
        """
        chunks = []
        token_count = self.token_counter.count(text)
        
        # If section fits in one chunk, use it as-is
        if token_count <= self.config.max_chunk_size:
            chunk_id = self._generate_chunk_id(filename, section_heading, 0)
            chunks.append(ArticleChunk(
                chunk_id=chunk_id,
                text=text,
                title=title,
                url=url,
                filename=filename,
                section=section_heading,
                token_count=token_count,
            ))
            return chunks
        
        # Split into multiple chunks with overlap
        paragraphs = text.split('\n\n')
        current_chunk_text = []
        current_token_count = 0
        chunk_index = 0
        
        for para in paragraphs:
            para = para.strip()
            if not para:
                continue
                
            para_tokens = self.token_counter.count(para)
            
            # If adding this paragraph exceeds max, save current chunk
            if current_token_count + para_tokens > self.config.max_chunk_size and current_chunk_text:
                chunk_text = '\n\n'.join(current_chunk_text)
                chunk_id = self._generate_chunk_id(filename, section_heading, chunk_index)
                chunks.append(ArticleChunk(
                    chunk_id=chunk_id,
                    text=chunk_text,
                    title=title,
                    url=url,
                    filename=filename,
                    section=section_heading,
                    token_count=self.token_counter.count(chunk_text),
                ))
                chunk_index += 1
                
                # Keep overlap - take last paragraph(s) up to overlap_tokens
                overlap_text = []
                overlap_tokens = 0
                for prev_para in reversed(current_chunk_text):
                    prev_tokens = self.token_counter.count(prev_para)
                    if overlap_tokens + prev_tokens <= self.config.overlap_tokens:
                        overlap_text.insert(0, prev_para)
                        overlap_tokens += prev_tokens
                    else:
                        break
                
                current_chunk_text = overlap_text
                current_token_count = overlap_tokens
            
            current_chunk_text.append(para)
            current_token_count += para_tokens
        
        # Don't forget the last chunk
        if current_chunk_text:
            chunk_text = '\n\n'.join(current_chunk_text)
            chunk_id = self._generate_chunk_id(filename, section_heading, chunk_index)
            chunks.append(ArticleChunk(
                chunk_id=chunk_id,
                text=chunk_text,
                title=title,
                url=url,
                filename=filename,
                section=section_heading,
                token_count=self.token_counter.count(chunk_text),
            ))
        
        return chunks
    
    def _generate_chunk_id(self, filename: str, section: str, index: int) -> str:
        """Generate a unique, deterministic chunk ID."""
        content = f"{filename}:{section}:{index}"
        return hashlib.md5(content.encode()).hexdigest()[:16]


class ThreadChunker:
    """
    Chunks community thread JSON files.
    
    Strategy:
    - One chunk per post
    - Preserve original post text verbatim
    - Include rich metadata for retrieval
    """
    
    def __init__(self):
        self.token_counter = TokenCounter()
    
    def chunk_thread(self, thread_data: dict) -> List[ThreadPostChunk]:
        """
        Chunk a community thread into post-based chunks.
        
        Args:
            thread_data: Parsed JSON thread data
            
        Returns:
            List of ThreadPostChunk objects
        """
        chunks = []
        
        thread_id = thread_data.get("thread_id", "unknown")
        url = thread_data.get("url", f"https://kindred.app/community/{thread_id}")
        posts = thread_data.get("posts", [])
        
        for post in posts:
            post_id = post.get("post_id", "unknown")
            author = post.get("author", {})
            # Handle author as dict (with handle/username) or string
            if isinstance(author, dict):
                author_name = author.get("handle") or author.get("username") or author.get("name", "anonymous")
            else:
                author_name = str(author) if author else "anonymous"
            timestamp = post.get("created_at", "")
            body = post.get("body", "")
            
            if not body:
                continue
            
            chunk_id = self._generate_chunk_id(thread_id, post_id)
            token_count = self.token_counter.count(body)
            
            chunks.append(ThreadPostChunk(
                chunk_id=chunk_id,
                text=body,
                thread_id=thread_id,
                url=url,
                author=author_name,
                timestamp=timestamp,
                post_id=post_id,
                token_count=token_count,
            ))
        
        return chunks
    
    def _generate_chunk_id(self, thread_id: str, post_id: str) -> str:
        """Generate a unique, deterministic chunk ID."""
        content = f"{thread_id}:{post_id}"
        return hashlib.md5(content.encode()).hexdigest()[:16]


def extract_article_metadata(content: str, filename: str) -> dict:
    """
    Extract metadata from article markdown content.
    
    Expected format at top of file:
    # Title
    **Author:** ...
    **Published:** YYYY-MM-DD
    **URL:** https://kindred.app/resources/...
    """
    metadata = {
        "title": "",
        "author": "",
        "published": "",
        "url": "",
        "filename": filename,
    }
    
    lines = content.split('\n')
    
    for i, line in enumerate(lines[:20]):  # Check first 20 lines
        line = line.strip()
        
        # Title (# heading)
        if line.startswith('# ') and not metadata["title"]:
            metadata["title"] = line[2:].strip()
        
        # Author - handle both "Author:" and "**Author:**" formats
        author_match = re.match(r'\*?\*?Author:\*?\*?\s*(.+)', line, re.IGNORECASE)
        if author_match:
            metadata["author"] = author_match.group(1).strip()
        
        # Published date - handle both formats
        pub_match = re.match(r'\*?\*?Published:\*?\*?\s*(.+)', line, re.IGNORECASE)
        if pub_match:
            metadata["published"] = pub_match.group(1).strip()
        
        # URL - handle both formats
        url_match = re.match(r'\*?\*?URL:\*?\*?\s*(.+)', line, re.IGNORECASE)
        if url_match:
            metadata["url"] = url_match.group(1).strip()
    
    # Generate URL from title if not found
    if not metadata["url"] and metadata["title"]:
        slug = re.sub(r'[^a-z0-9]+', '-', metadata["title"].lower()).strip('-')
        metadata["url"] = f"https://kindred.app/resources/{slug}"
    
    return metadata
