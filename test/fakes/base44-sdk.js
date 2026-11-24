// In-memory stand-in for the Base44 SDK client used by server functions.
let current = null;

export function createClientFromRequest() {
  if (!current) throw new Error('Call useFakeBase44() in the test first');
  return current;
}

function makeEntity(rows, name) {
  let seq = 0;
  return {
    async get(id) {
      const row = rows.get(id);
      if (!row) throw new Error(`${name} ${id} not found`);
      return structuredClone(row);
    },
    async filter(query) {
      return [...rows.values()]
        .filter((r) => Object.entries(query).every(([k, v]) => r[k] === v))
        .map((r) => structuredClone(r));
    },
    async create(data) {
      const id = `${name.toLowerCase()}_${String(++seq).padStart(8, '0')}`;
      rows.set(id, { id, ...structuredClone(data) });
      return structuredClone(rows.get(id));
    },
    async update(id, patch) {
      rows.set(id, { ...rows.get(id), ...structuredClone(patch) });
      return structuredClone(rows.get(id));
    },
  };
}

export function useFakeBase44({ user = null, products = [], users = [] } = {}) {
  const tables = {};
  const names = ['Product', 'Order', 'PickTicket', 'User'];
  const entities = {};
  for (const n of names) {
    tables[n] = new Map();
    entities[n] = makeEntity(tables[n], n);
  }
  for (const p of products) tables.Product.set(p.id, { ...p });
  for (const u of users) tables.User.set(u.id, { ...u });
  if (user) tables.User.set(user.id, { ...user });

  current = {
    auth: { me: async () => (user ? structuredClone(tables.User.get(user.id)) : null) },
    entities,
    asServiceRole: { entities },
  };

  const rows = (n) => [...tables[n].values()];
  return {
    product: (id) => tables.Product.get(id),
    orders: () => rows('Order'),
    tickets: () => rows('PickTicket'),
    user: (id) => tables.User.get(id),
    signIn: (u) => { user = u; tables.User.set(u.id, { ...u }); },
  };
}
