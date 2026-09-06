import React, { useCallback, useState } from 'react';
import { Upload, FileText, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface FileDropzoneProps {
  onFiles: (files: File[]) => void;
}

const ACCEPTED = '.csv,.xlsx,.xls';

const FileDropzone: React.FC<FileDropzoneProps> = ({ onFiles }) => {
  const { t } = useTranslation();
  const [over, setOver] = useState(false);
  const [selected, setSelected] = useState<File[]>([]);

  const handleFiles = useCallback(
    (list: FileList | null) => {
      if (!list || list.length === 0) return;
      const files = Array.from(list).filter((f) => {
        const n = f.name.toLowerCase();
        return n.endsWith('.csv') || n.endsWith('.xlsx') || n.endsWith('.xls');
      });
      if (files.length === 0) return;
      setSelected(files);
      onFiles(files);
    },
    [onFiles]
  );

  return (
    <div className="space-y-3">
      <label
        data-tour="onb-upload-dropzone"
        className={`upload-dropzone block ${over ? 'is-dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        <Upload size={40} className="mx-auto mb-3" style={{ color: 'var(--invoicing-primary)' }} />
        <p className="font-medium text-base" style={{ color: 'var(--invoicing-gray-800)' }}>
          {t('upload.dropHint')}
        </p>
        <p className="ct-hint m-0 mt-2">{t('upload.dropTypes')}</p>
        <input
          type="file"
          accept={ACCEPTED}
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </label>
      {selected.length > 0 && (
        <ul className="space-y-2">
          {selected.map((file, i) => (
            <li
              key={`${file.name}-${i}`}
              className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg"
              style={{
                backgroundColor: 'var(--invoicing-gray-100)',
                color: 'var(--invoicing-gray-700)',
              }}
            >
              <FileText size={16} />
              <span className="flex-1 truncate">{file.name}</span>
              <span className="text-xs opacity-70">{(file.size / 1024).toFixed(1)} KB</span>
              <button
                type="button"
                className="ct-btn-icon"
                onClick={() => {
                  const next = selected.filter((_, idx) => idx !== i);
                  setSelected(next);
                  onFiles(next);
                }}
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default FileDropzone;
