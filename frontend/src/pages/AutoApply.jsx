import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { autoApplyAPI } from '../api/autoApply';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Play,
    Key,
    Copy,
    RefreshCw,
    ExternalLink,
    Clock,
    CheckCircle,
    XCircle,
    Loader2,
    SkipForward,
    Filter,
    X
} from 'lucide-react';
import { format } from 'date-fns';

export default function AutoApply() {
    const { t } = useTranslation();
    const [queue, setQueue] = useState([]);
    const [loading, setLoading] = useState(true);
    const [extensionToken, setExtensionToken] = useState('');
    const [generatingToken, setGeneratingToken] = useState(false);
    const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });
    const [dateRange, setDateRange] = useState({ from: undefined, to: undefined });
    const [filterOpen, setFilterOpen] = useState(false);

    useEffect(() => {
        fetchQueue();
    }, []);

    const fetchQueue = async () => {
        try {
            setLoading(true);
            const response = await autoApplyAPI.getQueue();
            // Backend returns { success: true, queue: [...] }
            const queueData = response.queue || response || [];
            setQueue(Array.isArray(queueData) ? queueData : []);
        } catch (error) {
            console.error('Failed to fetch queue', error);
            toast.error(t('errors.queueLoadFailed'));
            setQueue([]);
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateExtensionToken = async () => {
        setGeneratingToken(true);
        try {
            const response = await fetch('/api/auth/extension-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to generate extension token');
            }

            const data = await response.json();
            setExtensionToken(data.token);
            toast.success(t('messages.tokenGenerated'));
        } catch (error) {
            console.error('Token generation error:', error);
            toast.error(t('errors.tokenGenerationFailed'));
        } finally {
            setGeneratingToken(false);
        }
    };

    const handleCopyToken = () => {
        navigator.clipboard.writeText(extensionToken);
        toast.success(t('messages.tokenCopied'));
    };

    const handleStartAutoApply = () => {
        toast.info(t('messages.extensionConnecting'));
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'completed':
            case 'applied':
                return <Badge className="bg-green-100 text-green-700 hover:bg-green-100"><CheckCircle className="w-3 h-3 mr-1" />{t('stats.applied')}</Badge>;
            case 'processing':
            case 'in_progress':
                return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100"><Loader2 className="w-3 h-3 mr-1 animate-spin" />{t('stats.processing')}</Badge>;
            case 'failed':
                return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />{t('stats.failed')}</Badge>;
            case 'skipped':
                return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100"><SkipForward className="w-3 h-3 mr-1" />{t('card.autoApply.skipped')}</Badge>;
            case 'pending':
            default:
                return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100"><Clock className="w-3 h-3 mr-1" />{t('stats.pending')}</Badge>;
        }
    };

    // Filter by date range
    const filteredQueue = React.useMemo(() => {
        const safeQueue = Array.isArray(queue) ? queue : [];
        if (!dateRange.from) return safeQueue;

        return safeQueue.filter(item => {
            if (!item.created_at) return false;
            const itemDate = new Date(item.created_at);
            // Set time to start of day for comparison
            const fromDate = new Date(dateRange.from);
            fromDate.setHours(0, 0, 0, 0);

            if (dateRange.to) {
                const toDate = new Date(dateRange.to);
                toDate.setHours(23, 59, 59, 999);
                return itemDate >= fromDate && itemDate <= toDate;
            }
            // If only 'from' is selected, show items from that single day
            const endOfDay = new Date(dateRange.from);
            endOfDay.setHours(23, 59, 59, 999);
            return itemDate >= fromDate && itemDate <= endOfDay;
        });
    }, [queue, dateRange]);

    // Sort function - handles backend field names (title, company_name)
    const sortedQueue = React.useMemo(() => {
        if (!sortConfig.key) return filteredQueue;

        return [...filteredQueue].sort((a, b) => {
            // Map frontend sort keys to backend field names
            let aVal, bVal;
            if (sortConfig.key === 'title') {
                aVal = a.title || '';
                bVal = b.title || '';
            } else if (sortConfig.key === 'company_name') {
                aVal = a.company_name || '';
                bVal = b.company_name || '';
            } else {
                aVal = a[sortConfig.key] || '';
                bVal = b[sortConfig.key] || '';
            }

            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredQueue, sortConfig]);

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return null;
        return sortConfig.direction === 'asc' ? '↑' : '↓';
    };

    const isFilterActive = dateRange.from != null;

    const handleClearFilter = () => {
        setDateRange({ from: undefined, to: undefined });
    };

    // Format the filter button label
    const getFilterLabel = () => {
        if (!dateRange.from) return 'Filter';
        if (!dateRange.to) return format(dateRange.from, 'dd/MM/yyyy');
        return `${format(dateRange.from, 'dd/MM/yyyy')} – ${format(dateRange.to, 'dd/MM/yyyy')}`;
    };

    // Stats — computed from the filtered queue so they reflect active filters
    const safeQueue = Array.isArray(filteredQueue) ? filteredQueue : [];
    const pendingCount = safeQueue.filter(q => q.status === 'pending').length;
    const processingCount = safeQueue.filter(q => ['processing', 'in_progress'].includes(q.status)).length;
    const completedCount = safeQueue.filter(q => ['completed', 'applied'].includes(q.status)).length;
    const failedCount = safeQueue.filter(q => q.status === 'failed').length;

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">{t('pages.autoApply.title')}</h1>
                    <p className="text-muted-foreground">{t('pages.autoApply.subtitle')}</p>
                </div>

                <Button
                    onClick={handleStartAutoApply}
                    className="bg-gradient-to-r from-blue-600 to-blue-600 hover:from-blue-700 hover:to-blue-700"
                >
                    <Play className="w-4 h-4 mr-2" />
                    {t('pages.autoApply.startButton')}
                </Button>
            </div>

            {/* Extension Token Section */}
            <div className="bg-gradient-to-r from-blue-50 to-blue-50 dark:from-blue-900/20 dark:to-blue-900/20 p-6 rounded-2xl border-2 border-blue-200 dark:border-blue-800 mb-8">
                <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                        <Key className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-grow">
                        <h3 className="text-lg font-semibold text-foreground mb-2">{t('pages.autoApply.extensionToken')}</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            {t('pages.autoApply.extensionTokenDescription')}
                        </p>

                        <div className="flex gap-3 mb-4">
                            <Button
                                onClick={handleGenerateExtensionToken}
                                disabled={generatingToken}
                            >
                                {generatingToken ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        {t('common.generating')}
                                    </>
                                ) : (
                                    <>
                                        <Key className="w-4 h-4 mr-2" />
                                        {t('pages.autoApply.generateExtensionToken')}
                                    </>
                                )}
                            </Button>

                            {extensionToken && (
                                <Button onClick={handleCopyToken} variant="secondary">
                                    <Copy className="w-4 h-4 mr-2" />
                                    {t('pages.autoApply.copyToken')}
                                </Button>
                            )}
                        </div>

                        {extensionToken && (
                            <div className="bg-background p-3 rounded-lg border">
                                <code className="text-xs text-muted-foreground break-all font-mono">
                                    {extensionToken}
                                </code>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-card p-5 rounded-xl shadow-sm border">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                            <Clock className="w-5 h-5 text-yellow-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{pendingCount}</p>
                            <p className="text-xs text-muted-foreground">{t('stats.pending')}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-card p-5 rounded-xl shadow-sm border">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Loader2 className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{processingCount}</p>
                            <p className="text-xs text-muted-foreground">{t('stats.processing')}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-card p-5 rounded-xl shadow-sm border">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{completedCount}</p>
                            <p className="text-xs text-muted-foreground">{t('stats.applied')}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-card p-5 rounded-xl shadow-sm border">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                            <XCircle className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{failedCount}</p>
                            <p className="text-xs text-muted-foreground">{t('stats.failed')}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Queue Table */}
            <div className="bg-card rounded-2xl shadow-sm border overflow-hidden">
                <div className="px-6 py-4 border-b flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold text-foreground">{t('pages.autoApply.applicationQueue')}</h2>
                        {isFilterActive && (
                            <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-xs">
                                {t('stats.results', { count: safeQueue.length })}
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Popover open={filterOpen} onOpenChange={setFilterOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className={isFilterActive ? 'border-blue-400 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800' : ''}
                                >
                                    <Filter className="w-4 h-4 mr-2" />
                                    {getFilterLabel()}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                                <div className="p-4 pb-2">
                                    <p className="text-sm text-muted-foreground leading-snug max-w-[280px]">
                                        {t('pages.autoApply.filterDescription')}
                                    </p>
                                </div>
                                <Calendar
                                    mode="range"
                                    selected={dateRange}
                                    onSelect={(range) => setDateRange(range || { from: undefined, to: undefined })}
                                    numberOfMonths={1}
                                    initialFocus
                                />
                                {isFilterActive && (
                                    <div className="p-3 pt-0 flex justify-center">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleClearFilter}
                                            className="text-muted-foreground hover:text-foreground w-full"
                                        >
                                            <X className="w-4 h-4 mr-2" />
                                            {t('filters.clearFilter')}
                                        </Button>
                                    </div>
                                )}
                            </PopoverContent>
                        </Popover>
                        <Button variant="outline" size="sm" onClick={fetchQueue}>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            {t('common.refresh')}
                        </Button>
                    </div>
                </div>

                {loading ? (
                    <div className="p-8 text-center text-muted-foreground">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                        {t('pages.autoApply.loadingQueue')}
                    </div>
                ) : safeQueue.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                        {t('pages.autoApply.noJobsInQueue')}
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => handleSort('title')}
                                >
                                    {t('pages.autoApply.jobTitle')} {getSortIcon('title')}
                                </TableHead>
                                <TableHead
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => handleSort('company_name')}
                                >
                                    {t('pages.autoApply.company')} {getSortIcon('company_name')}
                                </TableHead>
                                <TableHead>{t('pages.autoApply.source')}</TableHead>
                                <TableHead
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => handleSort('status')}
                                >
                                    {t('pages.autoApply.status')} {getSortIcon('status')}
                                </TableHead>
                                <TableHead
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => handleSort('created_at')}
                                >
                                    {t('pages.autoApply.added')} {getSortIcon('created_at')}
                                </TableHead>
                                <TableHead className="text-right">{t('pages.autoApply.link')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedQueue.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium max-w-[300px]">
                                        <span className="truncate block" title={item.title}>
                                            {item.title || t('common.untitled')}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {item.company_name || '-'}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="text-xs">
                                            {item.source || t('common.unknown')}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{getStatusBadge(item.status)}</TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        {item.created_at ? new Date(item.created_at).toLocaleDateString('nl-BE', {
                                            day: '2-digit',
                                            month: '2-digit',
                                            year: 'numeric'
                                        }) : '-'}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {item.job_url && (
                                            <a
                                                href={item.job_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-600 hover:text-blue-800"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                            </a>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </div>
        </div>
    );
}
