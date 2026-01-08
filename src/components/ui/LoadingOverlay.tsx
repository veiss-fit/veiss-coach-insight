import { Loader2 } from "lucide-react";

interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  fullScreen?: boolean;
}

export const LoadingOverlay = ({ 
  isLoading, 
  message = "Loading...", 
  fullScreen = false 
}: LoadingOverlayProps) => {
  if (!isLoading) return null;

  // fullScreen blocks the whole window, otherwise it blocks just the parent container
  const containerClasses = fullScreen
    ? "fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
    : "absolute inset-0 z-10 bg-background/50 backdrop-blur-[1px] rounded-lg";

  return (
    <div className={`${containerClasses} flex flex-col items-center justify-center`}>
      <div className="flex flex-col items-center gap-3 p-4 bg-background border shadow-lg rounded-lg">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted-foreground">{message}</p>
      </div>
    </div>
  );
};