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
  Loader2
} from "lucide-react";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
                    <span className={`text-[10px] px-2 py-1 rounded-full border ${
                        item.status === 'rejected_from_design_qc' ? 'border-red-500 text-red-500' : 'border-primary text-primary'
                    }`}>
                        {item.status === 'rejected_from_design_qc' ? 'NEEDS REVISION' : 'READY FOR DESIGN'}
                    </span>
                </div>
                <div className="space-y-3">
                    <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-semibold">Campaign Title</p>
                        <h4 className="font-bold text-lg leading-tight">{item.dm_title}</h4>
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
                                disabled={!!activeTimerId} 
                                onClick={() => startTimer(item.id, item.project_id)}
                                variant="outline"
                            >
                                <Play className="w-4 h-4 mr-2" /> Start Designing
                            </Button>
                        )}

                        {/* Upload Section */}
                        <div className="space-y-2">
                            <Label htmlFor={`file-${item.id}`} className="cursor-pointer block">
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
                                disabled={uploadingItemId === item.id}
                            />
                            {item.design_asset_url && (
                                <a href={item.design_asset_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline block text-center mt-1">Check Uploaded File</a>
                            )}
                        </div>

                        {/* Submit Button */}
                        <Button 
                            className="w-full bg-green-600 hover:bg-green-700 text-white" 
                            disabled={!item.design_asset_url}
                            onClick={() => handleSubmitClick(item)}
                        >
                            <Send className="w-3 h-3 mr-2" /> Submit to QC
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

  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [date, setDate] = useState<Date | undefined>(new Date());
  
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

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
    // Fetch all items for active projects to calculate progress
    const { data: items } = await supabase
        .from('content_items')
        .select('*, projects!inner(*)');

    if (items) {
        const uniqueProjectsMap = new Map();
        items.forEach(item => {
            if (item.projects && !uniqueProjectsMap.has(item.projects.id)) {
                uniqueProjectsMap.set(item.projects.id, {
                    ...item.projects,
                    designed_count: 0,
                    total_at_this_stage: 0
                });
            }
            const proj = uniqueProjectsMap.get(item.projects?.id);
            if (proj) {
                // Determine if this item is currently relevant to the designer's queue
                // or if it should be counted in the "waiting" total
                if (['pending_design', 'rejected_from_design_qc'].includes(item.status)) {
                    proj.total_at_this_stage++;
                }
                if (item.design_asset_url && item.status !== 'pending_design' && item.status !== 'rejected_from_design_qc') {
                   proj.designed_count++;
                }
            }
        });
        setProjects(Array.from(uniqueProjectsMap.values()).filter(p => p.total_at_this_stage > 0 || p.designed_count > 0));
    }
  };

  const handleProjectClick = async (project: any) => {
    setSelectedProject(project);
    fetchProjectContent(project.id);
  };

  const fetchProjectContent = async (projectId: string) => {
    const { data } = await supabase
        .from('content_items')
        .select('*')
        .eq('project_id', projectId)
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
                   </div>
                </div>
            </div>

            {projectContent.length === 0 ? (
                <Card variant="glass" className="p-8 text-center opacity-80">
                    <p className="text-muted-foreground">No pending design tasks found for this project.</p>
                </Card>
            ) : viewMode === 'list' ? (
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
                                cell: "h-12 w-12 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20 my-1",
                                day: "h-12 w-12 p-0 font-normal aria-selected:opacity-100 rounded-xl hover:bg-white/5 transition-all duration-300 data-[selected]:bg-primary data-[selected]:text-primary-foreground data-[selected]:shadow-[0_0_20px_var(--primary)]",
                                day_selected: "bg-primary text-black hover:bg-primary hover:text-black focus:bg-primary focus:text-black shadow-[0_0_15px_rgba(234,179,8,0.6)] font-bold scale-110 transition-transform",
                                day_today: "bg-white/10 text-white",
                            }}
                            modifiers={{
                                hasContent: (date) => contentDays.some(d => d.toDateString() === date.toDateString())
                            }}
                            modifiersClassNames={{
                                hasContent: "bg-primary/15 text-primary border border-primary/30 shadow-[0_0_10px_rgba(234,179,8,0.15)] font-bold hover:bg-primary/25 hover:scale-105 transition-all duration-300"
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
                        ) : (
                            <Card variant="glass" className="p-12 text-center border-dashed">
                                <p className="text-muted-foreground">No tasks for this date.</p>
                            </Card>
                        )}
                    </div>
                </div>
            )}
        </div>
      ) : (
      <>
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
                                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                                    {project.designed_count} of {project.total_contents} Designed
                                </span>
                            </div>
                            
                            <p className="text-sm text-muted-foreground mb-8 line-clamp-2 leading-relaxed h-10">{project.brief}</p>
                            
                            <div className="pt-4 border-t border-white/5">
                                <span className="text-xs text-muted-foreground">Click to start working</span>
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
