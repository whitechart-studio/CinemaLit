// src/constants/canvas.ts
// Single source of truth for scene-node/canvas dimensions. Used directly by
// ConnectorLayer/Minimap (plain JS/canvas, can read a TS constant). The CSS
// Modules that also need these values (SceneNode.module.css's `.node` width,
// SceneCanvas.module.css's `.board` width/height) can't import a TS constant
// — keep those literals in sync with the values here by hand.
export const NODE_W = 220;
export const NODE_H = 148;
export const CANVAS_W = 4000;
export const CANVAS_H = 3000;
