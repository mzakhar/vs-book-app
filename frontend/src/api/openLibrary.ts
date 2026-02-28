export interface OLSearchResult {
  key: string;
  title: string;
  author_name?: string[];
  cover_i?: number;
  series?: string[];
  series_number?: string[];
  number_of_pages_median?: number;
  first_sentence?: { value: string } | string;
}

export interface OLAutoFill {
  title: string;
  author: string;
  cover_url: string;
  page_count: string;
  description: string;
  series_name: string;
  series_position: string;
}

export function getCoverUrl(coverId: number): string {
  return `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`;
}

export async function searchOpenLibrary(query: string): Promise<OLSearchResult[]> {
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=7&fields=key,title,author_name,cover_i,series,series_number,number_of_pages_median,first_sentence`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('OL search failed');
  const data = await res.json();
  return data.docs ?? [];
}

export async function fetchWorkDetails(key: string): Promise<any> {
  // key is like "/works/OL12345W"
  const workKey = key.startsWith('/works/') ? key : `/works/${key}`;
  const res = await fetch(`https://openlibrary.org${workKey}.json`);
  if (!res.ok) return null;
  return res.json();
}

export function normalizeAutoFill(result: OLSearchResult, workDetails?: any): OLAutoFill {
  const title = result.title ?? '';
  const author = result.author_name?.[0] ?? '';
  const cover_url = result.cover_i ? getCoverUrl(result.cover_i) : '';
  const page_count = result.number_of_pages_median ? String(result.number_of_pages_median) : '';
  const series_name = result.series?.[0] ?? '';
  const series_position = result.series_number?.[0] ?? '';

  let description = '';
  if (workDetails?.description) {
    if (typeof workDetails.description === 'string') {
      description = workDetails.description;
    } else if (typeof workDetails.description?.value === 'string') {
      description = workDetails.description.value;
    }
  } else if (result.first_sentence) {
    if (typeof result.first_sentence === 'string') {
      description = result.first_sentence;
    } else if (typeof (result.first_sentence as any).value === 'string') {
      description = (result.first_sentence as any).value;
    }
  }

  return { title, author, cover_url, page_count, description, series_name, series_position };
}
