-- CreateTable
CREATE TABLE "family_members" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "account_number" TEXT NOT NULL,
    "bank_code" TEXT NOT NULL,
    "bank_name" TEXT,
    "balance" REAL NOT NULL DEFAULT 0,
    "paystack_recipient_code" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "transfer_transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reference" TEXT NOT NULL,
    "sender_id" TEXT,
    "total_amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paystack_batch_id" TEXT,
    "callback_url" TEXT,
    "description" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "transfer_transactions_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "family_members" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "transfer_recipients" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transfer_id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paystack_transfer_code" TEXT,
    "paystack_reference" TEXT,
    "failure_reason" TEXT,
    "transferred_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "transfer_recipients_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "transfer_transactions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "transfer_recipients_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "family_members" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "family_members_email_key" ON "family_members"("email");

-- CreateIndex
CREATE UNIQUE INDEX "transfer_transactions_reference_key" ON "transfer_transactions"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "transfer_recipients_transfer_id_recipient_id_key" ON "transfer_recipients"("transfer_id", "recipient_id");
