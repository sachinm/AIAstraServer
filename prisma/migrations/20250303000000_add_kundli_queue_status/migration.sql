-- AlterTable
ALTER TABLE "kundlis" ADD COLUMN     "queue_status" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "queue_started_at" TIMESTAMP(3),
ADD COLUMN     "queue_completed_at" TIMESTAMP(3),
ADD COLUMN     "last_sync_error" TEXT;
