import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { User } from "@supabase/supabase-js";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Megaphone, BarChart3, Users, Calendar as CalendarIcon, Target, Download, Edit2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ClientFilterCards } from "@/components/ClientFilterCards";
import { Calendar } from "@/components/ui/calendar"; // Moved import to top
import { canEditContent, type UserRole, type ContentStage } from "@/lib/stagePermissions";
import { StageIndicator } from "@/components/StageIndicator";
import { ReadOnlyAlert } from "@/components/ReadOnlyAlert";
import { useMarketingPerformance } from "@/hooks/useMarketingPerformance";
import { MarketingPerformanceForm } from "@/components/MarketingPerformanceForm";
import { MarketingPerformanceStats } from "@/components/MarketingPerformanceStats";
import { MarketingConfigForm } from "@/components/MarketingConfigForm";
// Helper component for the Calendar
const CalendarView = ({ contentItems, onDateSelect, selectedDate }: any) => {
    // Create status modifiers
    const hasContent = contentItems.map((item: any) => new Date(item.publish_date));

    return (
        <div className="w-full flex justify-center">
            <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={onDateSelect}
                className="rounded-xl border border-white/5 bg-black/20 p-6 w-full max-w-full"
                classNames={{
                    months: "w-full flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                    month: "w-full space-y-4",
                    table: "w-full border-collapse space-y-1",
                    head_row: "flex justify-between",
                    head_cell: "text-muted-foreground rounded-md w-full font-normal text-sm uppercase tracking-wider mb-4",
                    row: "flex w-full mt-2 justify-between gap-2",
                    cell: "h-14 w-full text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
                    day: "h-14 w-full p-0 font-normal aria-selected:opacity-100 hover:bg-white/5 rounded-full transition-all duration-300",
                    day_selected: "bg-primary text-black hover:bg-primary hover:text-black focus:bg-primary focus:text-black shadow-[0_0_20px_rgba(234,179,8,0.8)] font-bold scale-105 transition-transform rounded-full",
                    day_today: "bg-white/10 text-white font-bold rounded-full",
                }}
                modifiers={{
                    hasContent: hasContent
                }}
                modifiersStyles={{
                    hasContent: {
                        position: 'relative'
                    }
                }}
                components={{
                    DayContent: ({ date, ...props }) => {
                        // Custom day content rendering to add the dot/indicator
                        const isSelected = selectedDate?.toDateString() === date.toDateString();
                        const isToday = new Date().toDateString() === date.toDateString();
                        const hasItem = hasContent.some((d: Date) => d.toDateString() === date.toDateString());

                        return (
                            <div className="w-full h-full flex items-center justify-center relative">
                                <span>{date.getDate()}</span>
                                {hasItem && (
                                    <div className={`absolute bottom-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-black' : 'bg-primary shadow-[0_0_5px_rgba(234,179,8,0.8)]'}`} />
                                )}
                            </div>
                        )
                    }
                }}
            />
        </div>
    );
};

const DigitalMarketingDashboard = () => {
    const [user, setUser] = useState<User | null>(null);
    const [projects, setProjects] = useState<any[]>([]);
    const [selectedProject, setSelectedProject] = useState<any>(null);
    const [contentItems, setContentItems] = useState<any[]>([]);

    // Dialog States
    const [isIdeaDialogOpen, setIsIdeaDialogOpen] = useState(false);
    const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);

    const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
    const [selectedItem, setSelectedItem] = useState<any>(null);

    const [ideaForm, setIdeaForm] = useState({ dm_title: "", dm_notes: "", dm_thread: "", complexity_weight: 1 });
    const [changeRequests, setChangeRequests] = useState<any[]>([]);
    const [newChangeRequest, setNewChangeRequest] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedClient, setSelectedClient] = useState<string | null>(null);
    const { toast } = useToast();

    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(false);
    const [userRole, setUserRole] = useState<UserRole | null>(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            if (session?.user) {
                checkUserRole(session.user.id);
            }
        });
        fetchProjects();
    }, []);

    const checkUserRole = async (userId: string) => {
        const { data } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

        if (data) {
            setUserRole(data.role as UserRole);
            setIsAdmin(data.role === 'admin');
        }
    };
    const {
        config: marketingConfig,
        summary: marketingSummary,
        logPerformance,
        saveConfig
    } = useMarketingPerformance(selectedProject?.id);

    const saveMarketingConfig = async (config: any) => {
        await saveConfig(config);
    };
    const fetchProjects = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        setLoading(true);
        try {
            // Check if user is admin
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', session.user.id)
                .single();

            const isAdminUser = profile?.role === 'admin';
            setIsAdmin(isAdminUser);

            // Fetch projects and their content items
            let query = supabase
                .from('projects')
                .select('*, content_items(id, status, publish_date), project_onboarding(*)')
                .eq('status', 'active');

            // If not admin, filter to show only their assigned projects
            if (!isAdminUser) {
                // Fetch ALL projects first, then filter in JavaScript
                // This allows us to check both dedicated_dm_id and dm_assignee
                query = supabase
                    .from('projects')
                    .select('*, content_items(id, status, publish_date, dm_assignee), project_onboarding(*)')
                    .eq('status', 'active');
            }

            const { data, error } = await query;

            if (error) {
                console.error("Error fetching projects:", error);
                toast({ title: "Error", description: error.message, variant: "destructive" });
                throw error;
            }

            console.log("Fetched projects data:", data);

            if (data) {
                // Filter projects for non-admin users
                let filteredData = data;
                if (!isAdminUser) {
                    filteredData = data.filter((proj: any) => {
                        // Check if user is the dedicated DM for this project
                        const onboarding = Array.isArray(proj.project_onboarding)
                            ? proj.project_onboarding[0]
                            : proj.project_onboarding;
                        const isDedicatedDM = onboarding?.dedicated_dm_id === session.user.id;

                        // Check if user has any content items assigned to them
                        const hasAssignedItems = proj.content_items?.some(
                            (item: any) => item.dm_assignee === session.user.id
                        );

                        return isDedicatedDM || hasAssignedItems;
                    });
                }

                const projectsWithProgress = filteredData.map((proj: any) => {
                    const items = proj.content_items || [];
                    const plannedCount = items.filter((i: any) => i.status !== 'pending_dm').length;

                    // Find earliest deadline for pending tasks in this project
                    const pendingItems = items.filter((i: any) => i.status === 'pending_dm');
                    const earliestDate = pendingItems.length > 0
                        ? pendingItems.reduce((min: string, p: any) => p.publish_date < min ? p.publish_date : min, pendingItems[0].publish_date)
                        : proj.start_date;

                    return {
                        ...proj,
                        planned_count: plannedCount,
                        earliest_deadline: earliestDate
                    };
                }).sort((a: any, b: any) => new Date(a.earliest_deadline).getTime() - new Date(b.earliest_deadline).getTime());

                setProjects(projectsWithProgress);
            }
        } catch (error) {
            console.error("Error fetching projects:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchContentItems = async (projectId: string) => {
        const { data } = await supabase
            .from('content_items')
            .select('*')
            .eq('project_id', projectId)
            .eq('is_admin_verified', false);

        if (data) setContentItems(data);
    };

    const fetchChangeRequests = async (projectId: string) => {
        try {
            const { data, error } = await (supabase
                .from('project_change_requests' as any)
                .select('*')
                .eq('project_id', projectId)
                .order('created_at', { ascending: false }));

            if (error) throw error;
            if (data) setChangeRequests(data);
        } catch (error: any) {
            console.error("Error fetching change requests:", error);
            // Specifically check for 'table not found' to guide the user
            if (error.message?.includes("project_change_requests")) {
                toast({
                    title: "Database Table Missing",
                    description: "The 'project_change_requests' table has not been created yet. Please run the provided SQL migration in your Supabase SQL Editor.",
                    variant: "destructive"
                });
            }
        }
    };

    // Editable Fields State
    const [editableBrief, setEditableBrief] = useState("");
    const [editableProtocol, setEditableProtocol] = useState("");
    const [isEditingBrief, setIsEditingBrief] = useState(false);
    const [isEditingProtocol, setIsEditingProtocol] = useState(false);
    const [isSavingDetails, setIsSavingDetails] = useState(false);

    const [onboardingData, setOnboardingData] = useState<any>(null);

    const fetchOnboarding = async (projectId: string) => {
        const { data } = await supabase
            .from('project_onboarding' as any)
            .select('*')
            .eq('project_id', projectId)
            .single();

        if (data) {
            const onboarding = data as any;
            setOnboardingData(onboarding);
            setEditableProtocol(onboarding.additional_info || "");
        } else {
            setOnboardingData(null);
            setEditableProtocol("");
        }
    };

    const handleProjectClick = (project: any) => {
        setSelectedProject(project);
        setEditableBrief(project.brief || "");
        fetchContentItems(project.id);
        fetchChangeRequests(project.id);
        fetchOnboarding(project.id);
    };

    const handleSaveBrief = async () => {
        if (!selectedProject) return;
        setIsSavingDetails(true);
        try {
            const { error } = await supabase
                .from('projects')
                .update({ brief: editableBrief })
                .eq('id', selectedProject.id);

            if (error) throw error;

            toast({ title: "Success", description: "Brief updated." });
            setIsEditingBrief(false);
            // Update selectedProject local state to avoid refetch flicker
            setSelectedProject({ ...selectedProject, brief: editableBrief });
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsSavingDetails(false);
        }
    };

    const handleSaveProtocol = async () => {
        if (!selectedProject) return;
        setIsSavingDetails(true);
        try {
            const { error } = await supabase
                .from('project_onboarding' as any)
                .update({ additional_info: editableProtocol })
                .eq('project_id', selectedProject.id);

            if (error) throw error;

            toast({ title: "Success", description: "Protocol updated." });
            setIsEditingProtocol(false);
            // Update onboardingData local state
            setOnboardingData({ ...onboardingData, additional_info: editableProtocol });
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsSavingDetails(false);
        }
    };

    const handleDownloadLogo = async () => {
        if (!onboardingData?.brand_logo_url) return;
        try {
            const response = await fetch(onboardingData.brand_logo_url);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `brand-logo-${selectedProject.title.toLowerCase().replace(/\s+/g, '-')}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Download failed:", error);
            toast({ title: "Error", description: "Failed to download logo.", variant: "destructive" });
        }
    };

    const handleDateSelect = (date: Date | undefined) => {
        setSelectedDate(date);
        if (!date) return;

        // Check if there is an existing item for this date
        const existingItem = contentItems.find(item =>
            new Date(item.publish_date).toDateString() === date.toDateString()
        );

        setSelectedItem(existingItem || null);

        // Open Idea Dialog directly (bypass details dialog)
        setIdeaForm({
            dm_title: existingItem?.dm_title || "",
            dm_notes: existingItem?.dm_notes || "",
            dm_thread: existingItem?.dm_thread || "",
            complexity_weight: existingItem?.complexity_weight || 1
        });
        setIsIdeaDialogOpen(true);
    };

    // openIdeaDialog function is no longer needed but kept if referenced elsewhere, 
    // or can be removed. The above replaces the need for openIdeaDialog to be called from DetailsDialog.  };


    const handleSubmitIdea = async () => {
        if (!selectedProject || !selectedDate) return;

        try {
            // detailed fix: Construct YYYY-MM-DD from local date parts to avoid timezone shifting
            const offset = selectedDate.getTimezoneOffset();
            const localDate = new Date(selectedDate.getTime() - (offset * 60 * 1000));
            const dateString = localDate.toISOString().split('T')[0];
            let existingItem = contentItems.find(item =>
                new Date(item.publish_date).toDateString() === selectedDate.toDateString()
            );

            let error;
            let contentItemId;

            if (existingItem) {
                // Update existing item
                const { error: updateError } = await supabase
                    .from('content_items')
                    .update({
                        dm_title: ideaForm.dm_title,
                        dm_notes: ideaForm.dm_notes,
                        dm_thread: ideaForm.dm_thread,
                        complexity_weight: ideaForm.complexity_weight,
                        dm_submitted_at: new Date().toISOString()
                    })
                    .eq('id', existingItem.id);
                error = updateError;
                contentItemId = existingItem.id;
            } else {
                // Create new item
                const { data: newItem, error: insertError } = await supabase
                    .from('content_items')
                    .insert({
                        project_id: selectedProject.id,
                        publish_date: dateString,
                        dm_title: ideaForm.dm_title,
                        dm_notes: ideaForm.dm_notes,
                        dm_thread: ideaForm.dm_thread,
                        complexity_weight: ideaForm.complexity_weight,
                        current_stage: 'digital_marketer',
                        dm_submitted_at: new Date().toISOString()
                    })
                    .select()
                    .single();
                error = insertError;
                contentItemId = newItem?.id;
            }

            if (error) throw error;

            // Advance to next stage
            const { data: stageResult, error: stageError } = await supabase.rpc('advance_content_stage' as any, {
                p_content_item_id: contentItemId
            });

            if (stageError) throw stageError;

            toast({
                title: "Success",
                description: `Content submitted and advanced to ${(stageResult as any)?.new_stage || 'next'} stage.`
            });
            setIsIdeaDialogOpen(false);
            fetchContentItems(selectedProject.id); // Refresh item details
            fetchProjects(); // Refresh project list progress
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    };

    const handleSubmitChangeRequest = async () => {
        if (!newChangeRequest.trim() || !selectedProject) return;

        try {
            // Casting to any
            const { error } = await (supabase
                .from('project_change_requests' as any)
                .insert({
                    project_id: selectedProject.id,
                    content: newChangeRequest,
                    created_by: user?.id
                }));

            if (error) throw error;

            toast({ title: "Success", description: "Request submitted." });
            setNewChangeRequest("");
            fetchChangeRequests(selectedProject.id);
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    };

    return (
        <DashboardLayout>
            <div className="relative mb-8 p-8 rounded-3xl bg-gradient-to-r from-primary/10 via-background to-background border border-primary/20 overflow-hidden">
                {/* Background Effects */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl -mr-32 -mt-32 opacity-50 animate-pulse-glow" />

                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <h1 className="text-4xl font-extrabold mb-2 tracking-tight">
                            Digital Marketing <span className="text-gradient-gold">Dashboard</span>
                        </h1>
                        <p className="text-lg text-muted-foreground max-w-2xl">
                            Manage your campaigns efficiently. Select project dates to add content ideas and track your progress.
                        </p>
                    </div>

                    {!selectedProject && (
                        <div className="w-full md:w-64">
                            <Input
                                type="text"
                                placeholder="Filter by client..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-black/20 border-white/10"
                            />
                        </div>
                    )}
                </div>
            </div>

            {!selectedProject ? (
                <div className="space-y-6">
                    <ClientFilterCards
                        projects={projects}
                        selectedClient={selectedClient}
                        onSelectClient={setSelectedClient}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {projects.length === 0 && (
                            <Card className="col-span-full p-16 text-center glass-card border-dashed border-white/10">
                                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                                    <CalendarIcon className="w-8 h-8 text-primary" />
                                </div>
                                <h3 className="text-xl font-bold mb-2">No Active Projects</h3>
                                <p className="text-muted-foreground">You don't have any active projects assigned yet.</p>
                            </Card>
                        )}
                        {projects
                            .filter((proj: any) => {
                                const onboarding = Array.isArray(proj.project_onboarding) ? proj.project_onboarding[0] : proj.project_onboarding;
                                const clientName = onboarding?.company_name || "";
                                const projectTitle = proj.title || "";
                                const searchLower = searchQuery.toLowerCase();

                                const matchesSearch = clientName.toLowerCase().includes(searchLower) || projectTitle.toLowerCase().includes(searchLower);
                                const matchesClient = selectedClient ? clientName === selectedClient : true;

                                return matchesSearch && matchesClient;
                            })
                            .map(project => (
                                <div key={project.id} className="group relative" onClick={() => handleProjectClick(project)}>
                                    {/* Hover Glow */}
                                    <div className="absolute -inset-0.5 bg-gradient-gold opacity-0 group-hover:opacity-30 rounded-2xl blur transition duration-500" />

                                    <Card className="glass-card-hover h-full cursor-pointer border-white/5 bg-black/40 relative z-10">
                                        <CardContent className="p-6 flex flex-col h-full">
                                            <div className="flex items-start gap-4 mb-4 relative">
                                                {project.project_onboarding?.[0]?.brand_logo_url && (
                                                    <div className="w-12 h-12 rounded-lg overflow-hidden border border-white/10 bg-black/20 flex-shrink-0">
                                                        <img src={project.project_onboarding[0].brand_logo_url} alt="Logo" className="w-full h-full object-contain" />
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <span className="text-[10px] font-bold tracking-widest uppercase text-primary mb-1 block">Client</span>
                                                    <h3 className="font-bold text-xl tracking-tight group-hover:text-primary transition-colors truncate">
                                                        {project.project_onboarding?.[0]?.company_name || project.title}
                                                    </h3>
                                                </div>
                                            </div>

                                            <div className="space-y-4 flex-1">
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-muted-foreground">Planning Progress</span>
                                                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                                                        {project.planned_count}/{project.total_contents}
                                                    </span>
                                                </div>

                                                {project.project_onboarding?.[0]?.additional_info && (
                                                    <div className="p-3 rounded-lg bg-white/5 border border-white/5 space-y-1">
                                                        <span className="text-[10px] font-bold text-primary uppercase">Main Protocol</span>
                                                        <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                                                            {project.project_onboarding[0].additional_info}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
                                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                                                    <CalendarIcon className="w-3.5 h-3.5 text-primary/50" />
                                                    Next: {new Date(project.earliest_deadline).toLocaleDateString()}
                                                </div>
                                                <div className="flex gap-2">
                                                    {project.project_onboarding?.[0]?.brand_logo_url && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 px-2 text-[10px]"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                window.open(project.project_onboarding[0].brand_logo_url, '_blank');
                                                            }}
                                                        >
                                                            Logo
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            ))}
                    </div>
                </div>
            ) : (
                <div className="space-y-8 animate-fade-in-up">
                    {/* Enhanced Project Header */}
                    <div className="glass-card p-6 border-primary/20 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />

                        <div className="relative z-10 flex flex-col lg:flex-row gap-8">
                            <div className="flex-shrink-0">
                                <Button variant="outline" size="icon" onClick={() => setSelectedProject(null)} className="rounded-full h-10 w-10 border-white/10 hover:bg-white/10 mb-4">
                                    <span className="text-lg">←</span>
                                </Button>
                                <div
                                    className="w-32 h-32 rounded-2xl bg-gradient-to-br from-primary/20 to-black border border-white/10 flex items-center justify-center overflow-hidden cursor-pointer hover:ring-2 ring-primary/50 transition-all relative group"
                                    onClick={handleDownloadLogo}
                                    title="Click to download logo"
                                >
                                    {onboardingData?.brand_logo_url ? (
                                        <>
                                            <img src={onboardingData.brand_logo_url} alt="Logo" className="w-full h-full object-contain" />
                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                <Download className="w-8 h-8 text-primary" />
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-4xl font-black text-primary/50">SC</div>
                                    )}
                                </div>
                            </div>

                            <div className="flex-grow space-y-4">
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-3">
                                            <h2 className="text-3xl font-bold tracking-tight">{selectedProject.title}</h2>
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/20 text-green-500 border border-green-500/30 uppercase tracking-widest">Active Campaign</span>
                                        </div>
                                        {/* Header Actions removed - Save is now local */}
                                    </div>

                                    <div className="w-full">
                                        {/* PROTOCOL SECTION */}
                                        <div className={`rounded-xl p-6 border transition-all ${isEditingProtocol ? 'bg-black/40 border-primary/50 ring-1 ring-primary/20' : 'bg-white/5 border-white/5'}`}>
                                            <div className="flex items-center justify-between mb-3">
                                                <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                                    <Target className="w-4 h-4" />
                                                    Total Work Protocol
                                                </h4>
                                                {isAdmin && !isEditingProtocol && (
                                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-white/10" onClick={() => setIsEditingProtocol(true)}>
                                                        <Edit2 className="w-3 h-3 text-muted-foreground hover:text-white" />
                                                    </Button>
                                                )}
                                            </div>

                                            {isEditingProtocol ? (
                                                <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
                                                    <Textarea
                                                        value={editableProtocol}
                                                        onChange={(e) => setEditableProtocol(e.target.value)}
                                                        className="text-base leading-relaxed text-gray-300 min-h-[150px] bg-black/40 border-white/10 focus-visible:ring-0 resize-none custom-scrollbar"
                                                        placeholder="No protocol defined."
                                                    />
                                                    <div className="flex justify-end gap-2">
                                                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => {
                                                            setIsEditingProtocol(false);
                                                            setEditableProtocol(onboardingData?.additional_info || "");
                                                        }}>Cancel</Button>
                                                        <Button size="sm" className="h-7 text-xs bg-primary text-black hover:bg-primary/90" onClick={handleSaveProtocol} disabled={isSavingDetails}>
                                                            {isSavingDetails ? "Saving" : "Save"}
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-base leading-relaxed text-gray-300 min-h-[80px] max-h-[300px] overflow-y-auto custom-scrollbar whitespace-pre-wrap">
                                                    {onboardingData?.additional_info || <span className="text-muted-foreground italic">No protocol defined.</span>}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-6 text-sm pt-2">
                                    <div>
                                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Timeline</p>
                                        <p className="font-medium text-white">
                                            {new Date(selectedProject.start_date).toLocaleDateString()} — {new Date(selectedProject.end_date).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Total Deliverables</p>
                                        <p className="font-medium text-white">{selectedProject.total_contents} Threads</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {marketingConfig?.enabled && (
                        <div className="space-y-6 mb-8 animate-fade-in">
                            <MarketingPerformanceStats
                                summary={marketingSummary}
                                budget={{ amount: marketingConfig.budget_amount, type: marketingConfig.budget_type }}
                            />

                            {!isAdmin ? (
                                <MarketingPerformanceForm
                                    projectId={selectedProject.id}
                                    onLog={logPerformance}
                                />
                            ) : (
                                <MarketingConfigForm
                                    config={marketingConfig}
                                    onSave={saveMarketingConfig}
                                />
                            )}
                        </div>
                    )}

                    {isAdmin && !marketingConfig?.enabled && (
                        <Card className="glass-card p-8 border-dashed border-white/10 bg-white/5 mb-8 text-center animate-fade-in">
                            <h3 className="text-xl font-bold mb-2">Paid Marketing System</h3>
                            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                                Enable paid marketing tracking to allow your Digital Marketers to log daily performance data for this client.
                            </p>
                            <Button
                                onClick={() => saveMarketingConfig({ enabled: true, channels: [], budget_type: 'monthly', budget_amount: 0 })}
                                variant="outline"
                                className="border-primary/20 hover:bg-primary/10 h-11 px-8"
                            >
                                <BarChart3 className="w-4 h-4 mr-2 text-primary" />
                                Setup Paid Marketing
                            </Button>
                        </Card>
                    )}

                    <div className="grid grid-cols-1 xl:grid-cols-[1fr_350px] gap-8">
                        {/* Main Content Area */}
                        <div className="space-y-8">
                            {/* Calendar Section */}
                            <Card className="glass-card p-8 border-white/5 bg-gradient-to-br from-black/40 to-black/20">
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <CardTitle className="text-2xl mb-1 flex items-center gap-2">
                                            <CalendarIcon className="w-6 h-6 text-primary" />
                                            Content Calendar
                                        </CardTitle>
                                        <p className="text-sm text-muted-foreground">Select dates to manage content strategy.</p>
                                    </div>
                                </div>

                                <CalendarView
                                    contentItems={contentItems}
                                    onDateSelect={handleDateSelect}
                                    selectedDate={selectedDate}
                                />
                            </Card>

                            {/* Additional Change Requests */}
                            <Card className="glass-card p-8 border-primary/30 shadow-[0_0_20px_rgba(234,179,8,0.1)] relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-primary shadow-[2px_0_10px_rgba(234,179,8,0.5)]"></div>
                                <CardTitle className="mb-4 flex items-center gap-2 text-primary font-bold text-xl uppercase tracking-wider">
                                    <Megaphone className="w-6 h-6 animate-pulse" />
                                    Additional Permanent Changes (Main Point)
                                </CardTitle>
                                <div className="space-y-4">
                                    <div className="glass-card p-1 bg-black/20 focus-within:ring-2 ring-primary/50 transition-all">
                                        <Textarea
                                            placeholder="Add any critical points or strategic changes here..."
                                            value={newChangeRequest}
                                            onChange={(e) => setNewChangeRequest(e.target.value)}
                                            className="min-h-[120px] border-none focus-visible:ring-0 bg-transparent resize-none p-4 text-base"
                                        />
                                        <div className="p-2 flex justify-end bg-white/5 rounded-b-xl">
                                            <Button onClick={handleSubmitChangeRequest} className="bg-primary text-black hover:bg-primary/90 font-bold px-6">
                                                Update Main Points
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="space-y-3 mt-6">
                                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                            <span className="w-4 h-[1px] bg-muted-foreground/30"></span>
                                            Change History
                                        </h4>
                                        <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                                            {changeRequests.map(req => (
                                                <div key={req.id} className="p-4 rounded-xl bg-white/5 border border-white/5 hover:border-primary/20 transition-all group">
                                                    <p className="mb-2 text-sm leading-relaxed group-hover:text-white transition-colors">{req.content}</p>
                                                    <div className="flex justify-between items-center text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">
                                                        <span>Submitted by You</span>
                                                        <span>{new Date(req.created_at).toLocaleDateString()}</span>
                                                    </div>
                                                </div>
                                            ))}
                                            {changeRequests.length === 0 && (
                                                <div className="text-center py-8 text-muted-foreground bg-white/5 rounded-xl border-dashed border border-white/10 italic">
                                                    <p>No critical changes logged yet.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </div>

                        {/* Sidebar Info Panel */}
                        <div className="space-y-6">
                            <Card className="glass-card p-6 bg-primary/5 border-primary/10">
                                <CardTitle className="mb-4 text-lg">Quick Instructions</CardTitle>
                                <div className="space-y-4 text-sm text-muted-foreground">
                                    <div className="flex gap-3">
                                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary font-bold text-xs">1</div>
                                        <p>Select a date on the calendar to open the content planner.</p>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary font-bold text-xs">2</div>
                                        <p>Fill in the Content Name and detailed Description/Instructions.</p>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary font-bold text-xs">3</div>
                                        <p>Save your idea to automatically notify the Copywriter for that specific date.</p>
                                    </div>

                                    <div className="mt-4 p-3 rounded-lg bg-black/40 border border-white/5 flex items-center gap-3">
                                        <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_10px_rgba(234,179,8,0.5)]"></div>
                                        <span className="text-primary font-medium">Scheduled Content</span>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    </div>
                </div>
            )}

            {/* Add/Edit Dialog */}
            <Dialog open={isIdeaDialogOpen} onOpenChange={setIsIdeaDialogOpen}>
                <DialogContent className="glass-card border-primary/20 bg-black/90 backdrop-blur-xl sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                            <span className="w-2 h-8 rounded-full bg-primary"></span>
                            {selectedItem ? "Edit Content" : "New Content"}
                        </DialogTitle>
                        <div className="text-muted-foreground text-sm">
                            {selectedDate?.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </div>
                    </DialogHeader>
                    <div className="space-y-6 py-6">
                        <div className="space-y-2">
                            <Label className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Content Name (Optional)</Label>
                            <Input
                                placeholder="e.g. Summer Campaign Teaser"
                                value={ideaForm.dm_title}
                                onChange={(e) => setIdeaForm({ ...ideaForm, dm_title: e.target.value })}
                                className="bg-white/5 border-white/10 focus-visible:ring-primary/50 text-lg h-12"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Thread / Content Detail</Label>
                            <Textarea
                                placeholder="Enter the thread or main content structure..."
                                value={ideaForm.dm_thread}
                                onChange={(e) => setIdeaForm({ ...ideaForm, dm_thread: e.target.value })}
                                className="min-h-[100px] bg-white/5 border-white/10 focus-visible:ring-primary/50 resize-none leading-relaxed"
                            />
                        </div>
                        <div className="space-y-4 pt-4 border-t border-white/5">
                            <Label className="text-xs uppercase tracking-wide text-muted-foreground font-semibold flex justify-between items-center">
                                Task Complexity (CCUs)
                                <span className="text-primary font-bold">{ideaForm.complexity_weight} Units</span>
                            </Label>
                            <div className="grid grid-cols-5 gap-2">
                                {[1, 2, 3, 4, 5].map((val) => (
                                    <Button
                                        key={val}
                                        type="button"
                                        variant={ideaForm.complexity_weight === val ? "default" : "outline"}
                                        className={`h-10 font-bold transition-all ${ideaForm.complexity_weight === val ? 'shadow-[0_0_10px_rgba(234,179,8,0.3)]' : ''}`}
                                        onClick={() => setIdeaForm({ ...ideaForm, complexity_weight: val })}
                                    >
                                        {val}
                                    </Button>
                                ))}
                            </div>
                            <div className="flex justify-between text-[10px] text-muted-foreground italic px-1">
                                <span>Simple</span>
                                <span>Complex</span>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleSubmitIdea} className="w-full bg-primary text-black hover:bg-primary/90 font-bold h-12 text-lg shadow-[0_0_20px_rgba(234,179,8,0.3)]">
                            Submit to Copywriter
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    );
};


export default DigitalMarketingDashboard;
