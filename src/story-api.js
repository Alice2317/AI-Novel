export const useStoryApi = import.meta.env.DEV;

export const storyRequest = (path, options) => apiRequest('/api/stories' + path, options);
export const libraryRequest = options => apiRequest('/api/library', options);

async function apiRequest(path, { method = 'GET', body, signal } = {}) {
  const response = await fetch(path, {
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

export const uploadLibraryAttachment = data => apiRequest('/api/library/attachments', {method:'POST',body:{data}});
export const readLibraryAttachment = id => apiRequest('/api/library/attachments/'+id);
