import { Badge } from "@/components/ui/badge";
import { Lock, CheckCircle2 } from "lucide-react";
import { ContentStage, STAGE_DISPLAY_NAMES, STAGE_COLORS, isStageLocked } from "@/lib/stagePermissions";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface StageIndicatorProps {
    contentItem: any;
    currentStage: ContentStage;
    compact?: boolean;
}

export const StageIndicator = ({ contentItem, currentStage, compact = false }: StageIndicatorProps) => {
    const isLocked = isStageLocked(contentItem, currentStage);
    const colorClass = STAGE_COLORS[currentStage];
    const displayName = STAGE_DISPLAY_NAMES[currentStage];

    if (compact) {
        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Badge className={`${colorClass} text-[10px] font-bold uppercase tracking-wider`}>
                            {isLocked && <Lock className="w-3 h-3 mr-1" />}
                            {currentStage === 'completed' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                            {displayName}
                        </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{isLocked ? 'Stage Locked' : 'Current Stage'}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    return (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${colorClass}`}>
            {isLocked && <Lock className="w-4 h-4" />}
            {currentStage === 'completed' && <CheckCircle2 className="w-4 h-4" />}
            <div>
                <p className="text-xs font-bold uppercase tracking-wider">{displayName}</p>
                {isLocked && <p className="text-[10px] opacity-70">Locked</p>}
            </div>
        </div>
    );
};
