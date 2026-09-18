import { v4 as uuidv4 } from 'uuid';
import {
  Board,
  BoardElement,
  Layer,
  BoardSnapshot,
  SnapshotCounts,
  SNAPSHOT_FILE_TYPE,
  SNAPSHOT_FORMAT_VERSION,
} from '../types';

export type SnapshotErrorReason = 'corrupt' | 'empty' | 'unsupported-version';

export class SnapshotError extends Error {
  reason: SnapshotErrorReason;

  constructor(reason: SnapshotErrorReason, message: string) {
    super(message);
    this.name = 'SnapshotError';
    this.reason = reason;
  }
}

export interface ValidatedSnapshot {
  snapshot: BoardSnapshot;
  counts: SnapshotCounts;
  layerCount: number;
}

const ELEMENT_TYPES: BoardElement['type'][] = [
  'path',
  'rect',
  'circle',
  'text',
  'sticky-note',
  'line',
  'image',
];

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const countElements = (layers: Layer[]): SnapshotCounts => {
  const counts: SnapshotCounts = {
    stickyNotes: 0,
    texts: 0,
    paths: 0,
    shapes: 0,
    images: 0,
    total: 0,
  };

  layers.forEach((layer) => {
    layer.elements.forEach((el) => {
      counts.total += 1;
      switch (el.type) {
        case 'sticky-note':
          counts.stickyNotes += 1;
          break;
        case 'text':
          counts.texts += 1;
          break;
        case 'path':
          counts.paths += 1;
          break;
        case 'image':
          counts.images += 1;
          break;
        case 'rect':
        case 'circle':
        case 'line':
          counts.shapes += 1;
          break;
      }
    });
  });

  return counts;
};

export const createSnapshot = (board: Board): BoardSnapshot => {
  const counts = countElements(board.layers);
  return {
    fileType: SNAPSHOT_FILE_TYPE,
    formatVersion: SNAPSHOT_FORMAT_VERSION,
    appVersion: '1.0.0',
    exportedAt: new Date().toISOString(),
    board: {
      name: board.name,
      width: board.width,
      height: board.height,
      backgroundColor: board.backgroundColor,
      // 完整保留图层顺序、可见/锁定设置及元素（含坐标）
      layers: board.layers.map((layer) => ({
        name: layer.name,
        visible: layer.visible,
        locked: layer.locked,
        order: layer.order,
        elements: layer.elements.map((el) => ({ ...el })),
      })),
    },
    counts,
  };
};

const sanitizeFileName = (name: string): string => {
  const cleaned = name.trim().replace(/[\\/:*?"<>|]/g, '_');
  return cleaned || 'whiteboard';
};

export const downloadSnapshot = (board: Board): string => {
  const snapshot = createSnapshot(board);
  const json = JSON.stringify(snapshot, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${sanitizeFileName(board.name)}.whiteboard.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return link.download;
};

const isValidElement = (raw: unknown): raw is Record<string, unknown> => {
  if (!isObject(raw)) return false;
  const type = raw.type;
  if (typeof type !== 'string' || !ELEMENT_TYPES.includes(type as BoardElement['type'])) {
    return false;
  }
  if (!isFiniteNumber(raw.x) || !isFiniteNumber(raw.y)) return false;

  if (
    raw.width !== undefined &&
    (!isFiniteNumber(raw.width) || (raw.width as number) < 0)
  ) {
    return false;
  }
  if (
    raw.height !== undefined &&
    (!isFiniteNumber(raw.height) || (raw.height as number) < 0)
  ) {
    return false;
  }
  if (
    raw.strokeWidth !== undefined &&
    (!isFiniteNumber(raw.strokeWidth) || (raw.strokeWidth as number) < 0)
  ) {
    return false;
  }

  if (type === 'path' || type === 'line') {
    if (!Array.isArray(raw.points) || raw.points.length < 4 || raw.points.length % 2 !== 0) {
      return false;
    }
    if (!raw.points.every(isFiniteNumber)) return false;
  }

  return true;
};

const normalizeElement = (raw: Record<string, unknown>): BoardElement => {
  const element = { ...raw } as unknown as BoardElement;
  // 旧文件可能缺少 id，补齐以保证新画板内元素可被正常编辑
  if (typeof element.id !== 'string' || element.id.length === 0) {
    element.id = uuidv4();
  }
  if (typeof element.text !== 'string') {
    element.text = undefined;
  }
  return element;
};

const validateSnapshot = (data: unknown): ValidatedSnapshot => {
  if (!isObject(data)) {
    throw new SnapshotError('corrupt', '文件内容不是有效的白板快照（应为 JSON 对象）。');
  }

  if (data.fileType !== undefined && data.fileType !== SNAPSHOT_FILE_TYPE) {
    throw new SnapshotError('corrupt', '文件类型不正确，不是白板快照文件。');
  }

  if (data.formatVersion === undefined) {
    throw new SnapshotError('corrupt', '快照缺少格式版本信息，文件可能已损坏。');
  }
  if (!isFiniteNumber(data.formatVersion)) {
    throw new SnapshotError('corrupt', '快照格式版本信息无效，文件可能已损坏。');
  }
  if (data.formatVersion > SNAPSHOT_FORMAT_VERSION) {
    throw new SnapshotError(
      'unsupported-version',
      `快照版本 v${data.formatVersion} 来自更新版本的应用，当前版本（v${SNAPSHOT_FORMAT_VERSION}）无法打开，请升级后重试。`
    );
  }
  // 更早的版本格式不兼容
  if (data.formatVersion < 1) {
    throw new SnapshotError(
      'unsupported-version',
      `快照版本 v${data.formatVersion} 过旧，与当前版本（v${SNAPSHOT_FORMAT_VERSION}）不兼容。`
    );
  }

  const board = data.board;
  if (!isObject(board)) {
    throw new SnapshotError('corrupt', '快照缺少画板数据，文件可能已损坏。');
  }
  if (typeof board.name !== 'string' || board.name.trim().length === 0) {
    throw new SnapshotError('corrupt', '快照缺少有效的画板名称，文件可能已损坏。');
  }
  if (!isFiniteNumber(board.width) || (board.width as number) <= 0) {
    throw new SnapshotError('corrupt', '快照缺少有效的画板宽度，文件可能已损坏。');
  }
  if (!isFiniteNumber(board.height) || (board.height as number) <= 0) {
    throw new SnapshotError('corrupt', '快照缺少有效的画板高度，文件可能已损坏。');
  }
  if (!Array.isArray(board.layers)) {
    throw new SnapshotError('corrupt', '快照缺少图层数据，文件可能已损坏。');
  }

  const layers: Layer[] = board.layers.map((rawLayer, index) => {
    if (!isObject(rawLayer)) {
      throw new SnapshotError('corrupt', `第 ${index + 1} 个图层数据无效，文件可能已损坏。`);
    }
    if (!Array.isArray(rawLayer.elements)) {
      throw new SnapshotError('corrupt', `图层「${rawLayer.name ?? index + 1}」缺少内容数据，文件可能已损坏。`);
    }

    const elements: BoardElement[] = [];
    rawLayer.elements.forEach((rawElement, elementIndex) => {
      if (!isValidElement(rawElement)) {
        throw new SnapshotError(
          'corrupt',
          `图层「${rawLayer.name ?? index + 1}」中的第 ${elementIndex + 1} 个内容无效，文件可能已损坏。`
        );
      }
      elements.push(normalizeElement(rawElement));
    });

    return {
      name: typeof rawLayer.name === 'string' && rawLayer.name.length > 0 ? rawLayer.name : `图层 ${index + 1}`,
      visible: typeof rawLayer.visible === 'boolean' ? rawLayer.visible : true,
      locked: typeof rawLayer.locked === 'boolean' ? rawLayer.locked : false,
      order: isFiniteNumber(rawLayer.order) ? (rawLayer.order as number) : index,
      elements,
    };
  });

  const totalCount = layers.reduce((sum, layer) => sum + layer.elements.length, 0);
  if (layers.length === 0 || totalCount === 0) {
    throw new SnapshotError('empty', '快照内容为空（没有任何便签、文本或笔迹），无法导入。');
  }

  const snapshot: BoardSnapshot = {
    fileType: SNAPSHOT_FILE_TYPE,
    formatVersion: data.formatVersion,
    appVersion: typeof data.appVersion === 'string' ? data.appVersion : '',
    exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : '',
    board: {
      name: board.name,
      width: board.width as number,
      height: board.height as number,
      backgroundColor:
        typeof board.backgroundColor === 'string' && board.backgroundColor.length > 0
          ? board.backgroundColor
          : '#ffffff',
      layers,
    },
    counts: countElements(layers),
  };

  return { snapshot, counts: snapshot.counts, layerCount: layers.length };
};

export const parseSnapshotFile = async (file: File): Promise<ValidatedSnapshot> => {
  let rawText: string;
  try {
    rawText = await file.text();
  } catch {
    throw new SnapshotError('corrupt', '无法读取该文件，请重新选择。');
  }

  let data: unknown;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new SnapshotError('corrupt', '文件不是有效的 JSON，可能已损坏或不是白板快照文件。');
  }

  return validateSnapshot(data);
};
