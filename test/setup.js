globalThis.Deno = { env: { get: (name) => (name === 'BASE44_APP_ID' ? 'test-app-id' : undefined) } };
