const reportCollageActivity = jest.fn(async () => undefined);
jest.mock('../services/chatClient', () => ({
  reportCollageActivity: (...args: unknown[]) => reportCollageActivity(...(args as []))
}));

import { NUDGE_INTERVAL_MS, clearNudges, noteLeft, nudgeChat } from './chatCollage';

const COLLAGE = { id: 'k1', title: 'Rome', conversationId: 'c1' };
const TOM = { id: 'u-tom', name: 'Tom' };

afterEach(() => {
  clearNudges();
  reportCollageActivity.mockClear();
});

describe('nudgeChat', () => {
  it('nudges once for a session of work, and again after being away for the interval', () => {
    nudgeChat(COLLAGE, TOM, ['u-tom'], 0);
    nudgeChat(COLLAGE, TOM, ['u-tom'], 1000);
    noteLeft(COLLAGE, TOM.id, 2000);
    nudgeChat(COLLAGE, TOM, ['u-tom'], 2000 + NUDGE_INTERVAL_MS - 1);
    expect(reportCollageActivity).toHaveBeenCalledTimes(1);

    noteLeft(COLLAGE, TOM.id, 3000 + NUDGE_INTERVAL_MS);
    nudgeChat(COLLAGE, TOM, ['u-tom'], 3000 + 2 * NUDGE_INTERVAL_MS);
    expect(reportCollageActivity).toHaveBeenCalledTimes(2);
  });

  it('does not nudge again for a stream recycled or a tab come back after a long session', () => {
    const hour = 60 * 60 * 1000;
    nudgeChat(COLLAGE, TOM, ['u-tom'], 0);
    // Still editing an hour later: the stream closed and reopened on its own.
    noteLeft(COLLAGE, TOM.id, hour);
    nudgeChat(COLLAGE, TOM, ['u-tom'], hour + 1000);

    expect(reportCollageActivity).toHaveBeenCalledTimes(1);
  });

  it('does not nudge again when a second tab opens during a long session', () => {
    nudgeChat(COLLAGE, TOM, ['u-tom'], 0);
    nudgeChat(COLLAGE, TOM, ['u-tom', 'u-tom'], NUDGE_INTERVAL_MS + 1);
    expect(reportCollageActivity).toHaveBeenCalledTimes(1);
  });

  it('counts each collage and each person separately', () => {
    nudgeChat(COLLAGE, TOM, ['u-tom'], 0);
    nudgeChat({ ...COLLAGE, id: 'k2' }, TOM, ['u-tom'], 0);
    nudgeChat(COLLAGE, { id: 'u-irja', name: 'Irja' }, ['u-irja'], 0);

    expect(reportCollageActivity).toHaveBeenCalledTimes(3);
  });

  it('stays quiet for a collage with no chat behind it', () => {
    nudgeChat({ id: 'k1', title: 'Rome' }, TOM, ['u-tom'], 0);

    expect(reportCollageActivity).not.toHaveBeenCalled();
  });
});
