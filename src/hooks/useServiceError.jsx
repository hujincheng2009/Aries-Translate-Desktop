import { useServiceConfigDialog } from '@/components/app/ServiceConfigDialog';

// Keep credentials out of the expandable error details, including legacy providers.
export function useServiceError(config) {
    const { reportError } = useServiceConfigDialog();
    return (error) => reportError(error, config);
}
