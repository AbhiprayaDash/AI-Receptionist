import { PrismaClient } from "../../../apps/api/src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  const email = "owner@abc-clinic.local";
  const user = await db.user.upsert({
    where: { email },
    update: {},
    create: { email, name: "Demo Owner", passwordHash: await bcrypt.hash("demo1234", 12) },
  });
  let tenant = await db.tenant.findFirst({ where: { name: "ABC Clinic Demo" } });
  if (!tenant) tenant = await db.tenant.create({ data: { name: "ABC Clinic Demo" } });
  await db.membership.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
    update: { role: "OWNER" }, create: { tenantId: tenant.id, userId: user.id, role: "OWNER" },
  });
  const business = await db.business.upsert({
    where: { tenantId: tenant.id }, update: {},
    create: {
      tenantId: tenant.id, name: "ABC Clinic", address: "Fictional Market Road, Bhubaneswar", phone: "+919999900000",
      greetingEnglish: "Welcome to ABC Clinic. For English, choose 1.",
      greetingHindi: "ABC Clinic में आपका स्वागत है। हिंदी के लिए 2 चुनें।",
      greetingOdia: "ABC Clinic କୁ ସ୍ୱାଗତ। ଓଡ଼ିଆ ପାଇଁ 3 ବାଛନ୍ତୁ।",
    },
  });
  const staff = [];
  for (const name of ["Dr. Ananya Das", "Dr. Rohan Mishra"]) {
    staff.push(await db.staff.upsert({ where: { id: `${name === "Dr. Ananya Das" ? "11111111" : "22222222"}-1111-4111-8111-111111111111` }, update: {}, create: { id: `${name === "Dr. Ananya Das" ? "11111111" : "22222222"}-1111-4111-8111-111111111111`, businessId: business.id, name } }));
  }
  for (const [name, durationMinutes] of [["General Consultation", 30], ["Dental Check-up", 45], ["Follow-up", 20]] as const) {
    await db.service.upsert({ where: { businessId_name: { businessId: business.id, name } }, update: { durationMinutes }, create: { businessId: business.id, name, durationMinutes } });
  }
  for (let weekday = 1; weekday <= 6; weekday++) {
    await db.workingHours.upsert({ where: { businessId_weekday: { businessId: business.id, weekday } }, update: {}, create: { businessId: business.id, weekday, startTime: "09:00", endTime: "17:00" } });
  }
  await db.integrationConfiguration.upsert({
    where: { businessId_provider: { businessId: business.id, provider: "MOCK_WHATSAPP" } },
    update: { enabled: true }, create: { businessId: business.id, provider: "MOCK_WHATSAPP", enabled: true, config: { mode: "simulated" } },
  });
  console.log(`Seeded fictional ABC Clinic. Demo login: ${email}`);
}

main().finally(() => db.$disconnect());
