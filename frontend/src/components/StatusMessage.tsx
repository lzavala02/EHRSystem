import { ReactNode } from 'react';

export type StatusMessageType = 'error' | 'success' | 'info' | 'warning';

interface StatusMessageProps {
  type: StatusMessageType;
  title?: string;
  message: string;
  details?: string | ReactNode;
  onDismiss?: () => void;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function StatusMessage({
  type,
  title,
  message,
  details,
  onDismiss,
  action,
  className = ''
}: StatusMessageProps) {
  const typeConfig = {
    error: {
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-800',
      detailsColor: 'text-red-700',
      icon: (
        <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
      ),
      defaultTitle: 'Error'
    },
    success: {
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-800',
      detailsColor: 'text-green-700',
      icon: (
        <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      ),
      defaultTitle: 'Success'
    },
    info: {
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-800',
      detailsColor: 'text-blue-700',
      icon: (
        <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zm-11-1a1 1 0 11-2 0 1 1 0 012 0zM8 8a1 1 0 100-2 1 1 0 000 2zm5-1a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
        </svg>
      ),
      defaultTitle: 'Information'
    },
    warning: {
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      textColor: 'text-yellow-800',
      detailsColor: 'text-yellow-700',
      icon: (
        <svg className="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      ),
      defaultTitle: 'Warning'
    }
  };

  const config = typeConfig[type];

  return (
    <div
      className={`${config.bgColor} border ${config.borderColor} rounded-lg p-4 flex items-start gap-3 ${className}`}
    >
      <div className="flex-shrink-0 mt-0.5">
        {config.icon}
      </div>
      <div className="flex-1 min-w-0">
        {title || message && (
          <>
            {title && <p className={`font-semibold ${config.textColor}`}>{title}</p>}
            <p className={`${config.textColor} text-sm ${title ? 'mt-1' : ''}`}>
              {message}
            </p>
          </>
        )}
        {!title && !message && (
          <p className={`font-semibold ${config.textColor}`}>{config.defaultTitle}</p>
        )}
        {details && (
          <div className={`text-sm mt-2 ${config.detailsColor}`}>
            {typeof details === 'string' ? <p>{details}</p> : details}
          </div>
        )}
        {action && (
          <div className="mt-3">
            <button
              onClick={action.onClick}
              className={`text-sm font-medium ${config.textColor} hover:underline`}
            >
              {action.label}
            </button>
          </div>
        )}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className={`flex-shrink-0 ${config.textColor} hover:opacity-70`}
          aria-label="Dismiss message"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      )}
    </div>
  );
}
