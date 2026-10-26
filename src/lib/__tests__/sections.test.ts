import { isSectionHeading, sectionHeadingText } from '../sections';

describe('section headings', () => {
  it('treats a short label ending in a dash or colon as a heading', () => {
    expect(isSectionHeading('Frying-')).toBe(true);
    expect(isSectionHeading('Dressing-')).toBe(true);
    expect(isSectionHeading('Method-')).toBe(true);
    expect(isSectionHeading('For the sauce:')).toBe(true);
    expect(isSectionHeading('Avocado tahini Dressing:')).toBe(true);
    expect(sectionHeadingText('Frying-')).toBe('Frying');
    expect(sectionHeadingText('For the sauce:')).toBe('For the sauce');
  });

  it('leaves real steps and ingredient lines alone', () => {
    expect(isSectionHeading('Meanwhile, make the raspberry syrup:')).toBe(false);
    expect(isSectionHeading('In a pan on a low medium heat, pour 3/4 cup of vegetable oil')).toBe(false);
    expect(isSectionHeading('2 pounds of thin chicken cutlets')).toBe(false);
    expect(isSectionHeading('Mix all the ingredients in a bowl')).toBe(false);
  });
});