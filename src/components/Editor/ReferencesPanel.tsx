import React from 'react';
import { X, FileText, ArrowRight } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface Reference {
  filePath: string;
  fileName: string;
  line: number;
  column: number;
  preview: string;
}

interface ReferencesPanelProps {
  references: Reference[];
  onClose: () => void;
  onNavigate: (filePath: string, line: number, column: number) => void;
  symbolName: string;
}

const ReferencesPanel: React.FC<ReferencesPanelProps> = ({
  references,
  onClose,
  onNavigate,
  symbolName,
}) => {
  return (
    <div className="absolute inset-y-0 right-0 w-96 bg-white dark:bg-gray-800 border-l dark:border-gray-700 shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            References: {symbolName}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {references.length} {references.length === 1 ? 'reference' : 'references'}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* References List */}
      <div className="flex-1 overflow-y-auto">
        {references.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <p className="text-sm">No references found</p>
          </div>
        ) : (
          <div className="divide-y dark:divide-gray-700">
            {references.map((ref, index) => (
              <button
                key={index}
                onClick={() => onNavigate(ref.filePath, ref.line, ref.column)}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <FileText className="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {ref.fileName}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {ref.line}:{ref.column}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 font-mono truncate">
                      {ref.preview}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReferencesPanel;

