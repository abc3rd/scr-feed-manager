// Stand-in for npm:qrcode: returns a few bytes instead of a real PNG.
export default { toBuffer: async (text) => new TextEncoder().encode(`PNG:${text}`) };
