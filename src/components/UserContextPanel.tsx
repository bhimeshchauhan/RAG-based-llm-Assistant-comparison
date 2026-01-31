/**
 * =============================================================================
 * User Context Panel Component
 * =============================================================================
 * Editable panel for user context / personalization fields
 * Persists to localStorage for session persistence
 * =============================================================================
 */

import React from 'react';
import { User, ChevronDown, ChevronRight, Save } from 'lucide-react';
import type { UserContext } from '../types';

interface UserContextPanelProps {
  userContext: UserContext;
  onUpdate: (context: UserContext) => void;
}

export function UserContextPanel({ userContext, onUpdate }: UserContextPanelProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [localContext, setLocalContext] = React.useState<UserContext>(userContext);
  const [hasChanges, setHasChanges] = React.useState(false);

  // Sync local state when prop changes
  React.useEffect(() => {
    setLocalContext(userContext);
    setHasChanges(false);
  }, [userContext]);

  const handleFieldChange = (field: keyof UserContext, value: string) => {
    const newContext = { ...localContext, [field]: value || undefined };
    setLocalContext(newContext);
    setHasChanges(true);
  };

  const handleSave = () => {
    onUpdate(localContext);
    setHasChanges(false);
  };

  const filledFields = Object.values(userContext).filter(Boolean).length;
  const totalFields = 5;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <User className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">User Context</h2>
          <span className={`text-sm px-3 py-1 rounded-full ${
            filledFields === totalFields
              ? 'bg-green-100 text-green-700'
              : filledFields > 0
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-gray-100 text-gray-600'
          }`}>
            {filledFields}/{totalFields} fields
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
            <p className="text-sm text-gray-600 mb-4">
              This context is passed to all providers for personalization. Fill in what's relevant.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Caregiver Name
                </label>
                <input
                  type="text"
                  value={localContext.caregiver_name || ''}
                  onChange={(e) => handleFieldChange('caregiver_name', e.target.value)}
                  placeholder="Your name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Loved One's Name
                </label>
                <input
                  type="text"
                  value={localContext.loved_one_name || ''}
                  onChange={(e) => handleFieldChange('loved_one_name', e.target.value)}
                  placeholder="Name of person you're caring for"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Diagnosis
                </label>
                <input
                  type="text"
                  value={localContext.diagnosis || ''}
                  onChange={(e) => handleFieldChange('diagnosis', e.target.value)}
                  placeholder="e.g., Alzheimer's, Parkinson's"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Relationship
                </label>
                <select
                  value={localContext.relationship || ''}
                  onChange={(e) => handleFieldChange('relationship', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select relationship...</option>
                  <option value="spouse">Spouse/Partner</option>
                  <option value="child">Adult Child</option>
                  <option value="parent">Parent</option>
                  <option value="sibling">Sibling</option>
                  <option value="friend">Friend</option>
                  <option value="professional">Professional Caregiver</option>
                  <option value="other">Other</option>
                </select>
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Care Stage
                </label>
                <select
                  value={localContext.care_stage || ''}
                  onChange={(e) => handleFieldChange('care_stage', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select stage...</option>
                  <option value="early">Early Stage - Recently diagnosed</option>
                  <option value="middle">Middle Stage - Increasing support needed</option>
                  <option value="late">Late Stage - Full-time care required</option>
                  <option value="end-of-life">End of Life Care</option>
                  <option value="post-care">Post-Care / Bereavement</option>
                </select>
              </div>
            </div>

            {hasChanges && (
              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleSave}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  Save Context
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
