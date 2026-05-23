import { useRef, useState, type DragEvent } from "react";

interface AttachmentDropZoneProps {
  txnId: string;
  onDrop: (txnId: string, file: File) => void;
  uploading: boolean;
  hasAttachment: boolean;
  children: React.ReactNode;
}

/**
 * Entoure le bouton 📎 d'une zone de drag & drop.
 * Lorsqu'un fichier est glissé sur la ligne, elle devient une cible de drop visible.
 */
export function AttachmentDropZone({ txnId, onDrop, uploading, hasAttachment, children }: AttachmentDropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const dragCounter = useRef(0);

  function handleDragEnter(e: DragEvent) {
    e.preventDefault();
    dragCounter.current++;
    if (e.dataTransfer.types.includes("Files")) setDragging(true);
  }
  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setDragging(false);
  }
  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }
  function handleDrop(e: DragEvent) {
    e.preventDefault();
    dragCounter.current = 0;
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && !uploading) onDrop(txnId, file);
  }

  return (
    <div
      className={`relative flex items-center justify-center transition-all ${
        dragging ? "ring-1 ring-blue-400 rounded bg-blue-900/20" : ""
      }`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      title={hasAttachment ? "Glisser pour remplacer la pièce jointe" : "Glisser un fichier ou cliquer 📎"}
    >
      {children}
      {dragging && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-blue-400 text-[10px]">drop</span>
        </div>
      )}
    </div>
  );
}
