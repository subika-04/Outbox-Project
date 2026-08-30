import { useRef, useState, DragEvent } from 'react';
import { UploadCloud, FileText, X, AlertCircle } from 'lucide-react';
import { parseRecipientsFromText, readFileAsText, ParsedRecipients } from '../utils/parseRecipients';

interface FileUploaderProps {
  onParsed: (result: ParsedRecipients, fileName: string | null) => void;
}

export const FileUploader = ({ onParsed }: FileUploaderProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setReadError(null);
    const isCsvOrTxt = /\.(csv|txt)$/i.test(file.name);
    if (!isCsvOrTxt) {
      setReadError('Please upload a .csv or .txt file.');
      return;
    }
    try {
      const text = await readFileAsText(file);
      const result = parseRecipientsFromText(text);
      setFileName(file.name);
      onParsed(result, file.name);
    } catch {
      setReadError('Could not read that file. Try again.');
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const clear = () => {
    setFileName(null);
    setReadError(null);
    if (inputRef.current) inputRef.current.value = '';
    onParsed({ valid: [], invalid: [] }, null);
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center cursor-pointer transition-colors ${
          dragOver ? 'border-brand-400 bg-brand-50' : 'border-line hover:border-brand-300 hover:bg-paper'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.txt,text/csv,text/plain"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        {fileName ? (
          <div className="flex items-center gap-2 text-sm text-ink">
            <FileText className="w-4 h-4 text-brand-500" />
            <span className="font-mono">{fileName}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                clear();
              }}
              className="text-ink-faint hover:text-manifest-failed focus-ring rounded"
              aria-label="Remove file"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <>
            <UploadCloud className="w-6 h-6 text-ink-faint" />
            <p className="text-sm text-ink-soft">
              Drop a CSV or TXT file, or <span className="text-brand-500 font-medium">browse</span>
            </p>
            <p className="text-xs text-ink-faint">One recipient per line, or comma-separated</p>
          </>
        )}
      </div>
      {readError && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-manifest-failed">
          <AlertCircle className="w-3.5 h-3.5" /> {readError}
        </p>
      )}
    </div>
  );
};
