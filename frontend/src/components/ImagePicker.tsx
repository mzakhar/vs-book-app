import { useRef, useState } from 'react';
import { ImageIcon, X } from 'lucide-react';

interface Props {
  value: string;
  onChange: (dataUrl: string) => void;
  compress: (file: File) => Promise<string>;
  variant?: 'cover' | 'avatar';
  alt: string;
}

export default function ImagePicker({ value, onChange, compress, variant, alt }: Props) {
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasImage = value.trim() !== '';

  const handleFile = async (file: File) => {
    try {
      const dataUrl = await compress(file);
      setError('');
      onChange(dataUrl);
    } catch {
      setError('Could not read image.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) handleFile(file);
        return;
      }
    }
  };

  const handleZoneKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setError('');
    onChange('');
  };

  return (
    <div className="cover-picker">
      <div
        className={`cover-picker__zone${variant === 'avatar' ? ' cover-picker__zone--avatar' : ''}`}
        tabIndex={0}
        role="button"
        aria-label="Choose image"
        onClick={() => fileInputRef.current?.click()}
        onPaste={handlePaste}
        onKeyDown={handleZoneKeyDown}
      >
        {hasImage ? (
          <>
            <img className="cover-picker__img" src={value} alt={alt} onError={() => onChange('')} />
            <button
              type="button"
              className="cover-picker__clear"
              onClick={handleClear}
              title="Remove image"
            >
              <X size={12} />
            </button>
          </>
        ) : (
          <div className="cover-picker__placeholder">
            <ImageIcon size={variant === 'avatar' ? 24 : 28} />
            <span>Tap to choose an image (or Ctrl+V)</span>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      </div>
      <input
        className="form-input cover-picker__url"
        value={/^https?:\/\//i.test(value) ? value : ''}
        onChange={e => onChange(e.target.value)}
        placeholder="…or paste an image URL"
      />
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
