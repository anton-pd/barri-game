declare module '@3d-dice/dice-box' {
  interface DiceBoxConfig {
    assetPath: string;
    container: HTMLElement;
    id?: string;
    scale?: number;
    gravity?: number;
    mass?: number;
    friction?: number;
    restitution?: number;
    offscreen?: boolean;
    enableShadows?: boolean;
    lightIntensity?: number;
    theme?: string;
    themeColor?: string;
  }

  interface RollResult {
    rolls: { rolls: number[]; total: number }[];
  }

  class DiceBox {
    constructor(config: DiceBoxConfig);
    init(): Promise<void>;
    roll(notation: string): Promise<RollResult>;
    clear(): void;
    onRollComplete: ((result: RollResult) => void) | undefined;
  }

  export default DiceBox;
}
