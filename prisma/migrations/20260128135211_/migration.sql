/*
  Warnings:

  - You are about to drop the column `lgt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `ltd` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "lgt",
DROP COLUMN "ltd";

-- CreateTable
CREATE TABLE "GeoLocation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ltd" DOUBLE PRECISION NOT NULL,
    "lgt" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeoLocation_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "GeoLocation" ADD CONSTRAINT "GeoLocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
