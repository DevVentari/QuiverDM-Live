import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const pdfId = process.argv[2];
  if (!pdfId) {
    console.log('Usage: tsx scripts/cleanup-pdf.ts <pdfId>');
    process.exit(1);
  }

  const result = await prisma.homebrewPDF.delete({ where: { id: pdfId } });
  console.log('Deleted:', result.filename);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
