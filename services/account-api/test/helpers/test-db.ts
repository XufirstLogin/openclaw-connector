import { PrismaClient } from '@prisma/client';

export const hasTestDatabase = Boolean(process.env.DATABASE_URL);

export async function resetTestDatabase() {
  if (!hasTestDatabase) {
    return;
  }

  const prisma = new PrismaClient();
  await prisma.$connect();
  await prisma.auditLog.deleteMany();
  await prisma.userSession.deleteMany();
  await prisma.userServerConfig.deleteMany();
  await prisma.emailVerificationCode.deleteMany();
  await prisma.user.deleteMany();
  await prisma.$disconnect();
}