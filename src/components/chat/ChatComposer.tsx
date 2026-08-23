import { useRef, useState } from "react";
import { Loader2, Paperclip, Send, Smile, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ALLOWED_CHAT_MIME, formatBytes } from "@/lib/chatFiles";
import type { ChatMessage } from "@/hooks/useChatThread";

const EMOJIS = [
  "😀","😁","😂","🤣","😊","😍","🥳","😉","🤝","👍","👌","🙏","❤️","🔥","✅","❌",
  "📦","🚚","💰","🧾","⭐","⏰","📷","📎","🤔","😢","😡","🎉","🛒","💬","📍","🙌",
];

interface Props {
  disabled: boolean;
  sending: boolean;
  replyTo: ChatMessage | null;
  onCancelReply: () => void;
  onTyping: () => void;
  onSend: (text: string, files: File[], replyToId: string | null) => Promise<boolean>;
}

const ChatComposer = ({ disabled, sending, replyTo, onCancelReply, onTyping, onSend }: Props) => {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const submit = async () => {
    if (disabled || sending) return;
    if (!text.trim() && files.length === 0) return;
    const ok = await onSend(text, files, replyTo?.id ?? null);
    if (ok) {
      setText("");
      setFiles([]);
      onCancelReply();
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  return (
    <div className="border-t bg-card p-3">
      {replyTo && (
        <div className="mb-2 flex items-start gap-2 rounded-md border-s-2 border-primary bg-muted/60 px-3 py-2 text-xs">
          <span className="line-clamp-2 flex-1">
            رد على: {replyTo.content || replyTo.file_name || "مرفق"}
          </span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onCancelReply} aria-label="إلغاء الرد">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {files.map((f, i) => (
            <div key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-md bg-muted px-2 py-1 text-xs">
              <span className="max-w-[160px] truncate">{f.name}</span>
              <span className="opacity-70">{formatBytes(f.size)}</span>
              <button
                type="button"
                onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                aria-label="إزالة الملف"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showEmoji && (
        <div className="mb-2 grid grid-cols-8 gap-1 rounded-md border bg-popover p-2 sm:grid-cols-16">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              className="rounded p-1 text-lg hover:bg-muted"
              onClick={() => setText((t) => t + e)}
            >
              {e}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <input
          ref={fileInput}
          type="file"
          multiple
          className="hidden"
          accept={ALLOWED_CHAT_MIME.join(",")}
          onChange={(e) => {
            const picked = Array.from(e.target.files || []);
            setFiles((prev) => [...prev, ...picked].slice(0, 5));
          }}
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => fileInput.current?.click()}
          disabled={disabled || sending}
          aria-label="إرفاق ملف"
        >
          <Paperclip className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowEmoji((v) => !v)}
          disabled={disabled}
          aria-label="الرموز التعبيرية"
        >
          <Smile className="h-5 w-5" />
        </Button>
        <Textarea
          value={text}
          rows={1}
          maxLength={4000}
          placeholder={disabled ? "الإرسال غير متاح" : "اكتب رسالة..."}
          disabled={disabled || sending}
          className="max-h-32 min-h-[42px] flex-1 resize-none"
          onChange={(e) => {
            setText(e.target.value);
            onTyping();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
        />
        <Button
          onClick={() => void submit()}
          disabled={disabled || sending || (!text.trim() && files.length === 0)}
          size="icon"
          aria-label="إرسال"
        >
          {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        </Button>
      </div>
    </div>
  );
};

export default ChatComposer;
