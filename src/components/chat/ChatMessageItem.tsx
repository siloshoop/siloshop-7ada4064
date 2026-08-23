import { useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { ar } from "date-fns/locale";
import {
  Check,
  CheckCheck,
  Copy,
  CornerUpLeft,
  Forward,
  MoreVertical,
  Pencil,
  Pin,
  PinOff,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import ChatAttachmentView from "./ChatAttachmentView";
import type { ChatMessage } from "@/hooks/useChatThread";

const SYSTEM_TYPES = ["system", "order_update", "return_update", "admin_notice"];
const EDIT_WINDOW_MS = 15 * 60 * 1000;

interface Props {
  message: ChatMessage;
  isMine: boolean;
  onReply: (m: ChatMessage) => void;
  onForward: (m: ChatMessage) => void;
  onEdit: (id: string, content: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onPin: (id: string, pin: boolean) => Promise<boolean>;
  onCopy: (text: string) => void;
}

const ChatMessageItem = ({
  message,
  isMine,
  onReply,
  onForward,
  onEdit,
  onDelete,
  onPin,
  onCopy,
}: Props) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content ?? "");

  const removed = message.is_deleted || message.deleted_by_sender;
  const isSystem = SYSTEM_TYPES.includes(message.message_type);
  const canEdit =
    isMine &&
    !removed &&
    message.message_type === "text" &&
    Date.now() - new Date(message.created_at).getTime() < EDIT_WINDOW_MS;

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="flex max-w-[85%] items-start gap-2 rounded-lg border border-border bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div>
            <p className="whitespace-pre-wrap">{message.content}</p>
            <span className="opacity-70">
              {format(new Date(message.created_at), "d MMM HH:mm", { locale: ar })}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("group flex gap-1", isMine ? "justify-end" : "justify-start")}>
      {isMine && !removed && (
        <MessageMenu
          message={message}
          isMine={isMine}
          canEdit={canEdit}
          onReply={onReply}
          onForward={onForward}
          onDelete={onDelete}
          onPin={onPin}
          onCopy={onCopy}
          onStartEdit={() => {
            setDraft(message.content ?? "");
            setEditing(true);
          }}
        />
      )}

      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm sm:max-w-[70%]",
          isMine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
          removed && "italic opacity-70",
        )}
      >
        {message.is_pinned && (
          <div className="mb-1 flex items-center gap-1 text-[11px] opacity-80">
            <Pin className="h-3 w-3" /> مثبّتة
          </div>
        )}

        {message.forwarded_from_id && (
          <div className="mb-1 flex items-center gap-1 text-[11px] opacity-80">
            <Forward className="h-3 w-3" /> رسالة محوّلة
          </div>
        )}

        {message.reply_to_id && message.reply_preview && (
          <div
            className={cn(
              "mb-2 rounded-md border-s-2 px-2 py-1 text-xs",
              isMine ? "border-primary-foreground/50 bg-primary-foreground/10" : "border-primary/60 bg-background/50",
            )}
          >
            <span className="line-clamp-2">{message.reply_preview}</span>
          </div>
        )}

        {editing ? (
          <div className="space-y-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              className="bg-background text-foreground"
              maxLength={4000}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  if (await onEdit(message.id, draft)) setEditing(false);
                }}
              >
                حفظ
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                إلغاء
              </Button>
            </div>
          </div>
        ) : (
          <>
            {message.attachments?.length > 0 && (
              <div className="mb-2 space-y-2">
                {message.attachments.map((a) => (
                  <ChatAttachmentView key={a.id} attachment={a} />
                ))}
              </div>
            )}
            {message.content && <p className="whitespace-pre-wrap break-words">{message.content}</p>}
          </>
        )}

        <div className="mt-1 flex items-center justify-end gap-1 text-[11px] opacity-70">
          {message.edited_at && <span>معدّلة</span>}
          <span>
            {formatDistanceToNow(new Date(message.created_at), { addSuffix: true, locale: ar })}
          </span>
          {isMine &&
            !removed &&
            (message.is_read ? (
              <CheckCheck className="h-3.5 w-3.5" aria-label="تمت القراءة" />
            ) : (
              <Check className="h-3.5 w-3.5" aria-label="تم التسليم" />
            ))}
        </div>
      </div>

      {!isMine && !removed && (
        <MessageMenu
          message={message}
          isMine={isMine}
          canEdit={false}
          onReply={onReply}
          onForward={onForward}
          onDelete={onDelete}
          onPin={onPin}
          onCopy={onCopy}
          onStartEdit={() => undefined}
        />
      )}
    </div>
  );
};

const MessageMenu = ({
  message,
  isMine,
  canEdit,
  onReply,
  onForward,
  onDelete,
  onPin,
  onCopy,
  onStartEdit,
}: {
  message: ChatMessage;
  isMine: boolean;
  canEdit: boolean;
  onReply: (m: ChatMessage) => void;
  onForward: (m: ChatMessage) => void;
  onDelete: (id: string) => Promise<boolean>;
  onPin: (id: string, pin: boolean) => Promise<boolean>;
  onCopy: (text: string) => void;
  onStartEdit: () => void;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 self-center opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        aria-label="خيارات الرسالة"
      >
        <MoreVertical className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align={isMine ? "start" : "end"} className="w-44">
      <DropdownMenuItem onClick={() => onReply(message)}>
        <CornerUpLeft className="me-2 h-4 w-4" /> رد
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onForward(message)}>
        <Forward className="me-2 h-4 w-4" /> تحويل
      </DropdownMenuItem>
      {message.content && (
        <DropdownMenuItem onClick={() => onCopy(message.content ?? "")}>
          <Copy className="me-2 h-4 w-4" /> نسخ
        </DropdownMenuItem>
      )}
      <DropdownMenuItem onClick={() => void onPin(message.id, !message.is_pinned)}>
        {message.is_pinned ? (
          <>
            <PinOff className="me-2 h-4 w-4" /> إزالة التثبيت
          </>
        ) : (
          <>
            <Pin className="me-2 h-4 w-4" /> تثبيت
          </>
        )}
      </DropdownMenuItem>
      {canEdit && (
        <DropdownMenuItem onClick={onStartEdit}>
          <Pencil className="me-2 h-4 w-4" /> تعديل
        </DropdownMenuItem>
      )}
      {isMine && (
        <DropdownMenuItem className="text-destructive" onClick={() => void onDelete(message.id)}>
          <Trash2 className="me-2 h-4 w-4" /> حذف
        </DropdownMenuItem>
      )}
    </DropdownMenuContent>
  </DropdownMenu>
);

export default ChatMessageItem;
