/**
 * =============================================================================
 * Provider Adapters Index
 * =============================================================================
 * Factory function to create configured provider adapters
 * =============================================================================
 */

import type { AppConfig, ProviderAdapter, ProviderId } from '../types';
import { CustomGPTAdapter } from './customgpt';
import { BotpressAdapter } from './botpress';
import { PineconeAdapter } from './pinecone';

export { CustomGPTAdapter } from './customgpt';
export { BotpressAdapter } from './botpress';
export { PineconeAdapter } from './pinecone';

/**
 * Create all provider adapters from config
 */
export function createAdapters(config: AppConfig): Record<ProviderId, ProviderAdapter> {
  return {
    customgpt: new CustomGPTAdapter(config.customgpt),
    botpress: new BotpressAdapter(config.botpress),
    pinecone: new PineconeAdapter(config.pinecone),
  };
}

/**
 * Get only configured adapters
 */
export function getConfiguredAdapters(
  adapters: Record<ProviderId, ProviderAdapter>
): ProviderAdapter[] {
  return Object.values(adapters).filter(adapter => adapter.isConfigured);
}
