import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardTitle, CardHeader } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { 
  Calendar as CalendarIcon, 
  LayoutDashboard, 
  Clock,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  User as UserIcon,
  ArrowRight,
  FileDown,
  Download,
  CheckCircle,
  XCircle,
  Megaphone
} from "lucide-react";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/DashboardLayout";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";

// --- Helper Components ---

const WorkflowStepper = ({ item }: { item: any }) => {
    const steps = [
        { id: 'dm', label: 'Marketing', status: item.status === 'pending_dm' ? 'current' : item.dm_submitted_at ? 'completed' : 'pending', assignee: item.dm_assignee, time: item.dm_submitted_at },
        { id: 'copy', label: 'Copywriting', status: item.status === 'pending_copy' || item.status === 'pending_copy_qc' ? 'current' : item.copy_submitted_at ? 'completed' : 'pending', assignee: item.copy_assignee, time: item.copy_submitted_at },
        { id: 'design', label: 'Design', status: item.status === 'pending_design' || item.status === 'pending_design_qc' || item.status === 'rejected_from_design_qc' || item.status === 'rejected_from_copy_qc' ? 'current' : item.design_submitted_at ? 'completed' : 'pending', assignee: item.design_assignee, time: item.design_submitted_at },
        { id: 'completed', label: 'Review', status: item.status === 'completed' && !item.is_admin_verified ? 'current' : item.is_admin_verified ? 'completed' : 'pending', assignee: null, time: item.admin_verified_at }
    ];

    const calculateDuration = (end: string, start: string) => {
        if (!end || !start) return '-';
        const diff = new Date(end).getTime() - new Date(start).getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        return `${hours}h`;
    };

    return (
        <div className="space-y-4">
            <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Workflow Status</h4>
            <div className="relative border-l border-white/10 ml-3 space-y-6 pb-2">
                {steps.map((step, index) => {
                    const prevStep = steps[index - 1];
                    const duration = step.time && prevStep?.time ? calculateDuration(step.time, prevStep.time) : 
                                     step.id === 'dm' && step.time ? calculateDuration(step.time, item.created_at) : null;

                    return (
                        <div key={step.id} className="relative pl-8">
                            <div className={`absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full ring-4 ring-background ${
                                step.status === 'completed' ? 'bg-green-500' : 
                                step.status === 'current' ? 'bg-primary animate-pulse' : 'bg-muted'
                            }`} />
                            
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className={`text-sm font-bold ${step.status === 'current' ? 'text-primary' : 'text-foreground'}`}>{step.label}</p>
                                    <p className="text-xs text-muted-foreground">{step.status === 'completed' ? 'Completed' : step.status === 'current' ? 'In Progress' : 'Pending'}</p>
                                </div>
                                {duration && (
                                    <span className="text-xs bg-white/5 px-2 py-1 rounded text-muted-foreground font-mono">
                                        {duration}
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const AnalyticsView = ({ timeLogs }: { timeLogs: any[] }) => {
    // Process time logs to group by employee
    const employeeStats = timeLogs.reduce((acc: any, log: any) => {
        const employeeName = log.profiles?.full_name || log.user_id;
        const duration = log.duration || 0;
        
        if (!acc[employeeName]) {
            acc[employeeName] = { 
                name: employeeName,
                tasksLogCount: 0, 
                totalSeconds: 0 
            };
        }
        acc[employeeName].tasksLogCount += 1;
        acc[employeeName].totalSeconds += duration;
        return acc;
    }, {});

    const formatDuration = (totalSeconds: number) => {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    };

    return (
        <Card variant="glass">
            <CardHeader className="pb-2">
                <CardTitle className="text-xl flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" /> Employee Time Logs
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Total time spent on project content items.</p>
            </CardHeader>
            <CardContent>
                <div className="rounded-xl border border-white/5 overflow-hidden bg-black/20">
                    <Table>
                        <TableHeader className="bg-white/5">
                            <TableRow className="hover:bg-transparent border-white/5">
                                <TableHead className="py-4">Employee Name</TableHead>
                                <TableHead className="py-4">Sessions</TableHead>
                                <TableHead className="py-4 text-right">Total Time Tracked</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {Object.values(employeeStats).map((stat: any) => (
                                <TableRow key={stat.name} className="border-white/5 hover:bg-white/5 transition-colors">
                                    <TableCell className="font-medium">{stat.name}</TableCell>
                                    <TableCell>
                                        <span className="bg-white/5 px-2 py-0.5 rounded text-xs">{stat.tasksLogCount} sessions</span>
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-bold text-primary">
                                        {formatDuration(stat.totalSeconds)}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {Object.keys(employeeStats).length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center text-muted-foreground py-12 italic">
                                        <div className="flex flex-col items-center gap-2">
                                            <Clock className="w-8 h-8 opacity-20" />
                                            <p>No time logs recorded for this project yet.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
};

// --- Main Component ---

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newProject, setNewProject] = useState({
    title: "",
    brief: "",
    start_date: "",
    end_date: "",
    content_counts: {} as Record<string, number>
  });
  
  const CONTENT_TYPES = [
    "Posters", 
    "Reels", 
    "YouTube Videos", 
    "Shorts", 
    "Stories", 
    "Carousels"
  ];

  const toggleContentType = (type: string) => {
    setNewProject(prev => {
      const newCounts = { ...prev.content_counts };
      if (newCounts[type] !== undefined) {
        delete newCounts[type]; // Uncheck/Remove
      } else {
        newCounts[type] = 5; // Default count when checked
      }
      return { ...prev, content_counts: newCounts };
    });
  };

  const updateTypeCount = (type: string, count: number) => {
    setNewProject(prev => ({
      ...prev,
      content_counts: {
        ...prev.content_counts,
        [type]: Math.max(1, count)
      }
    }));
  };
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [projectContent, setProjectContent] = useState<any[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingItem, setRejectingItem] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectionDestination, setRejectionDestination] = useState("copywriter");
  const { toast } = useToast();

  const [changeRequests, setChangeRequests] = useState<any[]>([]);
  const [newChangeRequest, setNewChangeRequest] = useState("");
  const [timeLogs, setTimeLogs] = useState<any[]>([]);

  const handleDeleteProject = async () => {
    if (!selectedProject) return;
    
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', selectedProject.id);

      if (error) throw error;

      toast({
        title: "Project Deleted",
        description: "The project and all associated content have been removed.",
      });
      setSelectedProject(null);
      setDeleteDialogOpen(false);
      fetchProjects();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleVerify = async (item: any) => {
    try {
      const { error } = await supabase
        .from('content_items')
        .update({
          is_admin_verified: true,
          admin_verified_at: new Date().toISOString()
        } as any)
        .eq('id', item.id);

      if (error) throw error;

      toast({
        title: "Content Verified",
        description: "The work has been marked as verified and completed.",
      });
      // Refresh content
      if (selectedProject) handleProjectClick(selectedProject);
      fetchProjects();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleReject = async () => {
    if (!rejectingItem || !rejectionReason.trim()) return;

    let nextStatus = 'pending_copy';
    if (rejectionDestination === 'designer') nextStatus = 'pending_design';
    if (rejectionDestination === 'qc') nextStatus = 'pending_design_qc';

    try {
      const { error } = await supabase
        .from('content_items')
        .update({
          status: nextStatus,
          rejection_reason: rejectionReason,
          is_admin_verified: false,
          admin_verified_at: null
        } as any)
        .eq('id', rejectingItem.id);

      if (error) throw error;

      toast({
        title: "Content Rejected",
        description: `Work has been sent back to the ${rejectionDestination}.`,
      });
      setRejectingItem(null);
      setRejectionReason("");
      setRejectDialogOpen(false);
      // Refresh content
      if (selectedProject) handleProjectClick(selectedProject);
      fetchProjects();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const downloadAsset = (url: string, title: string) => {
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${title || 'content'}-asset`);
    link.setAttribute('target', '_blank');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [userRole, setUserRole] = useState<string | null>(null);
  const navigate = useNavigate();

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
        setUserRole(data.role);
        // Redirect logic for non-admins
        if (data.role === 'digital_marketing_manager') {
            navigate('/dashboard/digital-marketing');
        } else if (data.role === 'copywriter') {
            navigate('/dashboard/copywriter');
        } else if (data.role === 'copy_qc') {
            navigate('/dashboard/copy-qc');
        } else if (data.role === 'designer') {
            navigate('/dashboard/designer');
        } else if (data.role === 'designer_qc') {
            navigate('/dashboard/designer-qc');
        }
    }
  };

  const fetchProjects = async () => {
    const { data } = await supabase
      .from('projects')
      .select('*, content_items(id, is_admin_verified, status)')
      .order('created_at', { ascending: false });
    
    if (data) {
        const projectsWithVerifiedStatus = data.map(proj => {
            const items = proj.content_items || [];
            const verifiedCount = items.filter((i: any) => i.is_admin_verified).length;
            const allVerified = items.length > 0 && verifiedCount === items.length;
            return {
                ...proj,
                all_verified: allVerified,
                total_items_count: items.length,
                verified_count: verifiedCount,
                completed_count: items.filter((i: any) => i.status === 'completed').length
            };
        });
        setProjects(projectsWithVerifiedStatus);
    }
  };

  const handleProjectClick = async (project: any) => {
    setSelectedProject(project);
    const { data: contentData } = await supabase
        .from('content_items')
        .select('*')
        .eq('project_id', project.id)
        .order('publish_date', { ascending: true });
    
    if (contentData) setProjectContent(contentData);
    fetchChangeRequests(project.id);

    // Fetch time logs with employee names
    const { data: logsData } = await supabase
        .from('time_logs')
        .select(`
            *,
            profiles:user_id (full_name)
        `)
        .eq('project_id', project.id);
    
    if (logsData) setTimeLogs(logsData);
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

  const handleCreateProject = async () => {
    // Validate
    const totalItems = Object.values(newProject.content_counts).reduce((a, b) => a + b, 0);
    if (totalItems === 0) {
        toast({ title: "Error", description: "Please select at least one content type.", variant: "destructive" });
        return;
    }

    try {
      const { data, error } = await supabase.rpc('create_project_with_types', {
        p_title: newProject.title,
        p_brief: newProject.brief,
        p_start_date: newProject.start_date,
        p_end_date: newProject.end_date,
        p_content_counts: newProject.content_counts,
        p_created_by: user?.id
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Project created with ${data.items_created} generated content items.`,
      });
      setIsCreateOpen(false);
      fetchProjects();
      // Reset form
      setNewProject({ title: "", brief: "", start_date: "", end_date: "", content_counts: {} });
    } catch (error: any) {
      console.error("Create Project error:", error);
      let msg = error.message || "Failed to create project";

      if (error && typeof error === 'object' && 'context' in error) {
         msg += ".";
         if (error.context && error.context.json) {
            const body = await error.context.json().catch(() => ({}));
            if (body.error) msg = body.error;
         }
      }

      toast({
        title: "Error",
        description: msg,
        variant: "destructive"
      });
    }
  };

  const stats = [
    { label: "Active Projects", value: projects.filter(p => !p.all_verified).length.toString(), icon: LayoutDashboard, color: "text-primary" },
    { label: "Total Completed", value: projects.reduce((acc, p) => acc + p.verified_count, 0).toString(), icon: CheckCircle2, color: "text-green-500" },
  ];

  const [viewMode, setViewMode] = useState<'calendar' | 'list' | 'analytics'>('calendar');
  const [date, setDate] = useState<Date | undefined>(new Date());
  
  // Get days that have content
  const contentDays = projectContent.map(item => new Date(item.publish_date));
  
  // Get content for selected date
  const selectedDateContent = date 
    ? projectContent.filter(item => 
        new Date(item.publish_date).toDateString() === date.toDateString()
      )
    : [];

  const handleRejectClick = (item: any) => {
    setRejectingItem(item);
    setRejectionReason("");
    setRejectionDestination("copywriter");
    setRejectDialogOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold mb-2">
            Welcome back, <span className="text-gradient-gold">{user?.user_metadata?.full_name?.split(' ')[0] || "there"}</span>!
          </h1>
          <p className="text-muted-foreground">Here's an overview of your workflow status.</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button variant="hero"><Plus className="w-4 h-4 mr-2"/> New Project</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
              <DialogDescription>
                Set up a new campaign. Content calendar will be auto-generated.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Project Title</Label>
                <Input id="title" value={newProject.title} onChange={(e) => setNewProject({...newProject, title: e.target.value})} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="brief">Brief / Instructions</Label>
                <Textarea id="brief" value={newProject.brief} onChange={(e) => setNewProject({...newProject, brief: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input id="start_date" type="date" value={newProject.start_date} onChange={(e) => setNewProject({...newProject, start_date: e.target.value})} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="end_date">End Date</Label>
                  <Input id="end_date" type="date" value={newProject.end_date} onChange={(e) => setNewProject({...newProject, end_date: e.target.value})} />
                </div>
              </div>
                <div className="grid gap-2">
                 <Label>Content Strategy</Label>
                 <div className="grid grid-cols-1 gap-3 border rounded-lg p-4 bg-black/20">
                    {CONTENT_TYPES.map(type => {
                        const isChecked = newProject.content_counts[type] !== undefined;
                        return (
                            <div key={type} className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                    <Checkbox 
                                        id={`type-${type}`} 
                                        checked={isChecked}
                                        onCheckedChange={() => toggleContentType(type)}
                                    />
                                    <Label htmlFor={`type-${type}`} className="cursor-pointer">{type}</Label>
                                </div>
                                {isChecked && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">Qty:</span>
                                        <Input 
                                            type="number" 
                                            className="h-8 w-20 text-right" 
                                            value={newProject.content_counts[type]} 
                                            onChange={(e) => updateTypeCount(type, parseInt(e.target.value) || 0)}
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {Object.keys(newProject.content_counts).length === 0 && (
                        <p className="text-xs text-muted-foreground italic text-center py-2">Select content types to generate calendar</p>
                    )}
                    {Object.keys(newProject.content_counts).length > 0 && (
                         <div className="pt-2 mt-2 border-t border-white/5 flex justify-between text-sm">
                            <span className="font-semibold text-muted-foreground">Total Items:</span>
                            <span className="font-bold text-primary">
                                {Object.values(newProject.content_counts).reduce((a, b) => a + b, 0)}
                            </span>
                         </div>
                    )}
                 </div>
               </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreateProject}>Create Project</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
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
                    <Button variant="outline" onClick={() => setSelectedProject(null)}>← Back to Projects</Button>
                    <div>
                        <h2 className="text-2xl font-bold">{selectedProject.title}</h2>
                        <p className="text-muted-foreground text-sm">{selectedProject.brief}</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                   <div className="flex bg-muted p-1 rounded-lg">
                        <Button 
                            variant={viewMode === 'calendar' ? 'default' : 'ghost'} 
                            size="sm" 
                            onClick={() => setViewMode('calendar')}
                        >
                            <CalendarIcon className="w-4 h-4 mr-2"/> Calendar
                        </Button>
                        <Button 
                            variant={viewMode === 'list' ? 'default' : 'ghost'} 
                            size="sm" 
                            onClick={() => setViewMode('list')}
                        >
                            <LayoutDashboard className="w-4 h-4 mr-2"/> List
                        </Button>
                        <Button 
                            variant={viewMode === 'analytics' ? 'default' : 'ghost'} 
                            size="sm" 
                            onClick={() => setViewMode('analytics')}
                        >
                            <BarChart3 className="w-4 h-4 mr-2"/> Analytics
                        </Button>
                   </div>

                   <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive"><Trash2 className="w-4 h-4 mr-2"/> Delete Project</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This permanently deletes the project and all content.
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteProject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                        </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                   </AlertDialog>
                </div>
            </div>

            {projectContent.length === 0 ? (
                <Card variant="glass" className="p-8 text-center opacity-80">
                    <p className="text-muted-foreground">No content items found for this project.</p>
                </Card>
            ) : viewMode === 'analytics' ? (
                <AnalyticsView timeLogs={timeLogs} />
            ) : viewMode === 'list' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {projectContent.map((item: any) => (
                        <Card key={item.id} variant="glass-hover" className="opacity-90">
                            <CardContent className="p-4">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="font-mono text-lg font-bold">{new Date(item.publish_date).getDate()}</span>
                                    <span className={`text-[10px] px-2 py-1 rounded-full border ${
                                        item.status === 'pending_dm' ? 'border-primary text-primary' : 
                                        item.status === 'completed' ? 'border-green-500 text-green-500' : 'border-muted text-muted-foreground'
                                    }`}>
                                        {item.status?.replace(/_/g, ' ')}
                                    </span>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground font-semibold">Title</p>
                                    <p className="text-sm font-medium line-clamp-2">{item.dm_title || "Pending DM..."}</p>
                                </div>
                            </CardContent>
                        </Card>
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
                                hasContent: (date) => contentDays.some(d => d.toDateString() === date.toDateString())
                            }}
                            modifiersClassNames={{
                                hasContent: "bg-primary/15 text-primary border border-primary/30 shadow-[0_0_10px_rgba(234,179,8,0.15)] font-bold hover:bg-primary/25 hover:scale-105 transition-all duration-300 rounded-full"
                            }}
                        />
                    </Card>
                    
                    <div className="space-y-4">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                            {date ? date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Select a date'}
                            {selectedDateContent.length > 0 && <span className="bg-primary/20 text-primary text-xs px-2 py-1 rounded-full">{selectedDateContent.length} items</span>}
                        </h3>
                        
                        {selectedDateContent.length > 0 ? (
                            <div className="grid gap-4">
                                {selectedDateContent.map((item: any) => (
                                    <Card key={item.id} variant="glass-hover">
                                        <CardContent className="p-6">
                                            <div className="flex justify-between items-start mb-6">
                                                <div>
                                                    <h4 className="font-bold text-lg mb-1">{item.dm_title || "Untitled Content"}</h4>
                                                    <p className="text-sm bg-white/5 px-2 py-1 rounded w-fit text-muted-foreground">{item.status?.replace(/_/g, ' ')}</p>
                                                </div>
                                            </div>
                                            
                                            {/* WORKFLOW STEPPER */}
                                            <WorkflowStepper item={item} />

                                            {/* ADMIN ACTIONS */}
                                            {item.status === 'completed' && (
                                                <div className="mt-8 pt-6 border-t border-white/5 space-y-4">
                                                    <div className="flex items-center justify-between">
                                                        <h4 className="text-sm font-bold uppercase tracking-wider text-primary">Admin Verification</h4>
                                                        {item.is_admin_verified ? (
                                                            <span className="flex items-center gap-1 text-xs text-green-500 font-bold bg-green-500/10 px-2 py-1 rounded">
                                                                <CheckCircle2 className="w-3 h-3" /> VERIFIED
                                                            </span>
                                                        ) : (
                                                            <span className="flex items-center gap-1 text-xs text-orange-500 font-bold bg-orange-500/10 px-2 py-1 rounded">
                                                                <AlertCircle className="w-3 h-3" /> PENDING REVIEW
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                        <Button 
                                                            variant="outline" 
                                                            className="w-full"
                                                            onClick={() => downloadAsset(item.design_asset_url, item.dm_title)}
                                                            disabled={!item.design_asset_url}
                                                        >
                                                            <Download className="w-4 h-4 mr-2" /> Download
                                                        </Button>
                                                        <Button 
                                                            variant="outline" 
                                                            className="w-full text-red-500 hover:text-red-600 hover:bg-red-500/10 border-red-500/20"
                                                            onClick={() => handleRejectClick(item)}
                                                            disabled={item.is_admin_verified}
                                                        >
                                                            <XCircle className="w-4 h-4 mr-2" /> Reject
                                                        </Button>
                                                        <Button 
                                                            className="w-full bg-green-600 hover:bg-green-700 text-white"
                                                            onClick={() => handleVerify(item)}
                                                            disabled={item.is_admin_verified}
                                                        >
                                                            <CheckCircle className="w-4 h-4 mr-2" /> Verify
                                                        </Button>
                                                    </div>

                                                    {item.design_asset_url && (
                                                        <div className="mt-4 aspect-video rounded-xl overflow-hidden border border-white/10 bg-black/40">
                                                            <img src={item.design_asset_url} alt="Final Asset" className="w-full h-full object-contain" />
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            <Card variant="glass" className="p-12 text-center border-dashed">
                                <p className="text-muted-foreground">No content scheduled for this date.</p>
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
      ) : (
      <>
        {projects.length > 0 && <h2 className="text-xl font-bold mb-4">Active Projects</h2>}
        {projects.length === 0 ? (
            <Card variant="glass" className="p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <CalendarIcon className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-xl mb-2">No Projects Yet</CardTitle>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Create a new project to get started with the automatic content calendar.
            </p>
            </Card>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {projects.map(project => (
                <div key={project.id} className="relative group perspective-1000" onClick={() => handleProjectClick(project)}>
                    <div className="absolute inset-0 bg-primary/20 blur-xl rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <Card variant="glass-hover" className="cursor-pointer border-white/5 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md relative z-10 overflow-hidden group-hover:-translate-y-1 transition-transform duration-300">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:bg-primary/20" />
                        
                        <CardContent className="p-8">
                            <div className="flex justify-between items-start mb-6 relative">
                                 <div>
                                    <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-1 block">Project</span>
                                    <h3 className="font-bold text-2xl tracking-tight group-hover:text-primary transition-colors">{project.title}</h3>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                                    project.all_verified ? 'bg-green-500 text-white border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)]' :
                                    project.status === 'active' ? 'bg-primary/10 text-primary border-primary/20' : 
                                    'bg-muted text-muted-foreground border-white/10'
                                }`}>
                                    {project.all_verified ? 'COMPLETED' : project.status?.toUpperCase()}
                                </span>
                            </div>
                            
                            <p className="text-sm text-muted-foreground mb-8 line-clamp-2 leading-relaxed h-10">{project.brief}</p>
                            
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                                <div className="space-y-1">
                                    <span className="text-[10px] uppercase text-muted-foreground font-semibold flex items-center gap-1">
                                        <CalendarIcon className="w-3 h-3" /> Duration
                                    </span>
                                    <p className="text-sm font-medium">{project.start_date} <span className="text-muted-foreground">→</span> {project.end_date}</p>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] uppercase text-muted-foreground font-semibold flex items-center gap-1">
                                        <LayoutDashboard className="w-3 h-3" /> Scope
                                    </span>
                                    <p className="text-sm font-medium">{project.verified_count || 0} of {project.total_contents} verified</p>
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

      {/* Rejection Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Reject Content Work</DialogTitle>
            <DialogDescription>
              Provide feedback and select where the work should be sent for revision.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="grid gap-2">
              <Label htmlFor="reason">Reason for Rejection</Label>
              <Textarea 
                id="reason" 
                placeholder="Describe what needs to be changed..." 
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="min-h-[120px]"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="destination">Send Back To</Label>
              <Select value={rejectionDestination} onValueChange={setRejectionDestination}>
                <SelectTrigger id="destination">
                  <SelectValue placeholder="Select destination" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="copywriter">Copywriter (Content/Script changes)</SelectItem>
                  <SelectItem value="designer">Designer (Visual/Asset changes)</SelectItem>
                  <SelectItem value="qc">QC Team (Review process again)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectionReason.trim()}>
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Dashboard;
