CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'STAFF');
CREATE TYPE "Language" AS ENUM ('EN', 'HI', 'OR');
CREATE TYPE "AppointmentStatus" AS ENUM ('CONFIRMED', 'CANCELLED', 'COMPLETED');
CREATE TYPE "NotificationStatus" AS ENUM ('SIMULATED', 'PENDING', 'SENT', 'DELIVERED', 'FAILED');
CREATE TYPE "ProviderKind" AS ENUM ('LOCAL_CALENDAR', 'GOOGLE_CALENDAR', 'MOCK_WHATSAPP', 'WHATSAPP_CLOUD', 'OLLAMA', 'STT', 'TTS', 'TELEPHONY');

CREATE TABLE "Tenant" (
  "id" UUID PRIMARY KEY,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "User" (
  "id" UUID PRIMARY KEY,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE TABLE "Membership" (
  "id" UUID PRIMARY KEY,
  "tenantId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "role" "Role" NOT NULL DEFAULT 'STAFF',
  CONSTRAINT "Membership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE,
  CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "Membership_tenantId_userId_key" ON "Membership"("tenantId", "userId");
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");

CREATE TABLE "Business" (
  "id" UUID PRIMARY KEY,
  "tenantId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  "bufferMinutes" INTEGER NOT NULL DEFAULT 0,
  "greetingEnglish" TEXT NOT NULL,
  "greetingHindi" TEXT NOT NULL,
  "greetingOdia" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Business_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "Business_tenantId_key" ON "Business"("tenantId");
CREATE TABLE "Staff" (
  "id" UUID PRIMARY KEY,
  "businessId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "Staff_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE
);
CREATE INDEX "Staff_businessId_idx" ON "Staff"("businessId");
CREATE TABLE "Service" (
  "id" UUID PRIMARY KEY,
  "businessId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "durationMinutes" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "Service_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "Service_businessId_name_key" ON "Service"("businessId", "name");
CREATE TABLE "Customer" (
  "id" UUID PRIMARY KEY,
  "businessId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "language" "Language" NOT NULL DEFAULT 'EN',
  CONSTRAINT "Customer_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "Customer_businessId_phone_key" ON "Customer"("businessId", "phone");
CREATE INDEX "Customer_businessId_name_idx" ON "Customer"("businessId", "name");

CREATE TABLE "WorkingHours" (
  "id" UUID PRIMARY KEY,
  "businessId" UUID NOT NULL,
  "weekday" INTEGER NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  CONSTRAINT "WorkingHours_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "WorkingHours_businessId_weekday_key" ON "WorkingHours"("businessId", "weekday");
CREATE TABLE "Holiday" (
  "id" UUID PRIMARY KEY,
  "businessId" UUID NOT NULL,
  "date" DATE NOT NULL,
  "name" TEXT NOT NULL,
  CONSTRAINT "Holiday_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "Holiday_businessId_date_key" ON "Holiday"("businessId", "date");

CREATE TABLE "Appointment" (
  "id" UUID PRIMARY KEY,
  "tenantId" UUID NOT NULL,
  "businessId" UUID NOT NULL,
  "customerId" UUID NOT NULL,
  "staffId" UUID NOT NULL,
  "serviceId" UUID NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "status" "AppointmentStatus" NOT NULL DEFAULT 'CONFIRMED',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Appointment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE,
  CONSTRAINT "Appointment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id"),
  CONSTRAINT "Appointment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id"),
  CONSTRAINT "Appointment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id")
);
CREATE INDEX "Appointment_tenantId_startsAt_idx" ON "Appointment"("tenantId", "startsAt");
CREATE INDEX "Appointment_businessId_status_startsAt_idx" ON "Appointment"("businessId", "status", "startsAt");
CREATE INDEX "Appointment_staffId_startsAt_endsAt_idx" ON "Appointment"("staffId", "startsAt", "endsAt");
CREATE UNIQUE INDEX "Appointment_staffId_startsAt_key" ON "Appointment"("staffId", "startsAt");

CREATE TABLE "ConversationSession" (
  "id" UUID PRIMARY KEY,
  "businessId" UUID NOT NULL,
  "customerId" UUID,
  "language" "Language" NOT NULL,
  "channel" TEXT NOT NULL DEFAULT 'TEXT',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "state" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConversationSession_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE,
  CONSTRAINT "ConversationSession_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
);
CREATE INDEX "ConversationSession_businessId_createdAt_idx" ON "ConversationSession"("businessId", "createdAt");
CREATE TABLE "ConversationMessage" (
  "id" UUID PRIMARY KEY,
  "sessionId" UUID NOT NULL,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConversationMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ConversationSession"("id") ON DELETE CASCADE
);
CREATE INDEX "ConversationMessage_sessionId_createdAt_idx" ON "ConversationMessage"("sessionId", "createdAt");

CREATE TABLE "Notification" (
  "id" UUID PRIMARY KEY,
  "businessId" UUID NOT NULL,
  "appointmentId" UUID NOT NULL,
  "channel" TEXT NOT NULL DEFAULT 'WHATSAPP',
  "message" TEXT NOT NULL,
  "manualUrl" TEXT NOT NULL,
  "status" "NotificationStatus" NOT NULL DEFAULT 'SIMULATED',
  "providerId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE,
  CONSTRAINT "Notification_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE
);
CREATE INDEX "Notification_businessId_createdAt_idx" ON "Notification"("businessId", "createdAt");
CREATE TABLE "IntegrationConfiguration" (
  "id" UUID PRIMARY KEY,
  "businessId" UUID NOT NULL,
  "provider" "ProviderKind" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "config" JSONB NOT NULL,
  CONSTRAINT "IntegrationConfiguration_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "IntegrationConfiguration_businessId_provider_key" ON "IntegrationConfiguration"("businessId", "provider");
CREATE TABLE "AuditLog" (
  "id" UUID PRIMARY KEY,
  "tenantId" UUID NOT NULL,
  "actorId" UUID,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);
CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON "AuditLog"("tenantId", "createdAt");
