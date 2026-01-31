/**
 * =============================================================================
 * Settings Panel Component
 * =============================================================================
 * Displays environment variable health status for all providers
 * Shows which variables are configured and which are missing
 * =============================================================================
 */

import React from 'react';
import { CheckCircle, XCircle, AlertCircle, Settings, ChevronDown, ChevronRight } from 'lucide-react';
import type { AppConfig, ProviderId } from '../types';
import { PROVIDER_NAMES } from '../types';

interface SettingsPanelProps {
  config: AppConfig;
}

interface ProviderStatusProps {
  providerId: ProviderId;
  isConfigured: boolean;
  missingVars: string[];
}

function ProviderStatus({ providerId, isConfigured, missingVars }: ProviderStatusProps) {
  const [expanded, setExpanded] = React.useState(!isConfigured);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          {isConfigured ? (
            <CheckCircle className="w-5 h-5 text-green-500" />
          ) : (
            <XCircle className="w-5 h-5 text-red-500" />
          )}
          <span className="font-medium text-gray-900">
            {PROVIDER_NAMES[providerId]}
          </span>
          <span className={`text-sm px-2 py-0.5 rounded-full ${
            isConfigured 
              ? 'bg-green-100 text-green-700' 
              : 'bg-red-100 text-red-700'
          }`}>
            {isConfigured ? 'Ready' : 'Not Configured'}
          </span>
        </div>
        {expanded ? (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-400" />
        )}
      </button>
      
      {expanded && (
        <div className="px-4 py-3 bg-white border-t border-gray-200">
          {isConfigured ? (
            <p className="text-sm text-green-600 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              All required environment variables are configured.
            </p>
          ) : (
            <div>
              <p className="text-sm text-red-600 mb-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Missing environment variables:
              </p>
              <ul className="list-disc list-inside space-y-1">
                {missingVars.map(varName => (
                  <li key={varName} className="text-sm font-mono text-gray-700">
                    {varName}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SettingsPanel({ config }: SettingsPanelProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  
  const allConfigured = config.customgpt.isConfigured && 
                        config.botpress.isConfigured && 
                        config.pinecone.isConfigured;
  
  const anyConfigured = config.customgpt.isConfigured || 
                        config.botpress.isConfigured || 
                        config.pinecone.isConfigured;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Settings className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Configuration Status</h2>
          <span className={`text-sm px-3 py-1 rounded-full ${
            allConfigured 
              ? 'bg-green-100 text-green-700'
              : anyConfigured
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-red-100 text-red-700'
          }`}>
            {allConfigured 
              ? 'All Providers Ready' 
              : anyConfigured 
                ? 'Partial Configuration'
                : 'Not Configured'
            }
          </span>
        </div>
        {isOpen ? (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {isOpen && (
        <div className="px-6 pb-6 space-y-4">
          <div className="pt-2 border-t border-gray-100">
            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Setup:</strong> Create a <code className="bg-blue-100 px-1 rounded">.env.local</code> file 
                in the project root with your API keys. See the README for exact variable names.
              </p>
            </div>
            
            <div className="space-y-3">
              <ProviderStatus
                providerId="customgpt"
                isConfigured={config.customgpt.isConfigured}
                missingVars={config.customgpt.missingVars}
              />
              <ProviderStatus
                providerId="botpress"
                isConfigured={config.botpress.isConfigured}
                missingVars={config.botpress.missingVars}
              />
              <ProviderStatus
                providerId="pinecone"
                isConfigured={config.pinecone.isConfigured}
                missingVars={config.pinecone.missingVars}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
