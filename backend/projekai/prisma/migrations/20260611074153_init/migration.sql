-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `full_name` VARCHAR(191) NOT NULL,
    `password_hash` VARCHAR(191) NOT NULL,
    `university` VARCHAR(191) NULL,
    `major` VARCHAR(191) NULL,
    `graduation_year` INTEGER NULL,
    `writing_style_fingerprint` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `users_email_idx`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `essay_drafts` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL DEFAULT 'Esai Tanpa Judul',
    `scholarship_target` VARCHAR(191) NULL,
    `content` LONGTEXT NOT NULL,
    `status` ENUM('DRAFT', 'IN_REVIEW', 'FINALIZED') NOT NULL DEFAULT 'DRAFT',
    `version` INTEGER NOT NULL DEFAULT 1,
    `composite_score` DOUBLE NULL,
    `structure_score` DOUBLE NULL,
    `tone_score` DOUBLE NULL,
    `relevance_score` DOUBLE NULL,
    `originality_score` DOUBLE NULL,
    `impact_score` DOUBLE NULL,
    `total_word_count` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `essay_drafts_user_id_idx`(`user_id`),
    INDEX `essay_drafts_user_id_status_idx`(`user_id`, `status`),
    INDEX `essay_drafts_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_feedbacks` (
    `id` VARCHAR(191) NOT NULL,
    `draft_id` VARCHAR(191) NOT NULL,
    `feedback_type` ENUM('PARAGRAPH', 'FULL_ESSAY', 'TONE_CHECK', 'FINAL_REVIEW') NOT NULL,
    `scores` JSON NOT NULL,
    `annotations` JSON NOT NULL,
    `overall_comment` TEXT NOT NULL,
    `voice_preserved` BOOLEAN NOT NULL DEFAULT true,
    `model_version` VARCHAR(191) NOT NULL DEFAULT 'gemini-2.5-flash',
    `prompt_tokens` INTEGER NOT NULL DEFAULT 0,
    `response_tokens` INTEGER NOT NULL DEFAULT 0,
    `processing_time_ms` INTEGER NOT NULL DEFAULT 0,
    `raw_prompt` LONGTEXT NULL,
    `raw_response` LONGTEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ai_feedbacks_draft_id_idx`(`draft_id`),
    INDEX `ai_feedbacks_feedback_type_idx`(`feedback_type`),
    INDEX `ai_feedbacks_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `essay_drafts` ADD CONSTRAINT `essay_drafts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_feedbacks` ADD CONSTRAINT `ai_feedbacks_draft_id_fkey` FOREIGN KEY (`draft_id`) REFERENCES `essay_drafts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
