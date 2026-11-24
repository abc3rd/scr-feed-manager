export const stripeCalls = { sessions: [], coupons: [] };

export default class Stripe {
  constructor() {
    this.checkout = {
      sessions: {
        create: async (params) => {
          stripeCalls.sessions.push(params);
          return { id: `cs_test_${stripeCalls.sessions.length}`, url: 'https://checkout.stripe.test/session' };
        },
      },
    };
    this.coupons = {
      create: async (params) => {
        stripeCalls.coupons.push(params);
        return { id: `coupon_${stripeCalls.coupons.length}` };
      },
    };
  }
}
