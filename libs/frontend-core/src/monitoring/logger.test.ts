import { logger } from './logger';
import { captureException, captureMessage } from './errors';

vi.mock('./errors', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn()
}));

const mockedCaptureException = vi.mocked(captureException);
const mockedCaptureMessage = vi.mocked(captureMessage);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('logger', () => {
  it('debug/info/warn forward to captureMessage at the matching level', () => {
    logger.debug('a debug message', { foo: 1 });
    logger.info('an info message');
    logger.warn('a warn message', { foo: 2 });

    expect(mockedCaptureMessage).toHaveBeenNthCalledWith(1, 'a debug message', 'debug', { foo: 1 });
    expect(mockedCaptureMessage).toHaveBeenNthCalledWith(2, 'an info message', 'info', undefined);
    expect(mockedCaptureMessage).toHaveBeenNthCalledWith(3, 'a warn message', 'warn', { foo: 2 });
  });

  it('error() routes an Error instance through captureException with the message folded into context', () => {
    const err = new Error('boom');

    logger.error('operation failed', err, { userId: 'u1' });

    expect(mockedCaptureException).toHaveBeenCalledWith(err, { message: 'operation failed', userId: 'u1' });
    expect(mockedCaptureMessage).not.toHaveBeenCalled();
  });

  it('error() with a non-Error value falls back to captureMessage at error level', () => {
    logger.error('operation failed', 'some string reason');

    expect(mockedCaptureMessage).toHaveBeenCalledWith('operation failed', 'error', { error: 'some string reason' });
    expect(mockedCaptureException).not.toHaveBeenCalled();
  });

  it('error() with no second argument still reports via captureMessage', () => {
    logger.error('just a message');

    expect(mockedCaptureMessage).toHaveBeenCalledWith('just a message', 'error', undefined);
  });
});
