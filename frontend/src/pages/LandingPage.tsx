import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
  const navigate = useNavigate();
  const [isExiting, setIsExiting] = useState(false);
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });
  const titleLetters = 'TaskTracker'.split('');

  const triggerEnterDashboard = useCallback(() => {
    if (isExiting) return;
    setIsExiting(true);

    setTimeout(() => {
      navigate('/dashboard');
    }, 360);
  }, [isExiting, navigate]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        triggerEnterDashboard();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [triggerEnterDashboard]);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const nx = (e.clientX / window.innerWidth - 0.5) * 2;
    const ny = (e.clientY / window.innerHeight - 0.5) * 2;
    setMouseOffset({ x: nx, y: ny });
  }

  return (
    <div
      onClick={triggerEnterDashboard}
      onMouseMove={handleMouseMove}
      role="button"
      tabIndex={0}
      aria-label="TaskTracker"
      className={`relative min-h-screen w-full overflow-hidden diary-page-surface text-slate-900 select-none cursor-pointer flex items-center justify-center p-6 sm:p-12 transition-all duration-400 ease-out ${
        isExiting ? 'opacity-0 scale-[1.03]' : 'opacity-100 scale-100'
      }`}
    >
      {/* Interactive Stacked Diary Spread Centerpiece */}
      <div
        style={{
          transform: `translate3d(${mouseOffset.x * -10}px, ${mouseOffset.y * -8}px, 0)`,
        }}
        className="relative w-full max-w-3xl transition-transform duration-300 ease-out"
      >
        {/* Bottom Stacked Lavender Diary Sheet */}
        <div
          aria-hidden="true"
          className="absolute inset-0 translate-x-3.5 translate-y-3.5 -rotate-[1.4deg] rounded-[28px] bg-[#F3E8FF]/90 border border-[#DFC5F7] shadow-sm"
        />

        {/* Middle Stacked Rose-Blush Diary Sheet */}
        <div
          aria-hidden="true"
          className="absolute inset-0 -translate-x-2.5 translate-y-2 rotate-[1.1deg] rounded-[28px] bg-[#FCE7F3]/90 border border-[#F3C2E2] shadow-sm"
        />

        {/* Primary Diary Cover Sheet (Plain Behind Text) */}
        <div className="relative rounded-[28px] bg-[#FFFCFE] border border-[#E5C5E3] px-8 py-20 sm:px-16 sm:py-28 overflow-hidden shadow-[0_24px_60px_-15px_rgba(150,36,111,0.14)]">
          {/* Silk Bookmark Ribbon at Top Right */}
          <div
            aria-hidden="true"
            className="absolute top-0 right-12 sm:right-16 w-7 h-20 bg-gradient-to-b from-[#D44FA6] to-[#9333EA] shadow-sm"
            style={{
              clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 82%, 0 100%)',
            }}
          />

          {/* Delicate Double-Line Stationery Frame */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-4 sm:inset-6 rounded-[20px] border border-[#E8C8E6]/80"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-5 sm:inset-7 rounded-[16px] border border-dashed border-[#E8C8E6]/60"
          />

          {/* Notebook Spine Binding Loops on Left Edge */}
          <div
            aria-hidden="true"
            className="hidden sm:flex flex-col justify-between absolute left-3 top-14 bottom-14 py-2"
          >
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="w-4 h-2.5 rounded-full bg-gradient-to-r from-[#E2BEDF] to-[#F8EDF7] border border-[#D3A6CF]"
              />
            ))}
          </div>

          {/* Monumental Editorial Title */}
          <div className="relative z-10 flex flex-col items-center justify-center text-center">
            <h1
              aria-label="TaskTracker"
              className="text-5xl sm:text-7xl md:text-8xl tracking-tight text-[#2A1029] flex items-center justify-center"
            >
              {titleLetters.map((char, index) => (
                <span
                  key={index}
                  style={{ animationDelay: `${index * 45}ms` }}
                  className="inline-block opacity-0 animate-fade-up"
                >
                  {char}
                </span>
              ))}
            </h1>

            {/* Subtle Stationery Flourish Rule */}
            <div
              aria-hidden="true"
              className="mt-6 flex items-center gap-3 opacity-80"
            >
              <span className="w-12 sm:w-20 h-px bg-gradient-to-r from-transparent to-[#D44FA6]/50" />
              <span className="w-2 h-2 rotate-45 border border-[#C83E8B]/60 bg-[#FCE7F3]" />
              <span className="w-12 sm:w-20 h-px bg-gradient-to-l from-transparent to-[#9333EA]/50" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
