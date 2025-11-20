import React, { useState, useEffect, useRef } from 'react';

interface ResizablePanelProps {
  id: string;
  defaultHeight?: number; // px
  minHeight?: number;
  children: React.ReactNode;
  className?: string;
}

// Simple vertical drag-resizable wrapper. Stores height in localStorage under key `panel-size:<id>`.
// Width is managed by the grid layout; only height is adjusted.
const ResizablePanel: React.FC<ResizablePanelProps> = ({
  id,
  defaultHeight = 260,
  minHeight = 160,
  children,
  className = ''
}) => {
  const stored = typeof window !== 'undefined' ? localStorage.getItem(`panel-size:${id}`) : null;
  const initialH = stored ? JSON.parse(stored).h : defaultHeight;
  const [height, setHeight] = useState<number>(initialH);
  const [dragging, setDragging] = useState(false);
  const startPos = useRef<{ y: number; h: number } | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`panel-size:${id}`, JSON.stringify({ h: height }));
    }
  }, [height, id]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging || !startPos.current) return;
      const dy = e.clientY - startPos.current.y;
      const newH = Math.max(minHeight, startPos.current.h + dy);
      setHeight(newH);
    };
    const onUp = () => {
      setDragging(false);
      startPos.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, minHeight]);

  const beginDrag = (e: React.MouseEvent) => {
    setDragging(true);
    startPos.current = { y: e.clientY, h: height };
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div
      className={`resizable-panel ${className}`}
      style={{ height, position: 'relative' }}
    >
      {children}
      <div
        className={`resize-handle active`}
        onMouseDown={beginDrag}
        title={'Drag to resize height'}
      />
    </div>
  );
};

export default ResizablePanel;