/**
 * =============================================================================
 * CustomGPT Provider Adapter
 * =============================================================================
 * Documentation: https://docs.customgpt.ai/reference/quickstart-guide
 * 
 * Uses the OpenAI-compatible chat completions endpoint:
 * - POST /api/v1/projects/{projectId}/chat/completions
 * 
 * This is the recommended approach per CustomGPT docs - simpler and cleaner
 * than the conversation-based API.
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
  CustomGPTConfig,
} from '../types';

// OpenAI-compatible response format
interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string | null;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
    index: number;
  }>;
  // CustomGPT-specific: citations may be included
  citations?: Array<{
    id: number;
    source_id: number;
    title?: string;
    url?: string;
    snippet?: string;
  }>;
}

interface CustomGPTSourceResponse {
  data: {
    id: number;
    type: string;
    status: string;
    file_name?: string;
    created_at: string;
  };
}

export class CustomGPTAdapter implements ProviderAdapter {
  readonly providerId = 'customgpt' as const;
  private config: CustomGPTConfig;
  private conversationHistory: Array<{ role: string; content: string }> = [];

  constructor(config: CustomGPTConfig) {
    this.config = config;
  }

  get isConfigured(): boolean {
    return this.config.isConfigured;
  }

  /**
   * Ingest files into CustomGPT via the sources endpoint
   */
  async ingest(options: IngestOptions): Promise<IngestResult> {
    if (!this.isConfigured) {
      return { success: false, error: 'CustomGPT is not configured' };
    }

    const { files, onProgress } = options;
    
    try {
      onProgress?.('uploading', 0);
      
      const sourceIds: string[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        
        if (file.content) {
          const blob = new Blob([file.content], { type: file.type || 'text/plain' });
          formData.append('file', blob, file.name);
        } else {
          return { success: false, error: `No content available for file: ${file.name}` };
        }
        
        const response = await fetch(
          `${this.config.baseUrl}/api/v1/projects/${this.config.projectId}/sources`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.config.apiKey}`,
            },
            body: formData,
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to upload ${file.name}: ${response.status} - ${errorText}`);
        }

        const data: CustomGPTSourceResponse = await response.json();
        sourceIds.push(String(data.data.id));
        
        onProgress?.('uploading', Math.round(((i + 1) / files.length) * 50));
      }

      onProgress?.('indexing', 75);
      await new Promise(resolve => setTimeout(resolve, 2000));
      onProgress?.('ready', 100);
      
      return {
        success: true,
        sourceId: sourceIds.join(','),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  /**
   * Send a chat message using OpenAI-compatible endpoint
   * 
   * Endpoint: POST /api/v1/projects/{projectId}/chat/completions
   * Docs: https://docs.customgpt.ai/reference/post_api-v1-projects-projectid-chat-completions-1
   */
  async chat(options: ChatOptions): Promise<ChatResult> {
    if (!this.isConfigured) {
      return { success: false, error: 'CustomGPT is not configured' };
    }

    const { message, userContext, sessionId } = options;
    const startTime = Date.now();

    try {
      // Reset conversation if no session
      if (!sessionId) {
        this.conversationHistory = [];
      }

      // Build message with user context
      const contextPrefix = this.buildContextPrefix(userContext);
      const fullMessage = contextPrefix 
        ? `${contextPrefix}\n\nQuestion: ${message}` 
        : message;

      // Add user message to history
      this.conversationHistory.push({ role: 'user', content: fullMessage });

      // Send request using OpenAI-compatible format
      const response = await fetch(
        `${this.config.baseUrl}/api/v1/projects/${this.config.projectId}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            messages: this.conversationHistory,
            stream: false,
            lang: 'en',
            is_inline_citation: true, // Request inline citations
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Failed to send message: ${response.status} ${errorText}`);
      }

      const data: ChatCompletionResponse = await response.json();
      const latency = Date.now() - startTime;

      // Extract assistant response
      const assistantMessage = data.choices[0]?.message?.content || '';
      
      // Add to conversation history
      this.conversationHistory.push({ role: 'assistant', content: assistantMessage });

      // Parse citations into related resources
      const relatedResources = this.parseCitations(data.citations, assistantMessage);

      const result: ProviderResult = {
        answer_text: assistantMessage,
        related_resources: relatedResources,
        latency_ms: latency,
        raw: data,
      };

      return {
        success: true,
        result,
        sessionId: sessionId || `customgpt-${Date.now()}`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Build a context prefix string from UserContext
   */
  private buildContextPrefix(userContext: Record<string, string | undefined>): string {
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

    if (parts.length === 0) return '';
    
    return `[User Context: ${parts.join(', ')}]`;
  }

  /**
   * Parse CustomGPT citations into RelatedResource format
   * Also extracts URLs from response text as fallback
   */
  private parseCitations(
    citations: ChatCompletionResponse['citations'],
    responseText: string
  ): RelatedResource[] {
    const resources: RelatedResource[] = [];
    const seenUrls = new Set<string>();

    // First, process explicit citations if available
    if (citations && citations.length > 0) {
      for (const citation of citations) {
        const url = citation.url || '';
        if (url && !seenUrls.has(url)) {
          seenUrls.add(url);
          resources.push({
            title: citation.title || `Source ${citation.id}`,
            url,
            snippet: citation.snippet,
            category: url.includes('community') ? 'community' : 'library',
          });
        }
      }
    }

    // Also extract any URLs mentioned in the response as fallback
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;
    const matches = responseText.match(urlRegex) || [];
    
    for (const url of matches) {
      if (!seenUrls.has(url)) {
        seenUrls.add(url);
        resources.push({
          title: this.extractTitleFromUrl(url),
          url,
          category: url.includes('community') ? 'community' : 'library',
        });
      }
    }

    return resources;
  }

  /**
   * Extract a readable title from a URL
   */
  private extractTitleFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname.split('/').filter(Boolean).pop() || '';
      return path
        .replace(/[-_]/g, ' ')
        .replace(/\.(html|htm|pdf|md)$/i, '')
        .replace(/\b\w/g, c => c.toUpperCase()) || 'Source';
    } catch {
      return 'Source';
    }
  }
}
