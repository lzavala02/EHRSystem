interface ErrorAlertProps {
  message: string;
  onDismiss?: () => void;
}

export function ErrorAlert({ message, onDismiss }: ErrorAlertProps) {
  return (
    <div className="bg-health-danger text-white p-4 rounded-lg mb-4 flex items-center justify-between">
      <span>{message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="ml-4 font-bold hover:opacity-75"
        >
          ✕
        </button>
      )}
    </div>
  );
}

interface SuccessAlertProps {
  message: string;
  onDismiss?: () => void;
}

export function SuccessAlert({ message, onDismiss }: SuccessAlertProps) {
  return (
    <div className="bg-health-success text-white p-4 rounded-lg mb-4 flex items-center justify-between">
      <span>{message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="ml-4 font-bold hover:opacity-75"
        >
          ✕
        </button>
      )}
    </div>
  );
}
