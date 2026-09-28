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

  // Interactive filter button
  if (onClick) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className={clsx(
          'inline-flex items-center gap-1.5 rounded-xl border transition-all whitespace-nowrap shrink-0 cursor-pointer hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30',
          size === 'xs' ? 'px-2.5 py-0.5 text-[11px] leading-4' : 'px-3 py-1 text-xs',
          active ? cfg.activeClass : clsx(cfg.bgClass, cfg.textClass, cfg.borderClass),
          className
        )}
        title={`Filter by ${cfg.label}`}
      >
        {content}
      </button>
    );
  }

  // Static metadata: clean unboxed inline text with dot indicator (Zero-Pill Discipline)
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 whitespace-nowrap shrink-0',
        size === 'xs' ? 'text-xs' : 'text-xs',
        cfg.textClass,
        className
      )}
    >
      {content}
    </span>
  );
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
              'inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs border transition-all',
              isSelected
                ? clsx(cfg.activeClass, 'shadow-xs')
                : clsx(cfg.bgClass, cfg.textClass, cfg.borderClass, 'hover:opacity-90')
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
