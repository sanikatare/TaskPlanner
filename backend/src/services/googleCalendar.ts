import { google } from 'googleapis';
import { User, IUser } from '../models/User';
import { ScheduleBlock } from '../models/ScheduleBlock';
import { logger } from '../utils/logger';

// Build an authenticated OAuth2 client for a given user
function getOAuth2Client(user: IUser) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
  oauth2Client.setCredentials({
    access_token:  user.googleAccessToken,
    refresh_token: user.googleRefreshToken,
  });
  return oauth2Client;
}

// Generate OAuth2 authorization URL
export function getAuthUrl(): string {
  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri  = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Google Calendar OAuth is not configured');
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
    prompt: 'consent',
  });
}

// Exchange authorization code for tokens and save to user
export async function handleOAuthCallback(code: string, uid: string): Promise<void> {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
  const { tokens } = await oauth2Client.getToken(code);
  await User.findOneAndUpdate(
    { uid },
    {
      googleAccessToken:       tokens.access_token,
      googleRefreshToken:      tokens.refresh_token,
      googleCalendarConnected: true,
    }
  );
}

interface ScheduleBlockWithTask {
  _id: string;
  taskId: { title: string; subject: string; description?: string };
  date: string;
  startTime: string;
  endTime: string;
}

// Create Google Calendar events for schedule blocks
export async function createCalendarEvents(
  user: IUser,
  blocks: ScheduleBlockWithTask[]
): Promise<string[]> {
  const oauth2Client = getOAuth2Client(user);
  const calendar     = google.calendar({ version: 'v3', auth: oauth2Client });
  const createdIds: string[] = [];

  for (const block of blocks) {
    try {
      const task = block.taskId;
      const startDateTime = `${block.date}T${block.startTime}:00`;
      const endDateTime   = `${block.date}T${block.endTime}:00`;

      const event = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: {
          summary:     `[Study] ${task.title}`,
          description: `Subject: ${task.subject}\n${task.description ?? ''}`,
          start: { dateTime: startDateTime, timeZone: 'Asia/Kolkata' },
          end:   { dateTime: endDateTime,   timeZone: 'Asia/Kolkata' },
          colorId: '9', // blueberry
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'popup', minutes: 15 },
              { method: 'email', minutes: 60 },
            ],
          },
        },
      });

      // Store the event ID so we can update/delete it later
      await ScheduleBlock.findByIdAndUpdate(block._id, {
        googleCalendarEventId: event.data.id,
      });

      createdIds.push(event.data.id!);
    } catch (err) {
      logger.warn(`Failed to create calendar event for block ${block._id}:`, err);
    }
  }

  return createdIds;
}

// Delete a calendar event (e.g. when a task is completed or rescheduled)
export async function deleteCalendarEvent(user: IUser, eventId: string): Promise<void> {
  const oauth2Client = getOAuth2Client(user);
  const calendar     = google.calendar({ version: 'v3', auth: oauth2Client });
  try {
    await calendar.events.delete({ calendarId: 'primary', eventId });
  } catch (err) {
    logger.warn(`Failed to delete calendar event ${eventId}:`, err);
  }
}
