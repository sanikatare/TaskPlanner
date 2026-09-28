import { GraduationCap } from 'lucide-react';

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#F8FAFC]">
      <div className="flex flex-col items-center">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-brand-600 text-white shadow-sm mb-4">
          <GraduationCap className="w-5 h-5" />
        </div>
        <div className="text-base font-semibold text-slate-900 tracking-tight">StudyAI</div>
        <div className="text-xs text-slate-500 mt-1 mb-5">Preparing your study workspace...</div>
        <div className="w-36 h-1 rounded-full bg-slate-200 overflow-hidden">
          <div className="h-full w-1/2 bg-brand-600 rounded-full animate-pulse" />
        </div>
      </div>
    </div>
  );
}
