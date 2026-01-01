import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { User } from "@supabase/supabase-js";
import DashboardLayout from "@/components/DashboardLayout";
import { Eye, CheckCircle2, XCircle, ExternalLink, ThumbsUp, ThumbsDown, FolderOpen, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const DesignerQCDashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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
    setLoading(true);
    const { data, error } = await supabase
        .from('content_items')
        .select('*, projects!inner(title, id, brief)')
        .eq('status', 'pending_design_qc')
        .order('design_submitted_at', { ascending: false });

    if (error) {
        toast({ title: "Error fetching items", description: error.message, variant: "destructive" });
    } else {
        setItems(data || []);
    }
    setLoading(false);
  };

  const fetchStats = async () => {
      // Simple stats fetching - can be optimized
      const { count: toReview } = await supabase.from('content_items').select('*', { count: 'exact', head: true }).eq('status', 'pending_design_qc');
      const { count: approved } = await supabase.from('content_items').select('*', { count: 'exact', head: true }).eq('status', 'completed'); // Assuming 'completed' is next step
      const { count: rejected } = await supabase.from('content_items').select('*', { count: 'exact', head: true }).eq('status', 'rejected_from_design_qc');

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
      const projectId = item.projects?.id || 'unknown';
      if (!acc[projectId]) {
          acc[projectId] = {
              id: projectId,
              title: item.projects?.title || 'Unknown Project',
              brief: item.projects?.brief || '',
              items: []
          };
      }
      acc[projectId].items.push(item);
      return acc;
  }, {});

  const projects = Object.values(projectGroups);
  const selectedProject = selectedProjectId ? projectGroups[selectedProjectId] : null;

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          Design QC <span className="text-gradient-gold">Review</span>
        </h1>
        <p className="text-muted-foreground">Quality control for design assets.</p>
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
          // ==================== PROJECT FOLDER VIEW ====================
          <>
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
                    {projects.map((proj: any) => (
                        <div key={proj.id} className="relative group perspective-1000" onClick={() => setSelectedProjectId(proj.id)}>
                            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            <Card variant="glass-hover" className="cursor-pointer border-white/5 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md relative z-10 overflow-hidden group-hover:-translate-y-1 transition-transform duration-300">
                                <CardContent className="p-8">
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="p-3 bg-primary/10 rounded-xl">
                                            <FolderOpen className="w-8 h-8 text-primary" />
                                        </div>
                                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                                            {proj.items.length} Tasks to Review
                                        </span>
                                    </div>
                                    
                                    <h3 className="font-bold text-xl mb-2 group-hover:text-primary transition-colors">{proj.title}</h3>
                                    <p className="text-sm text-muted-foreground line-clamp-2 h-10">{proj.brief || 'No brief available.'}</p>
                                    
                                    <div className="pt-4 mt-4 border-t border-white/5 text-xs text-muted-foreground flex justify-between items-center">
                                        <span>Click to open folder</span>
                                        <ArrowLeft className="w-4 h-4 rotate-180" />
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
