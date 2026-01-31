/**
 * =============================================================================
 * Environment Configuration Loader
 * =============================================================================
 * Loads and validates environment variables for all providers
 * =============================================================================
 */

import type { AppConfig, CustomGPTConfig, BotpressConfig, PineconeConfig, UserContext } from '../types';

/**
 * Get a Vite environment variable with optional default
 */
function getEnvVar(key: string, defaultValue?: string): string | undefined {
  // Vite exposes env vars prefixed with VITE_ on import.meta.env
  const value = (import.meta.env as Record<string, string | undefined>)[key];
  return value || defaultValue;
}

/**
 * Load CustomGPT configuration from environment
 */
function loadCustomGPTConfig(): CustomGPTConfig {
  const apiKey = getEnvVar('VITE_CUSTOMGPT_API_KEY');
  const projectId = getEnvVar('VITE_CUSTOMGPT_PROJECT_ID');
  const baseUrl = getEnvVar('VITE_CUSTOMGPT_BASE_URL', 'https://app.customgpt.ai');

  const missingVars: string[] = [];
  if (!apiKey) missingVars.push('VITE_CUSTOMGPT_API_KEY');
  if (!projectId) missingVars.push('VITE_CUSTOMGPT_PROJECT_ID');

  return {
    apiKey,
    projectId,
    baseUrl: baseUrl!,
    isConfigured: missingVars.length === 0,
    missingVars,
  };
}

/**
 * Load Botpress configuration from environment
 * 
 * Uses Chat API for programmatic bot interaction.
 * Docs: https://botpress.com/docs/api-reference/chat-api/introduction
 * 
 * Required:
 * - webhookId: Webhook ID from the Chat integration settings
 * 
 * Optional:
 * - botId: Your Botpress bot ID (for Files API)
 * - clientId: Webchat client ID (if using webchat fallback)
 * - token: Personal access token (for Files API ingestion)
 */
function loadBotpressConfig(): BotpressConfig {
  const webhookId = getEnvVar('VITE_BOTPRESS_WEBHOOK_ID');
  const botId = getEnvVar('VITE_BOTPRESS_BOT_ID');
  const clientId = getEnvVar('VITE_BOTPRESS_CLIENT_ID');
  const token = getEnvVar('VITE_BOTPRESS_TOKEN');
  const integrationId = getEnvVar('VITE_BOTPRESS_INTEGRATION_ID');
  const baseUrl = getEnvVar('VITE_BOTPRESS_BASE_URL', 'https://api.botpress.cloud');

  const missingVars: string[] = [];
  if (!webhookId) missingVars.push('VITE_BOTPRESS_WEBHOOK_ID');

  return {
    botId,
    clientId,
    webhookId,
    token,
    integrationId,
    baseUrl: baseUrl!,
    isConfigured: missingVars.length === 0,
    missingVars,
  };
}

/**
 * Load Pinecone Assistant configuration from environment
 * 
 * Uses Pinecone Assistant API - a fully managed RAG service.
 * No external LLM API needed!
 * 
 * Docs: https://docs.pinecone.io/guides/assistant/overview
 */
function loadPineconeConfig(): PineconeConfig {
  const apiKey = getEnvVar('VITE_PINECONE_API_KEY');
  const assistantName = getEnvVar('VITE_PINECONE_ASSISTANT_NAME', 'kindred-assistant');
  const namespace = getEnvVar('VITE_PINECONE_NAMESPACE', 'kindred-assistant');

  const missingVars: string[] = [];
  if (!apiKey) missingVars.push('VITE_PINECONE_API_KEY');

  return {
    apiKey,
    assistantName,
    namespace: namespace!,
    isConfigured: missingVars.length === 0,
    missingVars,
  };
}

/**
 * Load user context from environment variables
 * 
 * This personalizes responses with information about the caregiver
 * and their loved one (from onboarding responses).
 */
export function loadUserContext(): UserContext {
  return {
    caregiver_name: getEnvVar('VITE_USER_CAREGIVER_NAME'),
    loved_one_name: getEnvVar('VITE_USER_LOVED_ONE_NAME'),
    diagnosis: getEnvVar('VITE_USER_DIAGNOSIS'),
    relationship: getEnvVar('VITE_USER_RELATIONSHIP'),
    care_stage: getEnvVar('VITE_USER_CARE_STAGE'),
  };
}

/**
 * Load all provider configurations
 */
export function loadAppConfig(): AppConfig {
  return {
    customgpt: loadCustomGPTConfig(),
    botpress: loadBotpressConfig(),
    pinecone: loadPineconeConfig(),
  };
}

/**
 * Check if any provider is configured
 */
export function hasAnyProviderConfigured(config: AppConfig): boolean {
  return config.customgpt.isConfigured || 
         config.botpress.isConfigured || 
         config.pinecone.isConfigured;
}

/**
 * Get list of all configured providers
 */
export function getConfiguredProviders(config: AppConfig): Array<'customgpt' | 'botpress' | 'pinecone'> {
  const providers: Array<'customgpt' | 'botpress' | 'pinecone'> = [];
  if (config.customgpt.isConfigured) providers.push('customgpt');
  if (config.botpress.isConfigured) providers.push('botpress');
  if (config.pinecone.isConfigured) providers.push('pinecone');
  return providers;
}
