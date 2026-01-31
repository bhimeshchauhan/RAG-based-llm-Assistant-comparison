/**
 * =============================================================================
 * RAG Chatbot Comparison Tool - Type Definitions
 * =============================================================================
 * Core type definitions for the comparison tool state model and data contracts
 * =============================================================================
 */

// -----------------------------------------------------------------------------
// Provider Identification
// -----------------------------------------------------------------------------

export type ProviderId = 'customgpt' | 'botpress' | 'pinecone';

export const PROVIDER_NAMES: Record<ProviderId, string> = {
  customgpt: 'CustomGPT',
  botpress: 'Botpress',
  pinecone: 'Pinecone RAG',
};

// -----------------------------------------------------------------------------
// User Context (Personalization)
// -----------------------------------------------------------------------------

export interface UserContext {
  caregiver_name?: string;
  loved_one_name?: string;
  diagnosis?: string;
  relationship?: string;
  care_stage?: string;
}

// -----------------------------------------------------------------------------
// Configuration & Environment Variables
// -----------------------------------------------------------------------------

export interface ProviderConfig {
  isConfigured: boolean;
  missingVars: string[];
}

export interface CustomGPTConfig extends ProviderConfig {
  apiKey?: string;
  projectId?: string;
  baseUrl: string;
}

export interface BotpressConfig extends ProviderConfig {
  botId?: string;
  clientId?: string;   // For webchat - from Botpress Cloud embed code
  webhookId?: string;  // For Chat API - from Chat integration settings
  token?: string;      // Personal access token (for Files API ingestion)
  integrationId?: string;
  baseUrl: string;
}

export interface PineconeConfig extends ProviderConfig {
  apiKey?: string;
  assistantName?: string;  // Pinecone Assistant name (default: kindred-assistant)
  namespace: string;       // Fallback if assistantName not set
  // No external LLM needed - Pinecone Assistant handles everything!
}

export interface AppConfig {
  customgpt: CustomGPTConfig;
  botpress: BotpressConfig;
  pinecone: PineconeConfig;
}

// -----------------------------------------------------------------------------
// Ingestion State
// -----------------------------------------------------------------------------

export type IngestionStatus = 'idle' | 'queued' | 'uploading' | 'indexing' | 'ready' | 'error';

export interface IngestionFile {
  id: string;
  name: string;
  size: number;
  type: string;
  content?: string; // For text files, we may store content for Pinecone chunking
}

export interface ProviderIngestionState {
  status: IngestionStatus;
  error?: string;
  sourceId?: string; // Provider-specific source/file ID
  progress?: number; // 0-100 percentage if available
  timestamp?: string;
}

export interface IngestionRun {
  id: string;
  startedAt: string;
  completedAt?: string;
  files: IngestionFile[];
  providers: Record<ProviderId, ProviderIngestionState>;
}

// -----------------------------------------------------------------------------
// Chat & Conversation
// -----------------------------------------------------------------------------

export interface RelatedResource {
  title: string;
  url: string;
  snippet?: string;
  score?: number; // Relevance score if available
  imageUrl?: string; // Optional image for rich cards
  author?: string; // For community posts
  category?: 'community' | 'library' | 'unknown'; // Resource categorization
}

export interface ResponseFeedback {
  turnId: string;
  providerId: ProviderId;
  rating: 'up' | 'down' | null;
  timestamp?: string;
}

export interface ProviderResult {
  answer_text: string;
  related_resources: RelatedResource[];
  raw?: unknown; // Raw provider response for debugging
  latency_ms?: number;
  error?: string;
}

export interface Turn {
  id: string;
  user_message: string;
  timestamp: string;
  results: Partial<Record<ProviderId, ProviderResult>>;
}

export interface Conversation {
  id: string;
  startedAt: string;
  turns: Turn[];
  // Per-provider conversation/session IDs for continuity
  providerSessionIds: Partial<Record<ProviderId, string>>;
}

// -----------------------------------------------------------------------------
// Question Set (Evaluation)
// -----------------------------------------------------------------------------

export interface QuestionItem {
  id: string;
  text: string;
  followups?: string[];
}

export interface QuestionSet {
  name: string;
  description?: string;
  questions: QuestionItem[];
}

// -----------------------------------------------------------------------------
// Scoring & Metrics
// -----------------------------------------------------------------------------

export interface TurnScore {
  linkCount: number;
  validUrls: number;
  invalidUrls: number;
  uniqueUrls: number;
  duplicateUrls: number;
  personalizationScore: number; // 0-1 based on user_context field usage
  personalizationFields: string[]; // Which fields were referenced
  hasNoLinksWarning: boolean;
  hasContinuityIndicator: boolean;
}

export interface ProviderScoreSummary {
  totalTurns: number;
  avgLinkCount: number;
  avgValidUrlRate: number;
  avgPersonalizationScore: number;
  noLinksWarnings: number;
  continuityIndicators: number;
  avgLatencyMs: number;
  errorCount: number;
}

// -----------------------------------------------------------------------------
// Application State
// -----------------------------------------------------------------------------

export interface AppState {
  config: AppConfig;
  userContext: UserContext;
  ingestionRuns: IngestionRun[];
  currentIngestion: IngestionRun | null;
  conversation: Conversation | null;
  questionSet: QuestionSet | null;
  isRunningQuestionSet: boolean;
  questionSetProgress: number; // Current question index
}

// -----------------------------------------------------------------------------
// Provider Adapter Interfaces
// -----------------------------------------------------------------------------

export interface IngestOptions {
  files: IngestionFile[];
  onProgress?: (status: IngestionStatus, progress?: number) => void;
}

export interface IngestResult {
  success: boolean;
  sourceId?: string;
  error?: string;
}

export interface ChatOptions {
  message: string;
  userContext: UserContext;
  sessionId?: string; // For conversation continuity
}

export interface ChatResult {
  success: boolean;
  result?: ProviderResult;
  sessionId?: string; // Return session ID for continuity
  error?: string;
}

export interface ProviderAdapter {
  readonly providerId: ProviderId;
  readonly isConfigured: boolean;
  
  ingest(options: IngestOptions): Promise<IngestResult>;
  chat(options: ChatOptions): Promise<ChatResult>;
  clearKnowledge?(): Promise<void>; // Optional: clear ingested data
}
