import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Actualizando moneda de USD a COP...");

  const result = await prisma.profileService.updateMany({
    where: {
      currency: "USD",
    },
    data: {
      currency: "COP",
    },
  });

  console.log(`Actualizados ${result.count} registros de USD a COP`);
}

main()
  .catch((e) => {
    console.error("Error actualizando moneda:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
