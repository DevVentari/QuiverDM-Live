import * as React from 'react';

type ToastProps = {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
};

type ToastActionElement = React.ReactElement;

export const useToast = () => {
  const [toasts, setToasts] = React.useState<ToastProps[]>([]);

  const toast = React.useCallback((props: ToastProps) => {
    // For now, just console.log - you can implement a proper toast system later
    console.log('[Toast]', props.title, props.description);

    setToasts((prev) => [...prev, props]);

    // Auto dismiss after 3 seconds
    setTimeout(() => {
      setToasts((prev) => prev.slice(1));
    }, 3000);
  }, []);

  return {
    toast,
    toasts,
  };
};
