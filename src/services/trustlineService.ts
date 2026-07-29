export interface TrustlineToken {
  assetCode: string;
  issuer: string;
  balance: string;
  limit: string;
  isAuthorized: boolean;
  trustlineSet: boolean;
}

export const COCOHUB_TOKENS = [
  {
    code: 'PETC',
    issuer: 'GDUKMGUGDZQK6YHYA5Z6AY2G4XDSZPSZ3SW5UN3ARVMO6QSRDWP5YLEX',
    name: 'PetCoin',
    desc: 'Earned through pet health milestones and activity',
  },
  {
    code: 'VETH',
    issuer: 'GDUKMGUGDZQK6YHYA5Z6AY2G4XDSZPSZ3SW5UN3ARVMO6QSRDWP5YLEX',
    name: 'Vet Token',
    desc: 'Rewarded for completing veterinary appointments',
  },
  {
    code: 'PAWP',
    issuer: 'GDUKMGUGDZQK6YHYA5Z6AY2G4XDSZPSZ3SW5UN3ARVMO6QSRDWP5YLEX',
    name: 'Paw Points',
    desc: 'Community engagement and referral rewards',
  },
];

/**
 * Fetch trustline information from Horizon for a given Stellar account.
 * In production this calls the backend API. For now, returns mock data.
 */
export async function fetchTrustlines(_publicKey: string): Promise<TrustlineToken[]> {
  // TODO: Replace with actual Horizon API call:
  // const server = new Horizon.Server('https://horizon-testnet.stellar.org');
  // const account = await server.loadAccount(publicKey);
  // return account.balances.filter(...).map(...);

  return COCOHUB_TOKENS.map((token) => ({
    assetCode: token.code,
    issuer: token.issuer,
    balance: '0',
    limit: '1000000',
    isAuthorized: true,
    trustlineSet: false,
  }));
}

/**
 * Add a trustline for an asset.
 * Submits a change_trust operation via the backend.
 */
export async function addTrustline(assetCode: string, _issuer: string): Promise<boolean> {
  // TODO: Replace with actual backend call
  console.log(`Adding trustline for ${assetCode}`);
  return true;
}

/**
 * Remove a trustline for an asset.
 * Only possible when balance is 0.
 */
export async function removeTrustline(assetCode: string): Promise<boolean> {
  // TODO: Replace with actual backend call
  console.log(`Removing trustline for ${assetCode}`);
  return true;
}
