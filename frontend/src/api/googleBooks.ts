import type { OLAutoFill } from './openLibrary';

// Fallback for the Open Library miss. Google Books has no series data, so those two fields
// are always left empty — the user fills them in during review, not a guessed heuristic.
export async function lookupIsbnGoogleBooks(isbn: string): Promise<OLAutoFill | null> {
  try {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.totalItems || !data.items?.length) return null;

    const info = data.items[0].volumeInfo ?? {};
    const thumbnail: string = info.imageLinks?.thumbnail ?? '';

    return {
      title: info.title ?? '',
      author: info.authors?.[0] ?? '',
      cover_url: thumbnail.replace(/^http:\/\//, 'https://'),
      page_count: info.pageCount ? String(info.pageCount) : '',
      description: info.description ?? '',
      series_name: '',
      series_position: '',
      genre: info.categories?.join(', ') ?? ''
    };
  } catch {
    return null;
  }
}
