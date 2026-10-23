import { useEffect } from 'react';
import * as Sentry from '@sentry/react-native';

export function useModalBreadcrumb(name: string, visible: boolean) {
  useEffect(() => {
    Sentry.addBreadcrumb({
      category: 'modal',
      message: `${name} ${visible ? 'opened' : 'closed'}`,
      level: 'info',
    });
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps
}
