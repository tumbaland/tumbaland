import React, { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';

export interface CanvasText {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DraggableTextBoxProps {
  textBoxes: CanvasText[];
  setTextBoxes: React.Dispatch<React.SetStateAction<CanvasText[]>>;
  onDoubleClick: (idx: number) => void;
}

const DraggableTextBox: React.FC<DraggableTextBoxProps> = ({ textBoxes, setTextBoxes, onDoubleClick }) => {
  const [dragTextId, setDragTextId] = useState<string | null>(null);
  const [dragTextOffset, setDragTextOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [resizeTextId, setResizeTextId] = useState<string | null>(null);
  const [resizeOrigin, setResizeOrigin] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  // Start drag for text box
  const handleTextBoxMouseDown = (id: string, e: React.MouseEvent<HTMLDivElement, MouseEvent>, textBox: CanvasText) => {
    // Prevent drag if clicking on resize handle
    if ((e.target as HTMLElement).classList.contains('resize-handle')) return;
    e.stopPropagation();
    setDragTextId(id);
    setDragTextOffset({ x: e.clientX - textBox.x, y: e.clientY - textBox.y });
  };

  // Start resize for text box
  const handleResizeMouseDown = (id: string, e: React.MouseEvent<HTMLDivElement, MouseEvent>, textBox: CanvasText) => {
    e.stopPropagation();
    setResizeTextId(id);
    setResizeOrigin({ x: e.clientX, y: e.clientY });
    setResizeStart({ width: textBox.width, height: textBox.height });
  };

  // Move text box with mouse when in drag mode
  useEffect(() => {
    if (!dragTextId) return;
    const handleMouseMove = (e: MouseEvent) => {
      setTextBoxes((prev) =>
        prev.map((t) =>
          t.id === dragTextId ? { ...t, x: e.clientX - dragTextOffset.x, y: e.clientY - dragTextOffset.y } : t
        )
      );
    };
    const handleMouseUp = () => {
      setDragTextId(null);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragTextId, dragTextOffset, setTextBoxes]);

  // Resize text box with mouse when in resize mode
  useEffect(() => {
    if (!resizeTextId) return;
    const handleMouseMove = (e: MouseEvent) => {
      setTextBoxes((prev) =>
        prev.map((t) =>
          t.id === resizeTextId
            ? {
                ...t,
                width: Math.max(60, resizeStart.width + (e.clientX - resizeOrigin.x)),
                height: Math.max(32, resizeStart.height + (e.clientY - resizeOrigin.y))
              }
            : t
        )
      );
    };
    const handleMouseUp = () => {
      setResizeTextId(null);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizeTextId, resizeOrigin, resizeStart, setTextBoxes]);

  return (
    <>
      {textBoxes.map((textBox, idx) => (
        <Box
          key={textBox.id}
          sx={{
            position: 'absolute',
            left: textBox.x,
            top: textBox.y,
            width: textBox.width,
            height: textBox.height,
            zIndex: 3,
            border: '2.5px solid #e91e63',
            borderRadius: 12,
            background: 'rgba(255, 192, 203, 0.12)', // light pink transparent
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: dragTextId === textBox.id ? 'grabbing' : resizeTextId === textBox.id ? 'nwse-resize' : 'move',
            userSelect: 'none',
            transition: 'box-shadow 0.2s'
          }}
          onMouseDown={(e) => handleTextBoxMouseDown(textBox.id, e, textBox)}
          onDoubleClick={() => onDoubleClick(idx)}
        >
          <Typography
            sx={{
              color: '#e91e63', // vibrant pink
              width: '100%',
              textAlign: 'center',
              px: 1,
              py: 0.5,
              fontWeight: 700,
              letterSpacing: 1,
              overflow: 'hidden',
              whiteSpace: 'pre-line',
              fontFamily: 'inherit',
              lineHeight: 1.1,
              fontSize: '2rem'
            }}
          >
            {textBox.text}
          </Typography>
          {/* Resize handle */}
          <Box
            className="resize-handle"
            sx={{
              position: 'absolute',
              right: 0,
              bottom: 0,
              width: 20,
              height: 20,
              cursor: 'nwse-resize',
              background: 'none',
              zIndex: 10
            }}
            onMouseDown={(e) => handleResizeMouseDown(textBox.id, e, textBox)}
          />
        </Box>
      ))}
    </>
  );
};

export default DraggableTextBox;
