import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { User } from "@supabase/supabase-js";
import DashboardLayout from "@/components/DashboardLayout";
import { Eye, CheckCircle2, XCircle, ExternalLink, ThumbsUp, ThumbsDown, FolderOpen, ArrowLeft, Megaphone, Calendar as CalendarIcon } from "lucide-react";
import { ClientFilterCards } from "@/components/ClientFilterCards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const DesignerQCDashboard = () => {
    const [user, setUser] = useState<User | null>(null);
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [searchQuery, setSearchQuery] = useState("");
    const [selectedClient, setSelectedClient] = useState<string | null>(null);
    const { toast } = useToast();

    // Navigation State
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

    // Stats
    const [stats, setStats] = useState({
        toReview: 0,
        approved: 0,
        rejected: 0
    });

    // Action State
    const [actionItem, setActionItem] = useState<any>(null);
    const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
    const [feedback, setFeedback] = useState("");

    const [changeRequests, setChangeRequests] = useState<any[]>([]);
    const [newChangeRequest, setNewChangeRequest] = useState("");

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchItems();
                fetchStats(); // Fetch initial stats
            }
        });
    }, []);

    const fetchItems = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        setLoading(true);

        // Check user role
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();

        const isAdmin = profile?.role === 'admin';

        let query = supabase
            .from('content_items')
            .select('*, projects!inner(*, project_onboarding!inner(*))')
            .eq('status', 'pending_design_qc')
            .eq('is_admin_verified', false);

        if (!isAdmin) {
            query = query.filter('projects.project_onboarding.dedicated_designer_qc_id', 'eq', session.user.id);
        }

        const { data, error } = await query.order('publish_date', { ascending: true });

        if (error) {
            console.error("Error fetching designer QC items:", error);
            toast({ title: "Error fetching items", description: error.message, variant: "destructive" });
        } else {
            console.log("DesignerQC fetched items:", data);
            setItems(data || []);
        }
        setLoading(false);
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
        if (!newChangeRequest.trim() || !selectedProjectId) return;

        try {
            const { error } = await (supabase
                .from('project_change_requests' as any)
                .insert({
                    project_id: selectedProjectId,
                    content: newChangeRequest,
                    created_by: user?.id
                }));

            if (error) throw error;

            toast({ title: "Success", description: "Request submitted." });
            setNewChangeRequest("");
            fetchChangeRequests(selectedProjectId);
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    };

    const fetchStats = async () => {
        // Simple stats fetching - can be optimized
        const { count: toReview } = await supabase.from('content_items').select('*', { count: 'exact', head: true }).eq('status', 'pending_design_qc').eq('is_admin_verified', false);
        const { count: approved } = await supabase.from('content_items').select('*', { count: 'exact', head: true }).eq('status', 'completed').eq('is_admin_verified', false);
        const { count: rejected } = await supabase.from('content_items').select('*', { count: 'exact', head: true }).eq('status', 'rejected_from_design_qc').eq('is_admin_verified', false);

        setStats({
            toReview: toReview || 0,
            approved: approved || 0,
            rejected: rejected || 0
        });
    };

    const handleActionClick = (item: any, type: 'approve' | 'reject') => {
        setActionItem(item);
        setActionType(type);
        setFeedback(""); // Reset feedback
    };

    const confirmAction = async () => {
        if (!actionItem || !actionType) return;

        const newStatus = actionType === 'approve' ? 'completed' : 'rejected_from_design_qc'; // 'completed' implies passed QC for now

        try {
            const { error } = await supabase
                .from('content_items')
                .update({
                    status: newStatus,
                    design_qc_notes: feedback // Save feedback if rejected
                })
                .eq('id', actionItem.id);

            if (error) throw error;

            toast({
                title: actionType === 'approve' ? "Approved" : "Rejected",
                description: `Item has been ${actionType === 'approve' ? 'approved' : 'sent back for revision'}.`
            });

            // Refresh
            await fetchItems();
            fetchStats();
            setActionItem(null);
            setActionType(null);

            // Helper: If no items left in this project, go back to folder view?
            // Let's decide to stay for now unless user clicks back.

        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    };

    // Group items by Project for the "Folder" view
    const projectGroups = items.reduce((acc: any, item: any) => {
        const project = item.projects;
        const projectId = project?.id || 'unknown';
        if (!acc[projectId]) {
            acc[projectId] = {
                id: projectId,
                title: project?.title || 'Unknown Project',
                brief: project?.brief || '',
                project_onboarding: project?.project_onboarding,
                items: []
            };
        }
        acc[projectId].items.push(item);
        return acc;
    }, {});

    const projects = Object.values(projectGroups);
    const selectedProject = selectedProjectId ? projectGroups[selectedProjectId] : null;

    useEffect(() => {
        if (selectedProjectId) {
            fetchChangeRequests(selectedProjectId);
        }
    }, [selectedProjectId]);

    return (
        <DashboardLayout>
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">
                    Design QC <span className="text-gradient-gold">Review</span>
                </h1>
                <p className="text-muted-foreground">Quality control for design assets.</p>

                {!selectedProjectId && (
                    <div className="w-full md:w-64 mt-4">
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

            {/* Stats - Only show on main view or stick to top? Main view is cleaner. */}
            {!selectedProjectId && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <Card variant="glass-hover">
                        <CardContent className="p-6 flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500">
                                <Eye className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">To Review</p>
                                <p className="text-2xl font-bold">{stats.toReview}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card variant="glass-hover">
                        <CardContent className="p-6 flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-green-500/10 text-green-500">
                                <CheckCircle2 className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Approved</p>
                                <p className="text-2xl font-bold">{stats.approved}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card variant="glass-hover">
                        <CardContent className="p-6 flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-red-500/10 text-red-500">
                                <XCircle className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Rejected</p>
                                <p className="text-2xl font-bold">{stats.rejected}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {loading ? (
                <div className="text-center py-12 text-muted-foreground">Loading items...</div>
            ) : !selectedProjectId ? (
                <>
                    <ClientFilterCards
                        projects={projects}
                        selectedClient={selectedClient}
                        onSelectClient={setSelectedClient}
                    />
                    <h2 className="text-xl font-bold mb-6">Pending Reviews</h2>
                    {projects.length === 0 ? (
                        <Card variant="glass" className="p-12 text-center">
                            <CardTitle className="text-xl mb-2">Queue Empty</CardTitle>
                            <p className="text-muted-foreground">
                                No projects have designs waiting for QC.
                            </p>
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
                                .map((proj: any) => (
                                    <div key={proj.id} className="relative group perspective-1000" onClick={() => setSelectedProjectId(proj.id)}>
                                        <div className="absolute inset-0 bg-primary/20 blur-xl rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                        <Card variant="glass-hover" className="cursor-pointer border-white/5 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md relative z-10 overflow-hidden group-hover:-translate-y-1 transition-transform duration-300 h-full flex flex-col">
                                            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:bg-primary/20" />

                                            <CardContent className="p-6 flex flex-col h-full">
                                                <div className="flex items-start gap-4 mb-4 relative">
                                                    {proj.project_onboarding?.[0]?.brand_logo_url && (
                                                        <div className="w-12 h-12 rounded-lg overflow-hidden border border-white/10 bg-black/20 flex-shrink-0">
                                                            <img src={proj.project_onboarding[0].brand_logo_url} alt="Logo" className="w-full h-full object-contain" />
                                                        </div>
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <span className="text-[10px] font-bold tracking-widest uppercase text-primary mb-1 block">Client</span>
                                                        <h3 className="font-bold text-xl tracking-tight group-hover:text-primary transition-colors truncate">
                                                            {proj.project_onboarding?.[0]?.company_name || proj.title}
                                                        </h3>
                                                    </div>
                                                </div>

                                                <div className="space-y-4 flex-1">
                                                    <div className="flex justify-between items-center text-xs">
                                                        <span className="text-muted-foreground">Review Queue</span>
                                                        <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                                                            {proj.items.length} Pending
                                                        </span>
                                                    </div>

                                                    {proj.project_onboarding?.[0]?.additional_info && (
                                                        <div className="p-3 rounded-lg bg-white/5 border border-white/5 space-y-1">
                                                            <span className="text-[10px] font-bold text-primary uppercase">Main Protocol</span>
                                                            <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                                                                {proj.project_onboarding[0].additional_info}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
                                                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                                                        <CalendarIcon className="w-3 h-3 text-primary/50" />
                                                        Next: {new Date(Math.min(...proj.items.map((i: any) => new Date(i.publish_date).getTime()))).toLocaleDateString()}
                                                    </div>
                                                    <div className="flex gap-2">
                                                        {proj.project_onboarding?.[0]?.brand_logo_url && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-7 px-2 text-[10px]"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    window.open(proj.project_onboarding[0].brand_logo_url, '_blank');
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
                </>
            ) : (
                // ==================== PROJECT ITEMS VIEW ====================
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="flex items-center gap-4 mb-8">
                        <Button variant="outline" onClick={() => setSelectedProjectId(null)}>
                            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Projects
                        </Button>
                        <div>
                            <h2 className="text-2xl font-bold flex items-center gap-2">
                                <FolderOpen className="w-6 h-6 text-primary" />
                                {selectedProject?.title}
                            </h2>
                            <p className="text-muted-foreground text-sm">Reviewing {selectedProject?.items.length} items</p>
                        </div>
                    </div>

                    {/* Additional Change Requests - Highlighted */}
                    {selectedProjectId && (
                        <Card className="glass-card p-8 border-primary/30 shadow-[0_0_20px_rgba(234,179,8,0.1)] relative overflow-hidden mb-8">
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

                    {selectedProject?.items.length === 0 ? (
                        <Card variant="glass" className="p-12 text-center">
                            <p className="text-muted-foreground">All items in this project have been reviewed!</p>
                            <Button variant="link" onClick={() => setSelectedProjectId(null)} className="mt-2">Go back to folders</Button>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {selectedProject?.items.map((item: any) => (
                                <Card key={item.id} variant="glass-hover" className="overflow-hidden">
                                    <div className="aspect-video w-full bg-black/40 relative flex items-center justify-center overflow-hidden group">
                                        {item.design_asset_url ? (
                                            <>
                                                <img src={item.design_asset_url} alt="Design Asset" className="object-contain h-full w-full" />
                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <a href={item.design_asset_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-white font-bold hover:underline">
                                                        <ExternalLink className="w-4 h-4" /> View Full Size
                                                    </a>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex flex-col items-center text-muted-foreground">
                                                <XCircle className="w-8 h-8 mb-2 opacity-50" />
                                                <span>No Asset</span>
                                            </div>
                                        )}
                                    </div>
                                    <CardContent className="p-6">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h3 className="text-xl font-bold">{item.dm_title}</h3>
                                            </div>
                                            <span className="text-[10px] bg-blue-500/10 text-blue-500 px-2 py-1 rounded-full border border-blue-500/20">WAITING REVIEW</span>
                                        </div>

                                        <div className="bg-muted/30 p-3 rounded-lg text-sm mb-6 max-h-32 overflow-y-auto">
                                            <p className="text-xs font-semibold text-muted-foreground mb-1">Copy Context</p>
                                            <p className="text-muted-foreground whitespace-pre-wrap">{item.copy_content}</p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <Button variant="outline" className="text-red-400 hover:text-red-500 hover:bg-red-500/10 border-red-500/20" onClick={() => handleActionClick(item, 'reject')}>
                                                <ThumbsDown className="w-4 h-4 mr-2" /> Reject
                                            </Button>
                                            <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => handleActionClick(item, 'approve')}>
                                                <ThumbsUp className="w-4 h-4 mr-2" /> Approve
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Confirmation Dialog */}
            <Dialog open={!!actionItem} onOpenChange={(open) => !open && setActionItem(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{actionType === 'approve' ? 'Approve Design' : 'Reject Design'}</DialogTitle>
                        <DialogDescription>
                            {actionType === 'approve'
                                ? "This will mark the design as completed and ready for distribution."
                                : "This will send the item back to the Designer for revision. Please provide feedback."}
                        </DialogDescription>
                    </DialogHeader>

                    {actionType === 'reject' && (
                        <div className="py-2">
                            <Textarea
                                placeholder="Enter feedback for the designer..."
                                value={feedback}
                                onChange={(e) => setFeedback(e.target.value)}
                                className="min-h-[100px]"
                            />
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setActionItem(null)}>Cancel</Button>
                        <Button
                            variant={actionType === 'reject' ? "destructive" : "default"}
                            onClick={confirmAction}
                            disabled={actionType === 'reject' && !feedback.trim()}
                        >
                            Confirm {actionType === 'approve' ? 'Approval' : 'Rejection'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    );
};

export default DesignerQCDashboard;
