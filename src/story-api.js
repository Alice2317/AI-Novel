export const useStoryApi = import.meta.env.DEV;

export async function storyRequest(path, { method = 'GET', body, signal } = {}) {
  const response = await fetch('/api/stories' + path, {
    method,
    signal,
    ...(body === undefined ? {} : {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  });
  if (!response.ok) {
    const error = new Error('Story API request failed');
    error.status = response.status;
    throw error;
  }
  return response.json();
}
