import type React from 'react';

let lastBurstTimestamp = 0;

const CONFETTI_COLORS = [
  '#10b981', // emerald-500
  '#059669', // emerald-600
  '#2563eb', // brand-600
  '#3b82f6', // brand-500
  '#14b8a6', // teal-500
  '#f59e0b', // amber-500
];

export interface BurstOrigin {
  x: number;
  y: number;
}

function resolveOrigin(
  input?: BurstOrigin | React.MouseEvent<HTMLElement> | MouseEvent | HTMLElement | null
): BurstOrigin {
  if (input && typeof input === 'object') {
    if ('clientX' in input && typeof input.clientX === 'number' && input.clientX > 0) {
      const target = input.currentTarget as HTMLElement | null;
      if (target && typeof target.getBoundingClientRect === 'function') {
        const rect = target.getBoundingClientRect();
        return {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        };
      }
      return { x: input.clientX, y: input.clientY };
    }
    if ('getBoundingClientRect' in input && typeof input.getBoundingClientRect === 'function') {
      const rect = input.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    }
    if ('x' in input && 'y' in input) {
      return { x: input.x, y: input.y };
    }
  }

  // Fallback to currently focused element if it's a button/select on screen
  if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
    const rect = document.activeElement.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.left >= 0) {
      return {
        x: rect.left + Math.min(rect.width / 2, 48),
        y: rect.top + rect.height / 2,
      };
    }
  }

  return {
    x: typeof window !== 'undefined' ? window.innerWidth / 2 : 400,
    y: typeof window !== 'undefined' ? Math.min(window.innerHeight * 0.28, 220) : 200,
  };
}

/**
 * Triggers a subtle, compositor-driven check-off ring and micro-confetti burst
 * to reinforce positive productivity behavior when a task or study block is completed.
 */
export function triggerTaskCompletionEffect(
  source?: BurstOrigin | React.MouseEvent<HTMLElement> | MouseEvent | HTMLElement | null
): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  // Debounce rapid duplicate triggers (e.g. button click + mutation onSuccess)
  const now = performance.now();
  if (now - lastBurstTimestamp < 260) return;
  lastBurstTimestamp = now;

  // Respect user motion preferences
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  const origin = resolveOrigin(source);

  const container = document.createElement('div');
  container.setAttribute('aria-hidden', 'true');
  container.style.position = 'fixed';
  container.style.left = `${origin.x}px`;
  container.style.top = `${origin.y}px`;
  container.style.width = '0px';
  container.style.height = '0px';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '9999';
  document.body.appendChild(container);

  // 1. Subtle expanding emerald completion halo
  const ring = document.createElement('div');
  ring.style.position = 'absolute';
  ring.style.left = '-14px';
  ring.style.top = '-14px';
  ring.style.width = '28px';
  ring.style.height = '28px';
  ring.style.borderRadius = '9999px';
  ring.style.border = '2px solid #10b981';
  ring.style.willChange = 'transform, opacity';
  container.appendChild(ring);

  ring.animate(
    [
      { transform: 'scale(0.45)', opacity: 0.75 },
      { transform: 'scale(1.95)', opacity: 0 },
    ],
    {
      duration: 460,
      easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      fill: 'forwards',
    }
  );

  // 2. Micro-confetti particles (16 lightweight geometric flecks)
  const particleCount = 16;
  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    const shapeType = i % 3; // 0: pill confetti, 1: circle dot, 2: diamond spark

    particle.style.position = 'absolute';
    particle.style.backgroundColor = color;
    particle.style.willChange = 'transform, opacity';

    if (shapeType === 0) {
      particle.style.width = '7px';
      particle.style.height = '3.5px';
      particle.style.borderRadius = '2px';
      particle.style.left = '-3.5px';
      particle.style.top = '-1.75px';
    } else if (shapeType === 1) {
      particle.style.width = '5px';
      particle.style.height = '5px';
      particle.style.borderRadius = '9999px';
      particle.style.left = '-2.5px';
      particle.style.top = '-2.5px';
    } else {
      particle.style.width = '5px';
      particle.style.height = '5px';
      particle.style.borderRadius = '1px';
      particle.style.left = '-2.5px';
      particle.style.top = '-2.5px';
    }

    container.appendChild(particle);

    // Distribute angles evenly around the circle with slight natural jitter
    const baseAngle = (i / particleCount) * Math.PI * 2;
    const angle = baseAngle + (Math.random() - 0.5) * 0.28;
    const distance = 24 + Math.random() * 28; // Subtle 24px-52px radius
    const tx = Math.cos(angle) * distance;
    const ty = Math.sin(angle) * distance - 6; // Slight upward lift initially
    const gravityY = ty + 14 + Math.random() * 8; // Gentle downward drift at end
    const rotationStart = Math.round(Math.random() * 90);
    const rotationEnd = rotationStart + (Math.random() > 0.5 ? 1 : -1) * (140 + Math.random() * 140);
    const duration = 520 + Math.random() * 180;

    particle.animate(
      [
        {
          transform: `translate3d(0px, 0px, 0) rotate(${rotationStart}deg) scale(0.4)`,
          opacity: 1,
        },
        {
          transform: `translate3d(${tx * 0.78}px, ${ty * 0.78}px, 0) rotate(${
            (rotationStart + rotationEnd) / 2
          }deg) scale(1.05)`,
          opacity: 0.95,
          offset: 0.45,
        },
        {
          transform: `translate3d(${tx}px, ${gravityY}px, 0) rotate(${rotationEnd}deg) scale(0.25)`,
          opacity: 0,
        },
      ],
      {
        duration,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        fill: 'forwards',
      }
    );
  }

  window.setTimeout(() => {
    container.remove();
  }, 750);
}
