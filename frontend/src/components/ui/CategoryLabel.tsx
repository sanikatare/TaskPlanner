import clsx from 'clsx';
import { CATEGORY_CONFIG } from '@/config/constants';
import type { SubjectCategory } from '@/types';

interface CategoryLabelProps {
  category?: SubjectCategory | string;
  size?: 'xs' | 'sm';
  onClick?: () => void;
  active?: boolean;
  className?: string;
}

export default function CategoryLabel({
  category = 'study',
  size = 'xs',
  onClick,
  active = false,
  className,
}: CategoryLabelProps) {
  const key = (category in CATEGORY_CONFIG ? category : 'other') as SubjectCategory;
  const cfg = CATEGORY_CONFIG[key] ?? CATEGORY_CONFIG.other;

  const baseClasses = clsx(
    'inline-flex items-center gap-1.5 rounded-md border font-medium transition-colors whitespace-nowrap shrink-0',
    size === 'xs' ? 'px-2 py-0.5 text-[11px] leading-4' : 'px-2.5 py-1 text-xs',
    active
      ? cfg.activeClass
      : clsx(cfg.bgClass, cfg.textClass, cfg.borderClass),
    onClick && 'cursor-pointer hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30',
    className
  );

  const content = (
    <>
      <span
        className={clsx(
          'w-1.5 h-1.5 rounded-full shrink-0',
          active ? 'bg-white' : cfg.dotClass
        )}
        aria-hidden="true"
      />
      <span>{cfg.label}</span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className={baseClasses}
        title={`Filter by ${cfg.label}`}
      >
        {content}
      </button>
    );
  }

  return <span className={baseClasses}>{content}</span>;
}

interface CategoryPickerProps {
  value: SubjectCategory;
  onChange: (category: SubjectCategory) => void;
  compact?: boolean;
}

const PRIMARY_CATEGORIES: SubjectCategory[] = [
  'study',
  'work',
  'personal',
  'programming',
  'math',
  'science',
  'lab',
  'theory',
  'project',
  'other',
];

const COMPACT_CATEGORIES: SubjectCategory[] = [
  'study',
  'work',
  'personal',
  'programming',
  'project',
  'lab',
];

export function CategoryPicker({
  value,
  onChange,
  compact = false,
}: CategoryPickerProps) {
  const keys = compact ? COMPACT_CATEGORIES : PRIMARY_CATEGORIES;

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Task category">
      {keys.map((key) => {
        const cfg = CATEGORY_CONFIG[key];
        const isSelected = value === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(key)}
            className={clsx(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-all',
              isSelected
                ? clsx(cfg.activeClass, 'shadow-xs font-semibold')
                : clsx(
                    cfg.bgClass,
                    cfg.textClass,
                    cfg.borderClass,
                    'hover:opacity-90'
                  )
            )}
          >
            <span
              className={clsx(
                'w-1.5 h-1.5 rounded-full shrink-0',
                isSelected ? 'bg-white' : cfg.dotClass
              )}
              aria-hidden="true"
            />
            <span>{cfg.label}</span>
          </button>
        );
      })}
    </div>
  );
}
