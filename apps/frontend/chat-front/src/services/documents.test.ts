import { describe, expect, it } from 'vite-plus/test';
import { documentMimetype, extensionLabel, formatSize, isDocumentType } from './documents';

describe('documentMimetype', () => {
  it('keeps the browser type when it is a document', () => {
    expect(documentMimetype({ name: 'a.pdf', type: 'application/pdf' })).toBe('application/pdf');
  });

  it('falls back to the extension, whatever its case', () => {
    expect(documentMimetype({ name: 'Budget.XLSX', type: '' })).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
  });

  it('refuses anything else', () => {
    expect(documentMimetype({ name: 'tool.exe', type: 'application/x-msdownload' })).toBeNull();
    expect(isDocumentType('image/jpeg')).toBe(false);
  });
});

describe('labels', () => {
  it('formats sizes', () => {
    expect(formatSize(500)).toBe('500 B');
    expect(formatSize(2048)).toBe('2 KB');
    expect(formatSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
  });

  it('labels a document by its extension, or its type when the name has none', () => {
    expect(extensionLabel('letter.docx', 'x')).toBe('DOCX');
    expect(extensionLabel(null, 'application/pdf')).toBe('PDF');
  });
});
