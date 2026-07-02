/// <reference types="vite/client" />

declare module "@3d-dice/dice-box" {
  type DiceBoxConfig = {
    container?: string;
    assetPath: string;
    themeColor?: string;
    scale?: number;
    gravity?: number;
    mass?: number;
    friction?: number;
    restitution?: number;
    enableShadows?: boolean;
    offscreen?: boolean;
  };

  export default class DiceBox {
    constructor(config: DiceBoxConfig);
    init(): Promise<void>;
    roll(notation: string): Promise<unknown>;
    clear(): DiceBox;
  }
}

