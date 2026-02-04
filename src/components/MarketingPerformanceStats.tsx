import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Users, MousePointer2, Eye, LayoutDashboard } from "lucide-react";

interface PerformanceStatsProps {
    summary: {
        total_spent: number;
        total_leads: number;
        total_reach: number;
        total_impressions: number;
        total_likes: number;
        total_views: number;
        total_clicks: number;
        total_conversions: number;
        avg_cost_per_lead: number;
        days_logged: number;
    } | null;
    budget?: {
        amount: number;
        type: string;
    };
}

export const MarketingPerformanceStats = ({ summary, budget }: PerformanceStatsProps) => {
    if (!summary) return null;

    const stats = [
        {
            label: "Total Spend",
            value: `$${summary.total_spent.toLocaleString()}`,
            sub: budget ? `${budget.type}: $${budget.amount}` : null,
            icon: DollarSign,
            color: "text-green-500",
            bg: "bg-green-500/10"
        },
        {
            label: "Total Leads",
            value: summary.total_leads.toLocaleString(),
            sub: `Avg. $${summary.avg_cost_per_lead}/lead`,
            icon: Users,
            color: "text-blue-500",
            bg: "bg-blue-500/10"
        },
        {
            label: "Total Reach",
            value: summary.total_reach.toLocaleString(),
            sub: `${summary.total_impressions.toLocaleString()} impressions`,
            icon: MousePointer2,
            color: "text-purple-500",
            bg: "bg-purple-500/10"
        },
        {
            label: "Engagement",
            value: summary.total_views.toLocaleString(),
            sub: `${summary.total_likes.toLocaleString()} likes`,
            icon: Eye,
            color: "text-orange-500",
            bg: "bg-orange-500/10"
        }
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat, index) => (
                <Card key={index} className="glass-card border-white/5 overflow-hidden">
                    <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                            <div className="space-y-1">
                                <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{stat.label}</p>
                                <p className="text-2xl font-bold">{stat.value}</p>
                                {stat.sub && <p className="text-xs text-muted-foreground">{stat.sub}</p>}
                            </div>
                            <div className={`p-2 rounded-lg ${stat.bg}`}>
                                <stat.icon className={`w-5 h-5 ${stat.color}`} />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
};
