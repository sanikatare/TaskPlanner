import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GraduationCap, Mail, Lock, User, Clock, ArrowRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function RegisterPage() {
  const { registerWithEmail } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    displayName: '',
    email: '',
    password: '',
    studyHoursPerDay: 6,
  });
  const [loading, setLoading] = useState(false);

  function update(field: string, value: string | number) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await registerWithEmail(
        form.email,
        form.password,
        form.displayName,
        form.studyHoursPerDay
      );
      navigate('/');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      {/* Left Brand Panel */}
      <div className="auth-panel">
        <div>
          <div className="flex items-center gap-2.5 mb-14">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white">
              <GraduationCap className="w-4 h-4" />
            </div>
            <span className="text-base font-semibold tracking-tight text-white">
              StudyAI
            </span>
          </div>
          <h1 className="text-3xl xl:text-4xl font-semibold leading-tight text-white tracking-tight max-w-md">
            Build a realistic study rhythm this semester.
          </h1>
          <p className="text-slate-400 text-sm sm:text-base max-w-md leading-relaxed mt-4">
            Set your available daily study hours and let StudyAI break down complex coursework into manageable daily blocks.
          </p>
        </div>

        <div className="space-y-4 border-t border-slate-800 pt-8 text-xs text-slate-400">
          <div>01. Personalized daily study capacity and deadline alerts</div>
          <div>02. Automatic time estimation based on subject and difficulty</div>
          <div>03. Weekly completion analytics and streak tracking</div>
        </div>
      </div>

      {/* Right Register Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="card p-7 sm:p-8">
            <h2 className="text-lg font-semibold text-slate-900">Create your account</h2>
            <p className="text-xs text-slate-500 mt-1 mb-6">
              Set up your student workspace in seconds
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={form.displayName}
                    onChange={(e) => update('displayName', e.target.value)}
                    placeholder="Your name"
                    className="input pl-9"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="label">University Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => update('email', e.target.value)}
                    placeholder="you@university.edu"
                    className="input pl-9"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => update('password', e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="input pl-9"
                    minLength={6}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="label">Available Study Hours per Day</label>
                <div className="relative">
                  <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="number"
                    value={form.studyHoursPerDay}
                    onChange={(e) => update('studyHoursPerDay', Number(e.target.value))}
                    min={1}
                    max={16}
                    className="input pl-9 font-mono tabular-nums"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-2.5 mt-1"
              >
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
            </form>

            <p className="text-center text-xs text-slate-500 mt-6">
              Already have an account?{' '}
              <Link
                to="/login"
                className="font-semibold text-brand-600 hover:text-brand-700 inline-flex items-center gap-1"
              >
                Sign in <ArrowRight className="w-3 h-3" />
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
