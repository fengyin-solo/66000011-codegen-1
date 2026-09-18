import React, { useEffect, useRef, useState } from 'react';
import { Board } from '../types';
import { boardApi } from '../services/api';
import {
  BoardSnapshot,
  CreateBoardFromSnapshotPayload,
  SnapshotError,
  countSnapshotContents,
  parseSnapshotFile,
  snapshotToCreateBoardPayload,
} from '../services/snapshot';

interface ImportSnapshotDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImported: (board: Board) => void;
  ownerId: string;
}

type Status = 'idle' | 'reading' | 'ready' | 'error';

interface FileError {
  message: string;
  canReselect: boolean;
}

const errorStyles: React.CSSProperties = {
  padding: '12px 14px',
  background: '#fef2f2',
  border: '1px solid #fecaca',
  borderRadius: '8px',
  color: '#dc2626',
  fontSize: '13px',
  lineHeight: 1.6,
};

const CountChip: React.FC<{ label: string; value: number; accent: string }> = ({
  label,
  value,
  accent,
}) => (
  <div
    style={{
      flex: '1 1 96px',
      minWidth: '96px',
      padding: '12px',
      borderRadius: '10px',
      background: '#f9fafb',
      border: '1px solid #eef0f3',
      textAlign: 'center',
    }}
  >
    <div style={{ fontSize: '20px', fontWeight: 700, color: accent, lineHeight: 1.2 }}>
      {value}
    </div>
    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>{label}</div>
  </div>
);

export const ImportSnapshotDialog: React.FC<ImportSnapshotDialogProps> = ({
  isOpen,
  onClose,
  onImported,
  ownerId,
}) => {
  const [status, setStatus] = useState<Status>('idle');
  const [snapshot, setSnapshot] = useState<BoardSnapshot | null>(null);
  const [counts, setCounts] = useState<ReturnType<typeof countSnapshotContents> | null>(null);
  const [newName, setNewName] = useState('');
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState<FileError | null>(null);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setStatus('idle');
      setSnapshot(null);
      setCounts(null);
      setNewName('');
      setFileName('');
      setError(null);
      setImporting(false);
      setDragOver(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const loadFile = async (file: File | undefined | null) => {
    if (!file) return;
    setStatus('reading');
    setError(null);
    setSnapshot(null);
    setCounts(null);
    try {
      const parsed = await parseSnapshotFile(file);
      setSnapshot(parsed);
      setCounts(countSnapshotContents(parsed));
      setNewName(parsed.board.name);
      setFileName(file.name);
      setStatus('ready');
    } catch (err) {
      // 任何校验失败都只提示原因、保留当前画板不变，等待用户重新选择
      const message =
        err instanceof SnapshotError
          ? err.message
          : '读取快照文件失败，请重新选择有效的白板快照文件';
      setError({ message, canReselect: true });
      setStatus('error');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    void loadFile(e.target.files?.[0]);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (status === 'reading' || importing) return;
    void loadFile(e.dataTransfer.files?.[0]);
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleConfirmImport = async () => {
    if (!snapshot || importing) return;
    setImporting(true);
    setError(null);
    try {
      const payload: CreateBoardFromSnapshotPayload = snapshotToCreateBoardPayload(
        snapshot,
        ownerId,
        newName,
      );
      // 始终通过创建接口生成一份新画板，不会覆盖任何现有画板
      const board = await boardApi.createBoard(payload);
      if (!board) {
        throw new Error('create-board-failed');
      }
      onImported(board);
      onClose();
    } catch (err) {
      console.error('Failed to import snapshot:', err);
      setError({
        message: '创建新画板失败，请检查网络后重试（现有画板未受影响）',
        canReselect: false,
      });
      setImporting(false);
    }
  };

  const primaryButtonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 24px',
    fontSize: '14px',
    fontWeight: 500,
    color: '#fff',
    background: '#667eea',
    border: 'none',
    borderRadius: '8px',
    cursor: importing ? 'not-allowed' : 'pointer',
    opacity: importing ? 0.8 : 1,
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '16px',
          width: '560px',
          maxWidth: '95vw',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '24px 28px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: '#1a1a1a' }}>
              导入白板快照
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#6b7280' }}>
              从快照文件创建一份全新画板，现有画板不会被修改或覆盖
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={importing}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: '#6b7280',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div style={{ padding: '24px 28px', overflowY: 'auto', flex: 1 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          {status !== 'ready' && (
            <div
              onClick={() => {
                if (status !== 'reading' && !importing) triggerFileSelect();
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              style={{
                border: `2px dashed ${dragOver ? '#667eea' : '#d1d5db'}`,
                borderRadius: '12px',
                padding: '40px 24px',
                textAlign: 'center',
                background: dragOver ? '#f5f3ff' : '#fafafa',
                cursor: status === 'reading' ? 'wait' : 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {status === 'reading' ? (
                <div style={{ fontSize: '14px', color: '#6b7280' }}>正在读取并校验文件…</div>
              ) : (
                <>
                  <svg
                    width="44"
                    height="44"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#9ca3af"
                    strokeWidth="1.5"
                    style={{ margin: '0 auto 12px' }}
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: '#374151' }}>
                    点击选择快照文件，或拖拽文件到此处
                  </div>
                  <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '6px' }}>
                    支持通过「下载快照」导出的 .wb.json 文件
                  </div>
                </>
              )}
            </div>
          )}

          {status === 'error' && error && (
            <div style={{ ...errorStyles, marginTop: '16px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '15px', lineHeight: 1.6 }}>⚠️</span>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: '2px' }}>无法导入该文件</div>
                  <div>{error.message}</div>
                  <div style={{ marginTop: '8px', fontSize: '12px', color: '#991b1b', opacity: 0.85 }}>
                    当前画板及已有白板均未受到任何影响。
                  </div>
                </div>
              </div>
            </div>
          )}

          {status === 'ready' && snapshot && counts && (
            <div>
              {error && (
                <div style={{ ...errorStyles, marginBottom: '16px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '15px', lineHeight: 1.6 }}>⚠️</span>
                    <div>{error.message}</div>
                  </div>
                </div>
              )}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 12px',
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '8px',
                  color: '#15803d',
                  fontSize: '13px',
                  marginBottom: '20px',
                }}
              >
                <span>✅</span>
                <span>
                  文件校验通过：<strong>{fileName}</strong>
                </span>
              </div>

              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#374151',
                  marginBottom: '6px',
                }}
              >
                新画板名称
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="请输入新画板名称"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 14px',
                  fontSize: '14px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  outline: 'none',
                  marginBottom: '20px',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#667eea';
                  e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#d1d5db';
                  e.target.style.boxShadow = 'none';
                }}
              />

              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#374151',
                  marginBottom: '8px',
                }}
              >
                画板尺寸
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 12px',
                  background: '#f9fafb',
                  borderRadius: '8px',
                  marginBottom: '20px',
                  fontSize: '13px',
                  color: '#374151',
                }}
              >
                <span style={{ fontSize: '16px' }}>📐</span>
                <span>
                  {snapshot.board.width} × {snapshot.board.height} 像素
                </span>
                <span
                  style={{
                    marginLeft: 'auto',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: '#6b7280',
                  }}
                >
                  背景
                  <span
                    style={{
                      display: 'inline-block',
                      width: '14px',
                      height: '14px',
                      borderRadius: '3px',
                      background: snapshot.board.backgroundColor,
                      border: '1px solid rgba(0,0,0,0.15)',
                    }}
                  />
                </span>
              </div>

              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#374151',
                  marginBottom: '8px',
                }}
              >
                内容数量（共 {counts.total} 项，分布在 {counts.layers} 个图层）
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <CountChip label="便签" value={counts.stickyNotes} accent="#d97706" />
                <CountChip label="文本" value={counts.texts} accent="#2563eb" />
                <CountChip label="手绘笔迹" value={counts.paths} accent="#059669" />
                <CountChip label="图形/其他" value={counts.shapes} accent="#7c3aed" />
              </div>

              <p
                style={{
                  margin: '20px 0 0',
                  fontSize: '12px',
                  color: '#9ca3af',
                  lineHeight: 1.6,
                }}
              >
                导入后，便签内容、文本与手绘笔迹将保持在画板上的原位置，原有图层设置（名称、可见性、锁定状态）也会一并保留，可继续从工作台入口打开。
              </p>
            </div>
          )}
        </div>

        <div
          style={{
            padding: '16px 28px',
            borderTop: '1px solid #e5e7eb',
            background: '#f9fafb',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
          }}
        >
          {status === 'error' && error?.canReselect && (
            <button
              type="button"
              onClick={triggerFileSelect}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: 500,
                color: '#fff',
                background: '#667eea',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              重新选择文件
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            disabled={importing}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: 500,
              color: '#374151',
              background: '#e5e7eb',
              border: 'none',
              borderRadius: '8px',
              cursor: importing ? 'not-allowed' : 'pointer',
            }}
          >
            取消
          </button>
          {status === 'ready' && (
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={importing || !newName.trim()}
              style={{
                ...primaryButtonStyle,
                opacity: importing || !newName.trim() ? 0.6 : 1,
              }}
            >
              {importing ? '导入中…' : '导入为新画板'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
