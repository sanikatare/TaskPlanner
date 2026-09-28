import mongoose from 'mongoose';
import crypto from 'crypto';
import { logger } from './logger';

mongoose.set('bufferCommands', false); // CRITICAL: fail fast, don't hang

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri || uri.includes('localhost/mock')) {
    getStore('Task');
    logger.info('Database store initialized');
    return;
  }
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 2000,
      maxPoolSize: 10,
    });
    logger.info(`MongoDB connected: ${mongoose.connection.host}`);
  } catch {
    getStore('Task');
    logger.info('Database store initialized (in-memory mode)');
  }
}

export function isMongoConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

const memoryStores: Record<string, Map<string, Record<string, any>>> = {};
let demoSeeded = false;

function getStore(name: string): Map<string, Record<string, any>> {
  if (!memoryStores[name]) {
    memoryStores[name] = new Map();
  }
  if (!demoSeeded) {
    demoSeeded = true;
    seedDemoWorkspace();
  }
  return memoryStores[name];
}

function seedDemoWorkspace(): void {
  const users = (memoryStores['User'] = new Map());
  const tasks = (memoryStores['Task'] = new Map());
  const blocks = (memoryStores['ScheduleBlock'] = new Map());
  const sessions = (memoryStores['StudySession'] = new Map());
  const plans = (memoryStores['AIStudyPlan'] = new Map());

  const now = new Date();
  const uid = 'student-demo';

  users.set('user-demo-1', {
    _id: 'user-demo-1',
    uid,
    email: 'student@university.edu',
    displayName: 'Student Workspace',
    authProvider: 'local',
    studyHoursPerDay: 6,
    preferredStudyTimes: ['morning', 'evening'],
    subjects: ['Algorithms', 'Distributed Systems', 'Linear Algebra', 'Database Systems', 'Operating Systems'],
    currentSemester: 6,
    googleCalendarConnected: false,
    notificationsEnabled: true,
    streakDays: 5,
    createdAt: new Date(now.getTime() - 14 * 86400000),
    updatedAt: now,
  });

  const addDays = (d: number) => {
    const dt = new Date(now);
    dt.setDate(dt.getDate() + d);
    dt.setHours(23, 59, 0, 0);
    return dt;
  };

  const fmtDate = (d: number) => {
    const dt = new Date(now);
    dt.setDate(dt.getDate() + d);
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const seedTasks = [
    {
      _id: 'task-101',
      userId: uid,
      title: 'Implement Raft Leader Election & Log Replication',
      subject: 'Distributed Systems',
      category: 'programming',
      description: 'Complete RPC handlers for RequestVote and AppendEntries with heartbeat timeouts and split-vote recovery.',
      deadline: addDays(1),
      estimatedHours: 4,
      aiPredictedHours: 4.5,
      priority: 'high',
      status: 'in_progress',
      difficulty: 5,
      tags: ['raft', 'consensus', 'lab-3'],
      createdAt: addDays(-3),
      updatedAt: now,
    },
    {
      _id: 'task-102',
      userId: uid,
      title: 'Dynamic Programming & Network Flow Problem Set',
      subject: 'Algorithms',
      category: 'math',
      description: 'Solve 6 problems covering Bellman-Ford, Ford-Fulkerson max-flow min-cut theorem, and bipartite matching.',
      deadline: addDays(2),
      estimatedHours: 3,
      aiPredictedHours: 3.5,
      priority: 'high',
      status: 'pending',
      difficulty: 4,
      tags: ['graphs', 'dp', 'assignment-4'],
      createdAt: addDays(-2),
      updatedAt: now,
    },
    {
      _id: 'task-103',
      userId: uid,
      title: 'B+ Tree Indexing & Query Optimizer Benchmark',
      subject: 'Database Systems',
      category: 'lab',
      description: 'Profile range scans vs hash index lookups on 1M synthetic rows and write execution plan analysis.',
      deadline: addDays(3),
      estimatedHours: 2.5,
      aiPredictedHours: 2.75,
      priority: 'medium',
      status: 'pending',
      difficulty: 3,
      tags: ['indexing', 'sql', 'benchmarks'],
      createdAt: addDays(-4),
      updatedAt: now,
    },
    {
      _id: 'task-104',
      userId: uid,
      title: 'Singular Value Decomposition & Eigenvalue Proofs',
      subject: 'Linear Algebra',
      category: 'study',
      description: 'Complete spectral theorem derivations and low-rank matrix approximation exercises.',
      deadline: addDays(5),
      estimatedHours: 2,
      aiPredictedHours: 2.25,
      priority: 'medium',
      status: 'pending',
      difficulty: 3,
      tags: ['svd', 'matrices', 'midterm-prep'],
      createdAt: addDays(-3),
      updatedAt: now,
    },
    {
      _id: 'task-105',
      userId: uid,
      title: 'TA Grading & Lab Section Office Hours Prep',
      subject: 'Teaching Assistantship',
      category: 'work',
      description: 'Review lab rubric edge cases and prepare walkthrough slides for Friday recitation.',
      deadline: addDays(4),
      estimatedHours: 1.5,
      aiPredictedHours: 1.5,
      priority: 'medium',
      status: 'pending',
      difficulty: 2,
      tags: ['ta-work', 'grading', 'recitation'],
      createdAt: addDays(-5),
      updatedAt: now,
    },
    {
      _id: 'task-108',
      userId: uid,
      title: 'Summer Internship Resume & Portfolio Update',
      subject: 'Career & Personal',
      category: 'personal',
      description: 'Update systems project metrics and submit applications for summer engineering roles.',
      deadline: addDays(6),
      estimatedHours: 1.5,
      aiPredictedHours: 1.5,
      priority: 'low',
      status: 'pending',
      difficulty: 2,
      tags: ['internship', 'portfolio'],
      createdAt: addDays(-4),
      updatedAt: now,
    },
    {
      _id: 'task-109',
      userId: uid,
      title: 'Operating Systems Virtual Memory Page Table Walkthrough',
      subject: 'Operating Systems',
      category: 'study',
      description: 'Review multi-level page table translation and TLB shootdown latency.',
      deadline: addDays(0),
      estimatedHours: 1.5,
      actualHours: 1.5,
      aiPredictedHours: 1.5,
      priority: 'medium',
      status: 'completed',
      difficulty: 3,
      tags: ['vm', 'tlb', 'paging'],
      completedAt: new Date(now.getTime() - 3 * 3600000), // Completed 3 hours ago (<24h, active)
      isArchived: false,
      createdAt: addDays(-2),
      updatedAt: new Date(now.getTime() - 3 * 3600000),
    },
    {
      _id: 'task-106',
      userId: uid,
      title: 'TCP Congestion Control (Cubic vs BBR) Trace Analysis',
      subject: 'Distributed Systems',
      category: 'lab',
      description: 'Analyze Wireshark packet captures and plot cwnd growth curves.',
      deadline: addDays(-1),
      estimatedHours: 2.5,
      actualHours: 2.5,
      aiPredictedHours: 2.5,
      priority: 'high',
      status: 'completed',
      difficulty: 3,
      tags: ['networking', 'tcp'],
      completedAt: new Date(now.getTime() - 30 * 3600000), // Completed 30 hours ago (>24h, auto-archived)
      isArchived: true,
      archivedAt: new Date(now.getTime() - 6 * 3600000),
      createdAt: addDays(-6),
      updatedAt: addDays(-1),
    },
    {
      _id: 'task-107',
      userId: uid,
      title: 'Amortized Analysis & Fibonacci Heaps Reading',
      subject: 'Algorithms',
      category: 'theory',
      description: 'Read CLRS Chapter 17 & 19 potential method proofs.',
      deadline: addDays(-2),
      estimatedHours: 2,
      actualHours: 1.8,
      aiPredictedHours: 2,
      priority: 'medium',
      status: 'completed',
      difficulty: 3,
      tags: ['clrs', 'heaps'],
      completedAt: new Date(now.getTime() - 52 * 3600000), // Completed 52 hours ago (>24h, auto-archived)
      isArchived: true,
      archivedAt: new Date(now.getTime() - 28 * 3600000),
      createdAt: addDays(-7),
      updatedAt: addDays(-2),
    },
  ];

  seedTasks.forEach((t, index) => {
    tasks.set(t._id, { ...t, order: index });
  });

  const seedBlocks = [
    {
      _id: 'block-201',
      userId: uid,
      taskId: 'task-101',
      date: fmtDate(0),
      startTime: '08:30',
      endTime: '10:30',
      durationMinutes: 120,
      isCompleted: true,
      isSkipped: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: 'block-202',
      userId: uid,
      taskId: 'task-102',
      date: fmtDate(0),
      startTime: '14:00',
      endTime: '15:30',
      durationMinutes: 90,
      isCompleted: false,
      isSkipped: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: 'block-203',
      userId: uid,
      taskId: 'task-101',
      date: fmtDate(0),
      startTime: '18:30',
      endTime: '20:30',
      durationMinutes: 120,
      isCompleted: false,
      isSkipped: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: 'block-204',
      userId: uid,
      taskId: 'task-102',
      date: fmtDate(1),
      startTime: '09:00',
      endTime: '10:30',
      durationMinutes: 90,
      isCompleted: false,
      isSkipped: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: 'block-205',
      userId: uid,
      taskId: 'task-103',
      date: fmtDate(1),
      startTime: '18:00',
      endTime: '20:00',
      durationMinutes: 120,
      isCompleted: false,
      isSkipped: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: 'block-206',
      userId: uid,
      taskId: 'task-104',
      date: fmtDate(2),
      startTime: '09:00',
      endTime: '11:00',
      durationMinutes: 120,
      isCompleted: false,
      isSkipped: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: 'block-207',
      userId: uid,
      taskId: 'task-106',
      date: fmtDate(-1),
      startTime: '09:00',
      endTime: '11:30',
      durationMinutes: 150,
      isCompleted: true,
      isSkipped: false,
      createdAt: addDays(-1),
      updatedAt: addDays(-1),
    },
    {
      _id: 'block-208',
      userId: uid,
      taskId: 'task-107',
      date: fmtDate(-2),
      startTime: '18:00',
      endTime: '20:00',
      durationMinutes: 120,
      isCompleted: true,
      isSkipped: false,
      createdAt: addDays(-2),
      updatedAt: addDays(-2),
    },
  ];

  for (const b of seedBlocks) {
    blocks.set(b._id, b);
  }

  const dailyMinutes = [95, 130, 110, 150, 120, 150, 120];
  const dailyScores = [8, 9, 8, 9, 8, 9, 9];
  for (let i = 6; i >= 0; i--) {
    const dt = new Date(now);
    dt.setDate(dt.getDate() - i);
    dt.setHours(10, 0, 0, 0);
    const id = `sess-${i}`;
    sessions.set(id, {
      _id: id,
      userId: uid,
      taskId: i % 2 === 0 ? 'task-106' : 'task-107',
      startTime: dt,
      endTime: new Date(dt.getTime() + dailyMinutes[6 - i] * 60000),
      durationMinutes: dailyMinutes[6 - i],
      productivityScore: dailyScores[6 - i],
      createdAt: dt,
    });
  }

  plans.set('plan-301', {
    _id: 'plan-301',
    userId: uid,
    taskId: 'task-101',
    planText: 'Structured 2-day implementation roadmap for Raft consensus. Focus Day 1 on state transitions and randomized election timers, and Day 2 on log replication consistency checks and partition recovery.',
    estimatedDays: 2,
    dailyGoals: [
      'Implement RequestVote RPC state machine and verify leader election under network delays',
      'Build AppendEntries log replication loop with prevLogIndex/prevLogTerm consistency verification',
      'Pass all split-brain and leader crash test cases with race detector enabled',
    ],
    breakdown: [
      {
        title: 'Phase 1: Election Timers & RequestVote RPC',
        duration: '1.5 hours',
        topics: ['Term increments', 'Randomized election timeout (150–300ms)', 'Up-to-date log comparison'],
        activities: [
          'Implement candidate transition loop and vote counting',
          'Enforce election safety restriction using lastLogTerm and lastLogIndex',
        ],
      },
      {
        title: 'Phase 2: Heartbeats & Log Replication',
        duration: '1.5 hours',
        topics: ['AppendEntries RPC', 'nextIndex & matchIndex tracking', 'CommitIndex advancement'],
        activities: [
          'Send periodic empty AppendEntries heartbeats from leader',
          'Handle log conflict backtracking and apply committed entries to state machine',
        ],
      },
      {
        title: 'Phase 3: Fault Tolerance & Integration Testing',
        duration: '1 hour',
        topics: ['Network partitions', 'Concurrent client proposals', 'State persistence'],
        activities: [
          'Run partition recovery test suite and inspect RPC logs',
          'Verify zero data loss across 20 randomized leader crash iterations',
        ],
      },
    ],
    resources: [
      'In Search of an Understandable Consensus Algorithm (Extended Raft Paper, Figure 2)',
      'MIT 6.5840 Distributed Systems Lab 3 Implementation Guide',
      'Students Guide to Raft — Common Locking & Liveness Pitfalls',
    ],
    generatedAt: now,
  });
}

function matchesFilter(doc: Record<string, any>, filter: Record<string, any> = {}): boolean {
  for (const [key, cond] of Object.entries(filter)) {
    if (cond === undefined) continue;
    const val = doc[key];
    if (cond instanceof RegExp) {
      if (!cond.test(String(val ?? ''))) return false;
    } else if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
      if ('$in' in cond && Array.isArray(cond.$in)) {
        if (!cond.$in.includes(val)) return false;
      }
      if ('$gte' in cond) {
        const a = val instanceof Date ? val.getTime() : val;
        const b = cond.$gte instanceof Date ? cond.$gte.getTime() : cond.$gte;
        if (a < b) return false;
      }
      if ('$lte' in cond) {
        const a = val instanceof Date ? val.getTime() : val;
        const b = cond.$lte instanceof Date ? cond.$lte.getTime() : cond.$lte;
        if (a > b) return false;
      }
    } else {
      if (String(val) !== String(cond)) return false;
    }
  }
  return true;
}

function attachDocHelpers(doc: Record<string, any>, includePassword = false): Record<string, any> {
  const clone = { ...doc };
  if (!includePassword) {
    delete clone.passwordHash;
  }
  Object.defineProperty(clone, 'toJSON', {
    value: () => {
      const json = { ...doc };
      delete json.passwordHash;
      return json;
    },
    enumerable: false,
  });
  return clone;
}

function createQuery(
  storeName: string,
  filter: Record<string, any>,
  single: boolean,
  populateRef?: { field: string; targetStore: string }
) {
  let sortSpec: Record<string, number> | null = null;
  let includePassword = false;
  let shouldPopulate = false;

  const execute = () => {
    const store = getStore(storeName);
    let results = Array.from(store.values()).filter(d => matchesFilter(d, filter));

    if (sortSpec) {
      const entries = Object.entries(sortSpec);
      results.sort((a, b) => {
        for (const [k, dir] of entries) {
          const va = a[k] instanceof Date ? a[k].getTime() : a[k];
          const vb = b[k] instanceof Date ? b[k].getTime() : b[k];
          if (va < vb) return -1 * dir;
          if (va > vb) return 1 * dir;
        }
        return 0;
      });
    }

    const mapped = results.map(d => {
      const item = attachDocHelpers(d, includePassword);
      if (shouldPopulate && populateRef) {
        const target = getStore(populateRef.targetStore).get(String(item[populateRef.field]));
        if (target) {
          item[populateRef.field] = attachDocHelpers(target, false);
        }
      }
      return item;
    });

    return single ? (mapped[0] ?? null) : mapped;
  };

  const queryObj: any = {
    sort(spec: Record<string, number>) {
      sortSpec = spec;
      return queryObj;
    },
    select(fields: string) {
      if (fields.includes('+passwordHash')) includePassword = true;
      return queryObj;
    },
    populate() {
      shouldPopulate = true;
      return queryObj;
    },
    lean() {
      return queryObj;
    },
    then(onFulfilled: any, onRejected?: any) {
      return Promise.resolve().then(execute).then(onFulfilled, onRejected);
    },
    catch(onRejected: any) {
      return Promise.resolve().then(execute).catch(onRejected);
    },
  };

  return queryObj;
}

export function wrapModelWithFallback<T>(
  name: string,
  realModel: mongoose.Model<T>,
  defaults: Record<string, any> = {},
  populateRef?: { field: string; targetStore: string }
): mongoose.Model<T> {
  return new Proxy(realModel, {
    get(target, prop, receiver) {
      if (isMongoConnected()) {
        return Reflect.get(target, prop, receiver);
      }

      const store = getStore(name);

      if (prop === 'find') {
        return (filter: Record<string, any> = {}) => createQuery(name, filter, false, populateRef);
      }
      if (prop === 'findOne') {
        return (filter: Record<string, any> = {}) => createQuery(name, filter, true, populateRef);
      }
      if (prop === 'create') {
        return async (data: Record<string, any>) => {
          const _id = data._id ? String(data._id) : crypto.randomBytes(12).toString('hex');
          const now = new Date();
          const doc: Record<string, any> = {
            ...defaults,
            ...data,
            _id,
            createdAt: data.createdAt ?? now,
            updatedAt: now,
          };
          store.set(_id, doc);
          return attachDocHelpers(doc, false);
        };
      }
      if (prop === 'findOneAndUpdate') {
        return async (filter: Record<string, any>, update: Record<string, any>, options?: { upsert?: boolean; new?: boolean }) => {
          let existing = Array.from(store.values()).find(d => matchesFilter(d, filter));
          const now = new Date();
          if (!existing) {
            if (!options?.upsert) return null;
            const _id = crypto.randomBytes(12).toString('hex');
            const setOnInsert = update.$setOnInsert ?? {};
            const directUpdates = { ...update };
            delete directUpdates.$setOnInsert;
            const newDoc: Record<string, any> = {
              ...defaults,
              ...filter,
              ...setOnInsert,
              ...directUpdates,
              _id,
              createdAt: now,
              updatedAt: now,
            };
            store.set(_id, newDoc);
            return attachDocHelpers(newDoc, false);
          }
          const directUpdates = { ...update };
          delete directUpdates.$setOnInsert;
          Object.assign(existing, directUpdates, { updatedAt: now });
          store.set(String(existing._id), existing);
          return attachDocHelpers(existing, false);
        };
      }
      if (prop === 'findByIdAndUpdate') {
        return async (id: string, update: Record<string, any>) => {
          const existing = store.get(String(id));
          if (!existing) return null;
          Object.assign(existing, update, { updatedAt: new Date() });
          store.set(String(id), existing);
          return attachDocHelpers(existing, false);
        };
      }
      if (prop === 'findOneAndDelete') {
        return async (filter: Record<string, any>) => {
          const existing = Array.from(store.values()).find(d => matchesFilter(d, filter));
          if (!existing) return null;
          store.delete(String(existing._id));
          return attachDocHelpers(existing, false);
        };
      }
      if (prop === 'deleteMany') {
        return async (filter: Record<string, any> = {}) => {
          let deletedCount = 0;
          for (const [k, v] of store.entries()) {
            if (matchesFilter(v, filter)) {
              store.delete(k);
              deletedCount++;
            }
          }
          return { deletedCount };
        };
      }
      if (prop === 'insertMany') {
        return async (docs: Record<string, any>[]) => {
          const now = new Date();
          return docs.map(d => {
            const _id = d._id ? String(d._id) : crypto.randomBytes(12).toString('hex');
            const doc = {
              ...defaults,
              ...d,
              _id,
              createdAt: now,
              updatedAt: now,
            };
            store.set(_id, doc);
            return attachDocHelpers(doc, false);
          });
        };
      }

      return Reflect.get(target, prop, receiver);
    },
  });
}

mongoose.connection.on('disconnected', () => logger.info('MongoDB disconnected'));
mongoose.connection.on('reconnected',  () => logger.info('MongoDB reconnected'));

