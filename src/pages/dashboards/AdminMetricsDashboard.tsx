import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Users,
    Briefcase,
    Clock,
    BarChart3,
    TrendingUp,
    Zap,
    Target,
    Trophy,
    Filter,
    RefreshCw,
    AlertTriangle,
    AlertCircle,
    Inbox,
    ArrowRight,
    Settings,
    Shield,
    Medal,
    Star,
    LayoutDashboard
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    LineChart,
    Line,
    PieChart,
    Pie,
    Cell,
    AreaChart,
    Area
} from "recharts";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";

const COLORS = ['#EAB308', '#3B82F6', '#8B5CF6', '#F97316', '#EF4444', '#10B981'];

export default function AdminMetricsDashboard() {
    const [dateRange, setDateRange] = useState({
        start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
        end: format(new Date(), 'yyyy-MM-dd')
    });
    const [roleFilter, setRoleFilter] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // Data States
    const [productionStats, setProductionStats] = useState<any>(null);
    const [timeEfficiency, setTimeEfficiency] = useState<any[]>([]);
    const [teamRanking, setTeamRanking] = useState<any[]>([]);
    const [leaderboard, setLeaderboard] = useState<any[]>([]);
    const [volumeData, setVolumeData] = useState<any[]>([]);
    const [workloadData, setWorkloadData] = useState<any[]>([]);
    const [bottlenecks, setBottlenecks] = useState<any[]>([]);
    const [insights, setInsights] = useState<any[]>([]);
    const [masterLeaderboard, setMasterLeaderboard] = useState<any[]>([]);
    const [leaderboardEnabled, setLeaderboardEnabled] = useState(true);

    const fetchAllMetrics = async () => {
        setLoading(true);
        try {
            const startTz = `${dateRange.start}T00:00:00Z`;
            const endTz = `${dateRange.end}T23:59:59Z`;

            const [
                { data: prod },
                { data: timeEff },
                { data: teamRank },
                { data: creativeLdr },
                { data: vol }
            ] = await Promise.all([
                (supabase.rpc as any)('get_agency_production_stats', { p_start_date: startTz, p_end_date: endTz }),
                (supabase.rpc as any)('get_agency_time_efficiency', { p_start_date: startTz, p_end_date: endTz }),
                (supabase.rpc as any)('get_team_efficiency_ranking', { p_start_date: startTz, p_end_date: endTz, p_role_filter: roleFilter }),
                (supabase.rpc as any)('get_creative_leaderboard', { p_start_date: dateRange.start, p_end_date: dateRange.end }),
                (supabase.rpc as any)('get_agency_production_volume', { p_start_date: dateRange.start, p_end_date: dateRange.end })
            ]);

            const [
                { data: work },
                { data: btl },
                { data: ins },
                { data: masterLdr },
                { data: settings }
            ] = await Promise.all([
                (supabase.rpc as any)('get_agency_workload_distribution'),
                (supabase.rpc as any)('get_workflow_bottlenecks'),
                (supabase.rpc as any)('get_actionable_insights'),
                (supabase.rpc as any)('get_agency_leaderboard', { p_start_date: startTz, p_end_date: endTz }),
                (supabase.from('agency_settings') as any).select('value').eq('key', 'performance_leaderboard').single()
            ]);

            if (prod) setProductionStats(prod[0]);
            if (timeEff) setTimeEfficiency(timeEff);
            if (teamRank) setTeamRanking(teamRank);
            if (creativeLdr) setLeaderboard(creativeLdr);
            if (vol) setVolumeData(vol);
            if (work) setWorkloadData(work);
            if (btl) setBottlenecks(btl);
            if (ins) setInsights(ins);
            if (masterLdr) setMasterLeaderboard(masterLdr);
            if (settings?.value) setLeaderboardEnabled((settings.value as any).enabled);
        } catch (error) {
            console.error("Error fetching metrics:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllMetrics();
    }, [dateRange, roleFilter]);

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const hrs = Math.floor(mins / 60);
        if (hrs > 0) return `${hrs}h ${mins % 60}m`;
        return `${mins}m`;
    };

    return (
        <DashboardLayout>
            <div className="p-8 space-y-8 animate-in fade-in duration-500">
                {/* Insights Banner */}
                {insights.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {insights.map((insight, idx) => (
                            <div key={idx} className={`p-4 rounded-xl border flex items-start gap-3 glass-card transition-all hover:scale-[1.02] ${insight.insight_type === 'bottleneck' ? 'bg-red-500/10 border-red-500/20' :
                                insight.insight_type === 'overload' ? 'bg-orange-500/10 border-orange-500/20' :
                                    'bg-blue-500/10 border-blue-500/20'
                                }`}>
                                <div className={`p-2 rounded-lg ${insight.insight_type === 'bottleneck' ? 'bg-red-500/20 text-red-500' :
                                    insight.insight_type === 'overload' ? 'bg-orange-500/20 text-orange-500' :
                                        'bg-blue-500/20 text-blue-500'
                                    }`}>
                                    {insight.insight_type === 'bottleneck' ? <AlertTriangle className="w-4 h-4" /> :
                                        insight.insight_type === 'overload' ? <Zap className="w-4 h-4" /> :
                                            <AlertCircle className="w-4 h-4" />}
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-bold uppercase tracking-tight opacity-70">
                                        {insight.insight_type.replace('_', ' ')} Insight
                                    </p>
                                    <p className="text-sm text-white/90 leading-snug">{insight.insight_text}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Performance Control & Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-black/40 p-6 rounded-2xl border border-white/5 glass-card">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-4xl font-black tracking-tighter text-white uppercase">
                                Agency <span className="text-primary">Metrics</span>
                            </h1>
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-bold uppercase tracking-widest text-[10px]">
                                Internal OS
                            </Badge>
                        </div>
                        <p className="text-muted-foreground mt-1 text-sm font-medium">Internal Performance Monitoring & Business Intelligence</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl mr-4 shadow-inner">
                            <Shield className="w-4 h-4 text-primary" />
                            <span className="text-[10px] font-black text-white uppercase tracking-widest">Leaderboard</span>
                            <Button
                                size="sm"
                                variant={leaderboardEnabled ? "default" : "outline"}
                                className={`h-7 px-3 text-[10px] font-bold uppercase transition-all ${leaderboardEnabled ? 'bg-primary text-black hover:bg-primary/90' : 'text-white/40 border-white/10'}`}
                                onClick={async () => {
                                    const newVal = !leaderboardEnabled;
                                    setLeaderboardEnabled(newVal);
                                    await (supabase.from('agency_settings') as any).upsert({
                                        key: 'performance_leaderboard',
                                        value: { enabled: newVal }
                                    }, { onConflict: 'key' });
                                }}
                            >
                                {leaderboardEnabled ? 'Visible' : 'Hidden'}
                            </Button>
                        </div>
                        <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
                            <Button
                                variant="ghost"
                                size="sm"
                                className={`rounded-lg ${dateRange.start === format(subDays(new Date(), 7), 'yyyy-MM-dd') ? 'bg-primary text-black' : ''}`}
                                onClick={() => setDateRange({ start: format(subDays(new Date(), 7), 'yyyy-MM-dd'), end: format(new Date(), 'yyyy-MM-dd') })}
                            >
                                7D
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className={`rounded-lg ${dateRange.start === format(subDays(new Date(), 30), 'yyyy-MM-dd') ? 'bg-primary text-black' : ''}`}
                                onClick={() => setDateRange({ start: format(subDays(new Date(), 30), 'yyyy-MM-dd'), end: format(new Date(), 'yyyy-MM-dd') })}
                            >
                                30D
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className={`rounded-lg ${dateRange.start === format(startOfMonth(new Date()), 'yyyy-MM-dd') ? 'bg-primary text-black' : ''}`}
                                onClick={() => setDateRange({ start: format(startOfMonth(new Date()), 'yyyy-MM-dd'), end: format(new Date(), 'yyyy-MM-dd') })}
                            >
                                MTD
                            </Button>
                        </div>

                        <Select value={roleFilter || "all"} onValueChange={(val) => setRoleFilter(val === "all" ? null : val)}>
                            <SelectTrigger className="w-[180px] bg-white/5 border-white/10 rounded-xl">
                                <Filter className="w-4 h-4 mr-2" />
                                <SelectValue placeholder="All Roles" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Roles</SelectItem>
                                <SelectItem value="digital_marketing_manager">Digital Marketer</SelectItem>
                                <SelectItem value="copywriter">Copywriter</SelectItem>
                                <SelectItem value="designer">Designer</SelectItem>
                                <SelectItem value="copy_qc">Copy QC</SelectItem>
                                <SelectItem value="designer_qc">Design QC</SelectItem>
                            </SelectContent>
                        </Select>

                        <Button size="icon" variant="outline" className="rounded-xl border-white/10" onClick={fetchAllMetrics}>
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                </div>

                {/* Master Performance Leaderboard */}
                {leaderboardEnabled && (
                    <Card className="glass-card border-primary/20 bg-primary/5 overflow-hidden animate-in zoom-in-95 duration-500">
                        <CardHeader className="flex flex-row items-center justify-between border-b border-primary/10 pb-4">
                            <div>
                                <CardTitle className="text-2xl font-black flex items-center gap-2 text-primary">
                                    <Medal className="w-6 h-6" />
                                    AGENCY MASTER LEADERBOARD
                                </CardTitle>
                                <p className="text-xs text-primary/60 font-medium uppercase tracking-widest mt-1">Composite Performance Score (Efficiency + Workload + Quality)</p>
                            </div>
                            <div className="hidden sm:flex gap-2 text-[10px] font-bold uppercase tracking-tighter">
                                <div className="px-2 py-1 bg-primary/10 rounded border border-primary/20 text-primary">Efficiency 40%</div>
                                <div className="px-2 py-1 bg-primary/10 rounded border border-primary/20 text-primary">Workload 40%</div>
                                <div className="px-2 py-1 bg-primary/10 rounded border border-primary/20 text-primary">Quality 20%</div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-x divide-primary/5">
                                {masterLeaderboard.slice(0, 3).map((member, idx) => (
                                    <div key={member.user_id} className={`p-6 flex flex-col items-center text-center relative ${idx === 0 ? 'bg-primary/10' : ''}`}>
                                        {idx === 0 && <Star className="w-8 h-8 text-yellow-500 absolute -top-4 -right-4 fill-yellow-500 animate-pulse" />}
                                        <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black mb-4 border-2 ${idx === 0 ? 'border-yellow-500 bg-yellow-500/20 text-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.3)]' :
                                            idx === 1 ? 'border-blue-400 bg-blue-400/20 text-blue-400' :
                                                'border-orange-400 bg-orange-400/20 text-orange-400'
                                            }`}>
                                            {idx + 1}
                                        </div>
                                        <h3 className="text-xl font-bold text-white">{member.full_name}</h3>
                                        <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-4">{member.role?.replace('_', ' ')}</p>

                                        <div className="w-full space-y-3">
                                            <div className="flex justify-between items-end">
                                                <span className="text-[10px] text-white/40 uppercase font-black">Performance Score</span>
                                                <span className="text-2xl font-black text-primary">{Math.round(member.performance_score)}%</span>
                                            </div>
                                            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/10">
                                                <div className="h-full bg-primary transition-all duration-1000 shadow-[0_0_10px_rgba(234,179,8,0.5)]" style={{ width: `${member.performance_score}%` }} />
                                            </div>
                                            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5">
                                                <div className="text-center">
                                                    <p className="text-[10px] font-bold text-white">{member.tasks_completed}</p>
                                                    <p className="text-[8px] text-white/40 uppercase">Tasks</p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-[10px] font-bold text-white">{formatDuration(member.avg_speed_seconds)}</p>
                                                    <p className="text-[8px] text-white/40 uppercase">Avg</p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-[10px] font-bold text-white">{(member.avg_engagement_score || 0).toFixed(1)}%</p>
                                                    <p className="text-[8px] text-white/40 uppercase">Eng.</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {masterLeaderboard.length === 0 && (
                                    <div className="col-span-full py-12 text-center text-muted-foreground italic opacity-50">
                                        Calculating performance metrics...
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* High-Level Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard title="Active Clients" value={productionStats?.active_clients || 0} icon={Users} color="text-blue-400" />
                    <StatCard title="Active Projects" value={productionStats?.active_projects || 0} icon={Briefcase} color="text-purple-400" />
                    <StatCard title="Items Completed" value={productionStats?.completed_content_items || 0} icon={Zap} color="text-yellow-400" />
                    <StatCard
                        title="Avg Time / Item"
                        value={formatDuration(timeEfficiency[0]?.avg_seconds_per_content_item || 0)}
                        icon={Clock}
                        color="text-green-400"
                    />
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    {/* Production Volume Chart */}
                    <Card className="glass-card border-white/5 bg-black/40 overflow-hidden">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="text-xl font-bold flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-primary" />
                                Production Volume
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="h-[350px] w-full pt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={volumeData}>
                                    <defs>
                                        <linearGradient id="colorPlanned" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#EAB308" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#EAB308" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                                    <XAxis dataKey="production_date" stroke="#666" fontSize={"12"} tickFormatter={(val) => format(new Date(val), 'MMM d')} />
                                    <YAxis stroke="#666" fontSize={"12"} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px' }}
                                        itemStyle={{ fontSize: '12px' }}
                                    />
                                    <Area type="monotone" dataKey="items_planned" stroke="#3B82F6" fillOpacity={1} fill="url(#colorPlanned)" strokeWidth={2} name="Planned" />
                                    <Area type="monotone" dataKey="items_completed" stroke="#EAB308" fillOpacity={1} fill="url(#colorCompleted)" strokeWidth={3} name="Completed" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    {/* Role Efficiency Chart */}
                    <Card className="glass-card border-white/5 bg-black/40 overflow-hidden">
                        <CardHeader>
                            <CardTitle className="text-xl font-bold flex items-center gap-2">
                                <BarChart3 className="w-5 h-5 text-primary" />
                                Avg. Prep Time by Role
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="h-[350px] w-full pt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={timeEfficiency}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                                    <XAxis
                                        dataKey="role_name"
                                        stroke="#666"
                                        fontSize={"10"}
                                        tickFormatter={(val) => val.split('_').map((s: any) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')}
                                    />
                                    <YAxis stroke="#666" fontSize={"12"} unit="m" tickFormatter={(val) => Math.floor(val / 60).toString()} />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                        contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px' }}
                                        formatter={(val: number) => [formatDuration(val), "Avg Time"]}
                                    />
                                    <Bar dataKey="avg_role_seconds_per_item" fill="#EAB308" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                    {/* Team Efficiency Leaderboard */}
                    <Card className="glass-card border-white/5 bg-black/40 xl:col-span-1">
                        <CardHeader>
                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                                <Zap className="w-5 h-5 text-primary" />
                                Efficiency Ranking
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {teamRanking.slice(0, 5).map((member, i) => (
                                <div key={member.employee_id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 group hover:border-primary/30 transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${i === 0 ? 'bg-yellow-500/20 text-yellow-500' : 'bg-white/10 text-muted-foreground'}`}>
                                            #{i + 1}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-white group-hover:text-primary transition-colors">{member.employee_name}</p>
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{member.employee_role.replace('_', ' ')}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-mono font-bold">{formatDuration(member.avg_seconds_per_task)}</p>
                                        <p className="text-[10px] text-muted-foreground">{member.total_tasks_completed} items</p>
                                    </div>
                                </div>
                            ))}
                            {teamRanking.length === 0 && <p className="text-center text-muted-foreground italic py-8">No data for this range</p>}
                        </CardContent>
                    </Card>

                    {/* Workload Distribution */}
                    <Card className="glass-card border-white/5 bg-black/40 xl:col-span-1">
                        <CardHeader>
                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                                <Target className="w-5 h-5 text-primary" />
                                Utilization Heatmap
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {workloadData.slice(0, 6).map((item) => (
                                <div key={item.employee_name} className="space-y-1.5 p-3 rounded-xl bg-white/5 border border-white/5">
                                    <div className="flex justify-between text-xs font-bold uppercase tracking-tight">
                                        <span className="text-white">{item.employee_name}</span>
                                        <span className={item.utilization_rate > 90 ? "text-red-400" : item.utilization_rate > 70 ? "text-yellow-400" : "text-green-400"}>
                                            {Math.round(item.utilization_rate)}%
                                        </span>
                                    </div>
                                    <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full transition-all duration-1000 ${item.utilization_rate > 90 ? "bg-red-500" :
                                                item.utilization_rate > 70 ? "bg-yellow-500" :
                                                    "bg-green-500"
                                                }`}
                                            style={{ width: `${Math.min(item.utilization_rate, 100)}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    {/* Creative Performance */}
                    <Card className="glass-card border-white/5 bg-black/40 xl:col-span-1">
                        <CardHeader>
                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                                <Trophy className="w-5 h-5 text-primary" />
                                Top Creatives
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {leaderboard.map((item, i) => (
                                <div key={item.content_item_id} className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1">
                                    <div className="flex justify-between">
                                        <p className="text-xs font-bold text-white truncate max-w-[150px]">{item.title}</p>
                                        <div className="flex gap-1">
                                            <Zap className="w-3 h-3 text-primary" />
                                            <span className="text-[10px] font-bold text-primary">{Math.round(item.engagement_score * 10) / 10}% Eng.</span>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground uppercase">{item.company_name}</p>
                                    <div className="flex justify-between text-[10px] font-mono text-muted-foreground/60">
                                        <span>Reach: {(item.total_reach || 0).toLocaleString()}</span>
                                        <span>Impressions: {(item.total_impressions || 0).toLocaleString()}</span>
                                    </div>
                                </div>
                            ))}
                            {leaderboard.length === 0 && <p className="text-center text-muted-foreground italic py-8">No marketing data available</p>}
                        </CardContent>
                    </Card>
                </div>

                {/* Detailed Bottlenecks Breakdown */}
                <Card className="glass-card border-white/5 bg-black/40">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-xl font-bold flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-red-500" />
                                Critical Workflow Bottlenecks
                            </CardTitle>
                            <p className="text-xs text-muted-foreground mt-1">Content items exceeding expected stage duration targets</p>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="border-b border-white/5 text-muted-foreground font-medium uppercase tracking-wider text-[10px]">
                                        <th className="pb-3 pl-2">Project / Item</th>
                                        <th className="pb-3">Stuck In Stage</th>
                                        <th className="pb-3">Time Spent</th>
                                        <th className="pb-3">Benchmark</th>
                                        <th className="pb-3">Assignee</th>
                                        <th className="pb-3 text-right pr-2">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {bottlenecks.map((item) => (
                                        <tr key={item.content_item_id} className="group hover:bg-white/5 transition-colors">
                                            <td className="py-4 pl-2">
                                                <p className="font-bold text-white">{item.project_name}</p>
                                                <p className="text-[10px] text-muted-foreground">ID: {item.content_item_id.slice(0, 8)}</p>
                                            </td>
                                            <td className="py-4">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${item.urgency === 'CRITICAL' ? 'bg-red-500/20 text-red-500' : 'bg-orange-500/20 text-orange-400'
                                                    }`}>
                                                    {item.stage_name}
                                                </span>
                                            </td>
                                            <td className="py-4 font-mono">
                                                <span className={item.urgency === 'CRITICAL' ? 'text-red-400' : 'text-orange-400'}>
                                                    {Math.round(item.hours_in_stage)}h
                                                </span>
                                            </td>
                                            <td className="py-4 text-muted-foreground">{item.benchmark_hours}h</td>
                                            <td className="py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                                                        {item.assignee_name?.[0]}
                                                    </div>
                                                    <span className="text-white/80">{item.assignee_name || 'Unassigned'}</span>
                                                </div>
                                            </td>
                                            <td className="py-4 text-right pr-2">
                                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-primary hover:text-black">
                                                    <ArrowRight className="w-4 h-4" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                    {bottlenecks.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="py-12 text-center text-muted-foreground italic">
                                                <div className="flex flex-col items-center gap-2 opacity-50">
                                                    <Inbox className="w-8 h-8" />
                                                    <p>Efficient Workflow - No Bottlenecks Detected</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}

function StatCard({ title, value, icon: Icon, color }: any) {
    return (
        <Card className="glass-card border-white/5 bg-black/40 hover:border-primary/20 transition-all group">
            <CardContent className="p-6">
                <div className="flex items-start justify-between">
                    <div className="space-y-1">
                        <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">{title}</p>
                        <p className="text-3xl font-bold tracking-tighter text-white">{value}</p>
                    </div>
                    <div className={`p-2.5 rounded-xl bg-white/5 ${color} group-hover:scale-110 transition-transform`}>
                        <Icon className="w-6 h-6" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
