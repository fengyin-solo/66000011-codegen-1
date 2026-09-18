import { Board, BoardElement, Layer } from '../types';

/**
 * 白板快照文件：把当前画板（便签、文本、手绘笔迹等全部内容及图层设置）
 * 打包成单个 JSON 文件下载，之后可从文件导入为一份全新的画板。
 *
 * 文件结构（.wb.json）：
 * {
 *   format: 'whiteboard-snapshot',
 *   version: 1,
 *   exportedAt: string,
 *   board: { name, width, height, backgroundColor, layers }
 * }
 */
export const SNAPSHOT_FORMAT = 'whiteboard-snapshot';
export const SNAPSHOT_VERSION = 1;
const SUPPORTED_SNAPSHOT_VERSIONS: readonly number[] = [SNAPSHOT_VERSION];
const SNAPSHOT_EXTENSION = '.wb.json';
// eslint-disable-next-line no-control-regex
const ILLEGAL_FILE_NAME_CHARS = /[\\/:*?"<>|\x00-\x1f]/g;

const ELEMENT_TYPES = new Set<BoardElement['type']>([
  'path', 'rect', 'circle', 'text', 'sticky-note', 'line', 'image',
]);

export interface SnapshotBoardData {
  name: string;
  width: number;
  height: number;
  backgroundColor: string;
  layers: Layer[];
}

export interface BoardSnapshot {
  format: typeof SNAPSHOT_FORMAT;
  version: number;
  exportedAt: string;
  board: SnapshotBoardData;
}

export interface CreateBoardFromSnapshotPayload {
  name: string;
  ownerId: string;
  width: number;
  height: number;
  backgroundColor: string;
  layers: Layer[];
}

export interface SnapshotContentCounts {
  total: number;
  layers: number;
  stickyNotes: number;
  texts: number;
  paths: number;
  shapes: number;
  byType: Partial<Record<BoardElement['type'], number>>;
}

export type SnapshotErrorCode =
  | 'parse-error'
  | 'invalid-format'
  | 'invalid-structure'
  | 'unsupported-version'
  | 'empty-content';

export class SnapshotError extends Error {
  code: SnapshotErrorCode;

  constructor(code: SnapshotErrorCode, message: string) {
    super(message);
    this.name = 'SnapshotError';
    this.code = code;
  }
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** 把画板序列化为快照对象（坐标等原始数据原样保留） */
export const serializeBoard = (board: Board): BoardSnapshot => ({
  format: SNAPSHOT_FORMAT,
  version: SNAPSHOT_VERSION,
  exportedAt: new Date().toISOString(),
  board: {
    name: board.name,
    width: board.width,
    height: board.height,
    backgroundColor: board.backgroundColor,
    layers: board.layers.map((layer) => ({
      name: layer.name,
      visible: layer.visible,
      locked: layer.locked,
      order: layer.order,
      elements: layer.elements.map((el) => ({ ...el })),
    })),
  },
});

const sanitizeFileName = (name: string): string =>
  name.replace(ILLEGAL_FILE_NAME_CHARS, '_').trim();

export const snapshotFileName = (board: Board): string =>
  `${sanitizeFileName(board.name) || '白板'}-白板快照${SNAPSHOT_EXTENSION}`;

/** 打包当前画板并触发浏览器下载 */
export const downloadBoardSnapshot = (board: Board): void => {
  const snapshot = serializeBoard(board);
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = snapshotFileName(board);
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

const normalizeElement = (raw: unknown, layerIndex: number, elementIndex: number): BoardElement => {
  const position = `第 ${layerIndex + 1} 层中的第 ${elementIndex + 1} 个内容`;
  if (!isPlainObject(raw)) {
    throw new SnapshotError('invalid-structure', `${position}格式不正确，文件可能已损坏`);
  }
  const { type, x, y } = raw;
  if (typeof type !== 'string' || !ELEMENT_TYPES.has(type as BoardElement['type'])) {
    throw new SnapshotError('invalid-structure', `${position}类型无法识别，文件可能已损坏`);
  }
  if (!isFiniteNumber(x) || !isFiniteNumber(y)) {
    throw new SnapshotError('invalid-structure', `${position}缺少位置信息，文件可能已损坏`);
  }
  // 其余字段（points、宽高、颜色、文本内容等）原样保留，保证导入后位置不变
  return { ...(raw as Record<string, unknown>) } as unknown as BoardElement;
};

const normalizeLayer = (raw: unknown, layerIndex: number): Layer => {
  if (!isPlainObject(raw)) {
    throw new SnapshotError('invalid-structure', `第 ${layerIndex + 1} 个图层格式不正确，文件可能已损坏`);
  }
  if (!Array.isArray(raw.elements)) {
    throw new SnapshotError('invalid-structure', `第 ${layerIndex + 1} 个图层缺少内容数据，文件可能已损坏`);
  }
  const elements = raw.elements.map((el, i) => normalizeElement(el, layerIndex, i));
  return {
    name:
      typeof raw.name === 'string' && raw.name.trim()
        ? raw.name
        : `图层 ${layerIndex + 1}`,
    visible: typeof raw.visible === 'boolean' ? raw.visible : true,
    locked: typeof raw.locked === 'boolean' ? raw.locked : false,
    order: isFiniteNumber(raw.order) ? raw.order : layerIndex,
    elements,
  };
};

/**
 * 校验快照内容：
 * - 文件损坏 / 格式不对 / 结构缺失 → SnapshotError(invalid-*)
 * - 版本不兼容 → SnapshotError(unsupported-version)
 * - 内容为空（没有任何元素）→ SnapshotError(empty-content)
 * 校验通过返回规范化后的快照（图层设置与元素坐标保持原样）。
 */
export const validateSnapshot = (raw: unknown): BoardSnapshot => {
  if (!isPlainObject(raw)) {
    throw new SnapshotError('invalid-format', '文件已损坏或不是有效的白板快照文件');
  }

  if (raw.format !== SNAPSHOT_FORMAT) {
    throw new SnapshotError(
      'invalid-format',
      '该文件不是白板快照文件，请选择通过「下载快照」功能导出的文件',
    );
  }

  if (!('version' in raw)) {
    throw new SnapshotError('invalid-structure', '快照缺少版本信息，文件可能已损坏');
  }
  if (!isFiniteNumber(raw.version) || !Number.isInteger(raw.version)) {
    throw new SnapshotError('invalid-structure', '快照版本信息无效，文件可能已损坏');
  }
  if (!SUPPORTED_SNAPSHOT_VERSIONS.includes(raw.version)) {
    throw new SnapshotError(
      'unsupported-version',
      `快照版本 v${raw.version} 与当前应用不兼容（当前支持版本：v${SUPPORTED_SNAPSHOT_VERSIONS.join('、v')}），请升级应用或使用兼容版本重新导出`,
    );
  }

  const boardRaw = raw.board;
  if (!isPlainObject(boardRaw)) {
    throw new SnapshotError('invalid-structure', '快照缺少画板数据，文件可能已损坏');
  }
  if (
    !isFiniteNumber(boardRaw.width) || boardRaw.width <= 0 ||
    !isFiniteNumber(boardRaw.height) || boardRaw.height <= 0
  ) {
    throw new SnapshotError('invalid-structure', '画板尺寸信息无效或缺失，文件可能已损坏');
  }
  if (!Array.isArray(boardRaw.layers) || boardRaw.layers.length === 0) {
    throw new SnapshotError('invalid-structure', '快照缺少图层数据，文件可能已损坏');
  }

  const layers = boardRaw.layers.map((layer, i) => normalizeLayer(layer, i));
  const totalElements = layers.reduce((sum, layer) => sum + layer.elements.length, 0);
  if (totalElements === 0) {
    throw new SnapshotError(
      'empty-content',
      '快照内容为空，不包含任何便签、文本或手绘笔迹，无法导入为新画板',
    );
  }

  return {
    format: SNAPSHOT_FORMAT,
    version: raw.version,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
    board: {
      name:
        typeof boardRaw.name === 'string' && boardRaw.name.trim()
          ? boardRaw.name
          : '未命名白板',
      width: boardRaw.width,
      height: boardRaw.height,
      backgroundColor:
        typeof boardRaw.backgroundColor === 'string' && boardRaw.backgroundColor
          ? boardRaw.backgroundColor
          : '#ffffff',
      layers,
    },
  };
};

/** 读取并校验用户选择的快照文件，失败时抛出带中文原因的 SnapshotError */
export const parseSnapshotFile = async (file: File): Promise<BoardSnapshot> => {
  if (file.size === 0) {
    throw new SnapshotError('parse-error', '文件为空，请重新选择有效的白板快照文件');
  }

  let text: string;
  try {
    text = await file.text();
  } catch {
    throw new SnapshotError('parse-error', '读取文件失败，请重新选择文件后重试');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new SnapshotError(
      'parse-error',
      '文件无法解析，文件可能已损坏，请重新选择有效的白板快照文件（.wb.json）',
    );
  }

  return validateSnapshot(parsed);
};

/** 统计快照中各类内容数量，用于导入前预览 */
export const countSnapshotContents = (snapshot: BoardSnapshot): SnapshotContentCounts => {
  const byType: Partial<Record<BoardElement['type'], number>> = {};
  let stickyNotes = 0;
  let texts = 0;
  let paths = 0;
  let shapes = 0;

  for (const layer of snapshot.board.layers) {
    for (const element of layer.elements) {
      byType[element.type] = (byType[element.type] ?? 0) + 1;
      switch (element.type) {
        case 'sticky-note':
          stickyNotes += 1;
          break;
        case 'text':
          texts += 1;
          break;
        case 'path':
          paths += 1;
          break;
        default:
          shapes += 1;
      }
    }
  }

  return {
    total: stickyNotes + texts + paths + shapes,
    layers: snapshot.board.layers.length,
    stickyNotes,
    texts,
    paths,
    shapes,
    byType,
  };
};

/** 快照转换为创建新画板的请求数据（始终生成新画板，不会覆盖任何现有画板） */
export const snapshotToCreateBoardPayload = (
  snapshot: BoardSnapshot,
  ownerId: string,
  nameOverride?: string,
): CreateBoardFromSnapshotPayload => ({
  name: nameOverride && nameOverride.trim() ? nameOverride.trim() : snapshot.board.name,
  ownerId,
  width: snapshot.board.width,
  height: snapshot.board.height,
  backgroundColor: snapshot.board.backgroundColor,
  layers: snapshot.board.layers.map((layer, i) => ({ ...layer, order: i })),
});
