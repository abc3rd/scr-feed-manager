export function jsonRequest(body) {
  return new Request('https://scr.test/fn', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}
