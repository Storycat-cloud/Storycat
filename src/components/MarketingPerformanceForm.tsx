import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { BarChart3, Save, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PerformanceLog } from "@/hooks/useMarketingPerformance";
import { format } from "date-fns";

interface MarketingPerformanceFormProps {
    projectId: string;
    onLog: (log: Omit<PerformanceLog, 'project_id'>) => Promise<void>;
    existingLog?: PerformanceLog | null;
}

export const MarketingPerformanceForm = ({ projectId, onLog, existingLog }: MarketingPerformanceFormProps) => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<Omit<PerformanceLog, 'project_id' | 'id'>>({
        log_date: existingLog?.log_date || format(new Date(), 'yyyy-MM-dd'),
        amount_spent: existingLog?.amount_spent || 0,
        leads_generated: existingLog?.leads_generated || 0,
        reach: existingLog?.reach || 0,
        impressions: existingLog?.impressions || 0,
        likes: existingLog?.likes || 0,
        views: existingLog?.views || 0,
        clicks: existingLog?.clicks || 0,
        conversions: existingLog?.conversions || 0,
        notes: existingLog?.notes || ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onLog(formData);
            toast({
                title: "Success",
                description: "Performance data logged successfully.",
            });
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Failed to log performance data.",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="glass-card border-primary/20">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    Log Daily Performance
                </CardTitle>
                <div className="text-sm text-muted-foreground">
                    Logging for {format(new Date(formData.log_date), 'MMMM d, yyyy')}
                </div>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="amount_spent" className="text-xs uppercase tracking-wider text-muted-foreground">Amount Spent ($)</Label>
                            <Input
                                id="amount_spent"
                                type="number"
                                step="0.01"
                                value={formData.amount_spent}
                                onChange={(e) => setFormData({ ...formData, amount_spent: parseFloat(e.target.value) || 0 })}
                                className="bg-white/5 border-white/10"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="leads" className="text-xs uppercase tracking-wider text-muted-foreground">Leads Generated</Label>
                            <Input
                                id="leads"
                                type="number"
                                value={formData.leads_generated}
                                onChange={(e) => setFormData({ ...formData, leads_generated: parseInt(e.target.value) || 0 })}
                                className="bg-white/5 border-white/10"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="reach" className="text-xs uppercase tracking-wider text-muted-foreground">Reach</Label>
                            <Input
                                id="reach"
                                type="number"
                                value={formData.reach}
                                onChange={(e) => setFormData({ ...formData, reach: parseInt(e.target.value) || 0 })}
                                className="bg-white/5 border-white/10"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="impressions" className="text-xs uppercase tracking-wider text-muted-foreground">Impressions</Label>
                            <Input
                                id="impressions"
                                type="number"
                                value={formData.impressions}
                                onChange={(e) => setFormData({ ...formData, impressions: parseInt(e.target.value) || 0 })}
                                className="bg-white/5 border-white/10"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="likes" className="text-xs uppercase tracking-wider text-muted-foreground">Likes</Label>
                            <Input
                                id="likes"
                                type="number"
                                value={formData.likes}
                                onChange={(e) => setFormData({ ...formData, likes: parseInt(e.target.value) || 0 })}
                                className="bg-white/5 border-white/10"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="views" className="text-xs uppercase tracking-wider text-muted-foreground">Views</Label>
                            <Input
                                id="views"
                                type="number"
                                value={formData.views}
                                onChange={(e) => setFormData({ ...formData, views: parseInt(e.target.value) || 0 })}
                                className="bg-white/5 border-white/10"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes" className="text-xs uppercase tracking-wider text-muted-foreground">Notes (Optional)</Label>
                        <Textarea
                            id="notes"
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            className="bg-white/5 border-white/10 min-h-[80px]"
                            placeholder="Any specific observations for today?"
                        />
                    </div>

                    <Button
                        type="submit"
                        className="w-full h-12 font-bold shadow-[0_4px_14px_0_rgba(234,179,8,0.39)]"
                        disabled={loading}
                    >
                        <Save className="w-4 h-4 mr-2" />
                        {loading ? "Saving..." : "Save Daily Report"}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
};
