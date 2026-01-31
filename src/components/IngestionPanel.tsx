/**
 * =============================================================================
 * Ingestion Panel Component
 * =============================================================================
 * File upload and ingestion controls with per-provider status tracking
 * =============================================================================
 */

import React, { useRef } from 'react';
import { 
  Upload, 
  FileText, 
  Trash2, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Loader2,
  Clock,
  ChevronDown,
  ChevronRight,
  Database
} from 'lucide-react';
import type { 
  IngestionRun, 
  IngestionFile, 
  ProviderId,
  ProviderIngestionState,
  IngestionStatus 
} from '../types';
import { PROVIDER_NAMES } from '../types';

interface IngestionPanelProps {
  currentIngestion: IngestionRun | null;
  isIngesting: boolean;
  configuredProviders: ProviderId[];
  onStartIngestion: (files: IngestionFile[]) => void;
  onClearIngestion: () => void;
}

function StatusIcon({ status }: { status: IngestionStatus }) {
  switch (status) {
    case 'idle':
      return <Clock className="w-4 h-4 text-gray-400" />;
    case 'queued':
      return <Clock className="w-4 h-4 text-yellow-500" />;
    case 'uploading':
    case 'indexing':
      return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
    case 'ready':
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'error':
      return <XCircle className="w-4 h-4 text-red-500" />;
  }
}

function StatusLabel({ status }: { status: IngestionStatus }) {
  const labels: Record<IngestionStatus, string> = {
    idle: 'Idle',
    queued: 'Queued',
    uploading: 'Uploading...',
    indexing: 'Indexing...',
    ready: 'Ready',
    error: 'Error',
  };
  
  const colors: Record<IngestionStatus, string> = {
    idle: 'text-gray-500',
    queued: 'text-yellow-600',
    uploading: 'text-blue-600',
    indexing: 'text-blue-600',
    ready: 'text-green-600',
    error: 'text-red-600',
  };

  return (
    <span className={`text-sm font-medium ${colors[status]}`}>
      {labels[status]}
    </span>
  );
}

function ProviderIngestionStatus({ 
  providerId, 
  state 
}: { 
  providerId: ProviderId; 
  state: ProviderIngestionState;
}) {
  return (
    <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-2">
        <StatusIcon status={state.status} />
        <span className="font-medium text-gray-700">{PROVIDER_NAMES[providerId]}</span>
      </div>
      <div className="flex items-center gap-3">
        <StatusLabel status={state.status} />
        {state.progress !== undefined && state.status !== 'ready' && state.status !== 'error' && (
          <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${state.progress}%` }}
            />
          </div>
        )}
        {state.error && (
          <span className="text-xs text-red-600 max-w-[150px] truncate" title={state.error}>
            {state.error}
          </span>
        )}
      </div>
    </div>
  );
}

export function IngestionPanel({ 
  currentIngestion, 
  isIngesting,
  configuredProviders,
  onStartIngestion,
  onClearIngestion 
}: IngestionPanelProps) {
  const [isOpen, setIsOpen] = React.useState(true);
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleStartIngestion = async () => {
    if (selectedFiles.length === 0) return;

    // Convert Files to IngestionFile format with content
    const ingestionFiles: IngestionFile[] = await Promise.all(
      selectedFiles.map(async (file) => {
        const content = await file.text();
        return {
          id: `${Date.now()}-${file.name}`,
          name: file.name,
          size: file.size,
          type: file.type,
          content,
        };
      })
    );

    onStartIngestion(ingestionFiles);
  };

  const handleClear = () => {
    setSelectedFiles([]);
    onClearIngestion();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const hasIngestionData = currentIngestion && currentIngestion.files.length > 0;
  const allProvidersReady = currentIngestion && configuredProviders.every(
    p => currentIngestion.providers[p]?.status === 'ready'
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Database className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Data Ingestion</h2>
          {hasIngestionData && (
            <span className={`text-sm px-3 py-1 rounded-full ${
              allProvidersReady
                ? 'bg-green-100 text-green-700'
                : 'bg-blue-100 text-blue-700'
            }`}>
              {currentIngestion.files.length} file(s) {allProvidersReady ? 'ingested' : 'processing'}
            </span>
          )}
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
            {configuredProviders.length === 0 ? (
              <div className="p-4 bg-yellow-50 rounded-lg text-yellow-800 text-sm">
                No providers configured. Add API keys in your .env.local file to enable ingestion.
              </div>
            ) : (
              <>
                {/* File Upload Section */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload Files
                  </label>
                  <div className="flex gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".txt,.pdf,.docx,.doc,.md,.json,.csv"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="file-upload"
                    />
                    <label
                      htmlFor="file-upload"
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                    >
                      <Upload className="w-5 h-5 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        Click to select files or drag and drop
                      </span>
                    </label>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Supported: .txt, .pdf, .docx, .doc, .md, .json, .csv
                  </p>
                </div>

                {/* Selected Files List */}
                {selectedFiles.length > 0 && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Selected Files ({selectedFiles.length})
                    </label>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {selectedFiles.map((file, index) => (
                        <div
                          key={`${file.name}-${index}`}
                          className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-700">{file.name}</span>
                            <span className="text-xs text-gray-500">
                              ({(file.size / 1024).toFixed(1)} KB)
                            </span>
                          </div>
                          <button
                            onClick={() => handleRemoveFile(index)}
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={handleStartIngestion}
                    disabled={selectedFiles.length === 0 || isIngesting}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    {isIngesting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Ingesting...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Ingest into All Providers
                      </>
                    )}
                  </button>
                  
                  {hasIngestionData && (
                    <button
                      onClick={handleClear}
                      disabled={isIngesting}
                      className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Clear & Re-ingest
                    </button>
                  )}
                </div>

                {/* Provider Status Section */}
                {currentIngestion && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Provider Ingestion Status
                    </label>
                    <div className="space-y-2">
                      {configuredProviders.map(providerId => (
                        <ProviderIngestionStatus
                          key={providerId}
                          providerId={providerId}
                          state={currentIngestion.providers[providerId] || { status: 'idle' }}
                        />
                      ))}
                    </div>
                    {currentIngestion.startedAt && (
                      <p className="mt-2 text-xs text-gray-500">
                        Ingestion started: {new Date(currentIngestion.startedAt).toLocaleString()}
                        {currentIngestion.completedAt && (
                          <> • Completed: {new Date(currentIngestion.completedAt).toLocaleString()}</>
                        )}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
