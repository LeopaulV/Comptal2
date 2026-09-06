import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, LoaderCircle } from 'lucide-react';

export interface SuggestItem<T = unknown> {
  id: string;
  value: string;
  label: string;
  hint?: string;
  payload?: T;
}

interface SuggestInputProps<T = unknown> {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (item: SuggestItem<T>) => void;
  suggestions?: Array<SuggestItem<T>>;
  loadSuggestions?: (query: string) => Promise<Array<SuggestItem<T>>>;
  placeholder?: string;
  minQueryLength?: number;
  showAllOnFocus?: boolean;
  emptyLabel?: string;
  typeMoreLabel?: string;
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function SuggestInput<T = unknown>({
  value,
  onChange,
  onSelect,
  suggestions = [],
  loadSuggestions,
  placeholder,
  minQueryLength = 0,
  showAllOnFocus = false,
  emptyLabel,
  typeMoreLabel,
}: SuggestInputProps<T>) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [remote, setRemote] = useState<Array<SuggestItem<T>>>([]);
  const [loading, setLoading] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const updateRect = () => {
    const node = inputRef.current;
    if (node) setRect(node.getBoundingClientRect());
  };

  const filtered = useMemo(() => {
    const source = loadSuggestions ? remote : suggestions;
    const query = normalize(value);
    if (!query) return showAllOnFocus ? source : [];
    return source.filter((item) => {
      const haystack = normalize(`${item.value} ${item.label} ${item.hint ?? ''}`);
      return haystack.includes(query);
    });
  }, [loadSuggestions, remote, suggestions, value, showAllOnFocus]);

  const visible = !loadSuggestions || value.trim().length >= minQueryLength ? filtered : [];

  useEffect(() => {
    if (!open || !loadSuggestions) return;
    if (value.trim().length < minQueryLength) {
      setRemote([]);
      setLoading(false);
      return;
    }
    const current = value;
    setLoading(true);
    const timer = window.setTimeout(() => {
      void loadSuggestions(current)
        .then((items) => {
          if (inputRef.current && inputRef.current.value === current) setRemote(items);
        })
        .finally(() => {
          if (inputRef.current && inputRef.current.value === current) setLoading(false);
        });
    }, 280);
    return () => window.clearTimeout(timer);
  }, [open, value, loadSuggestions, minQueryLength]);

  useEffect(() => {
    if (!open) return;
    updateRect();
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onViewport = () => updateRect();
    document.addEventListener('mousedown', onPointer);
    window.addEventListener('resize', onViewport);
    window.addEventListener('scroll', onViewport, true);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      window.removeEventListener('resize', onViewport);
      window.removeEventListener('scroll', onViewport, true);
    };
  }, [open]);

  useEffect(() => {
    setHighlight(0);
  }, [visible.length, open]);

  const choose = (item: SuggestItem<T>) => {
    onChange(item.value);
    onSelect?.(item);
    setOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setHighlight((index) => Math.min(index + 1, Math.max(visible.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && open && visible[highlight]) {
      event.preventDefault();
      choose(visible[highlight]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="org-suggest" ref={rootRef}>
      <div className="org-suggest-control">
        <input
          ref={inputRef}
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            updateRect();
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          className="org-suggest-toggle"
          tabIndex={-1}
          onMouseDown={(event) => {
            event.preventDefault();
            updateRect();
            setOpen((current) => !current);
            inputRef.current?.focus();
          }}
        >
          {loading ? <LoaderCircle size={14} className="pdf-preview-spinner" /> : <ChevronDown size={15} />}
        </button>
      </div>
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="org-suggest-list"
          style={
            rect
              ? {
                  top: rect.bottom + 4,
                  left: rect.left,
                  width: rect.width,
                }
              : undefined
          }
        >
          {loadSuggestions && value.trim().length < minQueryLength && (
            <li className="org-suggest-empty">{typeMoreLabel}</li>
          )}
          {!loading && visible.length === 0 && (!loadSuggestions || value.trim().length >= minQueryLength) && (
            <li className="org-suggest-empty">{emptyLabel}</li>
          )}
          {visible.map((item, index) => (
            <li key={item.id} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={index === highlight}
                className={index === highlight ? 'is-active' : ''}
                onMouseEnter={() => setHighlight(index)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  choose(item);
                }}
              >
                <strong>{item.label}</strong>
                {item.hint && <small>{item.hint}</small>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default SuggestInput;
