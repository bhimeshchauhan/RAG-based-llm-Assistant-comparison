/**
 * =============================================================================
 * Pinecone Assistant Provider Adapter
 * =============================================================================
 * Documentation: https://docs.pinecone.io/guides/assistant/overview
 * 
 * Uses Pinecone Assistant API which provides:
 * - Automatic document processing and chunking
 * - Built-in RAG with semantic search
 * - Native citations in responses
 * - Simple file upload for ingestion
 * - NO external LLM API needed!
 * 
 * This is a fully managed RAG service similar to CustomGPT.
 * 
 * API Endpoints:
 * - POST /assistant/assistants - Create assistant
 * - POST /assistant/files/{assistant_name} - Upload file
 * - POST /assistant/assistants/{assistant_name}/chat - Chat with citations
 * =============================================================================
 */

import type {
  ProviderAdapter,
  IngestOptions,
  IngestResult,
  ChatOptions,
  ChatResult,
  ProviderResult,
  RelatedResource,
  PineconeConfig,
} from '../types';

// Pinecone Assistant API types
interface PineconeAssistant {
  name: string;
  instructions?: string;
  metadata?: Record<string, string>;
  status: 'Initializing' | 'Ready' | 'Failed';
  created_on: string;
  updated_on: string;
}

interface PineconeFile {
  id: string;
  name: string;
  metadata?: Record<string, string>;
  status: 'Processing' | 'Available' | 'Failed';
  percent_done: number;
  created_on: string;
  updated_on: string;
  error_message?: string;
}

interface PineconeChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface PineconeCitation {
  position: number;
  references: Array<{
    pages?: number[];
    file: {
      name: string;
      id: string;
      metadata?: Record<string, string>;
      signed_url?: string;
    };
  }>;
}

interface PineconeChatResponse {
  id: string;
  model: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  message: {
    content: string;
    role: string;
  };
  finish_reason: string;
  citations?: PineconeCitation[];
}

// Pinecone API URLs
// Control plane: for managing assistants and files
const CONTROL_API_BASE = 'https://api.pinecone.io';
// Data plane: for chat operations
const DATA_API_BASE = 'https://prod-1-data.ke.pinecone.io';

export class PineconeAdapter implements ProviderAdapter {
  readonly providerId = 'pinecone' as const;
  private config: PineconeConfig;
  private conversationHistory: PineconeChatMessage[] = [];
  private assistantReady = false;

  constructor(config: PineconeConfig) {
    this.config = config;
  }

  get isConfigured(): boolean {
    return this.config.isConfigured;
  }

  /**
   * Get assistant name from config
   */
  private get assistantName(): string {
    return this.config.assistantName || this.config.namespace || 'kindred-assistant';
  }

  /**
   * Ensure the assistant exists, create if needed
   */
  private async ensureAssistant(): Promise<void> {
    if (this.assistantReady) return;

    try {
      // Check if assistant exists (control plane)
      const checkResponse = await fetch(
        `${CONTROL_API_BASE}/assistant/assistants/${this.assistantName}`,
        {
          headers: {
            'Api-Key': this.config.apiKey!,
          },
        }
      );

      if (checkResponse.ok) {
        const assistant: PineconeAssistant = await checkResponse.json();
        if (assistant.status === 'Ready') {
          this.assistantReady = true;
          return;
        }
      }

      // Create assistant if it doesn't exist (control plane)
      if (checkResponse.status === 404) {
        const createResponse = await fetch(
          `${CONTROL_API_BASE}/assistant/assistants`,
          {
            method: 'POST',
            headers: {
              'Api-Key': this.config.apiKey!,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: this.assistantName,
              instructions: 'You are a helpful, compassionate assistant for caregivers using the Kindred platform. Provide accurate, empathetic, and actionable information based on the uploaded documents. Always cite your sources when referencing specific content. Never provide medical, legal, or financial advice - suggest consulting professionals instead.',
            }),
          }
        );

        if (!createResponse.ok) {
          const error = await createResponse.text();
          throw new Error(`Failed to create assistant: ${error}`);
        }

        // Wait for assistant to be ready
        await this.waitForAssistantReady();
      }

      this.assistantReady = true;
    } catch (error) {
      console.error('Error ensuring assistant:', error);
      throw error;
    }
  }

  /**
   * Wait for assistant to be ready (control plane)
   */
  private async waitForAssistantReady(maxAttempts = 30): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      const response = await fetch(
        `${CONTROL_API_BASE}/assistant/assistants/${this.assistantName}`,
        {
          headers: {
            'Api-Key': this.config.apiKey!,
          },
        }
      );

      if (response.ok) {
        const assistant: PineconeAssistant = await response.json();
        if (assistant.status === 'Ready') {
          return;
        }
        if (assistant.status === 'Failed') {
          throw new Error('Assistant creation failed');
        }
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error('Timeout waiting for assistant to be ready');
  }

  /**
   * Ingest files into Pinecone Assistant
   */
  async ingest(options: IngestOptions): Promise<IngestResult> {
    if (!this.isConfigured) {
      return { success: false, error: 'Pinecone is not configured' };
    }

    const { files, onProgress } = options;

    try {
      onProgress?.('uploading', 0);

      // Ensure assistant exists
      await this.ensureAssistant();

      const fileIds: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        onProgress?.('uploading', Math.round((i / files.length) * 50));

        // Create form data for file upload
        const formData = new FormData();
        const blob = new Blob([file.content || ''], { 
          type: file.type || 'text/plain' 
        });
        formData.append('file', blob, file.name);

        // Upload file to assistant (control plane)
        const uploadResponse = await fetch(
          `${CONTROL_API_BASE}/assistant/files/${this.assistantName}`,
          {
            method: 'POST',
            headers: {
              'Api-Key': this.config.apiKey!,
            },
            body: formData,
          }
        );

        if (!uploadResponse.ok) {
          const error = await uploadResponse.text();
          throw new Error(`Failed to upload ${file.name}: ${error}`);
        }

        const uploadedFile: PineconeFile = await uploadResponse.json();
        fileIds.push(uploadedFile.id);

        // Wait for file to be processed
        onProgress?.('indexing', 50 + Math.round((i / files.length) * 40));
        await this.waitForFileReady(uploadedFile.id);
      }

      onProgress?.('ready', 100);

      return {
        success: true,
        sourceId: fileIds.join(','),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  /**
   * Wait for file to be processed (control plane)
   */
  private async waitForFileReady(fileId: string, maxAttempts = 60): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      const response = await fetch(
        `${CONTROL_API_BASE}/assistant/files/${this.assistantName}/${fileId}`,
        {
          headers: {
            'Api-Key': this.config.apiKey!,
          },
        }
      );

      if (response.ok) {
        const file: PineconeFile = await response.json();
        if (file.status === 'Available') {
          return;
        }
        if (file.status === 'Failed') {
          throw new Error(`File processing failed: ${file.error_message}`);
        }
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    throw new Error('Timeout waiting for file to be processed');
  }

  /**
   * Chat with Pinecone Assistant
   */
  async chat(options: ChatOptions): Promise<ChatResult> {
    if (!this.isConfigured) {
      return { success: false, error: 'Pinecone is not configured' };
    }

    const { message, userContext, sessionId } = options;
    const startTime = Date.now();

    try {
      // Ensure assistant exists
      await this.ensureAssistant();

      // Reset conversation if no session
      if (!sessionId) {
        this.conversationHistory = [];
      }

      // Build message with user context
      const contextPrefix = this.buildUserContext(userContext);
      const fullMessage = contextPrefix 
        ? `[User Context: ${contextPrefix}]\n\n${message}`
        : message;

      // Add user message to history
      this.conversationHistory.push({ role: 'user', content: fullMessage });

      // Send chat request (data plane - different URL structure!)
      const response = await fetch(
        `${DATA_API_BASE}/assistant/chat/${this.assistantName}`,
        {
          method: 'POST',
          headers: {
            'Api-Key': this.config.apiKey!,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: this.conversationHistory,
            stream: false,
            model: 'gpt-4o',
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Chat failed: ${error}`);
      }

      const chatResponse: PineconeChatResponse = await response.json();
      const latency = Date.now() - startTime;

      // Add assistant response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: chatResponse.message.content,
      });

      // Parse citations into related resources
      const relatedResources = this.parseCitations(chatResponse.citations);

      const result: ProviderResult = {
        answer_text: chatResponse.message.content,
        related_resources: relatedResources,
        latency_ms: latency,
        raw: chatResponse,
      };

      return {
        success: true,
        result,
        sessionId: sessionId || `pinecone-${Date.now()}`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Build user context string
   */
  private buildUserContext(userContext: Record<string, string | undefined>): string {
    const parts: string[] = [];

    if (userContext.caregiver_name) {
      parts.push(`Caregiver: ${userContext.caregiver_name}`);
    }
    if (userContext.loved_one_name) {
      parts.push(`Caring for: ${userContext.loved_one_name}`);
    }
    if (userContext.diagnosis) {
      parts.push(`Diagnosis: ${userContext.diagnosis}`);
    }
    if (userContext.relationship) {
      parts.push(`Relationship: ${userContext.relationship}`);
    }
    if (userContext.care_stage) {
      parts.push(`Care stage: ${userContext.care_stage}`);
    }

    return parts.join(', ');
  }

  /**
   * Parse Pinecone citations into RelatedResource format
   */
  private parseCitations(citations?: PineconeCitation[]): RelatedResource[] {
    if (!citations || citations.length === 0) {
      return [];
    }

    const resources: RelatedResource[] = [];
    const seenFiles = new Set<string>();

    for (const citation of citations) {
      for (const ref of citation.references) {
        // Avoid duplicates
        if (seenFiles.has(ref.file.id)) continue;
        seenFiles.add(ref.file.id);

        // Try to extract URL from metadata or filename
        const url = ref.file.metadata?.url || 
                    ref.file.signed_url || 
                    this.inferUrlFromFilename(ref.file.name);

        resources.push({
          title: this.cleanFilename(ref.file.name),
          url,
          snippet: ref.pages 
            ? `Referenced pages: ${ref.pages.join(', ')}`
            : undefined,
          category: ref.file.name.includes('thread') ? 'community' : 'library',
        });
      }
    }

    return resources;
  }

  /**
   * Infer Kindred URL from filename
   */
  private inferUrlFromFilename(filename: string): string {
    // Remove extension
    const name = filename.replace(/\.(md|json|txt|pdf)$/i, '');
    
    // Check if it's a thread
    if (name.startsWith('thread-')) {
      return `https://kindred.app/community/${name}`;
    }
    
    // Otherwise assume it's an article
    return `https://kindred.app/resources/${name}`;
  }

  /**
   * Clean filename for display
   */
  private cleanFilename(filename: string): string {
    return filename
      .replace(/\.(md|json|txt|pdf)$/i, '')
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  /**
   * Clear assistant files (for re-ingest) - control plane
   */
  async clearKnowledge(): Promise<void> {
    if (!this.isConfigured) return;

    try {
      // List all files (control plane)
      const listResponse = await fetch(
        `${CONTROL_API_BASE}/assistant/files/${this.assistantName}`,
        {
          headers: {
            'Api-Key': this.config.apiKey!,
          },
        }
      );

      if (!listResponse.ok) return;

      const data = await listResponse.json();
      const files: PineconeFile[] = data.files || [];

      // Delete each file (control plane)
      for (const file of files) {
        await fetch(
          `${CONTROL_API_BASE}/assistant/files/${this.assistantName}/${file.id}`,
          {
            method: 'DELETE',
            headers: {
              'Api-Key': this.config.apiKey!,
            },
          }
        );
      }
    } catch (error) {
      console.error('Failed to clear Pinecone files:', error);
    }
  }
}
