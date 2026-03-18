// browser-extension/src/content/page-world.ts
// Injected into MAIN world. Intercepts DDB API responses.
// Posts relevant payloads to isolated world via window.postMessage.

const DDB_PATTERNS = [
  /character-service\.dndbeyond\.com\/character\/v\d+\/character\/(\d+)/,
  /www\.dndbeyond\.com\/api\/now\/characters\/(\d+)/,
  /gamemaster-service\.dndbeyond\.com\/encounter/,
  /character-service\.dndbeyond\.com\/character\/v\d+\/current-user\/characters/,
];

const originalFetch = window.fetch.bind(window);

window.fetch = async function (input, init) {
  const url = typeof input === 'string' ? input
    : input instanceof Request ? input.url
    : String(input);
  const response = await originalFetch(input, init);

  const matched = DDB_PATTERNS.some(p => p.test(url));
  if (matched && response.ok) {
    const clone = response.clone();
    clone.json().then((body: unknown) => {
      window.postMessage({
        source: 'quiverdm-page-world',
        url,
        body,
      }, '*');
    }).catch(() => {/* ignore non-JSON */});
  }

  return response;
};
