import { useState, useEffect } from 'react';
import clsx from 'clsx';
import { triggerTaskCompletionEffect } from '@/utils/celebration';

interface TaskCheckButtonProps {
  checked: boolean;
  onToggle: () => void | Promise<unknown>;
  disabled?: boolean;
  size?: 'sm' | 'md';
  label?: string;
  title?: string;
  className?: string;
}

export default function TaskCheckButton({
  checked,
  onToggle,
  disabled = false,
  size = 'md',
  label = 'Mark complete',
  title,
  className,
}: TaskCheckButtonProps) {
  const [animatingCheck, setAnimatingCheck] = useState(false);

  useEffect(() => {
    if (!animatingCheck) return;
    const timer = window.setTimeout(() => setAnimatingCheck(false), 550);
    return () => window.clearTimeout(timer);
  }, [animatingCheck]);

  const isVisuallyChecked = checked || animatingCheck;

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    if (disabled) return;

    if (!checked) {
      setAnimatingCheck(true);
      triggerTaskCompletionEffect(e);
    } else {
      setAnimatingCheck(false);
    }

    onToggle();
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={handleClick}
      title={title ?? (isVisuallyChecked ? 'Completed' : 'Mark complete')}
      aria-label={label}
      aria-pressed={isVisuallyChecked}
      className={clsx(
        'relative rounded-lg border flex items-center justify-center shrink-0 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 focus-visible:ring-offset-1',
        size === 'sm' ? 'w-4 h-4' : 'w-5 h-5',
        isVisuallyChecked
          ? 'bg-gradient-to-br from-[#D44FA6] to-[#9333EA] border-[#B8328A] text-white shadow-xs'
          : 'border-[#DEC0DC] hover:border-[#D44FA6] hover:bg-[#FDF4F9] bg-[#FFFBFD] text-transparent',
        animatingCheck && 'animate-check-pop',
        disabled && 'opacity-60 cursor-not-allowed',
        className
      )}
    >
      <svg
        viewBox="0 0 14 14"
        fill="none"
        className={clsx(
          'pointer-events-none',
          size === 'sm' ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'
        )}
        aria-hidden="true"
      >
        <path
          d="M2.5 7.2L5.6 10.3L11.5 3.8"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={clsx(
            'transition-all duration-200',
            isVisuallyChecked
              ? 'opacity-100 [stroke-dasharray:16] [stroke-dashoffset:0]'
              : 'opacity-0 [stroke-dasharray:16] [stroke-dashoffset:16]',
            animatingCheck && 'animate-check-draw'
          )}
        />
      </svg>
    </button>
  );
}
