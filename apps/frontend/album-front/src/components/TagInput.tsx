import React, { useMemo, useState } from 'react';
import { Autocomplete, Chip, TextField } from '@mui/material';
import { TagCount } from '../types';

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  /** Album vocabulary offered as suggestions, most used first. */
  suggestions?: TagCount[];
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  size?: 'small' | 'medium';
  helperText?: string;
}

/**
 * Tags are stored lowercase (see the album service's `normalizeTags`), so the
 * client folds them the same way. Doing it here rather than only on the server
 * means the chip the user just added matches the suggestion list right away.
 */
export const normalizeTag = (tag: string): string => tag.trim().toLowerCase();

export const normalizeTagList = (tags: string[]): string[] => {
  const seen = new Set<string>();
  for (const tag of tags) {
    const normalized = normalizeTag(tag);
    if (normalized) seen.add(normalized);
  }
  return Array.from(seen);
};

/**
 * Free-text tag entry with suggestions from the album's existing tags.
 * Enter or comma commits a tag; backspace on an empty field removes the last.
 */
const TagInput: React.FC<TagInputProps> = ({
  value,
  onChange,
  suggestions = [],
  label = 'Tags',
  placeholder = 'Add a tag…',
  disabled = false,
  autoFocus = false,
  size = 'medium',
  helperText
}) => {
  const [inputValue, setInputValue] = useState('');
  const options = useMemo(() => suggestions.map((s) => s.tag), [suggestions]);
  const countByTag = useMemo(
    () => new Map(suggestions.map((s) => [s.tag, s.count])),
    [suggestions]
  );

  return (
    <Autocomplete
      multiple
      freeSolo
      disableCloseOnSelect
      size={size}
      options={options}
      value={value}
      disabled={disabled}
      inputValue={inputValue}
      onInputChange={(_event, next) => setInputValue(next)}
      onChange={(_event, next) => {
        onChange(normalizeTagList(next as string[]));
        setInputValue('');
      }}
      renderValue={(tags, getItemProps) =>
        tags.map((tag, index) => {
          const { key, ...chipProps } = getItemProps({ index });
          return <Chip key={key} label={tag} size="small" {...chipProps} sx={{ borderRadius: 1.5 }} />;
        })
      }
      renderOption={(props, option) => {
        const { key, ...liProps } = props as React.HTMLAttributes<HTMLLIElement> & { key: string };
        const count = countByTag.get(option);
        return (
          <li key={key} {...liProps}>
            {option}
            {count !== undefined && (
              <span style={{ marginLeft: 'auto', opacity: 0.5, fontSize: '0.8em' }}>{count}</span>
            )}
          </li>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={value.length === 0 ? placeholder : ''}
          autoFocus={autoFocus}
          helperText={helperText}
          onKeyDown={(event) => {
            // Comma commits the pending tag the way Enter does — people type
            // "beach, sunset, 2024" without thinking about it.
            if (event.key === ',') {
              event.preventDefault();
              const pending = normalizeTag(inputValue);
              if (pending) {
                onChange(normalizeTagList([...value, pending]));
                setInputValue('');
              }
            }
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
              backgroundColor: 'rgba(255, 255, 255, 0.5)',
              '& fieldset': { borderColor: 'rgba(0, 0, 0, 0.1)' },
              '&:hover fieldset': { borderColor: 'rgba(99, 102, 241, 0.5)' },
              '&.Mui-focused fieldset': { borderColor: '#6366f1' }
            }
          }}
        />
      )}
    />
  );
};

export default TagInput;
