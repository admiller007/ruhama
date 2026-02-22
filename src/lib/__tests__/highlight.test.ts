import { splitHighlightSegments } from '../highlight';

describe('splitHighlightSegments', () => {
  it('returns unmatched text when query is blank', () => {
    expect(splitHighlightSegments('Apple Pie', '   ')).toEqual([
      { text: 'Apple Pie', isMatch: false }
    ]);
  });

  it('splits and marks case-insensitive matches', () => {
    expect(splitHighlightSegments('Chickpea Rice', 'chick')).toEqual([
      { text: 'Chick', isMatch: true },
      { text: 'pea Rice', isMatch: false }
    ]);
  });

  it('escapes regex metacharacters in the query', () => {
    expect(splitHighlightSegments('a+b sugar', 'a+b')).toEqual([
      { text: 'a+b', isMatch: true },
      { text: ' sugar', isMatch: false }
    ]);
  });

  it('returns empty array when text is empty', () => {
    expect(splitHighlightSegments('', 'apple')).toEqual([]);
  });

  it('returns single unmatched segment when query is not found in text', () => {
    expect(splitHighlightSegments('Apple Pie', 'banana')).toEqual([
      { text: 'Apple Pie', isMatch: false }
    ]);
  });

  it('marks multiple non-overlapping matches in a single string', () => {
    expect(splitHighlightSegments('apple and apple', 'apple')).toEqual([
      { text: 'apple', isMatch: true },
      { text: ' and ', isMatch: false },
      { text: 'apple', isMatch: true }
    ]);
  });
});
