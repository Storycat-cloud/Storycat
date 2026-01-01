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
import { Megaphone, BarChart3, Users, Calendar as CalendarIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar"; // Moved import to top

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
                    cell: "h-14 w-full text-center text-sm p-0 relative [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                    day: "h-14 w-full p-0 font-normal aria-selected:opacity-100 hover:bg-white/5 rounded-xl transition-all duration-300",
                    day_selected: "bg-primary text-black hover:bg-primary hover:text-black focus:bg-primary focus:text-black shadow-[0_0_15px_rgba(234,179,8,0.6)] font-bold scale-105 transition-transform",
                    day_today: "bg-white/10 text-white font-bold",
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

  const [ideaForm, setIdeaForm] = useState({ dm_title: "", dm_notes: "" });
  const [changeRequests, setChangeRequests] = useState<any[]>([]);
  const [newChangeRequest, setNewChangeRequest] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    // Fetch projects and their content items to calculate progress
    const { data } = await supabase
        .from('projects')
        .select('*, content_items(id, status)')
        .eq('status', 'active');
    
    if (data) {
        const projectsWithProgress = data.map(proj => {
            const items = proj.content_items || [];
            const plannedCount = items.filter((i: any) => i.status !== 'pending_dm').length;
            return {
                ...proj,
                planned_count: plannedCount
            };
        });
        setProjects(projectsWithProgress);
    }
  };

  const fetchContentItems = async (projectId: string) => {
    const { data } = await supabase
      .from('content_items')
      .select('*')
      .eq('project_id', projectId);
    
    if (data) setContentItems(data);
  };

  const fetchChangeRequests = async (projectId: string) => {
    // Casting to any to avoid type errors until types are regenerated
    const { data } = await (supabase
      .from('project_change_requests' as any)
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false }));
      
    if (data) setChangeRequests(data);
  };

  const handleProjectClick = (project: any) => {
    setSelectedProject(project);
    fetchContentItems(project.id);
    fetchChangeRequests(project.id);
  };

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    if (!date) return;

    // Check if there is an existing item for this date
    const existingItem = contentItems.find(item => 
      new Date(item.publish_date).toDateString() === date.toDateString()
    );
    
    setSelectedItem(existingItem || null);
    
    // Open Details Dialog first
    setIsDetailsDialogOpen(true);
  };
  
  const openIdeaDialog = () => {
      setIsDetailsDialogOpen(false);
      setIdeaForm({
        dm_title: selectedItem?.dm_title || "",
        dm_notes: selectedItem?.dm_notes || "" 
      });
      setIsIdeaDialogOpen(true);
  };

  const handleCompletePlanning = async () => {
      if (!selectedProject) return;
      
      try {
          // Update ALL items for this project that are in 'pending_dm' status
          const { error } = await supabase
            .from('content_items')
            .update({ status: 'pending_copy' })
            .eq('project_id', selectedProject.id)
            .eq('status', 'pending_dm');
            
          if (error) throw error;
          
          toast({ 
              title: "Planning Completed", 
              description: "All content items have been sent to the Copywriter." 
          });
          fetchContentItems(selectedProject.id); // Refresh
      } catch (error: any) {
          toast({ title: "Error", description: error.message, variant: "destructive" });
      }
  };

  const handleSubmitIdea = async () => {
    if (!selectedProject || !selectedDate) return;

    try {
        const dateString = selectedDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD
        let existingItem = contentItems.find(item => 
            new Date(item.publish_date).toDateString() === selectedDate.toDateString()
        );

        let error;
        
        if (existingItem) {
             const { error: updateError } = await supabase
                .from('content_items')
                .update({
                    dm_title: ideaForm.dm_title,
                    dm_notes: ideaForm.dm_notes,
                    status: 'pending_copy' // Automatically move to next stage
                })
                .eq('id', existingItem.id);
            error = updateError;
        } else {
            // Create new item
             const { error: insertError } = await supabase
                .from('content_items')
                .insert({
                    project_id: selectedProject.id,
                    publish_date: dateString,
                    dm_title: ideaForm.dm_title,
                    dm_notes: ideaForm.dm_notes,
                    status: 'pending_copy' // Automatically move to next stage
                });
             error = insertError;
        }

      if (error) throw error;

      toast({ title: "Success", description: "Content submitted to Copywriter." });
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
        
        <div className="relative z-10">
          <h1 className="text-4xl font-extrabold mb-2 tracking-tight">
            Digital Marketing <span className="text-gradient-gold">Dashboard</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Manage your campaigns efficiently. Select project dates to add content ideas and track your progress.
          </p>
        </div>
      </div>

      {!selectedProject ? (
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
            {projects.map(project => (
                <div key={project.id} className="group relative" onClick={() => handleProjectClick(project)}>
                    {/* Hover Glow */}
                    <div className="absolute -inset-0.5 bg-gradient-gold opacity-0 group-hover:opacity-30 rounded-2xl blur transition duration-500" />
                    
                    <Card className="glass-card-hover h-full cursor-pointer border-white/5 bg-black/40 relative z-10">
                        <CardContent className="p-6 flex flex-col h-full">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                    <BarChart3 className="w-5 h-5" />
                                </div>
                                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                                    {project.planned_count || 0} of {project.total_contents} Done
                                </span>
                            </div>
                            
                            <h3 className="text-2xl font-bold mb-2 group-hover:text-primary transition-colors">{project.title}</h3>
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-6 flex-grow">{project.brief}</p>
                            
                            <div className="pt-4 border-t border-white/5 flex items-center justify-between text-xs text-muted-foreground">
                                <span className="flex items-center gap-1.5">
                                    <CalendarIcon className="w-3.5 h-3.5" />
                                    {new Date(project.start_date).toLocaleDateString()}
                                </span>
                                <span className="flex items-center gap-1 group-hover:translate-x-1 transition-transform text-white">
                                    Open Project →
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            ))}
        </div>
      ) : (
        <div className="space-y-8 animate-fade-in-up">
            <div className="flex items-center justify-between mb-6">
                 <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" onClick={() => setSelectedProject(null)} className="rounded-full h-10 w-10 border-white/10 hover:bg-white/10">
                        <span className="text-lg">←</span>
                    </Button>
                    <div>
                        <h2 className="text-3xl font-bold">{selectedProject.title}</h2>
                        <p className="text-muted-foreground text-sm flex items-center gap-2">
                             <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                             Active Campaign
                        </p>
                    </div>
                </div>
            </div>
            
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
                         
                         {/* Removed project-wide 'Complete Planning' button as tasks now move granularly */}
                     </Card>

                     {/* Additional Change Requests */}
                     <Card className="glass-card p-8 border-white/5">
                        <CardTitle className="mb-4 flex items-center gap-2">
                            <Megaphone className="w-5 h-5 text-primary" />
                            Additional Permanent Changes
                        </CardTitle>
                        <div className="space-y-4">
                            <div className="glass-card p-1 bg-black/20 focus-within:ring-2 ring-primary/50 transition-all">
                                <Textarea 
                                    placeholder="Describe any additional changes, strategic shifts, or permanent requirements..." 
                                    value={newChangeRequest}
                                    onChange={(e) => setNewChangeRequest(e.target.value)}
                                    className="min-h-[100px] border-none focus-visible:ring-0 bg-transparent resize-none p-4 text-base"
                                />
                                <div className="p-2 flex justify-end bg-white/5 rounded-b-xl">
                                    <Button onClick={handleSubmitChangeRequest} className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold px-6">
                                        Submit Request
                                    </Button>
                                </div>
                            </div>
                            
                            <div className="space-y-2 mt-6">
                                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Request History</h4>
                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                    {changeRequests.map(req => (
                                        <div key={req.id} className="p-4 rounded-xl bg-white/5 border border-white/5 hover:border-primary/20 transition-colors">
                                            <p className="mb-2 text-sm leading-relaxed">{req.content}</p>
                                            <div className="flex justify-between items-center text-xs text-muted-foreground">
                                                <span>Submitted by You</span>
                                                <span>{new Date(req.created_at).toLocaleString()}</span>
                                            </div>
                                        </div>
                                    ))}
                                    {changeRequests.length === 0 && (
                                        <div className="text-center py-8 text-muted-foreground bg-white/5 rounded-xl border-dashed border border-white/10">
                                            <p>No additional changes submitted yet.</p>
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
                                <p>When finished, click <strong>"Complete Planning"</strong> to notify the Copywriter.</p>
                            </div>
                            
                            <div className="mt-4 p-3 rounded-lg bg-black/40 border border-white/5 flex items-center gap-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_10px_rgba(234,179,8,0.5)]"></div>
                                <span className="text-primary font-medium">Scheduled Content</span>
                            </div>
                        </div>
                    </Card>

                    <Card className="glass-card p-6">
                        <h4 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground">Project Summary</h4>
                        <div className="space-y-4">
                            <div>
                                <p className="text-xs text-muted-foreground">Brief</p>
                                <p className="text-sm line-clamp-3">{selectedProject.brief}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs text-muted-foreground">Start Date</p>
                                    <p className="text-sm font-medium">{new Date(selectedProject.start_date).toLocaleDateString()}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Total Posts</p>
                                    <p className="text-sm font-medium">{selectedProject.total_contents}</p>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
      )}

      {/* Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
         <DialogContent className="glass-card border-white/10 bg-black/90 backdrop-blur-xl sm:max-w-[500px]">
             <DialogHeader>
                 <DialogTitle className="text-xl font-bold">
                    {selectedDate?.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                 </DialogTitle>
             </DialogHeader>
             
             <div className="py-6">
                 {selectedItem ? (
                     <div className="space-y-6">
                         <div className="space-y-1">
                             <Label className="uppercase text-xs text-muted-foreground font-bold tracking-wider">Content Name</Label>
                             <p className="text-xl font-semibold">{selectedItem.dm_title || "Untitled"}</p>
                         </div>
                         <div className="space-y-1">
                             <Label className="uppercase text-xs text-muted-foreground font-bold tracking-wider">Description</Label>
                             <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{selectedItem.dm_notes || "No description provided."}</p>
                         </div>
                         <div className="flex items-center gap-2 pt-2">
                             <span className={`px-2 py-1 rounded text-xs font-medium border ${
                                 selectedItem.status === 'pending_copy' ? 'bg-purple-500/10 text-purple-500 border-purple-500/20' :
                                 'bg-primary/10 text-primary border-primary/20'
                             }`}>
                                 {selectedItem.status === 'pending_copy' ? 'SENT TO COPYWRITER' : 'DRAFT'}
                             </span>
                         </div>
                     </div>
                 ) : (
                     <div className="text-center py-8 opacity-60">
                         <Megaphone className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                         <p className="text-lg font-medium">Nothing planned yet</p>
                         <p className="text-sm text-muted-foreground">Add content to this date to get started.</p>
                     </div>
                 )}
             </div>

             <DialogFooter className="gap-2 sm:gap-0">
                 <Button onClick={openIdeaDialog} className="bg-primary text-black hover:bg-primary/90 font-bold min-w-[120px] w-full">
                     {selectedItem ? "Edit Content" : "Add Content"}
                 </Button>
             </DialogFooter>
         </DialogContent>
      </Dialog>

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
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Content Name</Label>
                    <Input 
                        placeholder="e.g. Summer Campaign Teaser" 
                        value={ideaForm.dm_title}
                        onChange={(e) => setIdeaForm({...ideaForm, dm_title: e.target.value})}
                        className="bg-white/5 border-white/10 focus-visible:ring-primary/50 text-lg h-12"
                    />
                </div>
                <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Description & Strategies</Label>
                    <Textarea 
                        placeholder="Detail the execution plan, visual style, and key messaging..." 
                        value={ideaForm.dm_notes}
                        onChange={(e) => setIdeaForm({...ideaForm, dm_notes: e.target.value})}
                        className="min-h-[150px] bg-white/5 border-white/10 focus-visible:ring-primary/50 resize-none leading-relaxed"
                    />
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
