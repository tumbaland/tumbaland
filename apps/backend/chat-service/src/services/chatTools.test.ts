jest.mock('./messageSearch', () => ({ searchMessages: jest.fn() }));
jest.mock('./geocodingService', () => ({ searchPlaces: jest.fn(), placeAt: jest.fn() }));
jest.mock('./liveLocationService', () => ({ listShares: jest.fn(), distanceText: (m: number) => (m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`) }));
jest.mock('./savedPlaceService', () => ({ MAX_SAVED_PLACES: 50, listPlaces: jest.fn(), savePlace: jest.fn() }));

import { placeAt, searchPlaces } from './geocodingService';
import { listShares } from './liveLocationService';
import { searchMessages } from './messageSearch';
import { listPlaces, savePlace } from './savedPlaceService';
import { chatTools } from './chatTools';

const conversation = { _id: { toString: () => 'c1' }, groupId: 'g1' } as never;
const person = { id: 'u1', email: 'tom@example.com', name: 'Tom', groups: ['g1'] } as never;
const tool = (name: string) => chatTools(conversation, person, 'Europe/Tallinn').find((candidate) => candidate.name === name)!;

const message = (body: string, over: Record<string, unknown> = {}) => ({
  senderName: 'Mia',
  botId: null,
  body,
  createdAt: new Date('2026-10-12T15:02:00Z'),
  ...over
});

beforeEach(() => jest.clearAllMocks());

describe('search_chat', () => {
  it('searches only this conversation, and says who wrote each match and when, in the chat’s hours', async () => {
    (searchMessages as jest.Mock).mockResolvedValue([message('Our flight lands at 18:40'), message('flight booked!', { senderName: 'Tumbi', botId: 'b1' })]);
    const text = await tool('search_chat').run({ term: ' flight ' });
    expect(searchMessages).toHaveBeenCalledWith(['c1'], 'flight', 9);
    expect(text).toContain('2 messages mentioning "flight", newest first (Europe/Tallinn time):');
    expect(text).toContain('2026-10-12 18:02 Mia: Our flight lands at 18:40');
    expect(text).toContain('Tumbi (assistant): flight booked!');
  });

  it('leaves out the question being answered, which mentions the word too', async () => {
    (searchMessages as jest.Mock).mockResolvedValue([message('@Tumbi when does the flight land?', { id: 'asked' }), message('Flight lands 18:40', { id: 'm1' })]);
    const text = await chatTools(conversation, person, 'Europe/Tallinn', 'asked')[0]!.run({ term: 'flight' });
    expect(text).not.toContain('when does the flight land');
    expect(text).toContain('1 message mentioning "flight"');
  });

  it('cuts a long message and says when nothing matches', async () => {
    (searchMessages as jest.Mock).mockResolvedValueOnce([message('x'.repeat(1000))]);
    expect((await tool('search_chat').run({ term: 'xx' })).split('\n')[1]!.length).toBeLessThan(360);
    (searchMessages as jest.Mock).mockResolvedValueOnce([]);
    expect(await tool('search_chat').run({ term: 'cats' })).toBe('Nothing in this chat mentions "cats".');
  });

  it('refuses a search that is too short, without searching', async () => {
    expect(await tool('search_chat').run({ term: 'a' })).toMatch(/at least two letters/);
    expect(await tool('search_chat').run({})).toMatch(/at least two letters/);
    expect(searchMessages).not.toHaveBeenCalled();
  });
});

describe('saved_places', () => {
  it('lists the group’s places, or says there are none', async () => {
    (listPlaces as jest.Mock).mockResolvedValueOnce([{ name: 'The cottage', address: 'Käsmu, Estonia', lat: 59.6, lng: 25.9 }]);
    expect(await tool('saved_places').run({})).toBe('Places this group has saved:\nThe cottage, Käsmu, Estonia (59.6000, 25.9000)');
    (listPlaces as jest.Mock).mockResolvedValueOnce([]);
    expect(await tool('saved_places').run({ action: 'list' })).toMatch(/No places have been saved/);
  });

  it('looks a place up and saves it for everyone', async () => {
    (listPlaces as jest.Mock).mockResolvedValue([]);
    (searchPlaces as jest.Mock).mockResolvedValue([{ name: 'Viru väljak 4', detail: 'Kesklinn, Tallinn, Estonia', lat: 59.4372, lng: 24.7536 }]);
    (savePlace as jest.Mock).mockResolvedValue({ name: 'Usual sushi', address: 'Viru väljak 4, Kesklinn, Tallinn, Estonia', lat: 59.4372, lng: 24.7536 });

    const text = await tool('saved_places').run({ action: 'save', name: ' Usual sushi ', where: 'Viru väljak 4, Tallinn' });

    expect(savePlace).toHaveBeenCalledWith(person, conversation, { name: 'Usual sushi', lat: 59.4372, lng: 24.7536, address: 'Viru väljak 4, Kesklinn, Tallinn, Estonia' });
    expect(text).toBe('Saved "Usual sushi": Viru väljak 4, Kesklinn, Tallinn, Estonia.');
  });

  it('asks for what is missing, and does not save a place twice or one it cannot find', async () => {
    expect(await tool('saved_places').run({ action: 'save', name: 'Home' })).toMatch(/both a name and where/);

    (searchPlaces as jest.Mock).mockResolvedValueOnce([]);
    expect(await tool('saved_places').run({ action: 'save', name: 'Home', where: 'Nowhereville' })).toMatch(/Could not find "Nowhereville"/);

    (searchPlaces as jest.Mock).mockResolvedValueOnce([{ name: 'X', detail: '', lat: 1, lng: 1 }]);
    (listPlaces as jest.Mock).mockResolvedValueOnce([{ name: 'home' }]);
    expect(await tool('saved_places').run({ action: 'save', name: 'Home', where: 'X street' })).toMatch(/already saved/);
    expect(savePlace).not.toHaveBeenCalled();
  });
});

describe('where_is', () => {
  const share = (over: Record<string, unknown> = {}) => ({
    name: 'Mia',
    fixed: false,
    pinLabel: null,
    position: { lat: 59.4, lng: 24.7, speed: null, at: new Date(Date.now() - 3 * 60_000) },
    destination: null,
    ...over
  });

  it('says nobody can be found when nobody shares', async () => {
    (listShares as jest.Mock).mockResolvedValue([]);
    expect(await tool('where_is').run({})).toBe('Nobody is sharing their location in this chat right now.');
  });

  it('says where each person was, how long ago, and how far from where they are heading', async () => {
    (placeAt as jest.Mock).mockResolvedValue({ name: 'Viru väljak 4' });
    (listShares as jest.Mock).mockResolvedValue([
      share({ destination: { label: 'Home', distanceM: 3200 }, position: { lat: 59.4, lng: 24.7, speed: 10, at: new Date(Date.now() - 2 * 60_000) } }),
      share({ name: 'Tom', fixed: true, pinLabel: 'The cottage', position: null })
    ]);
    const lines = (await tool('where_is').run({})).split('\n');
    expect(lines[0]).toBe('Mia was near Viru väljak 4 2 min ago, heading to Home, 3.2 km away in a straight line, moving at 36 km/h (so no sooner than 5 min).');
    expect(lines[1]).toBe('Tom pinned The cottage on the map.');
  });

  it('copes with a position that has not arrived, or an address it cannot find', async () => {
    (placeAt as jest.Mock).mockRejectedValue(new Error('down'));
    (listShares as jest.Mock).mockResolvedValue([share(), share({ name: 'Tom', position: null })]);
    const lines = (await tool('where_is').run({})).split('\n');
    expect(lines[0]).toBe('Mia was at a spot on the map 3 min ago.');
    expect(lines[1]).toMatch(/has not arrived yet/);
  });
});
