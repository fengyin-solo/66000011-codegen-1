import React from 'react';
import { useWhiteboardStore } from '../store/whiteboard';

export const CursorOverlay: React.FC = () => {
  const { cursors, canvasTransform } = useWhiteboardStore();
  const cursorList = Array.from(cursors.values());

  return (
    <>
      {cursorList.map(cursor => (
        <div key={cursor.socketId}
          style={{
            position: 'absolute',
            left: cursor.x * canvasTransform.scale + canvasTransform.translateX,
            top: cursor.y * canvasTransform.scale + canvasTransform.translateY,
            pointerEvents: 'none',
            zIndex: 1000,
            transform: 'translate(-4px, -4px)'
          }}>
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path d="M0 0L12 8L6 8L4 14L0 0Z" fill="#FF4444" stroke="#fff" strokeWidth="1" />
          </svg>
          <span style={{
            fontSize: '11px', background: '#FF4444', color: '#fff',
            padding: '1px 6px', borderRadius: '4px', marginLeft: '8px',
            whiteSpace: 'nowrap'
          }}>
            {cursor.username}
          </span>
        </div>
      ))}
    </>
  );
};
