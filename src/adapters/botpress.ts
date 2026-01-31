/**
 * =============================================================================
 * Botpress Cloud Provider Adapter (Official Chat Client)
 * =============================================================================
 * Documentation: https://botpress.com/docs/api-reference/chat-api/introduction
 * 
 * Uses the official @botpress/chat JavaScript client for reliable integration.
 * =============================================================================
 */

import { Client } from '@botpress/chat';
import type { Message } from '@botpress/chat';
import type {
  ProviderAdapter,
  IngestOptions,
  IngestResult,
  ChatOptions,
  ChatResult,
  ProviderResult,
  RelatedResource,
  BotpressConfig,
  UserContext,
} from '../types';

interface BotpressFileResponse {
  file: {
    id: string;
    key: string;
    size: number;
    contentType: string;
    status: string;
    tags: Record<string, string>;
    createdAt: string;
    updatedAt: string;
  };
}

interface StoredAuth {
  userKey: string;
  userId: string;
}

export class BotpressAdapter implements ProviderAdapter {
  readonly providerId = 'botpress' as const;
  private config: BotpressConfig;
  private client: Awaited<ReturnType<typeof Client.connect>> | null = null;
  private conversationId: string | null = null;

  constructor(config: BotpressConfig) {
    this.config = config;
  }

  get isConfigured(): boolean {
    return this.config.isConfigured;
  }

  /**
   * Get or create an authenticated Botpress Chat client
   */
  private async getClient(): Promise<Awaited<ReturnType<typeof Client.connect>>> {
    if (this.client) return this.client;

    const webhookId = this.config.webhookId!;

    // Check for existing user key in session storage
    const storageKey = 'botpress-chat-auth';
    const storedData = sessionStorage.getItem(storageKey);

    if (storedData) {
      try {
        const { userKey } = JSON.parse(storedData) as StoredAuth;
        console.log('[Botpress] Restoring client with stored key...');
        this.client = await Client.connect({ webhookId, userKey });
        console.log('[Botpress] Restored authenticated client');
        return this.client;
      } catch (error) {
        console.log('[Botpress] Failed to restore client, creating new one');
        sessionStorage.removeItem(storageKey);
      }
    }

    // Create new unauthenticated client to create a user
    console.log('[Botpress] Creating new user...');
    const unauthClient = new Client({ webhookId });
    const { user, key } = await unauthClient.createUser({});
    console.log('[Botpress] Created user:', user.id);

    // Save credentials
    sessionStorage.setItem(storageKey, JSON.stringify({ userKey: key, userId: user.id }));

    // Connect with the new credentials
    this.client = await Client.connect({ webhookId, userKey: key });
    console.log('[Botpress] Created authenticated client');

    return this.client;
  }

  /**
   * Get or create a conversation
   */
  private async ensureConversation(): Promise<string> {
    if (this.conversationId) return this.conversationId;

    const client = await this.getClient();
    
    console.log('[Botpress] Creating new conversation...');
    const { conversation } = await client.createConversation({});
    const convId = conversation.id;
    this.conversationId = convId;
    console.log('[Botpress] Created conversation:', convId);
    
    return convId;
  }

  /**
   * Ingest files into Botpress Knowledge Base via Files API
   */
  async ingest(options: IngestOptions): Promise<IngestResult> {
    if (!this.isConfigured) {
      return { success: false, error: 'Botpress is not configured' };
    }

    if (!this.config.token) {
      return { success: false, error: 'Botpress token (VITE_BOTPRESS_TOKEN) required for file ingestion' };
    }

    if (!this.config.botId) {
      return { success: false, error: 'Botpress bot ID (VITE_BOTPRESS_BOT_ID) required for file ingestion' };
    }

    const { files, onProgress } = options;

    try {
      onProgress?.('uploading', 0);

      const fileIds: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileKey = `rag-comparison/${Date.now()}-${file.name}`;
        const contentType = file.type || 'text/plain';
        const content = file.content || '';

        const response = await fetch(
          `${this.config.baseUrl}/v1/files`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${this.config.token}`,
              'Content-Type': contentType,
              'x-bot-id': this.config.botId,
              'x-file-key': fileKey,
              'x-file-access': 'private',
              'x-file-index': 'true',
              'x-file-tags': JSON.stringify({ source: 'rag-comparison' }),
            },
            body: content,
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to upload ${file.name}: ${response.status} - ${errorText}`);
        }

        const data: BotpressFileResponse = await response.json();
        fileIds.push(data.file.id);

        onProgress?.('uploading', Math.round(((i + 1) / files.length) * 50));
      }

      onProgress?.('indexing', 75);
      await new Promise(resolve => setTimeout(resolve, 3000));
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
   * Send a chat message via Chat API
   */
  async chat(options: ChatOptions): Promise<ChatResult> {
    if (!this.isConfigured) {
      return { success: false, error: 'Botpress is not configured' };
    }

    const { message, userContext, sessionId } = options;
    const startTime = Date.now();

    try {
      const client = await this.getClient();

      // Reset conversation if no session
      if (!sessionId) {
        this.conversationId = null;
      }

      const conversationId = await this.ensureConversation();

      // Build message with context
      const contextPrefix = this.buildContextPrefix(userContext);
      const fullMessage = contextPrefix ? `${contextPrefix}\n\n${message}` : message;

      console.log('[Botpress] Sending message...');

      // Send message
      await client.createMessage({
        conversationId,
        payload: {
          type: 'text',
          text: fullMessage,
        },
      });

      // Wait for response using polling
      const responseText = await this.waitForResponse(client, conversationId);
      const latency = Date.now() - startTime;

      // Extract any URLs from the response
      const extractedUrls = this.extractUrlsFromText(responseText);

      const result: ProviderResult = {
        answer_text: responseText,
        related_resources: extractedUrls,
        latency_ms: latency,
        raw: { 
          via: 'chat-api-client',
          conversationId,
        },
      };

      return {
        success: true,
        result,
        sessionId: conversationId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Botpress] Chat error:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Wait for bot response using polling
   */
  private async waitForResponse(
    client: Awaited<ReturnType<typeof Client.connect>>,
    conversationId: string,
    maxAttempts = 20,
    delayMs = 1500
  ): Promise<string> {
    // Get the user info to identify our messages
    const { user } = await client.getUser({});
    const myUserId = user.id;
    
    console.log('[Botpress] My user ID:', myUserId);
    console.log('[Botpress] Waiting for bot response...');

    // Poll for bot responses - check ALL messages and filter by userId
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Small delay on first attempt too (bot might respond fast)
      if (attempt === 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }

      const { messages } = await client.listMessages({ conversationId });
      
      console.log('[Botpress] Poll attempt', attempt + 1, '- total messages:', messages.length);
      
      // Find ALL messages that are NOT from us (bot responses)
      const botMessages = messages.filter((m: Message) => {
        const payload = m.payload as { type?: string; text?: string };
        const isFromBot = m.userId !== myUserId;
        const isTextMessage = payload.type === 'text' && payload.text;
        return isFromBot && isTextMessage;
      });

      console.log('[Botpress] Found', botMessages.length, 'bot message(s)');

      if (botMessages.length > 0) {
        // Sort by createdAt to get the most recent bot response
        botMessages.sort((a: Message, b: Message) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        
        // Get the most recent bot message
        const latestBotMessage = botMessages[0];
        const payload = latestBotMessage.payload as { text?: string };
        const responseText = payload.text || '';
        
        console.log('[Botpress] Got bot response:', responseText.substring(0, 100) + '...');
        
        if (responseText) {
          return responseText;
        }
      }
    }

    // If we timeout, return a message instead of throwing
    console.warn('[Botpress] Timeout waiting for bot response after', maxAttempts, 'attempts');
    return '(No response received from bot - check that Knowledge Agent is enabled in your Botpress bot)';
  }

  /**
   * Build context prefix for message
   */
  private buildContextPrefix(userContext: UserContext): string {
    if (!userContext) return '';
    
    const parts: string[] = [];
    
    if (userContext.caregiver_name) {
      parts.push(`My name is ${userContext.caregiver_name}.`);
    }
    if (userContext.loved_one_name) {
      parts.push(`I'm caring for ${userContext.loved_one_name}.`);
    }
    if (userContext.diagnosis) {
      parts.push(`They have ${userContext.diagnosis}.`);
    }
    if (userContext.relationship) {
      parts.push(`I am their ${userContext.relationship}.`);
    }
    if (userContext.care_stage) {
      parts.push(`We are in the ${userContext.care_stage} stage of care.`);
    }

    return parts.join(' ');
  }

  /**
   * Extract URLs from response text as a workaround for missing citations
   */
  private extractUrlsFromText(text: string): RelatedResource[] {
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;
    const matches = text.match(urlRegex) || [];
    const uniqueUrls = [...new Set(matches)];
    
    return uniqueUrls.map((url, index) => ({
      title: `Source ${index + 1}`,
      url,
      snippet: '(URL from response)',
      category: 'library' as const,
    }));
  }
}
