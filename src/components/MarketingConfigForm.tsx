import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface MarketingConfig {
    enabled: boolean;
    channels: string[];
    budget_type: 'daily' | 'weekly' | 'monthly';
    budget_amount: number;
}

interface MarketingConfigFormProps {
    config: MarketingConfig | null;
    onSave: (config: MarketingConfig) => Promise<void>;
    readOnly?: boolean;
}

const MARKETING_CHANNELS = [
    { value: 'meta', label: 'Meta (Facebook/Instagram)' },
    { value: 'google', label: 'Google Ads' },
    { value: 'youtube', label: 'YouTube' },
    { value: 'tiktok', label: 'TikTok' },
    { value: 'linkedin', label: 'LinkedIn' },
    { value: 'twitter', label: 'Twitter/X' },
    { value: 'other', label: 'Other' }
];

export const MarketingConfigForm = ({ config, onSave, readOnly = false }: MarketingConfigFormProps) => {
    const [formData, setFormData] = useState<MarketingConfig>(config || {
        enabled: false,
        channels: [],
        budget_type: 'monthly',
        budget_amount: 0
    });
    const [saving, setSaving] = useState(false);

    const toggleChannel = (channel: string) => {
        if (readOnly) return;

        setFormData(prev => ({
            ...prev,
            channels: prev.channels.includes(channel)
                ? prev.channels.filter(c => c !== channel)
                : [...prev.channels, channel]
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave(formData);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card className="glass-card border-primary/20">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    Paid Marketing Configuration
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Enable/Disable */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10">
                    <div>
                        <Label className="text-base font-semibold">Enable Paid Marketing</Label>
                        <p className="text-sm text-muted-foreground">Allow digital marketers to log performance data</p>
                    </div>
                    <Switch
                        checked={formData.enabled}
                        onCheckedChange={(enabled) => !readOnly && setFormData({ ...formData, enabled })}
                        disabled={readOnly}
                    />
                </div>

                {formData.enabled && (
                    <>
                        {/* Channels */}
                        <div className="space-y-3">
                            <Label className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                                Marketing Channels
                            </Label>
                            <div className="grid grid-cols-2 gap-2">
                                {MARKETING_CHANNELS.map((channel) => (
                                    <Button
                                        key={channel.value}
                                        type="button"
                                        variant={formData.channels.includes(channel.value) ? "default" : "outline"}
                                        className="justify-start"
                                        onClick={() => toggleChannel(channel.value)}
                                        disabled={readOnly}
                                    >
                                        {channel.label}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {/* Budget Type */}
                        <div className="space-y-2">
                            <Label className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                                Budget Type
                            </Label>
                            <Select
                                value={formData.budget_type}
                                onValueChange={(value: any) => !readOnly && setFormData({ ...formData, budget_type: value })}
                                disabled={readOnly}
                            >
                                <SelectTrigger className="bg-white/5 border-white/10">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="daily">Daily Budget</SelectItem>
                                    <SelectItem value="weekly">Weekly Budget</SelectItem>
                                    <SelectItem value="monthly">Monthly Budget</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Budget Amount */}
                        <div className="space-y-2">
                            <Label className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                                Budget Amount
                            </Label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={formData.budget_amount}
                                    onChange={(e) => !readOnly && setFormData({ ...formData, budget_amount: parseFloat(e.target.value) || 0 })}
                                    className="pl-10 bg-white/5 border-white/10 text-lg h-12"
                                    placeholder="0.00"
                                    disabled={readOnly}
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {formData.budget_type.charAt(0).toUpperCase() + formData.budget_type.slice(1)} budget for paid marketing
                            </p>
                        </div>

                        {/* Selected Channels Display */}
                        {formData.channels.length > 0 && (
                            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                                    Active Channels
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {formData.channels.map((channel) => (
                                        <Badge key={channel} className="bg-primary/20 text-primary border-primary/30">
                                            {MARKETING_CHANNELS.find(c => c.value === channel)?.label}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* Save Button (Admin Only) */}
                {!readOnly && (
                    <Button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full h-12 text-base font-bold shadow-[0_0_20px_rgba(234,179,8,0.3)]"
                    >
                        {saving ? 'Saving...' : 'Save Marketing Configuration'}
                    </Button>
                )}

                {readOnly && (
                    <p className="text-sm text-muted-foreground italic text-center">
                        Only admins can modify marketing configuration
                    </p>
                )}
            </CardContent>
        </Card>
    );
};
