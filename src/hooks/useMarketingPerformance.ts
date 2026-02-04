import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MarketingConfig {
    id?: string;
    project_id: string;
    enabled: boolean;
    channels: string[];
    budget_type: 'daily' | 'weekly' | 'monthly';
    budget_amount: number;
}

export interface PerformanceLog {
    id?: string;
    project_id: string;
    log_date: string;
    amount_spent: number;
    leads_generated: number;
    reach: number;
    impressions: number;
    likes: number;
    views: number;
    clicks?: number;
    conversions?: number;
    notes?: string;
}

export const useMarketingPerformance = (projectId: string | undefined) => {
    const [config, setConfig] = useState<MarketingConfig | null>(null);
    const [performanceHistory, setPerformanceHistory] = useState<PerformanceLog[]>([]);
    const [summary, setSummary] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const fetchConfig = async () => {
        if (!projectId) return;
        const { data, error } = await (supabase
            .from('paid_marketing_config' as any) as any)
            .select('*')
            .eq('project_id', projectId)
            .single();

        if (data) setConfig(data as MarketingConfig);
        else if (error && error.code !== 'PGRST116') console.error('Error fetching config:', error);
    };

    const fetchHistory = async () => {
        if (!projectId) return;
        const { data, error } = await supabase.rpc('get_marketing_performance_trend' as any, {
            p_project_id: projectId,
            p_days: 30
        });

        if (data) setPerformanceHistory(data);
        else if (error) console.error('Error fetching history:', error);
    };

    const fetchSummary = async () => {
        if (!projectId) return;
        const { data, error } = await supabase.rpc('get_marketing_performance_summary' as any, {
            p_project_id: projectId
        });

        if (data && data.length > 0) setSummary(data[0]);
        else if (error) console.error('Error fetching summary:', error);
    };

    const logPerformance = async (log: Omit<PerformanceLog, 'project_id'>) => {
        if (!projectId) return;
        setLoading(true);
        try {
            const { data, error } = await supabase.rpc('log_marketing_performance' as any, {
                p_project_id: projectId,
                p_log_date: log.log_date,
                p_amount_spent: log.amount_spent,
                p_leads_generated: log.leads_generated,
                p_reach: log.reach,
                p_impressions: log.impressions,
                p_likes: log.likes,
                p_views: log.views,
                p_clicks: log.clicks || 0,
                p_conversions: log.conversions || 0,
                p_notes: log.notes || ''
            });

            if (error) throw error;

            await fetchHistory();
            await fetchSummary();
            return data;
        } finally {
            setLoading(false);
        }
    };

    const saveConfig = async (newConfig: Omit<MarketingConfig, 'project_id'>) => {
        if (!projectId) return;
        setLoading(true);
        try {
            const { data, error } = await (supabase
                .from('paid_marketing_config' as any) as any)
                .upsert({
                    project_id: projectId,
                    ...newConfig,
                    updated_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) throw error;
            setConfig(data as MarketingConfig);
            return data;
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (projectId) {
            fetchConfig();
            fetchHistory();
            fetchSummary();
        }
    }, [projectId]);

    return {
        config,
        performanceHistory,
        summary,
        loading,
        logPerformance,
        saveConfig,
        refresh: () => Promise.all([fetchConfig(), fetchHistory(), fetchSummary()])
    };
};
