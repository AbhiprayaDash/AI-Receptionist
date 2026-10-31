ALTER TABLE "Appointment"
ADD COLUMN "externalCalendarEventId" TEXT,
ADD COLUMN "calendarSyncStatus" TEXT NOT NULL DEFAULT 'LOCAL_ONLY';
