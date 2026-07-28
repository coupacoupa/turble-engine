import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { Move, X } from 'lucide-react';

export interface DraggableModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  icon?: React.ReactNode;
  defaultWidth?: number;
  defaultHeight?: number;
  minWidth?: number;
  minHeight?: number;
  children: React.ReactNode;
  footer?: React.ReactNode;
  headerExtra?: React.ReactNode;
  className?: string;
  zIndex?: number;
}

export const DraggableModal: React.FC<DraggableModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  badge,
  icon,
  defaultWidth = 640,
  defaultHeight = 640,
  minWidth = 420,
  minHeight = 360,
  children,
  footer,
  headerExtra,
  className = '',
  zIndex = 50,
}) => {
  // Helper to calculate centered initial coordinates synchronously
  const calculateGeometry = useCallback(() => {
    const winWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const winHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
    const targetWidth = Math.min(defaultWidth, Math.max(minWidth, winWidth - 60));
    const targetHeight = Math.min(defaultHeight, Math.max(minHeight, winHeight - 60));
    const defaultX = Math.max(20, Math.round((winWidth - targetWidth) / 2));
    const defaultY = Math.max(20, Math.round((winHeight - targetHeight) / 2));
    return {
      position: { x: defaultX, y: defaultY },
      size: { width: targetWidth, height: targetHeight },
    };
  }, [defaultWidth, defaultHeight, minWidth, minHeight]);

  // Synchronous state initialization (prevents initial (0,0) flash frame)
  const [position, setPosition] = useState<{ x: number; y: number }>(() => calculateGeometry().position);
  const [size, setSize] = useState<{ width: number; height: number }>(() => calculateGeometry().size);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const dragRef = useRef<{ startX: number; startY: number; posX: number; posY: number }>({
    startX: 0,
    startY: 0,
    posX: 0,
    posY: 0,
  });

  const resizeRef = useRef<{ startX: number; startY: number; startWidth: number; startHeight: number }>({
    startX: 0,
    startY: 0,
    startWidth: defaultWidth,
    startHeight: defaultHeight,
  });

  // Re-center before initial screen paint when modal opens
  useLayoutEffect(() => {
    if (isOpen) {
      const geom = calculateGeometry();
      setPosition(geom.position);
      setSize(geom.size);
    }
  }, [isOpen, calculateGeometry]);

  // Drag Handlers
  const handleDragMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, input, select, textarea')) return;
    e.preventDefault();
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: position.x,
      posY: position.y,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        const newX = Math.min(Math.max(10, dragRef.current.posX + dx), window.innerWidth - size.width - 10);
        const newY = Math.min(Math.max(10, dragRef.current.posY + dy), window.innerHeight - 80);
        setPosition({ x: newX, y: newY });
      } else if (isResizing) {
        const dx = e.clientX - resizeRef.current.startX;
        const dy = e.clientY - resizeRef.current.startY;
        const newWidth = Math.min(Math.max(minWidth, resizeRef.current.startWidth + dx), window.innerWidth - position.x - 20);
        const newHeight = Math.min(Math.max(minHeight, resizeRef.current.startHeight + dy), window.innerHeight - position.y - 20);
        setSize({ width: newWidth, height: newHeight });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, position.x, position.y, size.width, minWidth, minHeight]);

  const handleResizeMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startWidth: size.width,
      startHeight: size.height,
    };
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        zIndex,
      }}
      className={`fixed z-modal bg-white border border-slate-300 rounded-xl shadow-2xl flex flex-col font-sans text-slate-900 transition-shadow duration-150 ${
        isDragging ? 'shadow-emerald-900/20 ring-2 ring-emerald-500/30' : ''
      } ${className}`}
    >
      {/* Header Bar (Draggable - Sleek, Thin, Light Theme) */}
      <div
        onMouseDown={handleDragMouseDown}
        className="px-3.5 py-2.5 bg-slate-100/95 border-b border-slate-200 text-slate-800 rounded-t-xl flex items-center justify-between font-mono cursor-grab active:cursor-grabbing select-none shrink-0"
      >
        <div className="flex items-center space-x-2 min-w-0">
          <Move className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          {icon}
          <div className="truncate flex items-center space-x-2">
            <h3 className="font-bold text-xs text-slate-900 truncate">{title}</h3>
            {subtitle && (
              <span className="text-[10px] text-slate-500 font-sans truncate">{subtitle}</span>
            )}
            {badge && (
              <span className="text-[10px] bg-slate-200/70 text-slate-700 border border-slate-300 px-1.5 py-0.2 rounded font-mono font-semibold truncate">
                {badge}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-1.5 shrink-0 ml-2">
          {headerExtra}
          <button
            type="button"
            onClick={onClose}
            title="Close Modal"
            className="p-1 rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">{children}</div>

      {/* Footer Bar if provided */}
      {footer && (
        <div className="p-3 bg-white border-t border-slate-200 rounded-b-xl shrink-0">
          {footer}
        </div>
      )}

      {/* Bottom-Right Resize Handle */}
      <div
        onMouseDown={handleResizeMouseDown}
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize flex items-center justify-center opacity-40 hover:opacity-100 transition-opacity"
        title="Resize Window"
      >
        <div className="w-1.5 h-1.5 bg-slate-500 rounded-xs" />
      </div>
    </div>
  );
};
