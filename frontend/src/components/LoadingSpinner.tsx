export interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  fullScreen?: boolean;
}

export function LoadingSpinner({
  message = 'Loading...',
  size = 'md',
  className = '',
  fullScreen = false
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4 border-b-1',
    md: 'h-8 w-8 border-b-2',
    lg: 'h-12 w-12 border-b-2'
  };

  const spinner = (
    <div className={`inline-block animate-spin rounded-full ${sizeClasses[size]} border-clinical-600 ${className}`} />
  );

  if (fullScreen) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          {spinner}
          {message && <p className="text-clinical-600 mt-4">{message}</p>}
        </div>
      </div>
    );
  }

  return spinner;
}
