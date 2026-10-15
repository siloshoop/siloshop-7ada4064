import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

// Errors stay longer so they can be read; success/info messages auto-hide after 3s.
const ERROR_MS = 7000;
type SonnerError = typeof toast.error & { __patched?: boolean };
if (!(toast.error as SonnerError).__patched) {
  const original = toast.error;
  const patched = ((message, data) => original(message, { duration: ERROR_MS, ...data })) as SonnerError;
  patched.__patched = true;
  toast.error = patched;
}

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      duration={3000}
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
