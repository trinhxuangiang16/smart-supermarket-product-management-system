import prismaPkg from "@prisma/client";

const { PrismaClient } = prismaPkg as unknown as { PrismaClient: new () => any };
export const prisma = new PrismaClient();
