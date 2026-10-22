import { describe, expect, it, vi } from 'vite-plus/test';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const download = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('./Lightbox', () => ({ downloadAttachment: download }));

import { DocumentCard } from './DocumentCard';

describe('DocumentCard', () => {
  it('shows the document by name, type and size, and saves it on a tap', async () => {
    const attachment = { fileId: 'f', mimetype: 'application/pdf', name: 'plan.pdf', sizeBytes: 2_400_000, url: 'https://f.test/plan.pdf' };
    render(<DocumentCard attachment={attachment} />);

    expect(screen.getByText('plan.pdf')).toBeInTheDocument();
    expect(screen.getByText('PDF')).toBeInTheDocument();
    expect(screen.getByText('2.3 MB')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Download plan.pdf' }));
    expect(download).toHaveBeenCalledWith(attachment);
  });

  it('says a document without a link is not available', () => {
    render(<DocumentCard attachment={{ fileId: 'f', mimetype: 'application/pdf', sizeBytes: 1, url: null }} />);
    expect(screen.getByText('Not available')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download Document' })).toBeDisabled();
  });
});
