<<<<<<< HEAD
export type DisplayMode = 'ink' | 'velocity' | 'image';

export type SimulationParams = {
  dt: number;
  viscosity: number;
  jacobiIter: number;
  displayMode: DisplayMode;
  paused: boolean;
};

export type BrushState = {
  pos: [number, number];
  delta: [number, number];
  isDown: boolean;
};
=======
export type DisplayMode = 'ink' | 'velocity' | 'image';

export type SimulationParams = {
  dt: number;
  viscosity: number;
  jacobiIter: number;
  displayMode: DisplayMode;
  paused: boolean;
};

export type BrushState = {
  pos: [number, number];
  delta: [number, number];
  isDown: boolean;
};
>>>>>>> 304e5bbdce46baedae9e2a41c01a0f156962f3e7
