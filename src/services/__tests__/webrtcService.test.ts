import { WebRTCConnectionManager, DEFAULT_RTC_CONFIG } from '../webrtcService';

describe('WebRTCConnectionManager (#30)', () => {
  let manager: WebRTCConnectionManager;

  beforeEach(() => {
    manager = new WebRTCConnectionManager();
  });

  afterEach(() => {
    manager.close();
  });

  it('initializes PeerConnection with default STUN servers', async () => {
    const pc = await manager.initialize(DEFAULT_RTC_CONFIG);
    expect(pc).toBeDefined();
    expect(DEFAULT_RTC_CONFIG.iceServers.length).toBeGreaterThan(0);
  });

  it('creates local offer session description', async () => {
    await manager.initialize();
    const offer = await manager.createOffer();
    expect(offer).toBeDefined();
    expect(offer.type).toBe('offer');
  });

  it('closes peer connection cleanly', async () => {
    await manager.initialize();
    manager.close();
    await expect(manager.createOffer()).rejects.toThrow('PeerConnection not initialized');
  });
});
