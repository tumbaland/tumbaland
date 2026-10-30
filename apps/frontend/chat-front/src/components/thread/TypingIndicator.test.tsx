import { describe, expect, it } from 'vite-plus/test';
import { render, screen } from '@testing-library/react';
import { TypingIndicator } from './TypingIndicator';

describe('TypingIndicator', () => {
  it('shows nothing when nobody is typing and nothing is answering', () => {
    const { container } = render(<TypingIndicator names={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('names one person, or the first two', () => {
    const { rerender } = render(<TypingIndicator names={['Irja']} />);
    expect(screen.getByText('Irja is typing')).toBeInTheDocument();
    rerender(<TypingIndicator names={['Irja', 'Sam', 'Mari']} />);
    expect(screen.getByText('Irja and Sam are typing')).toBeInTheDocument();
  });

  it('says what an assistant is doing while it works', () => {
    render(<TypingIndicator names={[]} assistants={[{ name: 'Tumbi', activity: 'making a collage' }]} />);
    expect(screen.getByText('Tumbi is making a collage')).toBeInTheDocument();
  });

  it('says "writing" when it has not started on a tool, and lists people and assistants together', () => {
    render(<TypingIndicator names={['Irja']} assistants={[{ name: 'Tumbi' }, { name: 'Bubu', activity: 'planning' }]} />);
    expect(screen.getByText('Irja is typing · Tumbi is writing · Bubu is planning')).toBeInTheDocument();
  });
});
