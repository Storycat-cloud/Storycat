import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { User } from "@supabase/supabase-js";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PenTool, CheckCircle, Calendar as CalendarIcon, List, LayoutDashboard, ArrowLeft, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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
  
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [copyForm, setCopyForm] = useState({ copy_content: "", copy_writer_notes: "" });
  const [date, setDate] = useState<Date | undefined>(new Date());
  
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProjects();
    });
  }, []);

  const fetchProjects = async () => {
    // 1. Fetch all items assigned to copywriter flow
    const { data: items, error } = await supabase
      .from('content_items')
      .select('*, projects!inner(*)')
      .in('status', ['pending_copy', 'rejected_from_copy_qc'])
      // .eq('projects.status', 'active') // Optional: only active projects
      .order('publish_date', { ascending: true });

    if (error) {
        console.error("Error fetching tasks:", error);
        return;
    }

    if (items) {
        // 2. Group by Project to create unique project list
        const uniqueProjectsMap = new Map();
        items.forEach(item => {
            if (item.projects && !uniqueProjectsMap.has(item.projects.id)) {
                uniqueProjectsMap.set(item.projects.id, {
                    ...item.projects,
                    drafted_count: 0,
                    total_at_this_stage: 0,
                    earliest_deadline: item.publish_date
                });
            }
            const proj = uniqueProjectsMap.get(item.projects?.id);
            if (proj) {
                proj.total_at_this_stage++;
                if (item.copy_content) proj.drafted_count++;
                if (new Date(item.publish_date) < new Date(proj.earliest_deadline)) {
                    proj.earliest_deadline = item.publish_date;
                }
            }
        });
        setProjects(Array.from(uniqueProjectsMap.values()));
    }
  };

  const handleProjectClick = async (project: any) => {
      setSelectedProject(project);
      // Fetch all COPYWRITER RELEVANT content for this project
      const { data } = await supabase
        .from('content_items')
        .select('*')
        .eq('project_id', project.id)
        .order('publish_date', { ascending: true });
      
      if (data) setProjectContent(data);
      setViewMode('calendar'); // Default to calendar as requested
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

  // Calendar helpers
  const contentDays = projectContent.map(item => new Date(item.publish_date));
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
            Welcome back, <span className="text-gradient-gold">{user?.user_metadata?.full_name?.split(' ')[0] || "there"}</span>!
          </h1>
          <p className="text-muted-foreground">Manage your detailed copy tasks.</p>
        </div>
      </div>

      {!selectedProject ? (
          // PROJECT LIST VIEW
          <div className="space-y-6">
               <h2 className="text-xl font-bold mb-4">Your Active Projects</h2>
               {projects.length === 0 ? (
                    <Card variant="glass" className="p-12 text-center">
                        <CardTitle className="text-xl mb-2">All Caught Up!</CardTitle>
                        <p className="text-muted-foreground">No projects currently require your attention.</p>
                    </Card>
               ) : (
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                                                {project.drafted_count} of {project.total_at_this_stage} Drafted
                                            </span>
                                        </div>
                                        
                                        <p className="text-sm text-muted-foreground mb-8 line-clamp-2 leading-relaxed h-10">{project.brief}</p>
                                        
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                                            <CalendarIcon className="w-3 h-3" />
                                            Deadline: {new Date(project.earliest_deadline).toLocaleDateString()}
                                        </div>
                                    </CardContent>
                                </Card>
                           </div>
                       ))}
                   </div>
               )}
          </div>
      ) : (
          // PROJECT DETAIL VIEW
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="outline" onClick={() => setSelectedProject(null)}><ArrowLeft className="w-4 h-4 mr-2"/> Back</Button>
                    <div>
                        <h2 className="text-2xl font-bold">{selectedProject.title}</h2>
                        <p className="text-muted-foreground text-sm">Manage content and submit to QC</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    {/* View Toggle */}
                   <div className="flex bg-muted/50 p-1 rounded-lg">
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
                            <List className="w-4 h-4 mr-2"/> List
                        </Button>
                   </div>
                    
                    {/* Removed project-wide submit to QC as it's now granular */}
                </div>
            </div>

            {projectContent.length === 0 ? (
                <Card variant="glass" className="p-8 text-center opacity-80">
                    <p className="text-muted-foreground">No content items found for this project.</p>
                </Card>
            ) : viewMode === 'list' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projectContent.map((item: any) => (
                         <div key={item.id} className="relative group perspective-1000" onClick={() => handleTaskClick(item)}>
                            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            <Card variant="glass-hover" className={`cursor-pointer border-white/5 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md relative z-10 overflow-hidden group-hover:-translate-y-1 transition-transform duration-300 ${
                                ['pending_copy', 'rejected_from_copy_qc'].includes(item.status) ? '' : 'opacity-60 grayscale'
                            }`}>
                                <CardContent className="p-6">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="font-mono text-lg font-bold">{new Date(item.publish_date).getDate()}</span>
                                        <span className={`text-[10px] px-2 py-1 rounded-full border ${
                                            item.status === 'rejected_from_copy_qc' ? 'border-red-500 text-red-500' : 
                                            item.status === 'pending_copy' ? 'border-primary text-primary' : 'border-muted text-muted-foreground'
                                        }`}>
                                            {item.status.replace(/_/g, ' ')}
                                        </span>
                                    </div>
                                    <h3 className="font-bold text-lg mb-2">{item.dm_title}</h3>
                                    {item.copy_content ? (
                                        <p className="text-xs text-green-500 flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Drafted</p>
                                    ) : (
                                        <p className="text-xs text-muted-foreground">No content yet</p>
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
                                    <Card key={item.id} variant="glass-hover" className="cursor-pointer" onClick={() => handleTaskClick(item)}>
                                        <CardContent className="p-6">
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <h4 className="font-bold text-lg">{item.dm_title || "Untitled Content"}</h4>
                                                    <p className="text-sm text-muted-foreground">{item.status?.replace(/_/g, ' ')}</p>
                                                </div>
                                                <Button variant="outline" size="sm">Edit</Button>
                                            </div>
                                            {item.dm_notes && (
                                                <div className="bg-muted/30 p-3 rounded-lg text-sm mb-2">
                                                    <p className="font-semibold text-xs text-muted-foreground mb-1">DM Notes</p>
                                                    {item.dm_notes}
                                                </div>
                                            )}
                                            {item.copy_content && (
                                                <div className="bg-primary/10 p-3 rounded-lg text-sm border border-primary/20">
                                                    <p className="font-semibold text-xs text-primary mb-1 flex items-center gap-1"><PenTool className="w-3 h-3"/> Your Draft</p>
                                                    <p className="whitespace-pre-wrap">{item.copy_content}</p>
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
                    <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                        <Label className="text-xs uppercase text-muted-foreground">DM Brief</Label>
                        <h3 className="font-bold">{selectedTask.dm_title}</h3>
                        <p className="text-sm text-muted-foreground">{selectedTask.dm_notes}</p>
                        {selectedTask.rejection_reason && selectedTask.status === 'rejected_from_copy_qc' && (
                            <div className="mt-2 bg-red-500/10 text-red-500 p-2 rounded text-sm">
                                <strong>Rejection Reason:</strong> {selectedTask.rejection_reason}
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
                                onChange={(e) => setCopyForm({...copyForm, copy_content: e.target.value})}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Notes for QC / Designer</Label>
                            <Textarea 
                                placeholder="Any context or instructions..."
                                value={copyForm.copy_writer_notes}
                                onChange={(e) => setCopyForm({...copyForm, copy_writer_notes: e.target.value})}
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
    </DashboardLayout>
  );
};

export default CopywriterDashboard;
