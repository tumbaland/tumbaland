import { findMentions } from './mentions';

const bots = [{ name: 'Tumbi' }, { name: 'Bubu' }, { name: 'Mia' }, { name: 'Mia Bot' }];
const names = (body: string) => findMentions(body, bots).bots.map((entry) => entry.bot.name);

describe('findMentions', () => {
  it('finds a bot named with an @, in any case', () => {
    expect(names('@Tumbi where should we eat?')).toEqual(['Tumbi']);
    expect(names('hey @tumbi')).toEqual(['Tumbi']);
  });

  it('finds several, in the order they were written', () => {
    expect(names('@Bubu and @Tumbi, settle this')).toEqual(['Bubu', 'Tumbi']);
  });

  it('ignores a name with no @, and a name that only starts like one', () => {
    expect(names('Tumbi is great')).toEqual([]);
    expect(names('@Tumbiii')).toEqual([]);
    expect(names('mail me@Tumbi')).toEqual([]);
  });

  it('accepts punctuation after the name', () => {
    expect(names('@Tumbi, hello')).toEqual(['Tumbi']);
    expect(names("what would @Tumbi's plan be?")).toEqual(['Tumbi']);
    expect(names('(@Bubu)')).toEqual(['Bubu']);
  });

  it('matches a longer name first, so "@Mia Bot" does not also wake Mia', () => {
    expect(names('@Mia Bot help')).toEqual(['Mia Bot']);
    expect(names('@Mia help')).toEqual(['Mia']);
    expect(names('@Mia and @Mia Bot')).toEqual(['Mia', 'Mia Bot']);
  });

  it('wakes a bot once however many times it is named', () => {
    expect(names('@Tumbi @Tumbi @tumbi')).toEqual(['Tumbi']);
  });

  it('handles names with letters beyond ASCII', () => {
    expect(findMentions('@Mõmmi tere', [{ name: 'Mõmmi' }]).bots).toHaveLength(1);
    expect(findMentions('@Mõmmiii', [{ name: 'Mõmmi' }]).bots).toHaveLength(0);
  });

  it('does not take regex characters in a name as syntax', () => {
    expect(findMentions('@a+b hi', [{ name: 'a+b' }]).bots).toHaveLength(1);
    expect(findMentions('@aab hi', [{ name: 'a+b' }]).bots).toHaveLength(0);
  });

  it('notes @Claude without treating it as a bot', () => {
    expect(findMentions('@Claude help', bots)).toMatchObject({ bots: [], claude: true });
    expect(findMentions('@Claudette help', bots).claude).toBe(false);
    expect(findMentions('hello', bots).claude).toBe(false);
  });
});
