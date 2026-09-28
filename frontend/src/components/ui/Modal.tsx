import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { ModalProps } from '@/types';

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-[2px]" />
      <div
        className="relative w-full max-w-lg rounded-2xl bg-white border border-[#F0DFEE] shadow-xl animate-scale-in max-h-[90vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Modal'}
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0DFEE] shrink-0">
            <h2 className="text-base text-slate-900 tracking-tight">{title}</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-[#FDF4F9] transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
