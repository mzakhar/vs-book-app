export type FeedbackType = 'bug' | 'feature' | 'other';

export interface FeedbackInput {
  type: FeedbackType;
  description: string;
}

export interface IssuePayload {
  title: string;
  body: string;
  labels: string[];
}

const TYPE_LABELS: Record<FeedbackType, string | null> = {
  bug: 'bug',
  feature: 'enhancement',
  other: null,
};

export function buildIssuePayload(feedback: FeedbackInput, screenName: string): IssuePayload {
  const title = `[Feedback] ${feedback.description.slice(0, 80)}`;
  const body = `${feedback.description}\n\n_Reported by ${screenName} via in-app feedback_`;
  const typeLabel = TYPE_LABELS[feedback.type];
  const labels = typeLabel ? ['feedback', typeLabel] : ['feedback'];
  return { title, body, labels };
}

export function isGithubConfigured(): boolean {
  return !!process.env.GITHUB_TOKEN && !!process.env.GITHUB_REPO;
}

export type CreateIssueResult =
  | { ok: true; issueNumber: number; issueUrl: string }
  | { ok: false };

export async function createIssue(payload: IssuePayload): Promise<CreateIssueResult> {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  if (!token || !repo) return { ok: false };

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return { ok: false };

    const data: any = await res.json();
    return { ok: true, issueNumber: data.number, issueUrl: data.html_url };
  } catch {
    return { ok: false };
  }
}
