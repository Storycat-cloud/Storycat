import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { User } from "@supabase/supabase-js";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PenTool, CheckCircle, Calendar as CalendarIcon, List, LayoutDashboard, ArrowLeft, Send, Megaphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ClientFilterCards } from "@/components/ClientFilterCards";
import { Calendar } from "@/components/ui/calendar";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const CopywriterDashboard = () => {
    const [user, setUser] = useState<User | null>(null);
    const [projects, setProjects] = useState<any[]>([]);
    const [selectedProject, setSelectedProject] = useState<any>(null);
    const [projectContent, setProjectContent] = useState<any[]>([]);

    // No more viewMode, it's always list now
    const [editorOpen, setEditorOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState<any>(null);
    const [copyForm, setCopyForm] = useState({ copy_content: "", copy_writer_notes: "" });
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

        // Check if user is admin
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();

        const isAdmin = profile?.role === 'admin';

        // 1. Fetch PROJECTS directly (not content items) so we see the project even if empty
        let query = supabase
            .from('projects')
            .select('*, content_items(*), project_onboarding!inner(*)')
            .eq('status', 'active');

        if (!isAdmin) {
            // Filter by dedicated specialist
            query = query.filter('project_onboarding.dedicated_copywriter_id', 'eq', session.user.id);
        }

        const { data: projectsData, error } = await query;

        if (error) {
            console.error("Error fetching tasks:", error);
            toast({ title: "Error", description: error.message, variant: "destructive" });
            return;
        }

        console.log("Copywriter fetched projects:", projectsData);

        if (projectsData) {
            // 2. Process projects to calculate stats
            const projectsWithStats = projectsData.map((proj: any) => {
                const items = proj.content_items || [];
                let total_at_this_stage = 0;
                let drafted_count = 0;
                let earliest_deadline = proj.start_date || new Date().toISOString();

                // Find counts
                items.forEach((item: any) => {
                    if (['pending_copy', 'rejected_from_copy_qc'].includes(item.status)) {
                        total_at_this_stage++;
                    }
                    if (item.copy_content) {
                        drafted_count++;
                    }
                });

                // Find earliest deadline of ACTIVE tasks
                const activeItems = items.filter((item: any) => ['pending_copy', 'rejected_from_copy_qc'].includes(item.status));
                if (activeItems.length > 0) {
                    earliest_deadline = activeItems.reduce((min: string, p: any) => p.publish_date < min ? p.publish_date : min, activeItems[0].publish_date);
                }

                return {
                    ...proj,
                    total_at_this_stage,
                    drafted_count,
                    earliest_deadline
                };
            });

            // Sort by priority (deadline)
            const sortedProjects = projectsWithStats.sort((a: any, b: any) => new Date(a.earliest_deadline).getTime() - new Date(b.earliest_deadline).getTime());

            setProjects(sortedProjects);
        }
    };

    const handleProjectClick = async (project: any) => {
        setSelectedProject(project);
        // Fetch all COPYWRITER RELEVANT content for this project
        const { data } = await supabase
            .from('content_items')
            .select('*, projects(*, project_onboarding(*))')
            .eq('project_id', project.id)
            .eq('is_admin_verified', false)
            .order('publish_date', { ascending: true });

        if (data) setProjectContent(data);
        fetchChangeRequests(project.id);
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

    const handleTaskClick = (task: any) => {
        if (task.status !== 'pending_copy' && task.status !== 'rejected_from_copy_qc') {
            // If clicking a completed task, maybe just view? For now, only allow editing active tasks.
            return;
        }
        setSelectedTask(task);
        setCopyForm({
            copy_content: task.copy_content || "",
            copy_writer_notes: task.copy_writer_notes || ""
        });
        setEditorOpen(true);
    };

    const handleSaveDraft = async () => {
        try {
            const { error } = await supabase
                .from('content_items')
                .update({
                    copy_content: copyForm.copy_content,
                    copy_writer_notes: copyForm.copy_writer_notes
                })
                .eq('id', selectedTask.id);

            if (error) throw error;
            toast({ title: "Draft Saved", description: "Your changes have been saved." });

            // Refresh local state
            setProjectContent(prev => prev.map(item =>
                item.id === selectedTask.id ? { ...item, ...copyForm } : item
            ));
            // Keep editor open or close? Usually keeps open for quick saves.
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    };

    const submitBatchToQC = async () => {
        // Logic: Update all 'pending_copy'/'rejected_from_copy_qc' items in this project to 'pending_copy_qc'
        try {
            // Identify eligible items (optionally validate content existence)
            const eligibleIds = projectContent
                .filter(item => ['pending_copy', 'rejected_from_copy_qc'].includes(item.status))
                .map(item => item.id);

            if (eligibleIds.length === 0) {
                toast({ title: "No Items to Submit", description: "There are no pending items to submit." });
                return;
            }

            const { error } = await supabase
                .from('content_items')
                .update({
                    status: 'pending_copy_qc',
                    copy_submitted_at: new Date().toISOString()
                })
                .in('id', eligibleIds);

            if (error) throw error;

            toast({
                title: "Project Submitted",
                description: `${eligibleIds.length} items have been sent to Copy QC.`
            });

            // Return to project list
            setSelectedProject(null);
            // Refresh projects list
            fetchProjects();

        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    };

    const selectedDateContent = []; // Not used anymore

    return (
        <DashboardLayout>
            <div className="mb-8 flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold mb-2">
                        Welcome back, <span className="text-gradient-gold">{user?.user_metadata?.full_name?.split(' ')[0] || "there"}</span>!
                    </h1>
                    <p className="text-muted-foreground">Manage your detailed copy tasks.</p>
                </div>
                {!selectedProject && (
                    <div className="w-full md:w-64">
                        <input
                            type="text"
                            placeholder="Filter by client..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 ring-primary/50 transition-all"
                        />
                    </div>
                )}
            </div>

            {!selectedProject ? (
                // PROJECT LIST VIEW
                <div className="space-y-6">
                    <ClientFilterCards
                        projects={projects}
                        selectedClient={selectedClient}
                        onSelectClient={setSelectedClient}
                    />

                    <h2 className="text-xl font-bold mb-4">Your Active Projects</h2>
                    {projects.length === 0 ? (
                        <Card variant="glass" className="p-12 text-center">
                            <CardTitle className="text-xl mb-2">All Caught Up!</CardTitle>
                            <p className="text-muted-foreground">No projects currently require your attention.</p>
                        </Card>
                    ) : (

                        <div className="space-y-8">
                            {/* Client Header - Visible only when filtering by client */}
                            {selectedClient && (
                                <div className="bg-gradient-to-br from-white/10 to-transparent border border-white/10 rounded-3xl p-8 animate-in fade-in slide-in-from-top-4">
                                    {(() => {
                                        // Find client details from the first project matching this client
                                        const clientProject = projects.find(p => {
                                            const onboarding = Array.isArray(p.project_onboarding) ? p.project_onboarding[0] : p.project_onboarding;
                                            return (onboarding?.company_name || p.title) === selectedClient;
                                        });
                                        const onboarding = clientProject?.project_onboarding?.[0] || clientProject?.project_onboarding;

                                        return (
                                            <div className="flex flex-col md:flex-row gap-8 items-start">
                                                <div className="flex-shrink-0">
                                                    {onboarding?.brand_logo_url ? (
                                                        <div className="w-32 h-32 rounded-2xl overflow-hidden border-2 border-primary/20 bg-black shadow-[0_0_30px_rgba(234,179,8,0.1)]">
                                                            <img src={onboarding.brand_logo_url} alt={selectedClient} className="w-full h-full object-cover" />
                                                        </div>
                                                    ) : (
                                                        <div className="w-32 h-32 rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-primary/20 to-black flex items-center justify-center shadow-[0_0_30px_rgba(234,179,8,0.1)]">
                                                            <span className="text-4xl font-bold text-primary">
                                                                {selectedClient.substring(0, 2).toUpperCase()}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 space-y-4">
                                                    <div>
                                                        <h2 className="text-3xl font-bold text-white tracking-tight mb-2">{selectedClient}</h2>
                                                        <div className="flex items-center gap-2 text-muted-foreground text-sm">
                                                            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                                                                Active Client
                                                            </span>
                                                            <span>•</span>
                                                            <span>{projects.filter(p => (Array.isArray(p.project_onboarding) ? p.project_onboarding[0] : p.project_onboarding)?.company_name === selectedClient).length} Projects</span>
                                                        </div>
                                                    </div>

                                                    {onboarding?.additional_info && (
                                                        <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-sm leading-relaxed text-muted-foreground max-w-3xl">
                                                            <strong className="block text-primary text-xs uppercase tracking-wider mb-1">Main Protocol / Guidelines</strong>
                                                            {onboarding.additional_info}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            )
                            }

                            {/* Project Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {projects
                                    .filter((proj: any) => {
                                        const onboarding = Array.isArray(proj.project_onboarding) ? proj.project_onboarding[0] : proj.project_onboarding;
                                        const clientName = onboarding?.company_name || proj.title; // Use same fallback as filter
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
                                                            <span className="text-muted-foreground">Drafting Progress</span>
                                                            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                                                                {project.drafted_count}/{project.total_at_this_stage}
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
                    )}
                </div>
            ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <Button variant="outline" onClick={() => setSelectedProject(null)}><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
                            <div>
                                <h2 className="text-2xl font-bold">{selectedProject.title}</h2>
                                <p className="text-muted-foreground text-sm">Manage content and submit to QC</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* View Toggle Removed */}
                        </div>
                    </div>

                    {projectContent.length === 0 ? (
                        <Card variant="glass" className="p-8 text-center opacity-80">
                            <p className="text-muted-foreground">No content items found for this project.</p>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {projectContent.map((item: any) => (
                                <div key={item.id} className="relative group perspective-1000" onClick={() => handleTaskClick(item)}>
                                    <div className="absolute inset-0 bg-primary/20 blur-xl rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                    <Card variant="glass-hover" className={`cursor-pointer border-white/5 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md relative z-10 overflow-hidden group-hover:-translate-y-1 transition-transform duration-300 ${['pending_copy', 'rejected_from_copy_qc'].includes(item.status) ? '' : 'opacity-60 grayscale'
                                        }`}>
                                        <CardContent className="p-6">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-[10px] font-bold text-muted-foreground">{new Date(item.publish_date).toLocaleDateString()}</span>
                                                <span className={`text-[10px] px-2 py-1 rounded-full border ${item.status === 'rejected_from_copy_qc' ? 'border-red-500 text-red-500' :
                                                    item.status === 'pending_copy' ? 'border-primary text-primary' : 'border-muted text-muted-foreground'
                                                    }`}>
                                                    {item.status.replace(/_/g, ' ')}
                                                </span>
                                            </div>
                                            <h3 className="font-bold text-lg mb-2">{item.dm_title || "Untitled Task"}</h3>

                                            <div className="space-y-2 mt-4">
                                                {item.dm_thread && (
                                                    <div className="p-2 rounded bg-white/5 text-[11px] leading-tight line-clamp-2">
                                                        <span className="text-primary font-bold">Thread: </span>
                                                        {item.dm_thread}
                                                    </div>
                                                )}
                                                {item.copy_content ? (
                                                    <p className="text-xs text-green-500 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Drafted</p>
                                                ) : (
                                                    <p className="text-xs text-amber-500">Need Implementation</p>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            ))}
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

            {/* Editor Dialog */}
            <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Write Copy - {selectedProject?.title}</DialogTitle>
                    </DialogHeader>
                    {selectedTask && (
                        <div className="grid gap-6 py-4">
                            <div className="bg-muted/50 p-4 rounded-lg space-y-4">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <Label className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest">Plan Detail</Label>
                                        <h3 className="font-bold text-xl">{selectedTask.dm_title || "Untitled Task"}</h3>
                                    </div>
                                    <span className="text-xs font-mono bg-black/20 px-2 py-1 rounded">{new Date(selectedTask.publish_date).toLocaleDateString()}</span>
                                </div>

                                {selectedTask.dm_thread && (
                                    <div className="space-y-1 bg-black/20 p-3 rounded border border-white/5">
                                        <Label className="text-[10px] uppercase text-primary font-black tracking-tighter">Content Thread</Label>
                                        <p className="text-sm leading-relaxed">{selectedTask.dm_thread}</p>
                                    </div>
                                )}

                                {selectedTask.dm_notes && (
                                    <div className="space-y-1">
                                        <Label className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest">DM Instructions</Label>
                                        <p className="text-sm text-muted-foreground leading-relaxed">{selectedTask.dm_notes}</p>
                                    </div>
                                )}

                                {selectedTask.rejection_reason && selectedTask.status === 'rejected_from_copy_qc' && (
                                    <div className="mt-2 bg-red-500/10 text-red-500 p-3 rounded border border-red-500/20 text-sm">
                                        <p className="font-bold uppercase text-[10px] mb-1">Rejection Reason</p>
                                        {selectedTask.rejection_reason}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Main Content</Label>
                                    <Textarea
                                        className="min-h-[200px] font-serif text-lg"
                                        placeholder="Start writing your copy here..."
                                        value={copyForm.copy_content}
                                        onChange={(e) => setCopyForm({ ...copyForm, copy_content: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Notes for QC / Designer</Label>
                                    <Textarea
                                        placeholder="Any context or instructions..."
                                        value={copyForm.copy_writer_notes}
                                        onChange={(e) => setCopyForm({ ...copyForm, copy_writer_notes: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setEditorOpen(false)}>Cancel</Button>
                        <Button variant="outline" onClick={handleSaveDraft}>Save Draft</Button>
                        <Button
                            variant="hero"
                            onClick={async () => {
                                await handleSaveDraft();
                                try {
                                    const { error } = await supabase
                                        .from('content_items')
                                        .update({
                                            status: 'pending_copy_qc',
                                            copy_submitted_at: new Date().toISOString()
                                        })
                                        .eq('id', selectedTask.id);

                                    if (error) throw error;
                                    toast({ title: "Submitted", description: "Sent to QC stage." });
                                    setEditorOpen(false);
                                    handleProjectClick(selectedProject);
                                    fetchProjects();
                                } catch (error: any) {
                                    toast({ title: "Error", description: error.message, variant: "destructive" });
                                }
                            }}
                        >
                            Submit to QC
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DashboardLayout >
    );
};

export default CopywriterDashboard;
