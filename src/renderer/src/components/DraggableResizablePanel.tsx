import React, { useState, useEffect, useRef, useCallback } from 'react';

interface LayoutRecord { x: number; y: number; w: number; h: number; }
interface DraggableResizablePanelProps {
  id: string;
  defaultX?: number;
  defaultY?: number;
  defaultWidth?: number;
  defaultHeight?: number;
  minWidth?: number;
  minHeight?: number;
  children: React.ReactNode;
  className?: string;
}

// Absolute-positioned draggable + resizable panel. Persists in localStorage under key `panel-layout:<id>`.
const DraggableResizablePanel: React.FC<DraggableResizablePanelProps> = ({
  id,
  defaultX = 20,
  defaultY = 20,
  defaultWidth = 380,
  defaultHeight = 260,
  minWidth = 240,
  minHeight = 160,
  children,
  className = ''
}) => {
  const stored = typeof window !== 'undefined' ? localStorage.getItem(`panel-layout:${id}`) : null;
  const initial: LayoutRecord = stored ? JSON.parse(stored) : { x: defaultX, y: defaultY, w: defaultWidth, h: defaultHeight };
  const [layout, setLayout] = useState<LayoutRecord>(initial);
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const resizeRef = useRef<{ sx: number; sy: number; ow: number; oh: number } | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);

  useEffect(() => { if (typeof window !== 'undefined') localStorage.setItem(`panel-layout:${id}`, JSON.stringify(layout)); }, [layout, id]);

  const constrain = useCallback((x: number, y: number, w: number, h: number) => {
    const maxW = window.innerWidth - 40;
    const maxH = window.innerHeight - 40;
    const nx = Math.min(Math.max(0, x), Math.max(0, maxW - w));
    const ny = Math.min(Math.max(0, y), Math.max(0, maxH - h));
    const nw = Math.min(Math.max(minWidth, w), maxW);
    const nh = Math.min(Math.max(minHeight, h), maxH);
    return { x: nx, y: ny, w: nw, h: nh };
  }, [minWidth, minHeight]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragging && dragRef.current) {
        const dx = e.clientX - dragRef.current.sx;
        const dy = e.clientY - dragRef.current.sy;
        setLayout(prev => constrain(dragRef.current!.ox + dx, dragRef.current!.oy + dy, prev.w, prev.h));
      } else if (resizing && resizeRef.current) {
        const dx = e.clientX - resizeRef.current.sx;
        const dy = e.clientY - resizeRef.current.sy;
        setLayout(prev => constrain(prev.x, prev.y, resizeRef.current!.ow + dx, resizeRef.current!.oh + dy));
      }
    };
    const onUp = () => { setDragging(false); setResizing(false); dragRef.current = null; resizeRef.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging, resizing, constrain]);

  const beginDrag = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // left only
    setDragging(true);
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: layout.x, oy: layout.y };
    e.preventDefault();
  };

  const beginResize = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setResizing(true);
    resizeRef.current = { sx: e.clientX, sy: e.clientY, ow: layout.w, oh: layout.h };
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div
      ref={panelRef}
      className={`dr-panel ${className} ${dragging?'dragging':''} ${resizing?'resizing':''}`}
      style={{ position:'absolute', left: layout.x, top: layout.y, width: layout.w, height: layout.h }}
    >
      <div className="dr-bar" onMouseDown={beginDrag} title="Drag panel">
        <span className="dr-title">{id}</span>
        <button className="dr-reset" onClick={()=> setLayout(constrain(defaultX, defaultY, defaultWidth, defaultHeight))} title="Reset size & position">↺</button>
      </div>
      <div className="dr-body">{children}</div>
      <div className="dr-resize" onMouseDown={beginResize} title="Resize panel" />
    </div>
  );
};

export default DraggableResizablePanel;