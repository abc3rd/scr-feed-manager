// Stars Club helpers. Stars are earned (one per dollar on completed orders) and
// never reduce the price of a sale (ADR 0001, syncloudconnect-main).
export function membershipLabel(user) {
  return user?.membership === 'paid' ? 'Paid Member' : 'Free Member';
}
