class Stripe {
  constructor() {
    this.paymentIntents = {
      create: jest.fn().mockResolvedValue({ id: 'pi_mock', client_secret: 'sec_mock' }),
      retrieve: jest.fn().mockResolvedValue({ id: 'pi_mock', status: 'succeeded' }),
    };
    this.refunds = {
      create: jest.fn().mockResolvedValue({ id: 're_mock', status: 'succeeded' }),
    };
  }
}

module.exports = Stripe;
