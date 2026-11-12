import { Button, Modal } from './ui';

export function SuccessDialog({
  open,
  onClose,
  title,
  description,
  fallbackFocus,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  fallbackFocus?: () => HTMLElement | null;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      fallbackFocus={fallbackFocus}
      actions={<Button onClick={onClose}>ตกลง</Button>}
    />
  );
}
