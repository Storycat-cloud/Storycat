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
import {
    Check,
    Calendar as CalendarIcon,
    List,
    ArrowLeft,
    XCircle,
    AlertCircle,
    Megaphone
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ClientFilterCards } from "@/components/ClientFilterCards";
import { Calendar } from "@/components/ui/calendar";

const CopyQCDashboard = () => {
    const [user, setUser] = useState<User | null>(null);
    const [projects, setProjects] = useState<any[]>([]);
    const [selectedProject, setSelectedProject] = useState<any>(null);
    const [projectContent, setProjectContent] = useState<any[]>([]);

    const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState<any>(null);
    const [rejectReason, setRejectReason] = useState("");
    const [date, setDate] = useState<Date | undefined>(new Date());

    const [changeRequests, setChangeRequests] = useState<any[]>([]);
    const [newChangeRequest, setNewChangeRequest] = useState("");

    const [searchQuery, setSearchQuery] = useState("");
    const [selectedClient, setSelectedClient] = useState<string | null>(null);

    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            if (session?.user) fetchProjects();
        });
    }, []);

    const fetchProjects = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Check user role
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();

        const isAdmin = profile?.role === 'admin';

        // 1. Fetch all items ready for QC
        let query = supabase
            .from('content_items')
            .select('*, projects!inner(*, project_onboarding!inner(*))')
            .eq('status', 'pending_copy_qc')
            .eq('is_admin_verified', false);

        if (!isAdmin) {
            query = query.filter('projects.project_onboarding.dedicated_copy_qc_id', 'eq', session.user.id);
        }

        const { data: items, error } = await query.order('publish_date', { ascending: true });

        if (error) {
            console.error("Error fetching tasks:", error);
            toast({ title: "Error", description: error.message, variant: "destructive" });
            return;
        }

        console.log("CopyQC fetched items:", items);

        if (items) {
            // 2. Group by Project to create unique project list
            const uniqueProjectsMap = new Map();
            items.forEach(item => {
                const project = item.projects;
                if (project && !uniqueProjectsMap.has(project.id)) {
                    uniqueProjectsMap.set(project.id, {
                        ...project,
                        pending_qc_count: 0,
                        earliest_deadline: item.publish_date
                    });
                }
                const proj = uniqueProjectsMap.get(project?.id);
                if (proj) {
                    proj.pending_qc_count++;
                    if (new Date(item.publish_date) < new Date(proj.earliest_deadline)) {
                        proj.earliest_deadline = item.publish_date;
                    }
                }
            });
            const sortedProjects = Array.from(uniqueProjectsMap.values())
                .sort((a: any, b: any) => new Date(a.earliest_deadline).getTime() - new Date(b.earliest_deadline).getTime());
            setProjects(sortedProjects);
        }
    };

    const handleProjectClick = async (project: any) => {
        setSelectedProject(project);
        // Fetch ALL items for context, so we can see the full calendar
        const { data } = await supabase
            .from('content_items')
            .select('*, projects(*, project_onboarding(*))')
            .eq('project_id', project.id)
            .eq('is_admin_verified', false)
            .order('publish_date', { ascending: true });

        if (data) setProjectContent(data);
        fetchChangeRequests(project.id);
        setViewMode('calendar');
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
            if (error.message?.includes("project_change_requests")) {
                console.error("Change requests table missing");
            }
        }
    };

    const handleSubmitChangeRequest = async () => {
        if (!newChangeRequest.trim() || !selectedProject) return;

        try {
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

    // ... (keeping other handlers same)
    const handleApprove = async (task: any) => {
        try {
            const { error } = await supabase
                .from('content_items')
                .update({
                    status: 'pending_design' // Move to Designer
                })
                .eq('id', task.id);

            if (error) throw error;

            toast({ title: "Approved", description: "Item sent to Design team." });
            refreshProject(selectedProject?.id);
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    };

    const handleRejectClick = (task: any) => {
        setSelectedTask(task);
        setRejectReason("");
        setRejectDialogOpen(true);
    };

    const submitReject = async () => {
        if (!rejectReason.trim()) {
            toast({ title: "Reason Required", description: "Please explain why this is rejected.", variant: "destructive" });
            return;
        }
        try {
            const { error } = await supabase
                .from('content_items')
                .update({
                    status: 'rejected_from_copy_qc',
                    rejection_reason: rejectReason
                })
                .eq('id', selectedTask.id);

            if (error) throw error;

            toast({ title: "Rejected", description: "Item returned to Copywriter." });
            setRejectDialogOpen(false);
            refreshProject(selectedProject?.id);
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    };

    const refreshProject = async (projectId: string) => {
        if (!projectId) return;
        // Re-fetch content
        const { data } = await supabase
            .from('content_items')
            .select('*')
            .eq('project_id', projectId)
            .order('publish_date', { ascending: true });

        if (data) {
            setProjectContent(data);
            if (data.length === 0) {
                // If no more items, go back to list
                toast({ title: "Project Complete", description: "No more items to review for this project." });
            }
            fetchChangeRequests(projectId);
        }
    };

    // Filter content for display
    const pendingItems = projectContent.filter(item => item.status === 'pending_copy_qc');

    // Calendar helpers - Show all content days? Or just pending?
    // User wants to check submitted copy. Context is good. Let's mark days with ANY content, but highlight pending.
    const contentDays = projectContent.map(item => new Date(item.publish_date));
    const pendingDays = pendingItems.map(item => new Date(item.publish_date));

    const selectedDateContent = date
        ? projectContent.filter(item =>
            new Date(item.publish_date).toDateString() === date.toDateString()
        )
        : [];

    return (
        <DashboardLayout>
            {/* Header code same... */}
            <div className="mb-8 flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold mb-2">
                        Copy QC <span className="text-gradient-gold">Station</span>
                    </h1>
                    <p className="text-muted-foreground">Review and approve copy materials.</p>
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

            {!selectedProject ? (
                // PROJECT LIST VIEW (Same code...)
                <div className="space-y-6">
                    <ClientFilterCards
                        projects={projects}
                        selectedClient={selectedClient}
                        onSelectClient={setSelectedClient}
                    />
                    <h2 className="text-xl font-bold mb-4">Pending Review Queues</h2>
                    {projects.length === 0 ? (
                        <Card variant="glass" className="p-12 text-center">
                            <CardTitle className="text-xl mb-2">All Clear!</CardTitle>
                            <p className="text-muted-foreground">No copy awaiting approval.</p>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                                .map((project: any) => (
                                    <div key={project.id} className="relative group perspective-1000" onClick={() => handleProjectClick(project)}>
                                        <div className="absolute inset-0 bg-primary/20 blur-xl rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                        <Card variant="glass-hover" className="cursor-pointer border-white/5 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md relative z-10 overflow-hidden group-hover:-translate-y-1 transition-transform duration-300 h-full flex flex-col">
                                            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:bg-primary/20" />

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
                                                        <span className="text-muted-foreground">Review Queue</span>
                                                        <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                                                            {project.pending_qc_count} Pending
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
                                                        <CalendarIcon className="w-3 h-3 text-primary/50" />
                                                        Deadline: {new Date(project.earliest_deadline).toLocaleDateString()}
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
                    )}
                </div>
            ) : (
                // PROJECT DETAIL VIEW - Always render, no length check blocking
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <Button variant="outline" onClick={() => setSelectedProject(null)}><ArrowLeft className="w-4 h-4 mr-2" /> Back to Queue</Button>
                            <div>
                                <h2 className="text-2xl font-bold">{selectedProject.title}</h2>
                                <p className="text-muted-foreground text-sm">Reviewing submitted copy</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="flex bg-muted/50 p-1 rounded-lg">
                                <Button
                                    variant={viewMode === 'calendar' ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => setViewMode('calendar')}
                                >
                                    <CalendarIcon className="w-4 h-4 mr-2" /> Calendar
                                </Button>
                                <Button
                                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => setViewMode('list')}
                                >
                                    <List className="w-4 h-4 mr-2" /> List
                                </Button>
                            </div>
                        </div>
                    </div>

                    {viewMode === 'list' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {projectContent.length === 0 ? (
                                <p className="text-muted-foreground col-span-3 text-center py-12">No items found.</p>
                            ) : projectContent.map(item => (
                                // Show all items, but highlight pending ones? Or just list pending ones?
                                // Let's filter list view to only pending items for focus, or separate sections.
                                // For simplicity, let's show all but dim non-pending.
                                <div key={item.id} className={`relative group perspective-1000 ${item.status !== 'pending_copy_qc' ? 'opacity-50' : ''}`}>
                                    <Card variant="glass-hover" className="border-white/5 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md relative z-10 overflow-hidden">
                                        <CardContent className="p-6">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="font-mono text-lg font-bold">{new Date(item.publish_date).getDate()}</span>
                                                <span className={`text-[10px] px-2 py-1 rounded-full border ${item.status === 'pending_copy_qc' ? 'border-orange-500 text-orange-500' : 'border-muted text-muted-foreground'
                                                    }`}>
                                                    {item.status.replace(/_/g, ' ')}
                                                </span>
                                            </div>
                                            <h3 className="font-bold text-lg mb-2">{item.dm_title}</h3>

                                            {item.status === 'pending_copy_qc' && (
                                                <>
                                                    <div className="bg-muted/30 p-3 rounded-lg text-sm mb-4 max-h-32 overflow-y-auto">
                                                        <p className="whitespace-pre-wrap">{item.copy_content || "No content submitted"}</p>
                                                    </div>

                                                    <div className="flex gap-2">
                                                        <Button className="flex-1 bg-green-500 hover:bg-green-600" size="sm" onClick={() => handleApprove(item)}>
                                                            <Check className="w-4 h-4 mr-2" /> Approve
                                                        </Button>
                                                        <Button className="flex-1" variant="destructive" size="sm" onClick={() => handleRejectClick(item)}>
                                                            <XCircle className="w-4 h-4 mr-2" /> Reject
                                                        </Button>
                                                    </div>
                                                </>
                                            )}
                                        </CardContent>
                                    </Card>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 items-start">
                            <Card variant="glass" className="p-4 w-fit mx-auto md:mx-0">
                                <Calendar
                                    mode="single"
                                    selected={date}
                                    onSelect={setDate}
                                    className="rounded-2xl border bg-gradient-to-br from-black/80 to-black/40 backdrop-blur-2xl shadow-xl p-8"
                                    classNames={{
                                        head_cell: "text-muted-foreground rounded-md w-12 font-normal text-sm uppercase tracking-wider mb-4",
                                        cell: "h-12 w-12 text-center text-sm p-0 relative focus-within:relative focus-within:z-20 my-1",
                                        day: "h-12 w-12 p-0 font-normal aria-selected:opacity-100 rounded-full hover:bg-white/5 transition-all duration-300",
                                        day_selected: "bg-primary text-black hover:bg-primary hover:text-black focus:bg-primary focus:text-black shadow-[0_0_20px_rgba(234,179,8,0.8)] font-bold scale-110 transition-transform rounded-full",
                                        day_today: "bg-white/10 text-white rounded-full",
                                    }}
                                    modifiers={{
                                        hasContent: (date) => contentDays.some(d => d.toDateString() === date.toDateString()),
                                        isPending: (date) => pendingDays.some(d => d.toDateString() === date.toDateString())
                                    }}
                                    modifiersClassNames={{
                                        hasContent: "bg-muted/30 text-muted-foreground rounded-full",
                                        isPending: "bg-orange-500/20 text-orange-500 border border-orange-500/50 font-bold shadow-[0_0_10px_rgba(249,115,22,0.2)] rounded-full"
                                    }}
                                />
                            </Card>

                            <div className="space-y-4">
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                    {date ? date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Select a date'}
                                    {selectedDateContent.length > 0 && <span className="bg-muted text-muted-foreground text-xs px-2 py-1 rounded-full">{selectedDateContent.length} items</span>}
                                </h3>

                                {selectedDateContent.length > 0 ? (
                                    <div className="grid gap-4">
                                        {selectedDateContent.map((item: any) => (
                                            <Card key={item.id} variant="glass-hover" className={item.status !== 'pending_copy_qc' ? 'opacity-60' : ''}>
                                                <CardContent className="p-6">
                                                    <div className="flex justify-between items-start mb-4">
                                                        <div>
                                                            <h4 className="font-bold text-lg">{item.dm_title || "Untitled Content"}</h4>
                                                            <p className="text-sm text-muted-foreground">{item.status.replace(/_/g, ' ')}</p>
                                                        </div>
                                                    </div>

                                                    <div className="bg-muted/30 p-3 rounded-lg text-sm mb-4">
                                                        <p className="font-semibold text-xs text-muted-foreground mb-1">DM Notes</p>
                                                        {item.dm_notes}
                                                    </div>

                                                    {item.copy_content && (
                                                        <div className="bg-primary/10 p-3 rounded-lg text-sm mb-4 border border-primary/20">
                                                            <p className="font-semibold text-xs text-primary mb-1">Submitted Copy</p>
                                                            <p className="whitespace-pre-wrap">{item.copy_content}</p>
                                                        </div>
                                                    )}

                                                    {item.status === 'pending_copy_qc' && (
                                                        <div className="flex gap-2 justify-end">
                                                            <Button variant="destructive" size="sm" onClick={() => handleRejectClick(item)}>
                                                                <XCircle className="w-4 h-4 mr-2" /> Reject
                                                            </Button>
                                                            <Button className="bg-green-500 hover:bg-green-600" size="sm" onClick={() => handleApprove(item)}>
                                                                <Check className="w-4 h-4 mr-2" /> Approve
                                                            </Button>
                                                        </div>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                ) : (
                                    <Card variant="glass" className="p-12 text-center border-dashed">
                                        <p className="text-muted-foreground">No items for this date.</p>
                                    </Card>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Additional Change Requests - Highlighted */}
                    {selectedProject && (
                        <Card className="glass-card p-8 border-primary/30 shadow-[0_0_20px_rgba(234,179,8,0.1)] relative overflow-hidden mt-8">
                            <div className="absolute top-0 left-0 w-1 h-full bg-primary shadow-[2px_0_10px_rgba(234,179,8,0.5)]"></div>
                            <CardTitle className="mb-4 flex items-center gap-2 text-primary font-bold text-xl uppercase tracking-wider">
                                <Megaphone className="w-6 h-6 animate-pulse" />
                                Additional Permanent Changes (Main Point)
                            </CardTitle>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
                                </div>

                                <div className="space-y-3">
                                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                        <span className="w-4 h-[1px] bg-muted-foreground/30"></span>
                                        Change History
                                    </h4>
                                    <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                                        {changeRequests.map(req => (
                                            <div key={req.id} className="p-4 rounded-xl bg-white/5 border border-white/5 hover:border-primary/20 transition-all group">
                                                <p className="mb-2 text-sm leading-relaxed group-hover:text-white transition-colors">{req.content}</p>
                                                <div className="flex justify-between items-center text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">
                                                    <span>Post Update</span>
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
                    )}
                </div>
            )}

            <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reject Copy</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <Label className="mb-2 block">Reason for Rejection (Required)</Label>
                        <Textarea
                            placeholder="Explain what needs to be fixed..."
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={submitReject}>Reject & Return</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </DashboardLayout>
    );
};

export default CopyQCDashboard;
