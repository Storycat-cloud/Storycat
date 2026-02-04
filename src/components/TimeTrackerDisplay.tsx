import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TimeTrackerDisplayProps {
    isTracking: boolean;
    formattedTime: string;
    compact?: boolean;
}

export const TimeTrackerDisplay = ({
    isTracking,
    formattedTime,
    compact = false
}: TimeTrackerDisplayProps) => {
    if (!isTracking) return null;

    if (compact) {
        return (
            <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30 animate-pulse">
                <Clock className="w-3 h-3 mr-1" />
                {formattedTime}
            </Badge>
        );
    }

    return (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <Clock className="w-4 h-4 text-red-500" />
            <div>
                <p className="text-xs font-bold text-red-500 uppercase tracking-wider">Recording</p>
                <p className="text-sm font-mono text-red-500">{formattedTime}</p>
            </div>
        </div>
    );
};

interface TimeByRoleDisplayProps {
    timeByRole: Array<{
        role: string;
        total_hours: number;
        total_seconds: number;
    }>;
}

export const TimeByRoleDisplay = ({ timeByRole }: TimeByRoleDisplayProps) => {
    const roleDisplayNames: Record<string, string> = {
        'digital_marketing_manager': 'Digital Marketing',
        'copywriter': 'Copywriting',
        'copy_qc': 'Copy QC',
        'designer': 'Design',
        'designer_qc': 'Design QC'
    };

    if (timeByRole.length === 0) {
        return (
            <p className="text-sm text-muted-foreground italic">No time tracked yet</p>
        );
    }

    return (
        <div className="space-y-2">
            {timeByRole.map((item) => (
                <div
                    key={item.role}
                    className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/10"
                >
                    <span className="text-sm font-medium">
                        {roleDisplayNames[item.role] || item.role}
                    </span>
                    <span className="text-sm font-mono text-primary">
                        {item.total_hours.toFixed(2)}h
                    </span>
                </div>
            ))}
            <div className="pt-2 border-t border-white/10 flex justify-between font-bold">
                <span className="text-sm">Total</span>
                <span className="text-sm font-mono text-primary">
                    {timeByRole.reduce((sum, item) => sum + item.total_hours, 0).toFixed(2)}h
                </span>
            </div>
        </div>
    );
};
