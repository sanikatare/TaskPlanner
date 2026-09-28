import type { ITask } from '../models/Task';

export interface StudyPlanUser {
  studyHoursPerDay?: number;
  currentSemester?: number;
  subjects?: string[];
}

/**
 * Builds the prompt sent to Claude to generate a study plan for a single task.
 * Returns a JSON schema the model must fill.
 */
export function buildStudyPlanPrompt(task: Partial<ITask>, user: StudyPlanUser | null): string {
  const daysUntilDeadline = Math.ceil(
    (new Date(task.deadline as Date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  return `
You are creating a personalised study plan for an engineering student.

TASK DETAILS:
- Title: ${task.title}
- Subject: ${task.subject}
- Category: ${task.category}
- Description: ${task.description ?? 'Not provided'}
- Deadline: ${new Date(task.deadline as Date).toDateString()} (${daysUntilDeadline} days from today)
- Estimated Hours: ${task.estimatedHours}
- Difficulty: ${task.difficulty}/5
- Priority: ${task.priority}

STUDENT PROFILE:
- Study hours available per day: ${user?.studyHoursPerDay ?? 6}
- Current semester: ${user?.currentSemester ?? 'Not specified'}
- Subjects enrolled: ${user?.subjects?.join(', ') || 'Not specified'}

INSTRUCTIONS:
Create a comprehensive, practical study plan that:
1. Fits within ${daysUntilDeadline} days
2. Respects ${user?.studyHoursPerDay ?? 6} hours/day availability
3. Breaks the topic into logical progressive sections
4. Provides daily goals for accountability
5. Suggests resources appropriate for engineering students

RESPOND WITH EXACTLY THIS JSON STRUCTURE:
{
  "summary": "2-3 sentence overview of the plan and approach",
  "estimated_days": <number>,
  "breakdown": [
    {
      "title": "Section title",
      "duration": "e.g. 2 days",
      "topics": ["topic 1", "topic 2"],
      "activities": ["activity 1", "activity 2"]
    }
  ],
  "daily_goals": ["Day 1 goal", "Day 2 goal"],
  "resources": ["Resource name and description"]
}
`;
}

/**
 * Prompt for generating practice questions / revision notes
 */
export function buildRevisionPrompt(subject: string, topic: string, level: string): string {
  return `
Generate 10 practice questions for an engineering student on:
Subject: ${subject}
Topic: ${topic}
Difficulty Level: ${level}

Include:
- 4 conceptual questions
- 4 numerical/problem-solving questions
- 2 application-based questions

Format as JSON: { "questions": [{ "type": "conceptual|numerical|application", "question": "...", "hint": "..." }] }
`;
}

/**
 * Prompt for smart task breakdown using Claude
 */
export function buildTaskBreakdownPrompt(taskTitle: string, subject: string, estimatedHours: number): string {
  return `
Break down this academic task into manageable sub-tasks for an engineering student:
Task: ${taskTitle}
Subject: ${subject}
Total estimated time: ${estimatedHours} hours

Create 4-8 specific sub-tasks. Format as JSON:
{
  "subtasks": [
    { "title": "...", "estimated_minutes": 60, "description": "..." }
  ]
}
`;
}
