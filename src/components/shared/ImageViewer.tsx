"use client";

import { useState, useRef, useEffect } from "react";
import { X, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

interface ImageViewerProps {
  src: string;
  alt?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ImageViewer({ src, alt = "Bill Image", isOpen, onClose }: ImageViewerProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement>(null);

  // Reset state when opening using ref to avoid setState in effect
  const prevIsOpenRef = useRef(isOpen);
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      // Just opened - reset state
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen]);

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.5, 5));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.5, 0.5));
  };

  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Handle keyboard events
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "+" || e.key === "=") {
        setScale((prev) => Math.min(prev + 0.5, 5));
      }
      if (e.key === "-") {
        setScale((prev) => Math.max(prev - 0.5, 0.5));
      }
      if (e.key === "0") {
        setScale(1);
        setPosition({ x: 0, y: 0 });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging && e.touches.length === 1) {
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleDoubleClick = () => {
    if (scale > 1) {
      handleReset();
    } else {
      setScale(2);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black"
      role="dialog"
      aria-modal="true"
      aria-label={alt}
    >
      {/* Header with close button */}
      <div className="flex items-center justify-between bg-black/80 px-4 py-3">
        <h4 className="text-sm font-bold text-white truncate flex-1">{alt}</h4>
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <button
            onClick={handleZoomOut}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white active:bg-white/30 transition"
            aria-label="Zoom out"
          >
            <ZoomOut className="h-5 w-5" />
          </button>
          <span className="text-xs font-bold text-white min-w-[3rem] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white active:bg-white/30 transition"
            aria-label="Zoom in"
          >
            <ZoomIn className="h-5 w-5" />
          </button>
          <button
            onClick={handleReset}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white active:bg-white/30 transition"
            aria-label="Reset zoom"
          >
            <RotateCcw className="h-5 w-5" />
          </button>
          {/* Close button */}
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white active:bg-white/30 transition ml-2"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Image container */}
      <div
        className="flex-1 flex items-center justify-center overflow-hidden touch-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={handleDoubleClick}
        style={{ cursor: scale > 1 ? (isDragging ? "grabbing" : "grab") : "default" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imageRef}
          src={src}
          alt={alt}
          className="max-w-full max-h-full object-contain select-none"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transition: isDragging ? "none" : "transform 0.2s ease-out",
          }}
          draggable={false}
        />
      </div>

      {/* Bottom hint */}
      <div className="bg-black/80 px-4 py-2">
        <p className="text-[11px] text-white/60 text-center">
          Pinch to zoom  Double-tap to reset  Drag to pan
        </p>
      </div>
    </div>
  );
}
