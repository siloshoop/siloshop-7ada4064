import { useEffect, useState } from "react";
import { FileText, Download, Loader2 } from "lucide-react";
import { getChatFileUrl, formatBytes, type ChatAttachment } from "@/lib/chatFiles";

/** Renders a private chat attachment through a short-lived signed URL. */
const ChatAttachmentView = ({ attachment }: { attachment: ChatAttachment }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    getChatFileUrl(attachment.storage_path).then((u) => {
      if (!active) return;
      if (u) setUrl(u);
      else setFailed(true);
    });
    return () => {
      active = false;
    };
  }, [attachment.storage_path]);

  const isImage = attachment.kind === "image" || attachment.mime_type?.startsWith("image/");

  if (failed) {
    return <p className="text-xs opacity-70">تعذر تحميل المرفق</p>;
  }

  if (!url) {
    return (
      <div className="flex h-16 items-center justify-center rounded-md bg-background/30">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  if (isImage) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block">
        <img
          src={url}
          alt={attachment.file_name}
          loading="lazy"
          className="max-h-64 w-auto max-w-full rounded-md object-cover"
        />
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-md bg-background/30 px-3 py-2 text-sm hover:bg-background/50"
    >
      <FileText className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{attachment.file_name}</span>
      <span className="text-xs opacity-70">{formatBytes(attachment.size_bytes)}</span>
      <Download className="h-4 w-4 shrink-0" />
    </a>
  );
};

export default ChatAttachmentView;
