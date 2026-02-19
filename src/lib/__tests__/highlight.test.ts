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
});
