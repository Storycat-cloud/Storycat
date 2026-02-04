import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock } from "lucide-react";
import { getEditDisabledReason } from "@/lib/stagePermissions";
import type { UserRole } from "@/lib/stagePermissions";

interface ReadOnlyAlertProps {
    contentItem: any;
    userRole: UserRole;
}

export const ReadOnlyAlert = ({ contentItem, userRole }: ReadOnlyAlertProps) => {
    const reason = getEditDisabledReason(contentItem, userRole);

    return (
        <Alert className="border-yellow-500/30 bg-yellow-500/10">
            <Lock className="h-4 w-4 text-yellow-500" />
            <AlertDescription className="text-yellow-500 ml-2">
                <strong>Read-Only Mode:</strong> {reason}
            </AlertDescription>
        </Alert>
    );
};
