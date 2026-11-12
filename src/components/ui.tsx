import {
  Component,
  forwardRef,
  type ButtonHTMLAttributes,
  type ImgHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  useId,
  useRef,
  useState,
} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AlertCircle, LoaderCircle, X } from 'lucide-react';

export function Button({
  children,
  variant = 'primary',
  busy,
  className = '',
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'text';
  busy?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`button button-${variant} ${className}`}
    >
      {busy && <LoaderCircle size={17} className="spin" aria-hidden="true" />}
      {children}
    </button>
  );
}
export const TextField = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & {
    label: string;
    error?: string;
    hint?: string;
    trailing?: ReactNode;
  }
>(function TextField({ label, error, hint, trailing, id, ...props }, ref) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <div className="field">
      <label htmlFor={fieldId}>{label}</label>
      <div className="input-wrap">
        <input
          {...props}
          id={fieldId}
          ref={ref}
          aria-invalid={!!error}
          aria-describedby={error || hint ? `${fieldId}-help` : undefined}
        />
        {trailing}
      </div>
      {(error || hint) && (
        <p className={error ? 'field-error' : 'field-hint'} id={`${fieldId}-help`}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
});
export function Alert({
  children,
  tone = 'error',
}: {
  children: ReactNode;
  tone?: 'error' | 'info';
}) {
  return (
    <div className={`alert alert-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <AlertCircle size={18} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}
export function PageState({
  title,
  children,
  retry,
}: {
  title: string;
  children?: ReactNode;
  retry?: () => unknown | Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <section className="page-state" aria-live="polite">
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {retry && (
        <Button
          variant="secondary"
          busy={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await retry();
            } finally {
              setBusy(false);
            }
          }}
        >
          ลองใหม่
        </Button>
      )}
    </section>
  );
}
export function RoomImage(props: ImgHTMLAttributes<HTMLImageElement>) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <div className={`image-fallback ${props.className ?? ''}`} role="img" aria-label={props.alt}>
      ไม่มีภาพตัวอย่าง
    </div>
  ) : (
    <img {...props} onError={() => setFailed(true)} />
  );
}
export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main>
        <PageState title="เปิดหน้านี้ไม่สำเร็จ">
          กรุณาโหลดหน้าใหม่ หากยังพบปัญหาให้ลองอีกครั้งภายหลัง
        </PageState>
        <div className="recovery-actions">
          <Button onClick={() => window.location.reload()}>โหลดหน้าใหม่</Button>
          <a href="/rooms">กลับไปหน้าห้องพัก</a>
        </div>
      </main>
    ) : (
      this.props.children
    );
  }
}
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  actions,
  busy = false,
  fallbackFocus,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  children?: ReactNode;
  actions: ReactNode;
  busy?: boolean;
  fallbackFocus?: () => HTMLElement | null;
}) {
  const opener = useRef<HTMLElement | null>(null);
  return (
    <Dialog.Root
      open={open}
      onOpenChange={value => {
        if (!value && !busy) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="modal-backdrop" />
        <Dialog.Content
          className="modal"
          onOpenAutoFocus={() => {
            opener.current =
              document.activeElement instanceof HTMLElement ? document.activeElement : null;
          }}
          onCloseAutoFocus={event => {
            event.preventDefault();
            if (opener.current?.isConnected && opener.current !== document.body) {
              const target = opener.current.matches(':disabled')
                ? opener.current
                    .closest('form')
                    ?.querySelector<HTMLElement>('button:not(:disabled)')
                : opener.current;
              (target ?? fallbackFocus?.())?.focus();
            } else {
              fallbackFocus?.()?.focus();
            }
          }}
          onEscapeKeyDown={event => {
            if (busy) event.preventDefault();
          }}
          onPointerDownOutside={event => {
            if (busy) event.preventDefault();
          }}
        >
          <Dialog.Title className="modal-title">{title}</Dialog.Title>
          <Dialog.Description className="modal-description">{description}</Dialog.Description>
          {children && <div className="modal-body">{children}</div>}
          <div className="modal-actions">{actions}</div>
          <Dialog.Close className="modal-close" aria-label="ปิดหน้าต่าง" disabled={busy}>
            <X size={20} />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
