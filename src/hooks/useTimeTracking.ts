import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseTimeTrackingOptions {
    contentItemId: string | null;
    enabled?: boolean;
    onError?: (error: Error) => void;
}

interface TimeLog {
    id: string;
    start_time: string;
    elapsed_seconds: number;
}

/**
 * Automatic time tracking hook
 * Starts tracking when component mounts and content item is available
 * Stops tracking when component unmounts or content item changes
 */
export const useTimeTracking = ({
    contentItemId,
    enabled = true,
    onError
}: UseTimeTrackingOptions) => {
    const [isTracking, setIsTracking] = useState(false);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [timeLogId, setTimeLogId] = useState<string | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const startTimeRef = useRef<Date | null>(null);

    // Start tracking
    const startTracking = async () => {
        if (!contentItemId || !enabled) return;

        try {
            const { data, error } = await supabase.rpc('start_time_tracking' as any, {
                p_content_item_id: contentItemId
            });

            if (error) throw error;

            if (data) {
                setTimeLogId(data);
                setIsTracking(true);
                startTimeRef.current = new Date();

                // Start interval to update elapsed time
                intervalRef.current = setInterval(() => {
                    if (startTimeRef.current) {
                        const elapsed = Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000);
                        setElapsedSeconds(elapsed);
                    }
                }, 1000);
            }
        } catch (error) {
            console.error('Failed to start time tracking:', error);
            onError?.(error as Error);
        }
    };

    // Stop tracking
    const stopTracking = async () => {
        if (!contentItemId) return;

        try {
            // Clear interval
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }

            const { error } = await supabase.rpc('stop_time_tracking' as any, {
                p_content_item_id: contentItemId
            });

            if (error) throw error;

            setIsTracking(false);
            setTimeLogId(null);
            startTimeRef.current = null;
        } catch (error) {
            console.error('Failed to stop time tracking:', error);
            onError?.(error as Error);
        }
    };

    // Get active time log
    const getActiveLog = async () => {
        if (!contentItemId) return null;

        try {
            const { data, error } = await supabase.rpc('get_active_time_log' as any, {
                p_content_item_id: contentItemId
            });

            if (error) throw error;

            if (data && data.length > 0) {
                const log = data[0] as TimeLog;
                setTimeLogId(log.id);
                setElapsedSeconds(log.elapsed_seconds);
                setIsTracking(true);
                startTimeRef.current = new Date(Date.now() - (log.elapsed_seconds * 1000));

                // Start interval
                intervalRef.current = setInterval(() => {
                    if (startTimeRef.current) {
                        const elapsed = Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000);
                        setElapsedSeconds(elapsed);
                    }
                }, 1000);

                return log;
            }

            return null;
        } catch (error) {
            console.error('Failed to get active time log:', error);
            onError?.(error as Error);
            return null;
        }
    };

    // Auto-start tracking when content item is available
    useEffect(() => {
        if (contentItemId && enabled) {
            // Check if there's already an active log
            getActiveLog().then((activeLog) => {
                // If no active log, start tracking
                if (!activeLog) {
                    startTracking();
                }
            });
        }

        // Cleanup: stop tracking when component unmounts or content item changes
        return () => {
            if (isTracking) {
                stopTracking();
            }
        };
    }, [contentItemId, enabled]);

    // Format elapsed time as HH:MM:SS
    const formatElapsedTime = () => {
        const hours = Math.floor(elapsedSeconds / 3600);
        const minutes = Math.floor((elapsedSeconds % 3600) / 60);
        const seconds = elapsedSeconds % 60;

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    return {
        isTracking,
        elapsedSeconds,
        formattedTime: formatElapsedTime(),
        timeLogId,
        startTracking,
        stopTracking,
        getActiveLog
    };
};

/**
 * Hook to get time spent on a content item by role
 */
export const useContentTimeByRole = (contentItemId: string | null) => {
    const [timeByRole, setTimeByRole] = useState<Array<{
        role: string;
        total_seconds: number;
        total_hours: number;
    }>>([]);
    const [loading, setLoading] = useState(false);

    const fetchTimeByRole = async () => {
        if (!contentItemId) return;

        setLoading(true);
        try {
            const { data, error } = await supabase.rpc('get_time_by_role_for_content' as any, {
                p_content_item_id: contentItemId
            });

            if (error) throw error;
            setTimeByRole(data || []);
        } catch (error) {
            console.error('Failed to fetch time by role:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTimeByRole();
    }, [contentItemId]);

    return { timeByRole, loading, refetch: fetchTimeByRole };
};

/**
 * Hook to get time spent on a project by role
 */
export const useProjectTimeByRole = (projectId: string | null) => {
    const [timeByRole, setTimeByRole] = useState<Array<{
        role: string;
        total_seconds: number;
        total_hours: number;
        content_items_count: number;
    }>>([]);
    const [loading, setLoading] = useState(false);

    const fetchTimeByRole = async () => {
        if (!projectId) return;

        setLoading(true);
        try {
            const { data, error } = await supabase.rpc('get_time_by_role_for_project' as any, {
                p_project_id: projectId
            });

            if (error) throw error;
            setTimeByRole(data || []);
        } catch (error) {
            console.error('Failed to fetch project time by role:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTimeByRole();
    }, [projectId]);

    return { timeByRole, loading, refetch: fetchTimeByRole };
};
