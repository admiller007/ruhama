import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchBar } from '../SearchBar';

describe('SearchBar', () => {
  it('renders an input reflecting the current query value', () => {
    render(<SearchBar query="pasta" onChange={() => {}} onClear={() => {}} />);
    expect(screen.getByRole('searchbox')).toHaveValue('pasta');
  });

  it('does not show clear button when query is empty', () => {
    render(<SearchBar query="" onChange={() => {}} onClear={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();
  });

  it('does not show clear button when query is only whitespace', () => {
    render(<SearchBar query="   " onChange={() => {}} onClear={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();
  });

  it('shows clear button when query has non-whitespace content', () => {
    render(<SearchBar query="chicken" onChange={() => {}} onClear={() => {}} />);
    expect(screen.getByRole('button', { name: 'Clear search' })).toBeInTheDocument();
  });

  it('calls onClear when the clear button is clicked', async () => {
    const onClear = vi.fn();
    render(<SearchBar query="chicken" onChange={() => {}} onClear={onClear} />);
    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('calls onChange with the new value when the user types', async () => {
    const onChange = vi.fn();
    render(<SearchBar query="" onChange={onChange} onClear={() => {}} />);
    await userEvent.type(screen.getByRole('searchbox'), 'a');
    expect(onChange).toHaveBeenCalledWith('a');
  });
});
