import { PrismaClient } from "@prisma/client/edge";

export const prisma = new PrismaClient();

export type { PrismaClient } from "@prisma/client";
