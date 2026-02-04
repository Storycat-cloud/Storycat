// Utility functions for stage-based workflow permissions

export type ContentStage =
    | 'admin'
    | 'digital_marketer'
    | 'copywriter'
    | 'copy_qc'
    | 'designer'
    | 'design_qc'
    | 'digital_marketer_posting'
    | 'completed';

export type UserRole =
    | 'admin'
    | 'digital_marketing_manager'
    | 'copywriter'
    | 'copy_qc'
    | 'designer'
    | 'designer_qc';

// Map content stages to user roles
const STAGE_TO_ROLE_MAP: Record<ContentStage, UserRole | null> = {
    'admin': 'admin',
    'digital_marketer': 'digital_marketing_manager',
    'copywriter': 'copywriter',
    'copy_qc': 'copy_qc',
    'designer': 'designer',
    'design_qc': 'designer_qc',
    'digital_marketer_posting': 'digital_marketing_manager',
    'completed': null
};

// Map user roles to content stages they can edit
const ROLE_TO_STAGES_MAP: Record<UserRole, ContentStage[]> = {
    'admin': ['admin', 'digital_marketer', 'copywriter', 'copy_qc', 'designer', 'design_qc', 'digital_marketer_posting', 'completed'],
    'digital_marketing_manager': ['digital_marketer', 'digital_marketer_posting'],
    'copywriter': ['copywriter'],
    'copy_qc': ['copy_qc'],
    'designer': ['designer'],
    'designer_qc': ['design_qc']
};

// Stage display names
export const STAGE_DISPLAY_NAMES: Record<ContentStage, string> = {
    'admin': 'Admin Review',
    'digital_marketer': 'Digital Marketing',
    'copywriter': 'Copywriting',
    'copy_qc': 'Copy QC',
    'designer': 'Design',
    'design_qc': 'Design QC',
    'digital_marketer_posting': 'Ready to Post',
    'completed': 'Completed'
};

// Stage colors for UI
export const STAGE_COLORS: Record<ContentStage, string> = {
    'admin': 'bg-purple-500/20 text-purple-500 border-purple-500/30',
    'digital_marketer': 'bg-blue-500/20 text-blue-500 border-blue-500/30',
    'copywriter': 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
    'copy_qc': 'bg-orange-500/20 text-orange-500 border-orange-500/30',
    'designer': 'bg-pink-500/20 text-pink-500 border-pink-500/30',
    'design_qc': 'bg-red-500/20 text-red-500 border-red-500/30',
    'digital_marketer_posting': 'bg-green-500/20 text-green-500 border-green-500/30',
    'completed': 'bg-gray-500/20 text-gray-500 border-gray-500/30'
};

/**
 * Check if a user can edit a content item based on current stage
 * @param contentItem - The content item to check
 * @param userRole - The current user's role
 * @param userId - The current user's ID
 * @returns true if user can edit, false otherwise
 */
export const canEditContent = (
    contentItem: any,
    userRole: UserRole,
    userId: string
): boolean => {
    // Admins can always edit
    if (userRole === 'admin') return true;

    const currentStage = contentItem.current_stage as ContentStage;

    // Check if user's role matches the current stage
    const allowedStages = ROLE_TO_STAGES_MAP[userRole];
    if (!allowedStages || !allowedStages.includes(currentStage)) {
        return false;
    }

    // Check if user is assigned to this content item
    const assigneeMap: Record<ContentStage, string | null> = {
        'admin': null,
        'digital_marketer': contentItem.dm_assignee,
        'copywriter': contentItem.copy_assignee,
        'copy_qc': contentItem.copy_qc_assignee,
        'designer': contentItem.design_assignee,
        'design_qc': contentItem.design_qc_assignee,
        'digital_marketer_posting': contentItem.dm_assignee,
        'completed': null
    };

    const assignedUserId = assigneeMap[currentStage];

    // For digital marketer, also check dedicated_dm_id from project
    if (currentStage === 'digital_marketer' || currentStage === 'digital_marketer_posting') {
        const isDedicatedDM = contentItem.project_onboarding?.dedicated_dm_id === userId;
        return assignedUserId === userId || isDedicatedDM;
    }

    return assignedUserId === userId;
};

/**
 * Check if a stage is locked (completed)
 * @param contentItem - The content item to check
 * @param stage - The stage to check
 * @returns true if stage is locked, false otherwise
 */
export const isStageLocked = (
    contentItem: any,
    stage: ContentStage
): boolean => {
    const lockMap: Record<ContentStage, string | null> = {
        'admin': null,
        'digital_marketer': contentItem.dm_stage_locked_at,
        'copywriter': contentItem.copy_stage_locked_at,
        'copy_qc': contentItem.copy_qc_stage_locked_at,
        'designer': contentItem.design_stage_locked_at,
        'design_qc': contentItem.design_qc_stage_locked_at,
        'digital_marketer_posting': contentItem.posting_stage_locked_at,
        'completed': contentItem.admin_verified_at
    };

    return !!lockMap[stage];
};

/**
 * Get the next stage in the pipeline
 * @param currentStage - The current stage
 * @returns The next stage
 */
export const getNextStage = (currentStage: ContentStage): ContentStage => {
    const stageOrder: ContentStage[] = [
        'admin',
        'digital_marketer',
        'copywriter',
        'copy_qc',
        'designer',
        'design_qc',
        'digital_marketer_posting',
        'completed'
    ];

    const currentIndex = stageOrder.indexOf(currentStage);
    if (currentIndex === -1 || currentIndex === stageOrder.length - 1) {
        return 'completed';
    }

    return stageOrder[currentIndex + 1];
};

/**
 * Check if user's role matches the current stage
 * @param currentStage - The content item's current stage
 * @param userRole - The user's role
 * @returns true if roles match, false otherwise
 */
export const doesRoleMatchStage = (
    currentStage: ContentStage,
    userRole: UserRole
): boolean => {
    const requiredRole = STAGE_TO_ROLE_MAP[currentStage];
    return userRole === 'admin' || userRole === requiredRole;
};

/**
 * Get a user-friendly message for why editing is disabled
 * @param contentItem - The content item
 * @param userRole - The user's role
 * @returns A message explaining why editing is disabled
 */
export const getEditDisabledReason = (
    contentItem: any,
    userRole: UserRole
): string => {
    const currentStage = contentItem.current_stage as ContentStage;
    const requiredRole = STAGE_TO_ROLE_MAP[currentStage];

    if (currentStage === 'completed') {
        return 'This content has been completed and verified.';
    }

    if (!doesRoleMatchStage(currentStage, userRole)) {
        return `This content is currently at the ${STAGE_DISPLAY_NAMES[currentStage]} stage. Only ${requiredRole} can edit it now.`;
    }

    return 'You are not assigned to this content item.';
};
