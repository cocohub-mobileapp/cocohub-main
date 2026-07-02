import { COCOHUB_ASSETS, getCocohubTrustlineStatuses } from '../trustlineService';

describe('getCocohubTrustlineStatuses', () => {
  it('returns every Cocohub asset as not enabled when the account has no trustlines', () => {
    const statuses = getCocohubTrustlineStatuses([]);

    expect(statuses).toHaveLength(COCOHUB_ASSETS.length);
    expect(statuses.map((status) => status.asset.assetCode)).toEqual(['PETC', 'VETH', 'PAWP']);
    expect(statuses.every((status) => status.status === 'not_enabled')).toBe(true);
    expect(statuses.every((status) => status.balance === '0')).toBe(true);
  });

  it('marks matching Cocohub trustlines active with their current balance', () => {
    const [asset] = COCOHUB_ASSETS;

    const statuses = getCocohubTrustlineStatuses([
      {
        assetCode: asset.assetCode,
        issuerPublicKey: asset.issuerPublicKey,
        issuerLabel: asset.name,
        balance: '12.5000000',
        limit: '1000.0000000',
        isCocohubAsset: true,
      },
    ]);

    const active = statuses.find((status) => status.asset.assetCode === asset.assetCode);

    expect(active?.status).toBe('active');
    expect(active?.balance).toBe('12.5000000');
    expect(active?.trustline?.limit).toBe('1000.0000000');
    expect(statuses.filter((status) => status.status === 'not_enabled')).toHaveLength(2);
  });
});
