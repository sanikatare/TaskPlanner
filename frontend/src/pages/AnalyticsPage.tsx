import { useQuery } from '@tanstack/react-query';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import apiClient from '@/utils/apiClient';
import type { Analytics } from '@/types';
import { DAYS_OF_WEEK } from '@/config/constants';
import { hoursToReadable } from '@/utils/dateUtils';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        color: '#6E476C',
        font: { family: '"Playfair Display", Georgia, serif', size: 11, weight: 'normal' as const },
        padding: 14,
        usePointStyle: true,
        pointStyleWidth: 8,
      },
    },
    tooltip: {
      backgroundColor: '#2A122B',
      borderColor: '#543253',
      borderWidth: 1,
      titleColor: '#FDF2F8',
      bodyColor: '#F9CEE9',
      titleFont: { family: '"Playfair Display", Georgia, serif', weight: 'normal' as const, size: 12 },
      bodyFont: { family: '"Playfair Display", Georgia, serif', weight: 'normal' as const, size: 11 },
      padding: 10,
      boxPadding: 5,
      cornerRadius: 10,
      displayColors: true,
      usePointStyle: true,
    },
  },
  scales: {
    x: {
      ticks: { color: '#8D648A', font: { family: '"Playfair Display", Georgia, serif', weight: 'normal' as const, size: 11 } },
      grid: { color: '#F8EDF6', drawBorder: false },
      border: { display: false },
    },
    y: {
      ticks: { color: '#8D648A', font: { family: '"Playfair Display", Georgia, serif', weight: 'normal' as const, size: 11 } },
      grid: { color: '#F8EDF6', drawBorder: false },
      border: { display: false },
    },
  },
};

export default function AnalyticsPage() {
  const { data: analytics, isLoading } = useQuery<Analytics>({
    queryKey: ['analytics'],
    queryFn: async () => (await apiClient.get('/analytics')).data.data,
  });

  if (isLoading) {
    return (
      <div className="page-shell space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-72" />
          ))}
        </div>
      </div>
    );
  }

  const weekLabels = (analytics?.weeklyProgress ?? []).map(
    (w) => DAYS_OF_WEEK[new Date(w.date).getDay()]
  );

  const weeklyChartData = {
    labels: weekLabels,
    datasets: [
      {
        label: 'Completed Blocks',
        data: (analytics?.weeklyProgress ?? []).map((w) => w.completed),
        backgroundColor: '#D645A6',
        borderRadius: 6,
      },
      {
        label: 'Planned Blocks',
        data: (analytics?.weeklyProgress ?? []).map((w) => w.planned),
        backgroundColor: '#E9D5FF',
        borderRadius: 6,
      },
    ],
  };

  const studyHoursData = {
    labels: weekLabels,
    datasets: [
      {
        label: 'Study Hours',
        data: (analytics?.weeklyProgress ?? []).map((w) => w.studyHours),
        fill: true,
        backgroundColor: 'rgba(214, 69, 166, 0.12)',
        borderColor: '#BA2D8B',
        borderWidth: 2,
        tension: 0.35,
        pointBackgroundColor: '#FFFBFD',
        pointBorderColor: '#BA2D8B',
        pointBorderWidth: 2,
        pointRadius: 3.5,
        pointHoverRadius: 5,
      },
    ],
  };

  const subjectLabels = Object.keys(analytics?.tasksBySubject ?? {});
  const subjectColors = [
    '#D645A6',
    '#9333EA',
    '#E874C0',
    '#A855F7',
    '#7E1C5D',
    '#F4A6D7',
  ];
  const doughnutData = {
    labels: subjectLabels,
    datasets: [
      {
        data: Object.values(analytics?.tasksBySubject ?? {}),
        backgroundColor: subjectColors.slice(0, subjectLabels.length),
        borderColor: '#ffffff',
        borderWidth: 2,
      },
    ],
  };

  const completionRate = analytics?.completionRate ?? 0;

  return (
    <div className="page-shell space-y-6">
      {/* Header */}
      <div>
        <h1 className="page-title">Analytics</h1>
        <p className="page-subtitle">
          Quantitative breakdown of task completion, logged study hours, and subject allocation
        </p>
      </div>

      {/* Top KPI Strip (Tabular Numerals) */}
      <div className="card grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#F0DFEE]">
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">Completion Rate</div>
          <div className="stat-number mt-2">{completionRate.toFixed(0)}%</div>
          <div className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
            {analytics?.completedTasks ?? 0} of {analytics?.totalTasks ?? 0} tasks completed
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">Total Study Hours</div>
          <div className="stat-number mt-2">
            {hoursToReadable(analytics?.totalStudyHours ?? 0)}
          </div>
          <div className="text-xs text-slate-500 mt-1">Logged across study sessions</div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">Avg. Focus Score</div>
          <div className="stat-number mt-2">
            {(analytics?.avgProductivityScore ?? 0).toFixed(1)}
            <span className="text-sm font-normal text-slate-400">/10</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">Self-reported & inferred</div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">Study Streak</div>
          <div className="stat-number mt-2">{analytics?.streakDays ?? 0}d</div>
          <div className="text-xs text-slate-500 mt-1">Consecutive active days</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Completions */}
        <div className="card p-5 sm:p-6">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Weekly Block Execution
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Completed vs. planned study blocks over the past 7 days
            </p>
          </div>
          <div className="h-60">
            <Bar
              data={weeklyChartData}
              options={{
                ...CHART_DEFAULTS,
                scales: {
                  ...CHART_DEFAULTS.scales,
                  y: {
                    ...CHART_DEFAULTS.scales.y,
                    beginAtZero: true,
                    ticks: { ...CHART_DEFAULTS.scales.y.ticks, stepSize: 1 },
                  },
                },
              } as never}
            />
          </div>
        </div>

        {/* Daily Study Hours */}
        <div className="card p-5 sm:p-6">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-900">Daily Study Hours</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Focused hours logged per day over the past week
            </p>
          </div>
          <div className="h-60">
            <Line
              data={studyHoursData}
              options={{
                ...CHART_DEFAULTS,
                plugins: { ...CHART_DEFAULTS.plugins, legend: { display: false } },
                scales: {
                  ...CHART_DEFAULTS.scales,
                  y: { ...CHART_DEFAULTS.scales.y, beginAtZero: true },
                },
              } as never}
            />
          </div>
        </div>

        {/* Tasks by Subject */}
        <div className="card p-5 sm:p-6">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Workload by Subject
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Task distribution across enrolled courses
            </p>
          </div>
          {subjectLabels.length > 0 ? (
            <div className="h-56 flex items-center justify-center">
              <Doughnut
                data={doughnutData}
                options={{
                  ...CHART_DEFAULTS,
                  scales: undefined,
                  cutout: '66%',
                  plugins: {
                    ...CHART_DEFAULTS.plugins,
                    legend: {
                      position: 'right' as const,
                      labels: {
                        ...CHART_DEFAULTS.plugins.legend.labels,
                        padding: 12,
                      },
                    },
                  },
                } as never}
              />
            </div>
          ) : (
            <div className="h-56 flex items-center justify-center text-xs text-slate-500">
              No subject data available yet.
            </div>
          )}
        </div>

        {/* Task Status Breakdown */}
        <div className="card p-5 sm:p-6">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-900">Status Distribution</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Breakdown of tasks by current workflow stage
            </p>
          </div>
          <div className="space-y-4 mt-4">
            {[
              {
                label: 'Completed',
                value: analytics?.completedTasks ?? 0,
                color: '#C83E8B',
              },
              {
                label: 'Pending & In Progress',
                value:
                  (analytics?.totalTasks ?? 0) -
                  (analytics?.completedTasks ?? 0) -
                  (analytics?.skippedTasks ?? 0),
                color: '#A855F7',
              },
              {
                label: 'Skipped',
                value: analytics?.skippedTasks ?? 0,
                color: '#E9D5FF',
              },
            ].map((item) => {
              const total = Math.max(1, analytics?.totalTasks ?? 1);
              const pct = Math.max(0, (item.value / total) * 100);
              return (
                <div key={item.label}>
                  <div className="flex justify-between items-center text-xs mb-1.5">
                    <span className="font-medium text-slate-700">{item.label}</span>
                    <span className="font-mono tabular-nums text-slate-600">
                      {item.value} ({pct.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="progress-bar h-2">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: item.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
