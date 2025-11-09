import React from 'react';

interface PoetryPanelProps {
  pathName: string;
  distance: string;
  threeWords: string[];
  poem: string | null;
  poemTitle: string | null;
  isGenerating: boolean;
  onGeneratePoem: () => void;
  onClose: () => void;
}

export function PoetryPanel({
  pathName,
  distance,
  threeWords,
  poem,
  poemTitle,
  isGenerating,
  onGeneratePoem,
  onClose
}: PoetryPanelProps) {
  const handleCopyPoem = () => {
    if (poem) {
      const textToCopy = poemTitle ? `${poemTitle}\n\n${poem}` : poem;
      navigator.clipboard.writeText(textToCopy);
    }
  };

  return (
    <div
      className="position-absolute bg-white rounded shadow"
      style={{
        bottom: '20px',
        right: '20px',
        width: '400px',
        maxHeight: 'calc(100vh - 40px)',
        overflowY: 'auto',
        zIndex: 1002
      }}
    >
      <div className="p-3">
        {/* Header */}
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h6 className="mb-0">🎭 Route Poetry</h6>
          <button
            className="btn btn-sm btn-light"
            onClick={onClose}
            style={{ padding: '2px 8px' }}
          >
            ×
          </button>
        </div>

        {/* Route Info */}
        <div className="mb-3">
          <small className="text-muted">
            {pathName} • {distance}
          </small>
        </div>

        {/* Three Words Chips */}
        {threeWords.length > 0 && (
          <div className="mb-3">
            <small className="text-muted d-block mb-2">Location markers:</small>
            <div className="d-flex flex-wrap gap-1">
              {threeWords.map((words, index) => (
                <span
                  key={index}
                  className="badge bg-light text-dark"
                  style={{
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    border: '1px solid #dee2e6',
                    padding: '4px 8px'
                  }}
                >
                  {words}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Poem Display */}
        {poem ? (
          <div className="mb-3">
            <div
              className="p-3 rounded"
              style={{
                backgroundColor: '#f8f9fa',
                border: '1px solid #dee2e6'
              }}
            >
              {poemTitle && (
                <h6 className="mb-3 text-center" style={{ fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>
                  {poemTitle}
                </h6>
              )}
              <div style={{
                whiteSpace: 'pre-line',
                fontSize: '14px',
                lineHeight: '1.8',
                fontFamily: 'Georgia, serif'
              }}>
                {poem}
              </div>
            </div>
          </div>
        ) : threeWords.length > 0 ? (
          <div className="mb-3 text-center py-4">
            <small className="text-muted">
              Generate a poem to capture the essence of this journey
            </small>
          </div>
        ) : (
          <div className="mb-3 text-center py-4">
            <small className="text-muted">
              Loading location markers...
            </small>
          </div>
        )}

        {/* Action Buttons */}
        <div className="d-flex gap-2">
          <button
            className="btn btn-primary btn-sm flex-grow-1"
            onClick={onGeneratePoem}
            disabled={isGenerating || threeWords.length === 0}
          >
            {isGenerating ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" />
                Generating...
              </>
            ) : poem ? (
              'Regenerate Poem'
            ) : (
              'Generate Poem'
            )}
          </button>
          {poem && (
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={handleCopyPoem}
              title="Copy to clipboard"
            >
              📋
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
