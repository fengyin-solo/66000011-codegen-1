export interface BoardElement {
  id: string;
  type: 'path' | 'rect' | 'circle' | 'text' | 'sticky-note' | 'line' | 'image';
  x: number;
  y: number;
  width?: number;
  height?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  text?: string;
  points?: number[];
  rotation?: number;
  opacity?: number;
}

export interface Layer {
  name: string;
  visible: boolean;
  locked: boolean;
  order: number;
  elements: BoardElement[];
}

export interface Board {
  _id: string;
  name: string;
  ownerId: string;
  collaborators: string[];
  layers: Layer[];
  width: number;
  height: number;
  backgroundColor: string;
  createdAt: string;
  updatedAt: string;
}

export type ViewType = 'dashboard' | 'board';

export interface CursorPosition {
  socketId: string;
  username: string;
  x: number;
  y: number;
}

export interface CanvasTransform {
  scale: number;
  translateX: number;
  translateY: number;
}

export type ToolType = 'select' | 'pen' | 'rect' | 'circle' | 'line' | 'text' | 'sticky-note' | 'eraser';

export interface Template {
  _id: string;
  name: string;
  description: string;
  category: string;
  thumbnail: string;
  icon: string;
  width: number;
  height: number;
  backgroundColor: string;
  layers?: Layer[];
}

// 白板快照文件（可下载/导入）
export const SNAPSHOT_FILE_TYPE = 'whiteboard-snapshot';
export const SNAPSHOT_FORMAT_VERSION = 1;

export interface SnapshotCounts {
  stickyNotes: number;
  texts: number;
  paths: number;
  shapes: number;
  images: number;
  total: number;
}

export interface BoardSnapshot {
  fileType: string;
  formatVersion: number;
  appVersion: string;
  exportedAt: string;
  board: {
    name: string;
    width: number;
    height: number;
    backgroundColor: string;
    layers: Layer[];
  };
  counts: SnapshotCounts;
}
