import React, { useEffect, useRef, useState } from 'react';
import { BoardSnapshot } from '../types';
import {
  parseSnapshotFile,
  SnapshotError,
  SnapshotErrorReason,
  ValidatedSnapshot,
} from '../services/snapshot';

interface ImportSnapshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (snapshot: BoardSnapshot) => Promise<void>;
}

type Phase = 'select' | 'preview' | 'error';

interface ErrorState {
  reason: SnapshotErrorReason;
  message: string;
  fileName: string;
}

const ERROR_TITLE: Record<SnapshotErrorReason, string> = {
  corrupt: '文件已损坏',
  empty: '内容为空',
  'unsupported-version': '版本不兼容',
};

const formatDateTime = (iso: string): string => {
  if (!iso) return '未知';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '未知';
  return date.toLocaleString('zh-CN');
};

const CountItem: React.FC<{ icon: string; label: string; value: number }> = ({ icon, label, value }) => (
  <div
    style={{
      flex: 1,
      minWidth: '120px',
      background: '#f9fafb',
      border: '1px solid #f3f4f6',
      borderRadius: '10px',
      padding: '14px 16px',
      textAlign: 'center',
    }}
  >
    <div style={{ fontSize: '20px', lineHeight: 1 }}>{icon}</div>
    <div style={{ fontSize: '22px', fontWeight: 700, color: '#1a1a1a', margin: '6px 0 2px' }}>
      {value}
    </div>
    <div style={{ fontSize: '12px', color: '#6b7280' }}>{label}</div>
  </div>
);

export const ImportSnapshotModal: React.FC<ImportSnapshotModalProps> = ({ isOpen, onClose, onImport }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>('select');
  const [parsed, setParsed] = useState<ValidatedSnapshot | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<ErrorState | null>(null);
  const [importing, setImporting] = useState(false);

  // 每次打开时重置状态并自动弹出文件选择
  useEffect(() => {
    if (isOpen) {
      setPhase('select');
      setParsed(null);
      setName('');
      setError(null);
      setImporting(false);
      const timer = window.setTimeout(() => fileInputRef.current?.click(), 50);
      return () => window.clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const resetFileInput = () => {
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const result = await parseSnapshotFile(file);
      setParsed(result);
      setName(result.snapshot.board.name);
      setError(null);
      setPhase('preview');
    } catch (err) {
      if (err instanceof SnapshotError) {
        setError({ reason: err.reason, message: err.message, fileName: file.name });
      } else {
        setError({
          reason: 'corrupt',
          message: '无法解析该文件，请确认它是由白板导出的快照文件。',
          fileName: file.name,
        });
      }
      setParsed(null);
      setPhase('error');
    } finally {
      resetFileInput();
    }
  };

  const handleReselect = () => {
    setError(null);
    setParsed(null);
    setPhase('select');
    openFilePicker();
  };

  const handleConfirmImport = async () => {
    if (!parsed || importing) return;
    try {
      setImporting(true);
      await onImport({
        ...parsed.snapshot,
        board: { ...parsed.snapshot.board, name: name.trim() || parsed.snapshot.board.name },
      });
    } catch (err) {
      setImporting(false);
      setError({
        reason: 'corrupt',
        message: err instanceof Error ? err.message : '导入失败，请稍后重试。',
        fileName: '',
      });
      setPhase('error');
    }
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
          width: '640px',
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
            padding: '20px 28px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: '#1a1a1a' }}>
              导入白板快照
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>
              从快照文件创建一份新画板，现有画板不会被修改
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={importing}
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: '#6b7280',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          {phase === 'select' && (
            <div
              onClick={openFilePicker}
              style={{
                border: '2px dashed #d1d5db',
                borderRadius: '12px',
                padding: '48px 24px',
                textAlign: 'center',
                cursor: 'pointer',
                background: '#fafafa',
              }}
            >
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>📥</div>
              <p style={{ margin: 0, fontSize: '15px', fontWeight: 500, color: '#374151' }}>
                点击选择白板快照文件
              </p>
              <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#9ca3af' }}>
                支持 .whiteboard.json 格式
              </p>
            </div>
          )}

          {phase === 'error' && error && (
            <div>
              <div
                style={{
                  padding: '16px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '10px',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start',
                }}
              >
                <span style={{ fontSize: '22px', lineHeight: 1.2 }}>⚠️</span>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#b91c1c' }}>
                    {ERROR_TITLE[error.reason]}，无法导入
                  </div>
                  <div style={{ fontSize: '13px', color: '#dc2626', marginTop: '4px', lineHeight: 1.6 }}>
                    {error.message}
                  </div>
                  {error.fileName && (
                    <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '6px' }}>
                      文件：{error.fileName}
                    </div>
                  )}
                </div>
              </div>
              <p style={{ margin: '16px 0 0', fontSize: '13px', color: '#6b7280' }}>
                当前画板未受到任何影响，你可以重新选择其他快照文件。
              </p>
            </div>
          )}

          {phase === 'preview' && parsed && (
            <div>
              <label
                style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}
              >
                新画板名称
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  fontSize: '14px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  outline: 'none',
                  boxSizing: 'border-box',
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
                  background: '#f9fafb',
                  borderRadius: '10px',
                  padding: '14px 16px',
                  marginBottom: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: '#6b7280' }}>画板尺寸</span>
                  <span style={{ color: '#1a1a1a', fontWeight: 500 }}>
                    {parsed.snapshot.board.width} × {parsed.snapshot.board.height}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: '#6b7280' }}>图层数量</span>
                  <span style={{ color: '#1a1a1a', fontWeight: 500 }}>{parsed.layerCount}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: '#6b7280' }}>导出时间</span>
                  <span style={{ color: '#1a1a1a', fontWeight: 500 }}>
                    {formatDateTime(parsed.snapshot.exportedAt)}
                  </span>
                </div>
              </div>

              <div style={{ fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '10px' }}>
                内容数量（共 {parsed.counts.total} 项）
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <CountItem icon="📝" label="便签" value={parsed.counts.stickyNotes} />
                <CountItem icon="🔤" label="文本" value={parsed.counts.texts} />
                <CountItem icon="✏️" label="手绘笔迹" value={parsed.counts.paths} />
                <CountItem icon="⬜" label="形状/直线" value={parsed.counts.shapes} />
                <CountItem icon="🖼️" label="图片" value={parsed.counts.images} />
              </div>
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
          {phase === 'error' && (
            <>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '9px 18px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#374151',
                  background: '#e5e7eb',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                }}
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleReselect}
                style={{
                  padding: '9px 20px',
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
            </>
          )}

          {phase === 'select' && (
            <>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '9px 18px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#374151',
                  background: '#e5e7eb',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                }}
              >
                取消
              </button>
              <button
                type="button"
                onClick={openFilePicker}
                style={{
                  padding: '9px 20px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#fff',
                  background: '#667eea',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                }}
              >
                选择文件
              </button>
            </>
          )}

          {phase === 'preview' && (
            <>
              <button
                type="button"
                onClick={handleReselect}
                disabled={importing}
                style={{
                  padding: '9px 18px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#374151',
                  background: '#e5e7eb',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: importing ? 'not-allowed' : 'pointer',
                }}
              >
                重新选择
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={importing}
                style={{
                  padding: '9px 24px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#fff',
                  background: '#667eea',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: importing ? 'not-allowed' : 'pointer',
                  opacity: importing ? 0.7 : 1,
                }}
              >
                {importing ? '导入中...' : '创建为新画板'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
