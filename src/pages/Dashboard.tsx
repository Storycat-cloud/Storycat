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
  Megaphone,
  ChevronRight,
  ChevronLeft,
  Building2,
  Target,
  TrendingUp,
  Video,
  Upload
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
import { Plus, Trash2, Star } from "lucide-react";
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
              <div className={`absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full ring-4 ring-background ${step.status === 'completed' ? 'bg-green-500' :
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
  const [creationStep, setCreationStep] = useState(1);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);

  const [newProject, setNewProject] = useState<any>({
    title: "",
    brief: "",
    start_date: "",
    priority_stars: 3,
    content_counts: {},
    company_name: "",
    brand_logo_url: "",
    brand_expertise_years: "",
    general_usps: "",
    content_usps: "",
    focus_products: "",
    target_audience: "",
    pain_points: "",
    scope_brand_building: false,
    scope_lead_generation: false,
    target_promotion_area: "",
    gbp_status: false,
    gbp_location_name: "",
    seo_status: false,
    seo_keyword_count: "",
    google_ads_status: false,
    google_ads_display: false,
    google_ads_search: false,
    google_ads_youtube: false,
    sm_posters_count: "",
    mg_videos_count: "",
    reel_videos_count: "",
    ai_videos_count: "",
    website_updation_status: false,
    other_deliverables: "",
    has_existing_followers: false,
    fb_status: false,
    fb_followers: "",
    ig_status: false,
    ig_followers: "",
    li_status: false,
    li_followers: "",
    yt_status: false,
    yt_followers: "",
    ad_spend_amount: "",
    creative_website: "",
    creative_contact_number: "",
    major_competitors: "",
    additional_info: "",
    client_star_rating: 3 // Default to 3 stars
  });

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
    let file: File | undefined;

    if ('files' in e.target && e.target.files) {
      file = e.target.files[0];
    } else if ('dataTransfer' in e && e.dataTransfer.files) {
      e.preventDefault();
      file = e.dataTransfer.files[0];
    }

    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({ title: "Invalid file", description: "Please upload an image file (PNG, JPG, etc)", variant: "destructive" });
      return;
    }

    setIsUploadingLogo(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('project-assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('project-assets')
        .getPublicUrl(filePath);

      setNewProject({ ...newProject, brand_logo_url: publicUrl });
      toast({ title: "Logo Uploaded", description: "Your brand logo has been saved." });
    } catch (error: any) {
      console.error("Logo upload error:", error);
      toast({ title: "Upload Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsUploadingLogo(false);
    }
  };

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
  const [viewMode, setViewMode] = useState<'calendar' | 'list' | 'analytics' | 'onboarding'>('calendar');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [onboardingData, setOnboardingData] = useState<any>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [isExtendingCalendar, setIsExtendingCalendar] = useState(false);

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

  const handleExtendCalendar = async () => {
    if (!selectedProject) return;
    setIsExtendingCalendar(true);

    try {
      const { data, error } = await supabase.rpc('extend_project_calendar', {
        p_project_id: selectedProject.id,
        p_years_to_add: 1
      });

      if (error) throw error;

      toast({
        title: "Calendar Extended Successfully",
        description: `Added ${data.items_created} content items. New end date: ${new Date(data.new_end_date).toLocaleDateString()}`,
      });

      // Refresh project data
      fetchProjects();
      if (selectedProject) {
        // Re-fetch the selected project to update the view
        const { data: updatedProject } = await supabase
          .from('projects')
          .select('*')
          .eq('id', selectedProject.id)
          .single();

        if (updatedProject) {
          setSelectedProject(updatedProject);
        }

        handleProjectClick(selectedProject);
      }
    } catch (error: any) {
      toast({
        title: "Error Extending Calendar",
        description: error.message || "Failed to extend calendar. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExtendingCalendar(false);
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
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .neq('role', 'admin')
      .order('full_name');
    if (data) setEmployees(data);
  };

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
    fetchOnboarding(project.id);
  };

  const fetchOnboarding = async (projectId: string) => {
    const { data } = await supabase
      .from('project_onboarding' as any)
      .select('*')
      .eq('project_id', projectId)
      .single();

    if (data) setOnboardingData(data);
    else setOnboardingData({ project_id: projectId });
  };

  const handleSaveOnboarding = async () => {
    if (!selectedProject) return;
    setSaveLoading(true);

    try {
      const { error } = await supabase
        .from('project_onboarding' as any)
        .upsert(onboardingData, { onConflict: 'project_id' });

      if (error) throw error;

      toast({ title: "Success", description: "Onboarding data saved." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaveLoading(false);
    }
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
    const totalItems = Object.values(newProject.content_counts as Record<string, number>).reduce((a, b) => a + b, 0);
    if (totalItems === 0) {
      toast({ title: "Error", description: "Please select at least one content type.", variant: "destructive" });
      return;
    }

    try {
      const { data, error } = (await (supabase as any).rpc('create_project_with_types', {
        p_title: newProject.title,
        p_brief: newProject.brief,
        p_start_date: newProject.start_date,
        p_duration_months: 12,
        p_priority_stars: newProject.priority_stars,
        p_content_counts: newProject.content_counts,
        p_created_by: user?.id
      })) as { data: any, error: any };

      if (error) throw error;
      if (!data) throw new Error("No data returned from project creation");

      // Now save the onboarding data
      const onboardingPayload = {
        project_id: data.project_id,
        company_name: newProject.company_name,
        brand_logo_url: newProject.brand_logo_url,
        brand_expertise_years: newProject.brand_expertise_years,
        general_usps: newProject.general_usps,
        content_usps: newProject.content_usps,
        focus_products: newProject.focus_products,
        target_audience: newProject.target_audience,
        pain_points: newProject.pain_points,
        scope_brand_building: newProject.scope_brand_building,
        scope_lead_generation: newProject.scope_lead_generation,
        target_promotion_area: newProject.target_promotion_area,
        gbp_status: newProject.gbp_status,
        gbp_location_name: newProject.gbp_location_name,
        seo_status: newProject.seo_status,
        seo_keyword_count: newProject.seo_keyword_count,
        google_ads_status: newProject.google_ads_status,
        google_ads_display: newProject.google_ads_display,
        google_ads_search: newProject.google_ads_search,
        google_ads_youtube: newProject.google_ads_youtube,
        sm_posters_count: newProject.sm_posters_count,
        mg_videos_count: newProject.mg_videos_count,
        reel_videos_count: newProject.reel_videos_count,
        ai_videos_count: newProject.ai_videos_count,
        website_updation_status: newProject.website_updation_status,
        other_deliverables: newProject.other_deliverables,
        has_existing_followers: newProject.has_existing_followers,
        fb_status: newProject.fb_status,
        fb_followers: newProject.fb_followers,
        ig_status: newProject.ig_status,
        ig_followers: newProject.ig_followers,
        li_status: newProject.li_status,
        li_followers: newProject.li_followers,
        yt_status: newProject.yt_status,
        yt_followers: newProject.yt_followers,
        ad_spend_amount: newProject.ad_spend_amount,
        creative_website: newProject.creative_website,
        creative_contact_number: newProject.creative_contact_number,
        major_competitors: newProject.major_competitors,
        additional_info: newProject.additional_info,
        client_star_rating: newProject.client_star_rating || 3
      };

      const { error: onboardingError } = await supabase
        .from('project_onboarding' as any)
        .insert(onboardingPayload);

      if (onboardingError) console.error("Onboarding data save error:", onboardingError);

      toast({
        title: "Success",
        description: `Project created with ${data?.items_created || 0} generated content items for the next year.`,
      });
      setIsCreateOpen(false);
      fetchProjects();
      // Reset form
      setNewProject({
        title: "", brief: "", start_date: "", priority_stars: 3, content_counts: {},
        company_name: "", brand_logo_url: "", brand_expertise_years: "", general_usps: "",
        content_usps: "", focus_products: "", target_audience: "", pain_points: "",
        scope_brand_building: false, scope_lead_generation: false, target_promotion_area: "",
        gbp_status: false, gbp_location_name: "", seo_status: false, seo_keyword_count: "",
        google_ads_status: false, google_ads_display: false, google_ads_search: false, google_ads_youtube: false,
        sm_posters_count: "", mg_videos_count: "", reel_videos_count: "", ai_videos_count: "",
        website_updation_status: false, other_deliverables: "", has_existing_followers: false,
        fb_status: false, fb_followers: "", ig_status: false, ig_followers: "",
        li_status: false, li_followers: "", yt_status: false, yt_followers: "",
        ad_spend_amount: "", creative_website: "", creative_contact_number: "", major_competitors: "", additional_info: "",
        client_star_rating: 3
      });
      setCreationStep(1);
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
            <Button variant="hero"><Plus className="w-4 h-4 mr-2" /> New Project</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-2 mb-2">
                {[1, 2, 3, 4, 5].map((s) => (
                  <div
                    key={s}
                    className={`h-1.5 flex-1 rounded-full transition-all ${s <= creationStep ? 'bg-primary' : 'bg-white/10'}`}
                  />
                ))}
              </div>
              <DialogTitle className="text-2xl flex items-center gap-2">
                {creationStep === 1 && <><LayoutDashboard className="w-5 h-5 text-primary" /> Project Basics</>}
                {creationStep === 2 && <><Building2 className="w-5 h-5 text-primary" /> Brand Information</>}
                {creationStep === 3 && <><Target className="w-5 h-5 text-primary" /> Strategy & Scope</>}
                {creationStep === 4 && <><TrendingUp className="w-5 h-5 text-primary" /> Promotion & Ads</>}
                {creationStep === 5 && <><Video className="w-5 h-5 text-primary" /> Deliverables & Creative</>}
                {creationStep === 6 && <><UserIcon className="w-5 h-5 text-primary" /> Dedicated Team</>}
              </DialogTitle>
              <DialogDescription>
                Step {creationStep} of 6 — {creationStep === 6 ? "Assign dedicated team members" : "Tell us more about the project goals"}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-6 py-6">
              {/* STEP 1: BASICS */}
              {creationStep === 1 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="grid gap-2">
                    <Label htmlFor="title">Company Name</Label>
                    <Input id="title" value={newProject.title} onChange={(e) => setNewProject({ ...newProject, title: e.target.value, company_name: e.target.value })} placeholder="e.g. Acme Corp" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="brief">Brief / Instructions</Label>
                    <Textarea id="brief" value={newProject.brief} onChange={(e) => setNewProject({ ...newProject, brief: e.target.value })} placeholder="Overall campaign objective..." />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="start_date">Start Date</Label>
                      <Input id="start_date" type="date" value={newProject.start_date} onChange={(e) => setNewProject({ ...newProject, start_date: e.target.value })} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Priority Rating</Label>
                      <div className="flex items-center gap-1 bg-black/20 p-2 rounded-lg w-fit">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-5 h-5 cursor-pointer transition-all ${star <= newProject.priority_stars ? "fill-primary text-primary" : "text-muted-foreground/30"}`}
                            onClick={() => setNewProject({ ...newProject, priority_stars: star })}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Monthly Content Strategy</Label>
                    <div className="grid grid-cols-2 gap-3 border rounded-lg p-4 bg-black/20">
                      {CONTENT_TYPES.map(type => {
                        const isChecked = newProject.content_counts[type] !== undefined;
                        return (
                          <div key={type} className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <Checkbox id={`type-${type}`} checked={isChecked} onCheckedChange={() => toggleContentType(type)} />
                              <Label htmlFor={`type-${type}`} className="text-sm cursor-pointer">{type}</Label>
                            </div>
                            {isChecked && (
                              <Input type="number" className="h-7 w-20 px-2 text-right bg-black/40 focus:ring-1 focus:ring-primary border-white/10" value={newProject.content_counts[type]} onChange={(e) => updateTypeCount(type, parseInt(e.target.value) || 0)} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: BRAND */}
              {creationStep === 2 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="grid gap-2">
                    <Label>Brand Logo</Label>
                    <div
                      className={`relative group border-2 border-dashed rounded-xl p-8 transition-all flex flex-col items-center justify-center gap-4 bg-black/20 ${newProject.brand_logo_url ? 'border-primary/40' : 'border-white/10 hover:border-primary/40 hover:bg-black/40'}`}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleLogoUpload}
                    >
                      {newProject.brand_logo_url ? (
                        <div className="relative w-32 h-32 animate-in zoom-in-95 duration-300">
                          <img src={newProject.brand_logo_url} alt="Logo" className="w-full h-full object-contain rounded-lg shadow-lg" />
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute -top-2 -right-2 w-6 h-6 rounded-full scale-0 group-hover:scale-100 transition-transform"
                            onClick={() => setNewProject({ ...newProject, brand_logo_url: "" })}
                          >
                            <XCircle className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Upload className="w-8 h-8 text-primary" />
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-bold text-primary">Click or drag & drop logo</p>
                            <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-widest">PNG, JPG, SVG up to 5MB</p>
                          </div>
                          <input
                            type="file"
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            accept="image/*"
                            onChange={handleLogoUpload}
                            disabled={isUploadingLogo}
                          />
                        </>
                      )}

                      {isUploadingLogo && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center rounded-xl z-10 animate-in fade-in duration-300">
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            <p className="text-xs font-bold text-primary animate-pulse">Uploading...</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>How many years of experience does your business have?</Label>
                    <Input value={newProject.brand_expertise_years} onChange={e => setNewProject({ ...newProject, brand_expertise_years: e.target.value })} placeholder="e.g. 5 Years" />
                  </div>
                  <div className="grid gap-2">
                    <Label>Key USPs of your brand?</Label>
                    <Textarea value={newProject.general_usps} onChange={e => setNewProject({ ...newProject, general_usps: e.target.value })} placeholder="What makes you unique?" />
                  </div>
                  <div className="grid gap-2">
                    <Label>Brand USPs specifically for content creation?</Label>
                    <Textarea value={newProject.content_usps} onChange={e => setNewProject({ ...newProject, content_usps: e.target.value })} placeholder="Marketing focus points..." />
                  </div>
                </div>
              )}

              {/* STEP 3: STRATEGY */}
              {creationStep === 3 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="grid gap-2">
                    <Label>Which products or services should be the primary focus?</Label>
                    <Textarea value={newProject.focus_products} onChange={e => setNewProject({ ...newProject, focus_products: e.target.value })} placeholder="Primary offerings..." />
                  </div>
                  <div className="grid gap-2">
                    <Label>Who is your target audience?</Label>
                    <Textarea value={newProject.target_audience} onChange={e => setNewProject({ ...newProject, target_audience: e.target.value })} placeholder="Demographics, interests..." />
                  </div>
                  <div className="grid gap-2">
                    <Label>Major pain points faced by your customers?</Label>
                    <Textarea value={newProject.pain_points} onChange={e => setNewProject({ ...newProject, pain_points: e.target.value })} placeholder="Problem you are solving..." />
                  </div>
                  <div className="grid gap-4">
                    <Label>Scope of Work</Label>
                    <div className="flex gap-6 p-4 border rounded-xl bg-black/20">
                      <div className="flex items-center space-x-2">
                        <Checkbox id="build" checked={newProject.scope_brand_building} onCheckedChange={val => setNewProject({ ...newProject, scope_brand_building: !!val })} />
                        <Label htmlFor="build">Brand Building</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox id="gen" checked={newProject.scope_lead_generation} onCheckedChange={val => setNewProject({ ...newProject, scope_lead_generation: !!val })} />
                        <Label htmlFor="gen">Lead Generation</Label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: PROMOTION */}
              {creationStep === 4 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="grid gap-2">
                    <Label>What is the target area/location for promotion?</Label>
                    <Input value={newProject.target_promotion_area} onChange={e => setNewProject({ ...newProject, target_promotion_area: e.target.value })} placeholder="e.g. Dubai, UAE" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 border rounded-xl bg-black/20 space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox id="gbp_s" checked={newProject.gbp_status} onCheckedChange={val => setNewProject({ ...newProject, gbp_status: !!val })} />
                        <Label htmlFor="gbp_s" className="font-bold">Google Business Profile</Label>
                      </div>
                      {newProject.gbp_status && (
                        <Input value={newProject.gbp_location_name} onChange={e => setNewProject({ ...newProject, gbp_location_name: e.target.value })} placeholder="Location Name" className="h-8 text-xs" />
                      )}
                    </div>
                    <div className="p-4 border rounded-xl bg-black/20 space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox id="seo_s" checked={newProject.seo_status} onCheckedChange={val => setNewProject({ ...newProject, seo_status: !!val })} />
                        <Label htmlFor="seo_s" className="font-bold">SEO Services</Label>
                      </div>
                      {newProject.seo_status && (
                        <Input value={newProject.seo_keyword_count} onChange={e => setNewProject({ ...newProject, seo_keyword_count: e.target.value })} placeholder="No. of Keywords" className="h-8 text-xs" />
                      )}
                    </div>
                  </div>
                  <div className="p-4 border rounded-xl bg-black/20 space-y-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox id="ads_s" checked={newProject.google_ads_status} onCheckedChange={val => setNewProject({ ...newProject, google_ads_status: !!val })} />
                      <Label htmlFor="ads_s" className="font-bold">Google Ads Services</Label>
                    </div>
                    {newProject.google_ads_status && (
                      <div className="grid grid-cols-3 gap-3 pt-2 border-t border-white/5">
                        <div className="flex flex-col items-center gap-1">
                          <Checkbox id="ad_d" checked={newProject.google_ads_display} onCheckedChange={val => setNewProject({ ...newProject, google_ads_display: !!val })} />
                          <Label htmlFor="ad_d" className="text-[10px]">Display</Label>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <Checkbox id="ad_s" checked={newProject.google_ads_search} onCheckedChange={val => setNewProject({ ...newProject, google_ads_search: !!val })} />
                          <Label htmlFor="ad_s" className="text-[10px]">Search</Label>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <Checkbox id="ad_y" checked={newProject.google_ads_youtube} onCheckedChange={val => setNewProject({ ...newProject, google_ads_youtube: !!val })} />
                          <Label htmlFor="ad_y" className="text-[10px]">YouTube</Label>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label>What is the monthly ad spend budget?</Label>
                    <Input value={newProject.ad_spend_amount} onChange={e => setNewProject({ ...newProject, ad_spend_amount: e.target.value })} placeholder="e.g. $5,000" />
                  </div>
                </div>
              )}

              {/* STEP 5: FINAL SPECS */}
              {creationStep === 5 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* SOCIAL PLATFORMS BOX */}
                    <div className="p-4 border rounded-xl bg-black/20 space-y-4">
                      <Label className="font-bold text-sm flex items-center gap-2">
                        Managed Social Platforms
                      </Label>
                      <div className="grid gap-2">
                        {['fb', 'ig', 'li', 'yt'].map(p => {
                          const isChecked = newProject[`${p}_status`];
                          const platformNames: Record<string, string> = { fb: 'Facebook', ig: 'Instagram', li: 'LinkedIn', yt: 'YouTube' };
                          return (
                            <div key={p} className="flex items-center justify-between gap-4 p-3 border border-white/5 rounded-lg bg-black/20 hover:bg-black/40 transition-colors">
                              <div className="flex items-center space-x-3">
                                <Checkbox
                                  id={`wiz-${p}`}
                                  checked={isChecked}
                                  onCheckedChange={v => setNewProject({ ...newProject, [`${p}_status`]: !!v })}
                                />
                                <Label htmlFor={`wiz-${p}`} className="text-xs font-bold cursor-pointer">{platformNames[p]}</Label>
                              </div>
                              {(isChecked && newProject.has_existing_followers) && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-muted-foreground">Followers:</span>
                                  <Input
                                    placeholder="e.g. 5K"
                                    className="h-7 w-24 text-[11px] bg-black/60 border-primary/30 text-right font-mono"
                                    value={newProject[`${p}_followers`] || ''}
                                    onChange={e => setNewProject({ ...newProject, [`${p}_followers`]: e.target.value })}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* SETTINGS & CREATIVE BOX */}
                    <div className="space-y-6">
                      <div className="p-4 border rounded-xl bg-black/20 space-y-4">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="ex_f" className="font-bold text-xs cursor-pointer">Do you have existing followers?</Label>
                          <Checkbox
                            id="ex_f"
                            checked={newProject.has_existing_followers}
                            onCheckedChange={v => setNewProject({ ...newProject, has_existing_followers: !!v })}
                          />
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t border-white/5">
                          <Label htmlFor="web_u" className="font-bold text-xs cursor-pointer">Require Website Updates?</Label>
                          <Checkbox
                            id="web_u"
                            checked={newProject.website_updation_status}
                            onCheckedChange={v => setNewProject({ ...newProject, website_updation_status: !!v })}
                          />
                        </div>
                      </div>

                      <div className="grid gap-4">
                        <div className="grid gap-2">
                          <Label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Contact for Creatives</Label>
                          <Input
                            value={newProject.creative_contact_number}
                            onChange={e => setNewProject({ ...newProject, creative_contact_number: e.target.value })}
                            placeholder="+1 234 567 890"
                            className="h-10 bg-black/20"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Website for Creatives</Label>
                          <Input
                            value={newProject.creative_website}
                            onChange={e => setNewProject({ ...newProject, creative_website: e.target.value })}
                            placeholder="www.example.com"
                            className="h-10 bg-black/20"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-2 pt-2">
                    <Label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Additional Information / Competitors</Label>
                    <Textarea
                      value={newProject.additional_info}
                      onChange={e => setNewProject({ ...newProject, additional_info: e.target.value })}
                      placeholder="List major competitors or any specific design requirements..."
                      className="min-h-[100px] bg-black/20"
                    />
                  </div>
                </div>
              )}

              {/* STEP 6: CLIENT STAR RATING */}
              {creationStep === 6 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="space-y-4">
                    <Label className="text-lg font-semibold">Client Quality Tier (Star Rating)</Label>
                    <p className="text-sm text-muted-foreground">
                      Select the quality tier for this client. Employees with matching or higher star ratings will be automatically assigned to this project's tasks.
                    </p>

                    <div className="flex items-center gap-4 p-6 bg-black/20 rounded-xl border border-white/10">
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => setNewProject({ ...newProject, client_star_rating: rating })}
                            className={`transition-all duration-200 ${rating <= (newProject.client_star_rating || 3)
                              ? 'text-primary scale-110'
                              : 'text-muted-foreground hover:text-primary/50'
                              }`}
                          >
                            <Star
                              className="w-12 h-12"
                              fill={rating <= (newProject.client_star_rating || 3) ? 'currentColor' : 'none'}
                            />
                          </button>
                        ))}
                      </div>
                      <div className="flex-1 text-center">
                        <div className="text-4xl font-bold text-primary">{newProject.client_star_rating || 3}</div>
                        <div className="text-sm text-muted-foreground">
                          {newProject.client_star_rating === 1 && 'Basic Tier'}
                          {newProject.client_star_rating === 2 && 'Standard Tier'}
                          {newProject.client_star_rating === 3 && 'Professional Tier'}
                          {newProject.client_star_rating === 4 && 'Premium Tier'}
                          {newProject.client_star_rating === 5 && 'Elite Tier'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border border-primary/20 bg-primary/5 rounded-xl">
                    <p className="text-xs text-primary font-medium flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Work will be automatically distributed among employees whose star rating meets or exceeds this tier.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="flex justify-between items-center sm:justify-between border-t border-white/5 pt-4">
              <div className="flex items-center gap-2">
                {creationStep > 1 && (
                  <Button variant="ghost" onClick={() => setCreationStep(creationStep - 1)}>
                    <ChevronLeft className="w-4 h-4 mr-2" /> Back
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {creationStep < 6 ? (
                  <Button
                    onClick={() => setCreationStep(creationStep + 1)}
                    disabled={creationStep === 1 && (!newProject.title || !newProject.start_date || Object.keys(newProject.content_counts).length === 0)}
                  >
                    Continue <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button onClick={handleCreateProject} className="bg-primary text-black font-bold px-8">
                    Launch Project
                  </Button>
                )}
              </div>
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
                  <CalendarIcon className="w-4 h-4 mr-2" /> Calendar
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                >
                  <LayoutDashboard className="w-4 h-4 mr-2" /> List
                </Button>
                <Button
                  variant={viewMode === 'analytics' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('analytics')}
                >
                  <BarChart3 className="w-4 h-4 mr-2" /> Analytics
                </Button>
                <Button
                  variant={viewMode === 'onboarding' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('onboarding')}
                >
                  <UserIcon className="w-4 h-4 mr-2" /> Onboarding
                </Button>
              </div>

              <Button
                variant="outline"
                onClick={handleExtendCalendar}
                disabled={isExtendingCalendar}
                className="border-primary/20 hover:bg-primary/10"
              >
                <Plus className="w-4 h-4 mr-2" />
                {isExtendingCalendar ? "Extending..." : "Extend Calendar +1 Year"}
              </Button>

              <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive"><Trash2 className="w-4 h-4 mr-2" /> Delete Project</Button>
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
          ) : viewMode === 'onboarding' ? (
            <div className="animate-in fade-in slide-in-from-top-4 duration-500">
              <Card variant="glass" className="overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-primary/20 to-transparent border-b border-white/5 p-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-2xl font-bold flex items-center gap-3">
                        <Megaphone className="w-6 h-6 text-primary" />
                        Client Onboarding Data
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">Detailed strategic requirements and preferences for {selectedProject.title}</p>
                    </div>
                    <Button onClick={handleSaveOnboarding} disabled={saveLoading} className="bg-primary text-black font-bold">
                      {saveLoading ? "Saving..." : "Save All Changes"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-8">
                  <Tabs defaultValue="strategy" className="w-full">
                    <TabsList className="grid grid-cols-6 mb-8 bg-black/40 border border-white/5">
                      <TabsTrigger value="brand">Client Info</TabsTrigger>
                      <TabsTrigger value="strategy">Strategy & Scope</TabsTrigger>
                      <TabsTrigger value="promotion">Promotion & Ads</TabsTrigger>
                      <TabsTrigger value="deliverables">Deliverables</TabsTrigger>
                      <TabsTrigger value="social">Social & Creative</TabsTrigger>
                      <TabsTrigger value="team">Dedicated Team</TabsTrigger>
                    </TabsList>

                    {/* BRAND INFO SECTION */}
                    <TabsContent value="brand" className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <div className="grid gap-2">
                            <Label>What is the name of your company/brand?</Label>
                            <Input value={onboardingData?.company_name || ''} onChange={e => setOnboardingData({ ...onboardingData, company_name: e.target.value })} placeholder="Company Name" />
                          </div>
                          <div className="grid gap-2">
                            <Label>Brand Logo URL</Label>
                            <Input value={onboardingData?.brand_logo_url || ''} onChange={e => setOnboardingData({ ...onboardingData, brand_logo_url: e.target.value })} placeholder="https://..." />
                          </div>
                          <div className="grid gap-2">
                            <Label>How many years of experience does your business have?</Label>
                            <Input value={onboardingData?.brand_expertise_years || ''} onChange={e => setOnboardingData({ ...onboardingData, brand_expertise_years: e.target.value })} placeholder="e.g. 10 Years" />
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div className="grid gap-2">
                            <Label>Key USPs of your brand?</Label>
                            <Textarea value={onboardingData?.general_usps || ''} onChange={e => setOnboardingData({ ...onboardingData, general_usps: e.target.value })} placeholder="Core business strengths..." />
                          </div>
                          <div className="grid gap-2">
                            <Label>Brand USPs specifically for content creation?</Label>
                            <Textarea value={onboardingData?.content_usps || ''} onChange={e => setOnboardingData({ ...onboardingData, content_usps: e.target.value })} placeholder="Specific points for marketing content..." />
                          </div>
                          <div className="grid gap-2">
                            <Label>Which products or services should be the primary focus?</Label>
                            <Textarea value={onboardingData?.focus_products || ''} onChange={e => setOnboardingData({ ...onboardingData, focus_products: e.target.value })} placeholder="List focus areas..." />
                          </div>
                        </div>
                      </div>
                    </TabsContent>

                    {/* STRATEGY & SCOPE SECTION */}
                    <TabsContent value="strategy" className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <div className="grid gap-2">
                            <Label>Who is your target audience?</Label>
                            <Textarea value={onboardingData?.target_audience || ''} onChange={e => setOnboardingData({ ...onboardingData, target_audience: e.target.value })} placeholder="Describe ideal clients..." />
                          </div>
                          <div className="grid gap-2">
                            <Label>Major pain points faced by your customers?</Label>
                            <Textarea value={onboardingData?.pain_points || ''} onChange={e => setOnboardingData({ ...onboardingData, pain_points: e.target.value })} placeholder="Challenges you solve..." />
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div className="grid gap-2">
                            <Label>Scope of Work</Label>
                            <div className="grid grid-cols-1 gap-4 p-4 border rounded-xl bg-black/20">
                              <div className="flex items-center space-x-2">
                                <Checkbox id="scope1" checked={onboardingData?.scope_brand_building} onCheckedChange={val => setOnboardingData({ ...onboardingData, scope_brand_building: !!val })} />
                                <Label htmlFor="scope1">Brand Building services</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Checkbox id="scope2" checked={onboardingData?.scope_lead_generation} onCheckedChange={val => setOnboardingData({ ...onboardingData, scope_lead_generation: !!val })} />
                                <Label htmlFor="scope2">Lead Generation services</Label>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </TabsContent>

                    {/* PROMOTION SECTION */}
                    <TabsContent value="promotion" className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <div className="grid gap-2">
                            <Label>Target Area of Promotion</Label>
                            <Input value={onboardingData?.target_promotion_area || ''} onChange={e => setOnboardingData({ ...onboardingData, target_promotion_area: e.target.value })} placeholder="e.g. Dubai, Global, etc." />
                          </div>
                          <div className="p-4 border rounded-xl bg-black/20 space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <Checkbox id="gbp" checked={onboardingData?.gbp_status} onCheckedChange={val => setOnboardingData({ ...onboardingData, gbp_status: !!val })} />
                                <Label htmlFor="gbp">Google Business Profile</Label>
                              </div>
                            </div>
                            {onboardingData?.gbp_status && (
                              <div className="grid gap-2 pt-2 border-t border-white/5">
                                <Label className="text-xs">Location Name</Label>
                                <Input className="h-8" value={onboardingData?.gbp_location_name || ''} onChange={e => setOnboardingData({ ...onboardingData, gbp_location_name: e.target.value })} />
                              </div>
                            )}
                          </div>
                          <div className="p-4 border rounded-xl bg-black/20 space-y-4">
                            <div className="flex items-center space-x-2">
                              <Checkbox id="seo" checked={onboardingData?.seo_status} onCheckedChange={val => setOnboardingData({ ...onboardingData, seo_status: !!val })} />
                              <Label htmlFor="seo">SEO Optimization</Label>
                            </div>
                            {onboardingData?.seo_status && (
                              <div className="grid gap-2 pt-2 border-t border-white/5">
                                <Label className="text-xs text-muted-foreground">Number of Keywords</Label>
                                <Input className="h-8" value={onboardingData?.seo_keyword_count || ''} onChange={e => setOnboardingData({ ...onboardingData, seo_keyword_count: e.target.value })} />
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="p-6 border rounded-xl bg-black/20 space-y-6">
                          <div className="flex items-center space-x-2">
                            <Checkbox id="ads" checked={onboardingData?.google_ads_status} onCheckedChange={val => setOnboardingData({ ...onboardingData, google_ads_status: !!val })} />
                            <Label htmlFor="ads" className="text-lg font-bold">Google Ads</Label>
                          </div>
                          {onboardingData?.google_ads_status && (
                            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/5">
                              <div className="flex flex-col items-center gap-2 p-3 border rounded-lg bg-white/5">
                                <Checkbox id="ads_d" checked={onboardingData?.google_ads_display} onCheckedChange={val => setOnboardingData({ ...onboardingData, google_ads_display: !!val })} />
                                <Label htmlFor="ads_d" className="text-[10px] uppercase font-bold">Display</Label>
                              </div>
                              <div className="flex flex-col items-center gap-2 p-3 border rounded-lg bg-white/5">
                                <Checkbox id="ads_s" checked={onboardingData?.google_ads_search} onCheckedChange={val => setOnboardingData({ ...onboardingData, google_ads_search: !!val })} />
                                <Label htmlFor="ads_s" className="text-[10px] uppercase font-bold">Search</Label>
                              </div>
                              <div className="flex flex-col items-center gap-2 p-3 border rounded-lg bg-white/5">
                                <Checkbox id="ads_y" checked={onboardingData?.google_ads_youtube} onCheckedChange={val => setOnboardingData({ ...onboardingData, google_ads_youtube: !!val })} />
                                <Label htmlFor="ads_y" className="text-[10px] uppercase font-bold">YouTube</Label>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </TabsContent>

                    {/* DELIVERABLES SECTION */}
                    <TabsContent value="deliverables" className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[
                          { label: 'SM Posters', key: 'sm_posters_count' },
                          { label: 'MG Videos', key: 'mg_videos_count' },
                          { label: 'Reel Videos', key: 'reel_videos_count' },
                          { label: 'AI Videos', key: 'ai_videos_count' },
                        ].map(field => (
                          <div key={field.key} className="p-4 border rounded-xl bg-black/20">
                            <Label className="text-xs font-bold text-muted-foreground uppercase">{field.label}</Label>
                            <Input className="mt-2" value={onboardingData?.[field.key] || ''} onChange={e => setOnboardingData({ ...onboardingData, [field.key]: e.target.value })} placeholder="Qty" />
                          </div>
                        ))}
                        <div className="col-span-2 p-4 border rounded-xl bg-black/20">
                          <div className="flex items-center space-x-2 mb-4">
                            <Checkbox id="web" checked={onboardingData?.website_updation_status} onCheckedChange={val => setOnboardingData({ ...onboardingData, website_updation_status: !!val })} />
                            <Label htmlFor="web">Website Updation Required</Label>
                          </div>
                          <Label className="text-xs">Other Deliverables</Label>
                          <Textarea className="mt-2" value={onboardingData?.other_deliverables || ''} onChange={e => setOnboardingData({ ...onboardingData, other_deliverables: e.target.value })} placeholder="Any other specific requests..." />
                        </div>
                      </div>
                    </TabsContent>

                    {/* SOCIAL & CREATIVE */}
                    <TabsContent value="social" className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between p-4 border rounded-xl bg-black/20">
                            <Label>Do you currently have followers?</Label>
                            <Checkbox checked={onboardingData?.has_existing_followers} onCheckedChange={val => setOnboardingData({ ...onboardingData, has_existing_followers: !!val })} />
                          </div>
                          <Label className="text-base font-bold">Managed Platforms & Followers</Label>
                          <div className="grid gap-3">
                            {[
                              { label: 'Facebook', prefix: 'fb' },
                              { label: 'Instagram', prefix: 'ig' },
                              { label: 'LinkedIn', prefix: 'li' },
                              { label: 'YouTube', prefix: 'yt' },
                            ].map(platform => (
                              <div key={platform.prefix} className="flex items-center gap-4 p-3 border rounded-lg bg-black/20">
                                <Checkbox
                                  checked={onboardingData?.[`${platform.prefix}_status`]}
                                  onCheckedChange={val => setOnboardingData({ ...onboardingData, [`${platform.prefix}_status`]: !!val })}
                                />
                                <Label className="w-20">{platform.label}</Label>
                                <Input
                                  className="h-8 text-xs"
                                  placeholder="Followers Count"
                                  disabled={!onboardingData?.[`${platform.prefix}_status`]}
                                  value={onboardingData?.[`${platform.prefix}_followers`] || ''}
                                  onChange={e => setOnboardingData({ ...onboardingData, [`${platform.prefix}_followers`]: e.target.value })}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div className="grid gap-2">
                            <Label>Monthly ad spend budget?</Label>
                            <Input value={onboardingData?.ad_spend_amount || ''} onChange={e => setOnboardingData({ ...onboardingData, ad_spend_amount: e.target.value })} placeholder="Budget in INR/USD" />
                          </div>
                          <div className="grid gap-2">
                            <Label>Website link to be included in creatives</Label>
                            <Input value={onboardingData?.creative_website || ''} onChange={e => setOnboardingData({ ...onboardingData, creative_website: e.target.value })} placeholder="www.yourlink.com" />
                          </div>
                          <div className="grid gap-2">
                            <Label>Contact number to be included in creatives</Label>
                            <Input value={onboardingData?.creative_contact_number || ''} onChange={e => setOnboardingData({ ...onboardingData, creative_contact_number: e.target.value })} placeholder="+123..." />
                          </div>
                          <div className="grid gap-2">
                            <Label>Major Competitors?</Label>
                            <Textarea value={onboardingData?.major_competitors || ''} onChange={e => setOnboardingData({ ...onboardingData, major_competitors: e.target.value })} placeholder="Who are they?" />
                          </div>
                        </div>
                      </div>
                      <Card variant="glass" className="mt-6">
                        <CardContent className="p-6">
                          <Label className="text-base font-bold mb-2 block">Total Work Protocol / Specific Requirements</Label>
                          <Textarea
                            value={onboardingData?.additional_info || ''}
                            onChange={e => setOnboardingData({ ...onboardingData, additional_info: e.target.value })}
                            className="min-h-[100px]"
                            placeholder="Type here..."
                          />
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="team" className="space-y-6">
                      <div className="space-y-6">
                        <Card className="bg-black/20">
                          <CardHeader>
                            <CardTitle className="text-lg">Client Quality Tier</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="flex items-center gap-6 p-6 bg-black/30 rounded-xl border border-white/10">
                              <div className="flex gap-2">
                                {[1, 2, 3, 4, 5].map((rating) => (
                                  <button
                                    key={rating}
                                    type="button"
                                    onClick={() => setOnboardingData({ ...onboardingData, client_star_rating: rating })}
                                    className={`transition-all duration-200 ${rating <= (onboardingData?.client_star_rating || 3)
                                        ? 'text-primary scale-110'
                                        : 'text-muted-foreground hover:text-primary/50'
                                      }`}
                                  >
                                    <Star
                                      className="w-10 h-10"
                                      fill={rating <= (onboardingData?.client_star_rating || 3) ? 'currentColor' : 'none'}
                                    />
                                  </button>
                                ))}
                              </div>
                              <div className="flex-1">
                                <div className="text-3xl font-bold text-primary">{onboardingData?.client_star_rating || 3} Stars</div>
                                <div className="text-sm text-muted-foreground mt-1">
                                  {(onboardingData?.client_star_rating || 3) === 1 && 'Basic Tier'}
                                  {(onboardingData?.client_star_rating || 3) === 2 && 'Standard Tier'}
                                  {(onboardingData?.client_star_rating || 3) === 3 && 'Professional Tier'}
                                  {(onboardingData?.client_star_rating || 3) === 4 && 'Premium Tier'}
                                  {(onboardingData?.client_star_rating || 3) === 5 && 'Elite Tier'}
                                </div>
                              </div>
                            </div>
                            <div className="p-4 border border-primary/20 bg-primary/5 rounded-xl">
                              <p className="text-xs text-primary font-medium flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" />
                                Work is automatically distributed to employees whose star rating meets or exceeds this tier.
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>
          ) : viewMode === 'analytics' ? (
            <AnalyticsView timeLogs={timeLogs} />
          ) : viewMode === 'list' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {projectContent.map((item: any) => (
                <Card key={item.id} variant="glass-hover" className="opacity-90">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-mono text-lg font-bold">{new Date(item.publish_date).getDate()}</span>
                      <span className={`text-[10px] px-2 py-1 rounded-full border ${item.status === 'pending_dm' ? 'border-primary text-primary' :
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
                          <div className="flex items-center gap-1 mb-1">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                className={`w-3 h-3 ${s <= (project.priority_stars || 0) ? 'fill-primary text-primary' : 'text-muted-foreground/20'}`}
                              />
                            ))}
                          </div>
                          <h3 className="font-bold text-2xl tracking-tight group-hover:text-primary transition-colors">{project.title}</h3>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${project.all_verified ? 'bg-green-500 text-white border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)]' :
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
