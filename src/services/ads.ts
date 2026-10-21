// Rewarded ad service. Web build = fake ad (short wait).
// TODO: native build → swap with AdMob (@capacitor-community/admob) rewarded ad.
export type AdPlacement = "offlineDouble" | "freeGems" | "bossRetry";

export interface AdService {
  isReady(p: AdPlacement): boolean;
  show(p: AdPlacement): Promise<boolean>; // true = player watch full → give reward
}

class FakeAds implements AdService {
  isReady() {
    return true;
  }
  show(): Promise<boolean> {
    // pretend 1.2s ad. real ad SDK handle UI itself
    return new Promise((res) => setTimeout(() => res(true), 1200));
  }
}

export const ads: AdService = new FakeAds();
