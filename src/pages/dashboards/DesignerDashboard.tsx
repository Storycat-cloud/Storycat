import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import {
    Calendar as CalendarIcon,
    LayoutDashboard,
    Clock,
    CheckCircle2,
    AlertCircle,
    Upload,
    FileCheck,
    Play,
    Square,
    Send,
    Loader2,
    Megaphone
} from "lucide-react";
import { ClientFilterCards } from "@/components/ClientFilterCards";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/DashboardLayout";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

// Sub-component for reuse in List and Calendar views
const DesignerTaskCard = ({
    item,
    activeTimerId,
    timerDuration,
    startTimer,
    stopTimer,
    handleFileUpload,
    uploadingItemId,
    uploadProgress,
    handleSubmitClick
}: any) => {

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <Card key={item.id} variant="glass-hover" className={`opacity-90 ${activeTimerId === item.id ? 'border-primary shadow-[0_0_15px_rgba(234,179,8,0.2)]' : ''}`}>
            <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2">
                    <span className="font-mono text-lg font-bold">{new Date(item.publish_date).getDate()}</span>
                    <span className={`text-[10px] px-2 py-1 rounded-full border ${item.status === 'rejected_from_design_qc' ? 'border-red-500 text-red-500' : 'border-primary text-primary'
                        }`}>
                        {item.status === 'rejected_from_design_qc' ? 'NEEDS REVISION' : 'READY FOR DESIGN'}
                    </span>
                </div>
                <div className="space-y-3">
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">Plan Detail</p>
                            <h4 className="font-bold text-lg leading-tight">{item.dm_title || "Untitled Task"}</h4>
                        </div>

                        {item.dm_thread && (
                            <div className="bg-black/20 p-2 rounded text-[11px] border border-white/5">
                                <span className="text-primary font-bold uppercase text-[9px]">Thread: </span>
                                {item.dm_thread}
                            </div>
                        )}

                        {item.dm_notes && (
                            <div className="text-[11px] text-muted-foreground leading-relaxed">
                                {item.dm_notes}
                            </div>
                        )}
                    </div>

                    <div className="bg-muted/30 p-3 rounded-lg text-sm max-h-24 overflow-y-auto">
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Copy Content</p>
                        <p className="whitespace-pre-wrap text-muted-foreground">{item.copy_content}</p>
                    </div>

                    {/* Actions */}
                    <div className="pt-4 border-t border-white/5 space-y-3">
                        {/* Timer Control */}
                        {activeTimerId === item.id ? (
                            <div className="w-full bg-primary/20 text-primary text-center py-2 rounded-md font-bold animate-pulse">
                                Recording Time: {formatTime(timerDuration)}
                            </div>
                        ) : (
                            <Button
                                className="w-full"
                                disabled={!!activeTimerId || !['pending_design', 'rejected_from_design_qc'].includes(item.status)}
                                onClick={() => startTimer(item.id, item.project_id)}
                                variant="outline"
                            >
                                {['pending_design', 'rejected_from_design_qc'].includes(item.status) ? (
                                    <><Play className="w-4 h-4 mr-2" /> Start Designing</>
                                ) : (
                                    <><Clock className="w-4 h-4 mr-2" /> Waiting for Previous Stage</>
                                )}
                            </Button>
                        )}

                        {/* Upload Section */}
                        <div className="space-y-2">
                            <Label htmlFor={`file-${item.id}`} className={`cursor-pointer block ${!['pending_design', 'rejected_from_design_qc'].includes(item.status) ? 'pointer-events-none' : ''}`}>
                                <div className="border border-dashed border-muted-foreground/50 rounded-lg p-2 hover:bg-white/5 transition-colors text-center relative overflow-hidden">
                                    {uploadingItemId === item.id ? (
                                        <div className="space-y-2 py-2">
                                            <div className="flex items-center justify-center gap-2 text-xs text-primary animate-pulse">
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                Uploading...
                                            </div>
                                            <Progress value={uploadProgress} className="h-1" />
                                        </div>
                                    ) : item.design_asset_url ? (
                                        <div className="flex items-center justify-center gap-2 text-green-500">
                                            <FileCheck className="w-4 h-4" />
                                            <span className="text-xs">Asset Updated</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center gap-2 text-muted-foreground hover:text-primary">
                                            <Upload className="w-4 h-4" />
                                            <span className="text-xs">Upload Final Asset</span>
                                        </div>
                                    )}
                                </div>
                            </Label>
                            <Input
                                id={`file-${item.id}`}
                                type="file"
                                className="hidden"
                                onChange={(e) => handleFileUpload(e, item.id)}
                                disabled={uploadingItemId === item.id || !['pending_design', 'rejected_from_design_qc'].includes(item.status)}
                            />
                            {item.design_asset_url && (
                                <a href={item.design_asset_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline block text-center mt-1">Check Uploaded File</a>
                            )}
                        </div>

                        {/* Submit Button */}
                        <Button
                            className="w-full bg-green-600 hover:bg-green-700 text-white"
                            disabled={!item.design_asset_url || !['pending_design', 'rejected_from_design_qc'].includes(item.status)}
                            onClick={() => handleSubmitClick(item)}
                        >
                            <Send className="w-3 h-3 mr-2" /> {item.status === 'completed' ? 'ALREADY SUBMITTED' : 'Submit to QC'}
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};


const DesignerDashboard = () => {
    const [user, setUser] = useState<User | null>(null);
    const [projects, setProjects] = useState<any[]>([]);
    const [selectedProject, setSelectedProject] = useState<any>(null);
    const [projectContent, setProjectContent] = useState<any[]>([]);
    const { toast } = useToast();

    // File Upload State
    const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0); // Add progress state

    // Time Tracking State
    const [activeTimerId, setActiveTimerId] = useState<string | null>(null);
    const [timerDuration, setTimerDuration] = useState<number>(0);
    const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null);

    // No more viewMode, it's always list
    const [date, setDate] = useState<Date | undefined>(new Date());

    const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<any>(null);

    const [changeRequests, setChangeRequests] = useState<any[]>([]);
    const [newChangeRequest, setNewChangeRequest] = useState("");

    const [searchQuery, setSearchQuery] = useState("");
    const [selectedClient, setSelectedClient] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchProjects();
                checkActiveTimer(session.user.id);
            }
        });

        return () => {
            if (timerInterval) clearInterval(timerInterval);
        };
    }, []);

    const checkActiveTimer = async (userId: string) => {
        // Check if there is an open time log for this user
        const { data } = await supabase
            .from('time_logs')
            .select('*')
            .eq('user_id', userId)
            .is('end_time', null)
            .single();

        if (data) {
            setActiveTimerId(data.content_item_id); // Assuming one timer at a time
            // Calculate initial duration
            const start = new Date(data.start_time).getTime();
            const now = new Date().getTime();
            setTimerDuration(Math.floor((now - start) / 1000));

            // Start interval
            const interval = setInterval(() => {
                setTimerDuration(prev => prev + 1);
            }, 1000);
            setTimerInterval(interval);
        }
    };

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

        // Fetch all items for active projects
        let query = supabase
            .from('content_items')
            .select('*, projects!inner(*, project_onboarding!inner(*))')
            .eq('is_admin_verified', false);

        if (!isAdmin) {
            query = query.filter('projects.project_onboarding.dedicated_designer_id', 'eq', session.user.id);
        }

        const { data: items, error } = await query;

        if (error) {
            console.error("Error fetching designer projects:", error);
            toast({ title: "Error", description: error.message, variant: "destructive" });
            return;
        }

        console.log("Designer fetched items:", items);

        if (items) {
            const uniqueProjectsMap = new Map();
            items.forEach(item => {
                if (item.projects && !uniqueProjectsMap.has(item.projects.id)) {
                    uniqueProjectsMap.set(item.projects.id, {
                        ...item.projects,
                        designed_count: 0,
                        total_at_this_stage: 0,
                        earliest_deadline: item.publish_date
                    });
                }
                const proj = uniqueProjectsMap.get(item.projects?.id);
                if (proj) {
                    if (['pending_design', 'rejected_from_design_qc'].includes(item.status)) {
                        proj.total_at_this_stage++;
                        if (new Date(item.publish_date) < new Date(proj.earliest_deadline)) {
                            proj.earliest_deadline = item.publish_date;
                        }
                    }
                    if (item.design_asset_url && item.status !== 'pending_design' && item.status !== 'rejected_from_design_qc') {
                        proj.designed_count++;
                    }
                }
            });
            const sortedProjects = Array.from(uniqueProjectsMap.values())
                .filter(p => p.total_at_this_stage > 0 || p.designed_count > 0)
                .sort((a, b) => new Date(a.earliest_deadline).getTime() - new Date(b.earliest_deadline).getTime());
            setProjects(sortedProjects);
        }
    };

    const handleProjectClick = async (project: any) => {
        setSelectedProject(project);
        fetchProjectContent(project.id);
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

    const fetchProjectContent = async (projectId: string) => {
        const { data } = await supabase
            .from('content_items')
            .select('*, projects(*, project_onboarding(*))')
            .eq('project_id', projectId)
            .eq('is_admin_verified', false)
            .order('publish_date', { ascending: true });

        if (data) setProjectContent(data);
    };

    const startTimer = async (itemId: string, projectId: string) => {
        if (activeTimerId) {
            toast({ title: "Timer Running", description: "Please stop the current timer before starting a new one.", variant: "destructive" });
            return;
        }

        try {
            const { error } = await supabase
                .from('time_logs')
                .insert({
                    user_id: user?.id,
                    content_item_id: itemId,
                    project_id: projectId,
                    start_time: new Date().toISOString()
                });

            if (error) throw error;

            setActiveTimerId(itemId);
            setTimerDuration(0);
            const interval = setInterval(() => {
                setTimerDuration(prev => prev + 1);
            }, 1000);
            setTimerInterval(interval);

            toast({ title: "Timer Started", description: "Work tracking has begun." });

        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    };

    const stopTimer = async () => {
        if (!activeTimerId) return;

        try {
            // Find the active log entry
            const { data: activeLog } = await supabase
                .from('time_logs')
                .select('id, start_time')
                .eq('user_id', user?.id)
                .is('end_time', null)
                .single();

            if (activeLog) {
                const endTime = new Date();
                const startTime = new Date(activeLog.start_time);
                const durationSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

                const { error } = await supabase
                    .from('time_logs')
                    .update({
                        end_time: endTime.toISOString(),
                        duration_seconds: durationSeconds
                    })
                    .eq('id', activeLog.id);

                if (error) throw error;
            }

            if (timerInterval) clearInterval(timerInterval);
            setTimerInterval(null);
            setActiveTimerId(null);
            setTimerDuration(0);

            toast({ title: "Timer Stopped", description: "Work logged successfully." });

        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, itemId: string) => {
        try {
            const file = event.target.files?.[0];
            if (!file) return;

            setUploadingItemId(itemId);
            setUploadProgress(0); // Reset progress

            // Simulate upload progress since Supabase client basic upload doesn't have onProgress
            const progressInterval = setInterval(() => {
                setUploadProgress(prev => {
                    if (prev >= 95) {
                        clearInterval(progressInterval);
                        return 95;
                    }
                    return prev + 5;
                });
            }, 100);

            const fileExt = file.name.split('.').pop();
            const fileName = `${itemId}-${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`;

            // Upload to 'project-assets' bucket
            const { error: uploadError } = await supabase.storage
                .from('project-assets')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            clearInterval(progressInterval);
            setUploadProgress(100);

            const { data: { publicUrl } } = supabase.storage
                .from('project-assets')
                .getPublicUrl(filePath);

            // Update content item ONLY with URL, do NOT change status yet
            const { error: updateError } = await supabase
                .from('content_items')
                .update({
                    design_asset_url: publicUrl,
                })
                .eq('id', itemId);

            if (updateError) throw updateError;

            toast({
                title: "Success",
                description: "File uploaded. You can now submit to QC.",
            });

            // Refresh content
            if (selectedProject) {
                fetchProjectContent(selectedProject.id);
            }

        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Failed to upload file",
                variant: "destructive",
            });
            setUploadProgress(0);
        } finally {
            setUploadingItemId(null);
        }
    };

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const handleSubmitClick = (item: any) => {
        setSelectedItem(item);
        setSubmitDialogOpen(true);
    };

    const confirmSubmit = async () => {
        if (!selectedItem) return;

        try {
            // 1. Stop timer if running for this item
            if (activeTimerId === selectedItem.id) {
                await stopTimer();
            }

            // 2. Update Status
            const { error } = await supabase
                .from('content_items')
                .update({
                    status: 'pending_design_qc',
                    design_submitted_at: new Date().toISOString()
                })
                .eq('id', selectedItem.id);

            if (error) throw error;

            toast({ title: "Submitted", description: "Design sent to QC." });
            setSubmitDialogOpen(false);
            fetchProjectContent(selectedProject.id);
            fetchProjects();

        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    };

    const stats = [
        { label: "Tasks Waiting", value: projects.reduce((acc, p) => acc + p.total_at_this_stage, 0).toString(), icon: LayoutDashboard, color: "text-primary" },
        { label: "Completed Designs", value: projects.reduce((acc, p) => acc + p.designed_count, 0).toString(), icon: CheckCircle2, color: "text-green-500" },
    ];

    // Get days that have content
    const contentDays = projectContent.map(item => new Date(item.publish_date));

    // Get content for selected date
    const selectedDateContent = date
        ? projectContent.filter(item =>
            new Date(item.publish_date).toDateString() === date.toDateString()
        )
        : [];

    return (
        <DashboardLayout>
            <div className="mb-8 flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold mb-2">
                        Owner's <span className="text-gradient-gold">Design Studio</span>
                    </h1>
                    <p className="text-muted-foreground">Pick up tasks approved by Copy QC.</p>
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

                {activeTimerId && (
                    <div className="flex items-center gap-4 bg-primary/10 px-6 py-3 rounded-xl border border-primary/20 animate-pulse">
                        <div className="text-right">
                            <p className="text-xs text-primary font-bold uppercase tracking-wider">Working On Task</p>
                            <p className="font-mono text-2xl font-bold text-primary">{formatTime(timerDuration)}</p>
                        </div>
                        <Button variant="destructive" size="icon" onClick={stopTimer} className="h-10 w-10 rounded-full shadow-lg hover:scale-105 transition-transform">
                            <Square className="w-4 h-4 fill-current" />
                        </Button>
                    </div>
                )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {stats.map((stat) => (
                    <Card key={stat.label} variant="glass-hover">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                                    <p className="text-3xl font-bold">{stat.value}</p>
                                </div>
                                <stat.icon className={`w-8 h-8 ${stat.color}`} />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Active Projects List */}
            {selectedProject ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <Button variant="outline" onClick={() => setSelectedProject(null)}>← Back to Feed</Button>
                            <div>
                                <h2 className="text-2xl font-bold">{selectedProject.title}</h2>
                                <p className="text-muted-foreground text-sm">{selectedProject.brief}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* View Toggle Removed */}
                        </div>
                    </div>

                    {projectContent.length === 0 ? (
                        <Card variant="glass" className="p-8 text-center opacity-80">
                            <p className="text-muted-foreground">No pending design tasks found for this project.</p>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {projectContent.map((item: any) => (
                                <DesignerTaskCard
                                    key={item.id}
                                    item={item}
                                    activeTimerId={activeTimerId}
                                    timerDuration={timerDuration}
                                    startTimer={startTimer}
                                    stopTimer={stopTimer}
                                    handleFileUpload={handleFileUpload}
                                    uploadingItemId={uploadingItemId}
                                    uploadProgress={uploadProgress}
                                    handleSubmitClick={handleSubmitClick}
                                />
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
            ) : (
                <>
                    <ClientFilterCards
                        projects={projects}
                        selectedClient={selectedClient}
                        onSelectClient={setSelectedClient}
                    />
                    <h2 className="text-xl font-bold mb-4">Design Queue</h2>
                    {projects.length === 0 ? (
                        <Card variant="glass" className="p-12 text-center">
                            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                                <LayoutDashboard className="w-8 h-8 text-primary" />
                            </div>
                            <CardTitle className="text-xl mb-2">Queue Empty</CardTitle>
                            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                                No active projects have work ready for design yet.
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
                                                        <span className="text-muted-foreground">Design Progress</span>
                                                        <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                                                            {project.designed_count}/{project.total_contents}
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
                    )}
                </>
            )}

            {/* Confirmation Dialog */}
            <Dialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Submit Design?</DialogTitle>
                        <DialogDescription>
                            This will stop the timer (if running) and send the item to Designer QC.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSubmitDialogOpen(false)}>Cancel</Button>
                        <Button onClick={confirmSubmit}>Submit</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    );
};

export default DesignerDashboard;
