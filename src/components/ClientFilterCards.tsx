import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Building2, X } from "lucide-react";

interface Client {
    name: string;
    logoUrl?: string;
}

interface ClientFilterCardsProps {
    projects: any[];
    selectedClient: string | null;
    onSelectClient: (clientName: string | null) => void;
    className?: string;
}

export const ClientFilterCards = ({
    projects,
    selectedClient,
    onSelectClient,
    className
}: ClientFilterCardsProps) => {
    // Extract unique clients from projects
    const clients: Client[] = projects.reduce((acc: Client[], project) => {
        // Handle both array and object structure for onboarding data
        const onboarding = Array.isArray(project.project_onboarding)
            ? project.project_onboarding[0]
            : project.project_onboarding;

        // Use company name from onboarding, or fallback to project title
        // This matches the card rendering logic in dashboards
        const name = onboarding?.company_name || project.title;
        const logoUrl = onboarding?.brand_logo_url;

        if (!name) return acc;

        const existingClient = acc.find(c => c.name === name);
        if (!existingClient) {
            acc.push({
                name,
                logoUrl
            });
        }
        return acc;
    }, []);

    if (clients.length === 0) return null;

    return (
        <div className={cn("w-full mb-8", className)}>
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <span className="w-1 h-4 bg-primary rounded-full"></span>
                    Filter by Client
                </h3>
                {selectedClient && (
                    <button
                        onClick={() => onSelectClient(null)}
                        className="text-xs text-muted-foreground hover:text-white flex items-center gap-1 transition-colors"
                    >
                        <X className="w-3 h-3" /> Clear Active Filter
                    </button>
                )}
            </div>

            <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex space-x-3 pb-2">
                    {/* All Clients Chip */}
                    <button
                        onClick={() => onSelectClient(null)}
                        className={cn(
                            "inline-flex items-center px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border",
                            !selectedClient
                                ? "bg-primary text-black border-primary shadow-[0_0_10px_rgba(234,179,8,0.3)]"
                                : "bg-black/40 text-muted-foreground border-white/10 hover:bg-white/10 hover:border-white/20 hover:text-white"
                        )}
                    >
                        <Building2 className={cn("w-3.5 h-3.5 mr-2", !selectedClient ? "opacity-100" : "opacity-70")} />
                        All Projects
                        <span className={cn(
                            "ml-2 text-[10px] px-1.5 py-0.5 rounded-full",
                            !selectedClient ? "bg-black/20 text-black/80" : "bg-white/10"
                        )}>
                            {projects.length}
                        </span>
                    </button>

                    {/* Individual Client Chips */}
                    {clients.map((client, index) => {
                        const clientProjectCount = projects.filter(p => {
                            const pOnboarding = Array.isArray(p.project_onboarding)
                                ? p.project_onboarding[0]
                                : p.project_onboarding;
                            const pName = pOnboarding?.company_name || p.title;
                            return pName === client.name;
                        }).length;

                        const isSelected = selectedClient === client.name;

                        return (
                            <button
                                key={`${client.name}-${index}`}
                                onClick={() => onSelectClient(isSelected ? null : client.name)}
                                className={cn(
                                    "inline-flex items-center px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border",
                                    isSelected
                                        ? "bg-primary text-black border-primary shadow-[0_0_10px_rgba(234,179,8,0.3)]"
                                        : "bg-black/40 text-muted-foreground border-white/10 hover:bg-white/10 hover:border-white/20 hover:text-white"
                                )}
                            >
                                {client.logoUrl ? (
                                    <img
                                        src={client.logoUrl}
                                        alt={client.name}
                                        className="w-4 h-4 rounded-full mr-2 object-cover bg-white/10"
                                    />
                                ) : (
                                    <span className="w-4 h-4 rounded-full mr-2 bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-[8px] text-white font-bold">
                                        {client.name.substring(0, 1).toUpperCase()}
                                    </span>
                                )}
                                {client.name}
                                <span className={cn(
                                    "ml-2 text-[10px] px-1.5 py-0.5 rounded-full",
                                    isSelected ? "bg-black/20 text-black/80" : "bg-white/10"
                                )}>
                                    {clientProjectCount}
                                </span>
                            </button>
                        );
                    })}
                </div>
                <ScrollBar orientation="horizontal" className="h-1.5" />
            </ScrollArea>
        </div>
    );
};
