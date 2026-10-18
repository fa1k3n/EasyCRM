import {Component, type ReactNode} from 'react';
import {t} from '../i18n';

/* An error in one part of the page shows a message there instead of leaving the whole page empty. */
export default class ErrorBoundary extends Component<{children: ReactNode}, {failed: boolean}> {
  state = {failed: false};

  static getDerivedStateFromError() {
    return {failed: true};
  }

  componentDidCatch(error: unknown) {
    // Never log customer data; the error message is enough to find the cause
    console.error('Part of the page failed:', error instanceof Error ? error.message : error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="rounded-2xl bg-tally-soft p-4 text-tally">
        <strong className="font-semibold">{t('somethingWrong')}</strong>
        <p className="mt-1 text-sm">{t('somethingWrongHint')}</p>
      </div>
    );
  }
}
