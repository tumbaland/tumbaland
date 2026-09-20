import { render, screen } from '@testing-library/react';
import { AppErrorBoundary } from './AppErrorBoundary';

const { captureExceptionMock } = vi.hoisted(() => ({
  captureExceptionMock: vi.fn()
}));

vi.mock('../../monitoring', () => ({
  captureException: captureExceptionMock
}));

function Bomb(): never {
  throw new Error('boom');
}

beforeEach(() => {
  captureExceptionMock.mockClear();
});

describe('AppErrorBoundary', () => {
  it('renders children when nothing throws', () => {
    render(
      <AppErrorBoundary>
        <div>all good</div>
      </AppErrorBoundary>
    );

    expect(screen.getByText('all good')).toBeInTheDocument();
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it('renders the fallback ErrorPage and reports via captureException when a child throws', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <AppErrorBoundary component="test-app">
        <Bomb />
      </AppErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText(/an unexpected error occurred/i)).toBeInTheDocument();
    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    const [error, context, options] = captureExceptionMock.mock.calls[0];
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('boom');
    expect(context).toEqual(expect.objectContaining({ componentStack: expect.any(String) }));
    expect(options).toEqual({ component: 'test-app' });

    consoleErrorSpy.mockRestore();
  });

  it('supports custom fallback title and message', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <AppErrorBoundary title="Custom title" message="Custom message">
        <Bomb />
      </AppErrorBoundary>
    );

    expect(screen.getByText('Custom title')).toBeInTheDocument();
    expect(screen.getByText('Custom message')).toBeInTheDocument();

    consoleErrorSpy.mockRestore();
  });
});
