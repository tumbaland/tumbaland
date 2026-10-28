/**
 * Documents chat accepts, beside photos and videos. Mirrors chat-service's
 * ALLOWED_DOCUMENT_TYPES; the server is the one that enforces it.
 */

const BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  odp: 'application/vnd.oasis.opendocument.presentation',
  rtf: 'application/rtf',
  txt: 'text/plain',
  csv: 'text/csv'
};

const DOCUMENT_TYPES = new Set(Object.values(BY_EXTENSION));

/** What the picker offers: extensions as well as types, because Linux and Android often report no type for .odt or .csv. */
export const DOCUMENT_ACCEPT = [...Object.keys(BY_EXTENSION).map((extension) => `.${extension}`), ...DOCUMENT_TYPES].join(',');

export const isDocumentType = (mimetype: string | undefined | null): boolean =>
  Boolean(mimetype) && DOCUMENT_TYPES.has(mimetype!);

/**
 * The type to upload a file as, or null when it is not a document chat takes.
 * The browser's own type wins; the extension covers a file it left blank.
 */
export function documentMimetype(file: Pick<File, 'name' | 'type'>): string | null {
  if (isDocumentType(file.type)) return file.type;
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return BY_EXTENSION[extension] ?? null;
}

/** "PDF", "DOCX": the short label for a document's tile. */
export function extensionLabel(name: string | null | undefined, mimetype: string): string {
  const fromName = name?.includes('.') ? name.split('.').pop() : undefined;
  if (fromName && fromName.length <= 5) return fromName.toUpperCase();
  const known = Object.entries(BY_EXTENSION).find(([, type]) => type === mimetype)?.[0];
  return (known ?? 'FILE').toUpperCase();
}
