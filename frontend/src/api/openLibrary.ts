export interface OLSearchResult {
  key: string;
  title: string;
  author_name?: string[];
  cover_i?: number;
  series?: string[];
  series_number?: string[];
  subject?: string[];
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
  genre: string;
}

export function getCoverUrl(coverId: number): string {
  return `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`;
}

export async function searchOpenLibrary(query: string): Promise<OLSearchResult[]> {
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=7&fields=key,title,author_name,cover_i,series,series_number,subject,number_of_pages_median,first_sentence`;
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

export async function fetchEditions(workKey: string): Promise<any[]> {
  const key = workKey.startsWith('/works/') ? workKey : `/works/${workKey}`;
  const res = await fetch(`https://openlibrary.org${key}/editions.json?limit=5`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.entries ?? [];
}

export function normalizeAutoFill(result: OLSearchResult, workDetails?: any, editions: any[] = []): OLAutoFill {
  const title = result.title ?? '';
  const author = result.author_name?.[0] ?? '';
  const cover_url = result.cover_i ? getCoverUrl(result.cover_i) : '';
  const page_count = result.number_of_pages_median ? String(result.number_of_pages_median) : '';
  
  let series_name = result.series?.[0] ?? '';
  let series_position = result.series_number?.[0] ?? '';

  const subjects = result.subject || workDetails?.subjects || [];
  const desc = workDetails?.description?.value || workDetails?.description || '';

  // 1. Check editions for series info (often more specific than work)
  if (!series_name || !series_position) {
    for (const ed of editions) {
      if (ed.series) {
        const edSeries = Array.isArray(ed.series) ? ed.series[0] : ed.series;
        if (edSeries && typeof edSeries === 'string') {
          // Patterns: "Name (#3)", "Name, #3", "Name (Book 3)", "Name 3"
          const match = edSeries.match(/^(.*?)[,\s]*\(?(?:book|#|v|part)?\s*(\d+(\.\d+)?)\)?$/i);
          if (match) {
            if (!series_name) series_name = match[1].replace(/[()]/g, '').trim();
            if (!series_position) series_position = match[2];
          } else if (!series_name) {
            series_name = edSeries.replace(/[()]/g, '').trim();
          }
        }
      }
      if (series_name && series_position) break;
    }
  }

  // 2. Try to find series info in subjects if missing (common in OL)
  if (!series_name) {
    for (const sub of subjects) {
      const match = sub.match(/\[series:(.*?)\]/i) || sub.match(/series:\s*(.*)/i);
      if (match) {
        series_name = match[1].replace(/[:_]/g, ' ').trim();
        break;
      }
    }
  }

  // 3. Try to find series position in subjects, title, or description
  if (series_name && !series_position) {
    // Check subjects for #N or "Book N"
    for (const sub of subjects) {
      const posMatch = sub.match(/#(\d+(\.\d+)?)/) || sub.match(/book\s+(\d+(\.\d+)?)/i);
      if (posMatch) {
        series_position = posMatch[1];
        break;
      }
    }
    
    // Check description for "book one", "first book", "book 1", etc.
    if (!series_position && desc) {
      const descMatch = desc.match(/book\s+(one|two|three|four|five|six|seven|eight|nine|ten)/i) ||
                        desc.match(/(\d+)(?:st|nd|rd|th)\s+book/i) ||
                        desc.match(/book\s+(\d+)/i);
      if (descMatch) {
        const map: Record<string, string> = { one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10' };
        series_position = map[descMatch[1].toLowerCase()] || descMatch[1];
      }
    }
  }

  // 4. Fallback: Check title for (Series Name, #1) pattern
  if (!series_name) {
    const titleMatch = title.match(/\((.*?),\s*#?(\d+(\.\d+)?)\)/);
    if (titleMatch) {
      series_name = titleMatch[1];
      series_position = titleMatch[2];
    }
  }
  
  // Normalize genre from subjects (excluding series tags)
  const genre = subjects
    ?.filter((s: any) => typeof s === 'string' && !s.toLowerCase().includes('series:'))
    .slice(0, 3)
    .join(', ') ?? '';

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

  return { title, author, cover_url, page_count, description, series_name, series_position, genre };
}
