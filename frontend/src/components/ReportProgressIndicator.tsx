import { LoadingSpinner } from './LoadingSpinner';

export type ReportStatus = 'idle' | 'pending' | 'processing' | 'completed' | 'failed';

interface ReportProgressIndicatorProps {
  status: ReportStatus;
  reportId?: string;
  progress?: number;
  className?: string;
}

export function ReportProgressIndicator({
  status,
  reportId,
  progress,
  className = ''
}: ReportProgressIndicatorProps) {
  if (status === 'idle') return null;

  const statusConfig = {
    pending: {
      icon: <LoadingSpinner size="sm" />,
      label: 'Pending...',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      textColor: 'text-yellow-800',
      badgeColor: 'bg-yellow-100 text-yellow-800'
    },
    processing: {
      icon: <LoadingSpinner size="sm" />,
      label: 'Generating Report...',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-800',
      badgeColor: 'bg-blue-100 text-blue-800'
    },
    completed: {
      icon: (
        <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      ),
      label: 'Ready to Share',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-800',
      badgeColor: 'bg-green-100 text-green-800'
    },
    failed: {
      icon: (
        <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
      ),
      label: 'Generation Failed',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-800',
      badgeColor: 'bg-red-100 text-red-800'
    }
  };

  const config = statusConfig[status];

  return (
    <div
      className={`${config.bgColor} border ${config.borderColor} rounded-lg p-4 flex items-start gap-3 ${className}`}
    >
      <div className="text-clinical-600 flex-shrink-0 mt-0.5">
        {config.icon}
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <p className={`font-medium ${config.textColor}`}>
            {config.label}
          </p>
          {reportId && (
            <span className={`${config.badgeColor} px-2 py-1 rounded text-xs font-mono`}>
              {reportId}
            </span>
          )}
        </div>
        {progress !== undefined && progress > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-clinical-600">Progress</span>
              <span className="text-xs font-medium text-clinical-600">{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-clinical-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
